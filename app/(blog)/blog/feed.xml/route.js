// The blog's RSS 2.0 feed (served at /feed.xml on blog.dhruuv.me), read
// live from dev.to. Pages advertise it with <link rel="alternate">.

import { getArticles } from "@/app/lib/devto";
import { BLOG_DESCRIPTION, BLOG_NAME, NAME } from "@/app/lib/seo";
import { BLOG_ROOT, articleUrl, fileResponse, unavailable, xml } from "@/app/lib/feeds";

const isFiller = (text) => !text || /^A post by /i.test(text);
const tagsOf = (a) => (Array.isArray(a.tag_list) ? a.tag_list : typeof a.tags === "string" ? a.tags.split(",") : []).map((t) => t.trim()).filter(Boolean);

export async function GET() {
    const feed = await getArticles();
    if (feed.status !== "ok") return unavailable();
    const newest = feed.data.map((a) => a.edited_at || a.published_at).filter(Boolean).sort().pop();
    const items = feed.data.map((a) => [
        "<item>",
        `<title>${xml(a.title)}</title>`,
        `<link>${xml(articleUrl(a.slug))}</link>`,
        `<guid isPermaLink="true">${xml(articleUrl(a.slug))}</guid>`,
        `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>`,
        `<dc:creator>${xml(NAME)}</dc:creator>`,
        isFiller(a.description) ? "" : `<description>${xml(a.description)}</description>`,
        ...tagsOf(a).map((t) => `<category>${xml(t)}</category>`),
        "</item>",
    ].filter(Boolean).join(""));
    const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
        "<channel>",
        `<title>${xml(`${BLOG_NAME} · ${NAME}`)}</title>`,
        `<link>${xml(`${BLOG_ROOT}/`)}</link>`,
        `<description>${xml(BLOG_DESCRIPTION)}</description>`,
        "<language>en</language>",
        `<atom:link href="${xml(`${BLOG_ROOT}/feed.xml`)}" rel="self" type="application/rss+xml"/>`,
        newest ? `<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>` : "",
        ...items,
        "</channel>",
        "</rss>",
        "",
    ].filter(Boolean).join("\n");
    return fileResponse(body, "application/rss+xml");
}
