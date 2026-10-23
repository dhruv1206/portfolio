import Link from "next/link";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { personalData } from "@/utils/data/personal-data";
import { getArticle } from "@/app/lib/devto";
import { blogUrl } from "@/app/lib/origins";
import { BLOG_NAME, FEED_LINK, ORIGIN, abs, ogImage, pageMetadata, summary } from "@/app/lib/seo";
import { JsonLd, PERSON_ID, breadcrumbs, personSummary } from "@/app/lib/structured-data";

// One article, read live from dev.to (app/lib/devto.js keeps it within
// 10 seconds). dev.to renders the body for us; it is sanitised again here
// with a pure-JavaScript sanitiser (no jsdom: a DOM shim cannot load
// inside the Vercel function) so a future source cannot inject anything.
const SANITIZE = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "figure", "figcaption", "details", "summary", "video", "source", "del", "ins", "sup", "sub", "kbd"]),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        a: ["href", "name", "target", "rel", "title"],
        img: ["src", "srcset", "alt", "width", "height", "loading"],
        video: ["src", "controls", "width", "height", "poster"],
        source: ["src", "type"],
        code: ["class"], pre: ["class"], span: ["class"], div: ["class"], p: ["class"],
        "*": ["id"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true) },
};
const isFiller = (text) => !text || /^A post by /i.test(text);

export async function generateMetadata(props) {
    const { slug } = await props.params;
    const res = await getArticle(slug);
    if (res.status === "missing") return { title: "Article not found" };
    // dev.to did not answer: the page says so, and must not be indexed saying it.
    if (res.status !== "ok") return { title: "Blog", alternates: { canonical: blogUrl(slug) }, robots: { index: false, follow: true } };
    const blog = res.data;
    return pageMetadata({
        title: blog.title,
        description: describe(blog),
        url: blogUrl(slug),
        image: blog.cover_image || ogImage({ title: blog.title, sub: BLOG_NAME, path: `/blog/${slug}` }),
        type: "article",
        openGraph: { publishedTime: blog.published_at, modifiedTime: blog.edited_at || blog.published_at, authors: [`${ORIGIN}/`], tags: tagsOf(blog) },
        alternates: FEED_LINK,
    });
}

// dev.to's own description, or the opening of the article when that is the
// "A post by …" filler.
function describe(blog) {
    if (!isFiller(blog.description)) return blog.description;
    const text = sanitizeHtml(blog.body_html || "", { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
    return text ? summary(text) : `${blog.title}, on ${BLOG_NAME}.`;
}

const tagsOf = (blog) => (Array.isArray(blog.tags) ? blog.tags : typeof blog.tag_list === "string" ? blog.tag_list.split(",") : Array.isArray(blog.tag_list) ? blog.tag_list : []).map((t) => String(t).trim()).filter(Boolean);

export default async function BlogDetails(props) {
    const { slug } = await props.params;
    const res = await getArticle(slug);
    if (res.status === "missing") notFound();
    if (res.status !== "ok") return <Unavailable slug={slug} />;
    const blog = res.data;

    let body = "";
    try { body = sanitizeHtml(blog.body_html || "", SANITIZE).trim(); } catch { body = ""; }
    const date = new Date(blog.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    const url = abs(blogUrl(slug));
    return (
        <article className="rp" style={{ maxWidth: 820 }}>
            <JsonLd graph={[
                {
                    "@type": "BlogPosting",
                    "@id": `${url}#article`,
                    url,
                    mainEntityOfPage: url,
                    headline: blog.title,
                    description: describe(blog),
                    image: abs(blog.cover_image || ogImage({ title: blog.title, sub: BLOG_NAME, path: `/blog/${slug}` })),
                    datePublished: blog.published_at,
                    dateModified: blog.edited_at || blog.published_at,
                    author: { "@id": PERSON_ID },
                    publisher: { "@id": PERSON_ID },
                    isPartOf: { "@id": `${abs(blogUrl())}#blog` },
                    keywords: tagsOf(blog).join(", "),
                    inLanguage: "en",
                    // The same article where it was first published.
                    sameAs: blog.url,
                },
                personSummary(),
                breadcrumbs([["dhruuv.me", "/"], ["Blog", blogUrl()], [blog.title, blogUrl(slug)]]),
            ]} />
            <Link href={blogUrl()} className="rp-back">← All articles</Link>
            <header className="rp-head" style={{ marginBottom: 36 }}>
                <p className="rp-eyebrow"><b><time dateTime={blog.published_at}>{date}</time></b>{blog.reading_time_minutes ? <span>{blog.reading_time_minutes} min read</span> : null}<i>dev.to</i></p>
                <h1 className="rp-h1" style={{ fontSize: "clamp(32px, 4.6vw, 58px)" }}>{blog.title}</h1>
                {!isFiller(blog.description) && <p className="rp-lede">{blog.description}</p>}
            </header>
            {body ? (
                <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
            ) : (
                <div className="cell"><div className="cell-h"><b>No body yet</b></div><div className="cell-b"><p className="rp-p" style={{ margin: 0 }}>This post has a title and nothing else so far. When the text lands on dev.to it appears here within seconds.</p></div></div>
            )}
            <footer className="cell" style={{ marginTop: 40 }}>
                <div className="cell-b btns">
                    <span className="rp-note">Originally published on dev.to.</span>
                    <a href={blog.url} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-sm" style={{ marginLeft: "auto" }}>Discuss on dev.to ↗</a>
                </div>
            </footer>
        </article>
    );
}

// dev.to failed or is throttling and there is no earlier copy in memory.
// The article may well exist, so this is not a 404.
function Unavailable({ slug }) {
    return (
        <article className="rp" data-http-status="503" style={{ maxWidth: 820 }}>
            <Link href={blogUrl()} className="rp-back">← All articles</Link>
            <div className="cell">
                <div className="cell-h"><b>dev.to is not answering</b></div>
                <div className="cell-b btns">
                    <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>This article lives on dev.to, and it did not respond just now. Reload in a moment, or read it there.</p>
                    <a href={`https://dev.to/${personalData.devUsername}/${encodeURIComponent(slug)}`} target="_blank" rel="noopener noreferrer" className="mbtn">Read on dev.to ↗</a>
                </div>
            </div>
        </article>
    );
}
