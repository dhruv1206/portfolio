import Image from "next/image";
import Link from "next/link";

// One article from dev.to, linking to the mirrored copy at /blog/[slug].
function BlogCard({ blog }) {
    const date = blog.published_at ? new Date(blog.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
    const tags = Array.isArray(blog.tag_list) ? blog.tag_list : typeof blog.tag_list === "string" ? blog.tag_list.split(",").map((t) => t.trim()).filter(Boolean) : [];
    // dev.to fills an empty description with "A post by <name>"; that is not a summary.
    const summary = blog.description && !/^A post by /i.test(blog.description) ? blog.description : "";
    return (
        <Link href={`/blog/${blog.slug}`} className="cell" style={{ display: "flex", flexDirection: "column" }}>
            {blog.cover_image && (
                <div style={{ position: "relative", aspectRatio: "2 / 1", borderBottom: "1px solid var(--line)" }}>
                    <Image src={blog.cover_image} alt="" fill sizes="(min-width: 960px) 30vw, (min-width: 600px) 50vw, 100vw" style={{ objectFit: "cover" }} />
                </div>
            )}
            <div className="cell-h"><span>{date}</span>{blog.reading_time_minutes ? <span>{blog.reading_time_minutes} min read</span> : null}{typeof blog.public_reactions_count === "number" && blog.public_reactions_count > 0 && <span className="r">{blog.public_reactions_count} reactions</span>}</div>
            <div className="cell-b" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                <h2 className="rp-h3" style={{ margin: 0 }}>{blog.title}</h2>
                {summary ? <p className="rp-p" style={{ margin: 0, fontSize: 14, flex: 1 }}>{summary}</p> : <span style={{ flex: 1 }} />}
                <div className="btns"><span className="tags">{tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}</span><span className="rp-note" style={{ marginLeft: "auto", color: "var(--ink)" }}>Read →</span></div>
            </div>
        </Link>
    );
}

export default BlogCard;
