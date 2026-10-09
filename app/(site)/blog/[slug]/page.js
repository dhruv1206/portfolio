import Link from "next/link";
import { notFound } from "next/navigation";
import sanitizeHtml from "sanitize-html";
import { getArticle } from "@/app/lib/devto";

// dev.to renders the article body for us; it is sanitised again here
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
    const blog = await getArticle(slug);
    if (!blog) return { title: "Article not found" };
    return {
        title: blog.title,
        description: isFiller(blog.description) ? undefined : blog.description,
        alternates: { canonical: `/blog/${slug}` },
        openGraph: { title: blog.title, description: isFiller(blog.description) ? undefined : blog.description, type: "article", images: blog.cover_image ? [{ url: blog.cover_image }] : undefined },
    };
}

export default async function BlogDetails(props) {
    const { slug } = await props.params;
    const blog = await getArticle(slug);
    if (!blog) notFound();

    let body = "";
    try { body = sanitizeHtml(blog.body_html || "", SANITIZE).trim(); } catch { body = ""; }
    const date = new Date(blog.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    return (
        <article className="rp" style={{ maxWidth: 820 }}>
            <Link href="/blog" className="rp-back">← All articles</Link>
            <header className="rp-head" style={{ marginBottom: 36 }}>
                <p className="rp-eyebrow"><b>{date}</b>{blog.reading_time_minutes ? <span>{blog.reading_time_minutes} min read</span> : null}<i>dev.to</i></p>
                <h1 className="rp-h1" style={{ fontSize: "clamp(32px, 4.6vw, 58px)" }}>{blog.title}</h1>
                {!isFiller(blog.description) && <p className="rp-lede">{blog.description}</p>}
            </header>
            {body ? (
                <div className="prose" dangerouslySetInnerHTML={{ __html: body }} />
            ) : (
                <div className="cell"><div className="cell-h"><b>No body yet</b></div><div className="cell-b"><p className="rp-p" style={{ margin: 0 }}>This post has a title and nothing else so far. When the text lands on dev.to it appears here within fifteen minutes.</p></div></div>
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
