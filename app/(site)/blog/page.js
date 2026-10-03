// /blog — articles syndicated from dev.to. The list is cached for an
// hour; when dev.to is unreachable the page still renders with an
// empty state instead of crashing.

import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import BlogCard from "@/app/components/homepage/blog/blog-card";

export const metadata = {
    title: "Blog",
    description: "Notes on backend systems, syndicated from dev.to.",
    alternates: { canonical: "/blog" },
    openGraph: { images: [{ url: "/api/og?title=Notes%20from%20the%20backend&sub=Writing%20about%20the%20systems%20on%20this%20site%3A%20what%20broke%2C%20what%20the%20trace%20said%2C%20what%20shipped.&path=/blog", width: 1200, height: 630 }] },
};

async function getBlogs() {
    try {
        const res = await fetch(`https://dev.to/api/articles?username=${personalData.devUsername}`, { next: { revalidate: 3600 } });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export default async function BlogPage() {
    const blogs = await getBlogs();
    return (
        <div className="rp">
            <header className="rp-head">
                <p className="rp-eyebrow"><b>/blog</b> {blogs.length ? `${blogs.length} article${blogs.length === 1 ? "" : "s"}` : "no articles yet"} <i>syndicated from dev.to</i></p>
                <h1 className="rp-h1">Notes from <em>the backend.</em></h1>
                <p className="rp-lede">Writing about the systems on this site: what broke, what the trace said, what shipped. Published on dev.to and mirrored here within the hour.</p>
            </header>
            {blogs.length > 0 ? (
                <div className="g3">{blogs.map((blog) => <BlogCard blog={blog} key={blog.id || blog.slug} />)}</div>
            ) : (
                <div className="cell">
                    <div className="cell-h"><b>Nothing published yet</b><span className="r">the feed is live</span></div>
                    <div className="cell-b btns">
                        <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>Nothing is published yet. The case studies carry the same material: what broke, what the trace said, what shipped.</p>
                        <Link href="/projects" className="mbtn">Case studies</Link>
                        <a href={`https://dev.to/${personalData.devUsername}`} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-ghost">dev.to profile ↗</a>
                    </div>
                </div>
            )}
        </div>
    );
}
