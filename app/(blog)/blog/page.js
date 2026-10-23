// The blog index: dev.to articles, read live. app/lib/devto.js keeps the
// list within 10 seconds of dev.to, so a post shows up here on the first
// load after it is published. The header is static and in the first
// bytes of the page (one h1, readable without JavaScript); the article
// count and the list are dynamic holes that stream in under it, with
// room reserved for the count so the eyebrow does not jump.

import { Suspense } from "react";
import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import BlogCard from "@/app/components/homepage/blog/blog-card";
import { getArticles } from "@/app/lib/devto";
import { blogUrl, siteUrl } from "@/app/lib/origins";
import { BLOG_DESCRIPTION, BLOG_NAME, FEED_LINK, abs, ogImage, pageMetadata } from "@/app/lib/seo";
import { JsonLd, PERSON_ID, breadcrumbs, personSummary } from "@/app/lib/structured-data";

export const metadata = pageMetadata({
    title: "Blog",
    description: BLOG_DESCRIPTION,
    url: blogUrl(),
    image: ogImage({ title: BLOG_NAME, sub: "Writing about the systems on this site: what broke, what the trace said, what shipped.", path: "/blog" }),
    alternates: FEED_LINK,
});

const PROFILE = `https://dev.to/${personalData.devUsername}`;

export default function BlogPage() {
    return (
        <div className="rp">
            <header className="rp-head">
                <p className="rp-eyebrow"><b>/blog</b> <Suspense fallback={<Count state="loading" />}><LiveCount /></Suspense> <i>syndicated from dev.to</i></p>
                <h1 className="rp-h1">Notes from <em>the backend.</em></h1>
                <p className="rp-lede">Writing about the systems on this site: what broke, what the trace said, what shipped. Published on dev.to and mirrored here within seconds.</p>
            </header>
            <Suspense fallback={<div className="spin-wrap spin-late"><span className="spin" />loading the articles</div>}>
                <LiveList />
            </Suspense>
        </div>
    );
}

// Both holes read the same memoised feed, so they cost one dev.to read.
async function LiveCount() {
    const feed = await getArticles();
    return feed.status === "ok" ? <Count state="ok" n={feed.data.length} /> : <Count state="unavailable" />;
}

async function LiveList() {
    const feed = await getArticles();
    const articles = feed.status === "ok" ? feed.data : [];
    return (
        <>
            <JsonLd graph={[
                {
                    "@type": "Blog",
                    "@id": `${abs(blogUrl())}#blog`,
                    url: abs(blogUrl()),
                    name: BLOG_NAME,
                    description: BLOG_DESCRIPTION,
                    inLanguage: "en",
                    author: { "@id": PERSON_ID },
                    publisher: { "@id": PERSON_ID },
                    blogPost: articles.map((a) => ({ "@type": "BlogPosting", headline: a.title, url: abs(blogUrl(a.slug)), datePublished: a.published_at, ...(a.edited_at ? { dateModified: a.edited_at } : {}) })),
                },
                personSummary(),
                breadcrumbs([["dhruuv.me", "/"], ["Blog", blogUrl()]]),
            ]} />
            <ArticleList state={feed.status === "ok" ? "ok" : "unavailable"} articles={articles} />
        </>
    );
}

function Count({ state, n }) {
    // While loading, hold the count's place without showing a guess.
    if (state === "loading") return <span aria-hidden="true" style={{ visibility: "hidden" }}>0 articles</span>;
    if (state === "unavailable") return <span>dev.to unreachable</span>;
    return <span>{n ? `${n} article${n === 1 ? "" : "s"}` : "no articles yet"}</span>;
}

function ArticleList({ state, articles }) {
    if (state === "unavailable") {
        return (
            <div className="cell" data-http-status="503">
                <div className="cell-h"><b>dev.to is not answering</b></div>
                <div className="cell-b btns">
                    <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>The articles live on dev.to, and it did not respond just now. Reload in a moment, or read them there.</p>
                    <a href={PROFILE} target="_blank" rel="noopener noreferrer" className="mbtn">Read on dev.to ↗</a>
                </div>
            </div>
        );
    }
    if (articles.length > 0) return <div className="g3">{articles.map((blog) => <BlogCard blog={blog} key={blog.id || blog.slug} />)}</div>;
    return (
        <div className="cell">
            <div className="cell-h"><b>Nothing published yet</b><span className="r">the feed is live</span></div>
            <div className="cell-b btns">
                <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>Nothing is published yet. The case studies carry the same material: what broke, what the trace said, what shipped.</p>
                <Link href={siteUrl("/projects")} className="mbtn">Case studies</Link>
                <a href={PROFILE} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-ghost">dev.to profile ↗</a>
            </div>
        </div>
    );
}
