#!/usr/bin/env node
// What search engines, AI crawlers and plain HTTP clients get from the site:
// robots.txt, sitemaps, the feed and llms.txt on both hosts; every page's
// head (one title, its canonical, Open Graph, X card, JSON-LD) and its h1;
// whole pages for crawlers that do not run JavaScript, with real 404s and
// 503s; the case studies' prose in the server's HTML.
//
// Usage (the build must be made with the subdomain switched on):
//   BLOG_ORIGIN=http://blog.localhost:3001 npx next build
//   node scripts/verify-seo.mjs
// The script runs a fake dev.to and `next start -p 3001` itself.

import http from "node:http";
import { spawn } from "node:child_process";

const SITE = "http://localhost:3001";
const BLOG = "http://blog.localhost:3001";
const PROD = "https://dhruuv.me";
const MOCK_PORT = 4011;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); process.stdout.write(`${ok ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const UA = {
    browser: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
    googlebot: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    gptbot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.4; +https://openai.com/gptbot",
    claudebot: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    perplexity: "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    curl: "curl/8.7.1",
};
const CRAWLERS = ["gptbot", "claudebot", "perplexity", "curl"];

// ---------- fake dev.to ----------
const article = (slug, title, body, date) => ({ id: slug.length, slug, title, description: `About ${title}.`, published_at: date, edited_at: null, reading_time_minutes: 4, tag_list: ["systems", "devops"], tags: "systems, devops", public_reactions_count: 2, cover_image: null, url: `https://dev.to/dhruv1206/${slug}`, canonical_url: `https://dev.to/dhruv1206/${slug}`, body_html: body });
const LONG = `<p>${"A long paragraph about merge queues and the CI that feeds them. ".repeat(80)}</p>`.repeat(6); // past React's 12.8 KB outlining threshold
const ARTICLES = [article("merge-queues-explained-ab12", "Merge queues, explained", `<h2>Why</h2>${LONG}<p>Closing line.</p>`, "2026-10-20T09:00:00Z"), article("tampered-downloads-cd34", "Tampered downloads & <checksums>", "<p>Short body.</p>", "2026-10-22T09:00:00Z")];
const state = { mode: "ok" };
const mock = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    if (state.mode === "500") { res.writeHead(500); res.end("boom"); return; }
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/api/articles") { res.end(JSON.stringify(ARTICLES.map(({ body_html, ...rest }) => rest))); return; }
    const a = ARTICLES.find((x) => url.pathname === `/api/articles/dhruv1206/${x.slug}`);
    if (!a) { res.writeHead(404); res.end("{}"); return; }
    res.end(JSON.stringify({ ...a, tags: a.tag_list, tag_list: a.tags }));
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

const app = spawn("npx", ["next", "start", "-p", "3001"], { env: { ...process.env, DEVTO_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let appLog = ""; app.stdout.on("data", (d) => { appLog += d; }); app.stderr.on("data", (d) => { appLog += d; });
for (let i = 0; i < 60; i++) { try { if ((await fetch(`${SITE}/robots.txt`)).ok) break; } catch { /* not up yet */ } await sleep(500); }

const get = async (url, ua = "browser") => {
    const r = await fetch(url, { redirect: "manual", headers: { "user-agent": UA[ua] } });
    return { status: r.status, type: r.headers.get("content-type") || "", retryAfter: r.headers.get("retry-after"), body: await r.text() };
};
const headOf = (html) => html.split("</head>")[0];
const visible = (html) => html.replace(/<script\b[\s\S]*?<\/script>/g, "");
const attr = (head, re) => [...head.matchAll(re)].map((m) => m[1].replace(/&amp;/g, "&"));
const jsonLd = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => { try { return JSON.parse(m[1])["@graph"]; } catch { return [{ "@type": "INVALID" }]; } });

try {
    // ---------- 1. robots.txt, sitemaps, feed, llms.txt ----------
    let r = await get(`${SITE}/robots.txt`);
    check("main robots.txt allows everything but /api/ (and keeps /api/og open) and names its sitemap", r.status === 200 && /User-Agent: \*/i.test(r.body) && /Disallow: \/api\//.test(r.body) && /Allow: \/api\/og/.test(r.body) && !/Disallow: \/\s*$/m.test(r.body) && r.body.includes(`Sitemap: ${PROD}/sitemap.xml`), r.body.replace(/\n/g, " | "));
    r = await get(`${BLOG}/robots.txt`);
    check("blog robots.txt is the blog's own and names the blog's sitemap", r.status === 200 && r.body.includes(`Sitemap: ${BLOG}/sitemap.xml`) && !r.body.includes("/api/"), r.body.replace(/\n/g, " | "));
    r = await get(`${SITE}/sitemap.xml`);
    const mainLocs = attr(r.body, /<loc>([^<]+)<\/loc>/g);
    check("main sitemap lists every page on the main site, absolute, no blog", mainLocs.length === 18 && mainLocs.every((u) => u.startsWith(`${PROD}/`)) && mainLocs.includes(`${PROD}/projects/dstardb`) && mainLocs.includes(`${PROD}/lab/boids`) && !mainLocs.some((u) => u.includes("blog")), `${mainLocs.length} urls`);
    r = await get(`${BLOG}/sitemap.xml`);
    const blogLocs = attr(r.body, /<loc>([^<]+)<\/loc>/g);
    check("blog sitemap lists the index and each article with its date", r.status === 200 && blogLocs.length === 3 && blogLocs.includes(`${BLOG}/merge-queues-explained-ab12`) && (r.body.match(/<lastmod>/g) || []).length === 3, blogLocs.join(" "));
    r = await get(`${BLOG}/feed.xml`);
    check("RSS feed: valid channel, one item per article, titles escaped", r.status === 200 && r.type.includes("rss") && /<rss version="2.0"/.test(r.body) && (r.body.match(/<item>/g) || []).length === 2 && r.body.includes("Tampered downloads &amp; &lt;checksums&gt;") && r.body.includes(`<atom:link href="${BLOG}/feed.xml" rel="self"`));
    r = await get(`${SITE}/llms.txt`);
    check("main llms.txt: who, the case studies, the pages, the writing, contact", r.status === 200 && r.body.startsWith("# Dhruv Agrawal\n") && r.body.includes(`(${PROD}/projects/dstardb)`) && r.body.includes(`(${BLOG}/merge-queues-explained-ab12)`) && r.body.includes("## Contact"));
    r = await get(`${BLOG}/llms.txt`);
    check("blog llms.txt lists the articles and points to the main one", r.status === 200 && r.body.includes(`(${BLOG}/tampered-downloads-cd34)`) && r.body.includes(`${PROD}/llms.txt`));
    check("/blog/robots.txt on the main host moves to the blog host", (await get(`${SITE}/blog/robots.txt`)).status === 308);

    // ---------- 2. every page's head, h1 and JSON-LD (as a crawler sees it) ----------
    const PAGES = [
        [`${SITE}/`, `${PROD}`, ["WebSite", "Person", "ProfilePage"], "Dhruv Agrawal"],
        [`${SITE}/projects`, `${PROD}/projects`, ["CollectionPage", "BreadcrumbList"], "Machines you can run."],
        [`${SITE}/projects/dstardb`, `${PROD}/projects/dstardb`, ["WebPage", "SoftwareSourceCode", "BreadcrumbList"], "DStarDB"],
        [`${SITE}/lab`, `${PROD}/lab`, ["CollectionPage", "BreadcrumbList"], "Live experiments."],
        [`${SITE}/lab/boids`, `${PROD}/lab/boids`, ["WebPage", "CreativeWork", "BreadcrumbList"], "Boids"],
        [`${SITE}/room`, `${PROD}/room`, ["WebPage", "BreadcrumbList"], "Dhruv Agrawal"],
        [`${SITE}/r`, `${PROD}/r`, ["WebPage", "BreadcrumbList"], "Dhruv Agrawal."],
        [`${BLOG}/`, BLOG, ["Blog", "Person", "BreadcrumbList"], "Notes from the backend."],
        [`${BLOG}/merge-queues-explained-ab12`, `${BLOG}/merge-queues-explained-ab12`, ["BlogPosting", "Person", "BreadcrumbList"], "Merge queues, explained"],
    ];
    for (const [url, canonical, types, h1] of PAGES) {
        r = await get(url, "gptbot");
        const head = headOf(r.body);
        const titles = (head.match(/<title>/g) || []).length;
        const canonicals = attr(head, /<link rel="canonical" href="([^"]+)"/g);
        const ogUrl = attr(head, /<meta property="og:url" content="([^"]+)"/g);
        const ogImage = attr(head, /<meta property="og:image" content="([^"]+)"/g);
        const robots = attr(r.body, /<meta name="robots" content="([^"]+)"/g);
        const h1s = [...visible(r.body).matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => m[1].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").trim());
        const ld = jsonLd(r.body).map((n) => n["@type"]);
        const ok = r.status === 200 && titles === 1 && canonicals.length === 1 && [canonical, `${canonical}/`].includes(canonicals[0]) && ogUrl[0] === canonicals[0]
            && /<meta property="og:type"/.test(head) && ogImage[0]?.startsWith("http") && /<meta name="twitter:card" content="summary_large_image"/.test(head)
            && robots.length === 1 && !robots[0].includes("noindex") && h1s.length === 1 && h1s[0] === h1 && types.every((t) => ld.includes(t)) && !ld.includes("INVALID");
        check(`${url.replace("http://", "")}: one title, canonical = og:url, Open Graph + X card, one h1, JSON-LD ${types.join("/")}`, ok, ok ? "" : JSON.stringify({ status: r.status, titles, canonicals, ogUrl, robots, h1s, ld }));
    }
    r = await get(`${SITE}/`, "gptbot");
    check("home and blog pages advertise the RSS feed", /<link rel="alternate" type="application\/rss\+xml"[^>]*href="http:\/\/blog\.localhost:3001\/feed\.xml"/.test(headOf(r.body)));
    const posting = jsonLd((await get(`${BLOG}/merge-queues-explained-ab12`, "gptbot")).body).find((n) => n["@type"] === "BlogPosting");
    check("BlogPosting carries headline, dates, author and the dev.to original", posting && posting.headline === "Merge queues, explained" && posting.datePublished === "2026-10-20T09:00:00Z" && posting.author?.["@id"] === `${PROD}/#person` && posting.sameAs === "https://dev.to/dhruv1206/merge-queues-explained-ab12");

    // ---------- 3. crawlers that do not run JavaScript get whole pages ----------
    for (const bot of CRAWLERS) {
        r = await get(`${BLOG}/merge-queues-explained-ab12`, bot);
        const v = visible(r.body);
        check(`${bot}: the long article arrives whole (no hidden parts, no fallback, closing line inline)`, r.status === 200 && !r.body.includes('<div hidden id="S:') && !v.includes("loading the article") && v.includes("Closing line.") && /<title>Merge queues, explained/.test(headOf(r.body)));
    }
    r = await get(`${BLOG}/`, "claudebot");
    check("claudebot: the blog index arrives whole, with both articles inline", !r.body.includes('<div hidden id="S:') && !visible(r.body).includes("loading the articles") && visible(r.body).includes("Merge queues, explained") && visible(r.body).includes("Tampered downloads"));
    r = await get(`${BLOG}/no-such-post-zz99`, "gptbot");
    check("gptbot: a missing article is a real 404", r.status === 404, `status ${r.status}`);
    r = await get(`${BLOG}/no-such-post-zz99`, "browser");
    check("a browser still gets the streamed not-found page (200 + noindex)", r.status === 200 && /<meta name="robots" content="noindex"/.test(r.body), `status ${r.status}`);
    r = await get(`${BLOG}/merge-queues-explained-ab12`, "browser");
    check("browsers are not proxied: the article still streams for them", r.body.includes('<div hidden id="S:'));
    r = await get(`${BLOG}/merge-queues-explained-ab12`, "googlebot");
    check("googlebot gets the article with its metadata in <head>", r.status === 200 && /<title>Merge queues, explained/.test(headOf(r.body)) && /<link rel="canonical"/.test(headOf(r.body)));
    state.mode = "500";
    await sleep(15_500); // past the feed's 10 s window and 5 s retry pause
    r = await get(`${BLOG}/brand-new-post-ef56`, "gptbot");
    check("gptbot: while dev.to is down, an article its last list does not know is 503 with Retry-After, not a 404", r.status === 503 && r.retryAfter === "120", `status ${r.status} retry-after ${r.retryAfter}`);
    r = await get(`${BLOG}/sitemap.xml`);
    check("the blog sitemap stays a 200 from the last good list while dev.to is down", r.status === 200 && r.body.includes("merge-queues-explained-ab12"), `status ${r.status}`);
    state.mode = "ok";

    // ---------- 4. case studies and the 404 page ----------
    r = await get(`${SITE}/projects/dstardb`, "browser");
    check("a case study's chapters are in the server's HTML", visible(r.body).includes("Why a multi-core in-memory store, when Redis exists?") && !visible(r.body).includes("loading the chapters"));
    r = await get(`${SITE}/definitely-missing`, "gptbot");
    const robots404 = attr(r.body, /<meta name="robots" content="([^"]+)"/g);
    check("the 404 page is a 404 with noindex and nothing saying 'index'", r.status === 404 && robots404.some((x) => x.includes("noindex")) && !robots404.some((x) => /(^|,\s*)index/.test(x)), JSON.stringify(robots404));
} finally {
    app.kill("SIGTERM"); mock.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) { console.log(appLog.split("\n").filter((l) => /error|warn/i.test(l)).slice(-10).join("\n")); process.exit(1); }
process.exit(0);
