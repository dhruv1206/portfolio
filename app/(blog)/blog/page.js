// The blog index: dev.to articles, read live. app/lib/devto.js keeps the
// list within 10 seconds of dev.to, so a post shows up here on the first
// load after it is published. The header is static; the list is a dynamic
// hole that streams in under it, with room reserved for the article count
// so the eyebrow does not jump.

import { Suspense } from "react";
import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import BlogCard from "@/app/components/homepage/blog/blog-card";
import { getArticles } from "@/app/lib/devto";
import { blogUrl, siteUrl } from "@/app/lib/origins";

export const metadata = {
    title: "Blog",
    description: "Notes on backend systems, syndicated from dev.to.",
    alternates: { canonical: blogUrl() },
    openGraph: { url: blogUrl(), images: [{ url: "/api/og?title=Notes%20from%20the%20backend&sub=Writing%20about%20the%20systems%20on%20this%20site%3A%20what%20broke%2C%20what%20the%20trace%20said%2C%20what%20shipped.&path=/blog", width: 1200, height: 630 }] },
};

const PROFILE = `https://dev.to/${personalData.devUsername}`;

export default function BlogPage() {
    return (
        <div className="rp">
            <Suspense fallback={<BlogIndex state="loading" />}>
                <LiveBlogIndex />
            </Suspense>
        </div>
    );
}

async function LiveBlogIndex() {
    const feed = await getArticles();
    return feed.status === "ok" ? <BlogIndex state="ok" articles={feed.data} /> : <BlogIndex state="unavailable" />;
}

function Count({ state, n }) {
    // While loading, hold the count's place without showing a guess.
    if (state === "loading") return <span aria-hidden="true" style={{ visibility: "hidden" }}>0 articles</span>;
    if (state === "unavailable") return <span>dev.to unreachable</span>;
    return <span>{n ? `${n} article${n === 1 ? "" : "s"}` : "no articles yet"}</span>;
}

function BlogIndex({ state, articles = [] }) {
    return (
        <>
            <header className="rp-head">
                <p className="rp-eyebrow"><b>/blog</b> <Count state={state} n={articles.length} /> <i>syndicated from dev.to</i></p>
                <h1 className="rp-h1">Notes from <em>the backend.</em></h1>
                <p className="rp-lede">Writing about the systems on this site: what broke, what the trace said, what shipped. Published on dev.to and mirrored here within seconds.</p>
            </header>
            {state === "loading" && <div className="spin-wrap spin-late"><span className="spin" />loading the articles</div>}
            {state === "unavailable" && (
                <div className="cell">
                    <div className="cell-h"><b>dev.to is not answering</b></div>
                    <div className="cell-b btns">
                        <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>The articles live on dev.to, and it did not respond just now. Reload in a moment, or read them there.</p>
                        <a href={PROFILE} target="_blank" rel="noopener noreferrer" className="mbtn">Read on dev.to ↗</a>
                    </div>
                </div>
            )}
            {state === "ok" && articles.length > 0 && (
                <div className="g3">{articles.map((blog) => <BlogCard blog={blog} key={blog.id || blog.slug} />)}</div>
            )}
            {state === "ok" && articles.length === 0 && (
                <div className="cell">
                    <div className="cell-h"><b>Nothing published yet</b><span className="r">the feed is live</span></div>
                    <div className="cell-b btns">
                        <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>Nothing is published yet. The case studies carry the same material: what broke, what the trace said, what shipped.</p>
                        <Link href={siteUrl("/projects")} className="mbtn">Case studies</Link>
                        <a href={PROFILE} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-ghost">dev.to profile ↗</a>
                    </div>
                </div>
            )}
        </>
    );
}
