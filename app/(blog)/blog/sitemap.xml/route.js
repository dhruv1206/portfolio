// The blog's sitemap (served at /sitemap.xml on blog.dhruuv.me), read live
// from dev.to like the index, so a new article is listed within seconds.
// lastmod is the article's own edit or publish date.

import { getArticles } from "@/app/lib/devto";
import { BLOG_ROOT, articleUrl, fileResponse, unavailable, xml } from "@/app/lib/feeds";

export async function GET() {
    const feed = await getArticles();
    if (feed.status !== "ok") return unavailable();
    const newest = feed.data.map((a) => a.edited_at || a.published_at).filter(Boolean).sort().pop();
    const urls = [
        { loc: `${BLOG_ROOT}/`, lastmod: newest },
        ...feed.data.map((a) => ({ loc: articleUrl(a.slug), lastmod: a.edited_at || a.published_at })),
    ];
    const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map(({ loc, lastmod }) => `<url><loc>${xml(loc)}</loc>${lastmod ? `<lastmod>${xml(new Date(lastmod).toISOString())}</lastmod>` : ""}</url>`),
        "</urlset>",
        "",
    ].join("\n");
    return fileResponse(body, "application/xml");
}
