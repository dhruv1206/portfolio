import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "isomorphic-dompurify";
import { getArticle } from "@/app/lib/devto";

export async function generateMetadata(props) {
    const { slug } = await props.params;
    const blog = await getArticle(slug);
    if (!blog) return { title: "Article not found" };
    return {
        title: blog.title,
        description: blog.description,
        alternates: { canonical: `/blog/${slug}` },
        openGraph: { title: blog.title, description: blog.description, type: "article", images: blog.cover_image ? [{ url: blog.cover_image }] : undefined },
    };
}

export default async function BlogDetails(props) {
    const { slug } = await props.params;
    const blog = await getArticle(slug);
    if (!blog) notFound();

    // dev.to publishes our own content, but the HTML is sanitised anyway
    // so a future source cannot inject anything we would not expect.
    const sanitizedBody = DOMPurify.sanitize(blog.body_html, { USE_PROFILES: { html: true } });
    const date = new Date(blog.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

    return (
        <article className="rp" style={{ maxWidth: 820 }}>
            <Link href="/blog" className="rp-back">← All articles</Link>
            <header className="rp-head" style={{ marginBottom: 36 }}>
                <p className="rp-eyebrow"><b>{date}</b>{blog.reading_time_minutes ? <span>{blog.reading_time_minutes} min read</span> : null}<i>dev.to</i></p>
                <h1 className="rp-h1" style={{ fontSize: "clamp(32px, 4.6vw, 58px)" }}>{blog.title}</h1>
                {blog.description && <p className="rp-lede">{blog.description}</p>}
            </header>
            <div className="prose" dangerouslySetInnerHTML={{ __html: sanitizedBody }} />
            <footer className="cell" style={{ marginTop: 40 }}>
                <div className="cell-b btns">
                    <span className="rp-note">Originally published on dev.to.</span>
                    <a href={blog.url} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-sm" style={{ marginLeft: "auto" }}>Discuss on dev.to ↗</a>
                </div>
            </footer>
        </article>
    );
}
