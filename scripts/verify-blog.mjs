#!/usr/bin/env node
// End-to-end check of the blog subdomain and its freshness, against a fake
// dev.to this script controls: publish, edit, delete, outages and 429s.
//
// Usage (the build must be made with the subdomain switched on):
//   BLOG_ORIGIN=http://blog.localhost:3001 npx next build
//   node scripts/verify-blog.mjs
// The script starts `next start -p 3001` itself, pointed at the fake dev.to
// through DEVTO_API_ORIGIN, and stops it at the end. Chrome resolves
// *.localhost to loopback, and so does Node, so no hosts-file edits.
import http from "node:http";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const SITE = "http://localhost:3001";
const BLOG = "http://blog.localhost:3001";
const MOCK_PORT = 4010;
const TTL = 10_000, RETRY = 5_000;
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); process.stdout.write(`${ok ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- fake dev.to ----------
const article = (slug, title, body, i) => ({ id: 1000 + i, slug, title, description: `About ${title}`, published_at: "2026-10-19T11:15:35Z", reading_time_minutes: 3, tag_list: ["systems"], tags: "systems", public_reactions_count: 0, cover_image: null, url: `https://dev.to/dhruv1206/${slug}`, canonical_url: `https://dev.to/dhruv1206/${slug}`, body_html: `<p>${body}</p>` });
// A real cover from media2.dev.to: a host missing from next.config's image
// allowlist once took the whole index down in dev and broke the image in
// production (Vercel's optimizer answered 400).
const MEDIA2_COVER = "https://media2.dev.to/dynamic/image/width=1000,height=420,fit=cover,gravity=auto,format=auto/https%3A%2F%2Fdev-to-uploads.s3.us-east-2.amazonaws.com%2Fuploads%2Farticles%2Fvvncdvkobaagznaw80ok.png";
const state = { mode: "ok", retryAfter: "15", articles: [], hits: { list: 0, article: {} } };
const mock = http.createServer((req, res) => {
    const url = new URL(req.url, "http://x");
    const isList = url.pathname === "/api/articles";
    const slug = url.pathname.startsWith("/api/articles/dhruv1206/") ? decodeURIComponent(url.pathname.split("/").pop()) : null;
    if (isList) state.hits.list++;
    if (slug) state.hits.article[slug] = (state.hits.article[slug] || 0) + 1;
    if (state.mode === "500") { res.writeHead(500); res.end("boom"); return; }
    if (state.mode === "429") { res.writeHead(429, { "retry-after": state.retryAfter }); res.end("slow down"); return; }
    res.setHeader("content-type", "application/json");
    if (isList) { res.end(JSON.stringify(state.articles.map(({ body_html, ...rest }) => rest))); return; }
    const a = state.articles.find((x) => x.slug === slug);
    if (!a) { res.writeHead(404); res.end(JSON.stringify({ error: "not found", status: 404 })); return; }
    res.end(JSON.stringify(a));
});
await new Promise((r) => mock.listen(MOCK_PORT, "127.0.0.1", r));

// ---------- the app ----------
const app = spawn("npx", ["next", "start", "-p", "3001"], { env: { ...process.env, DEVTO_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}` }, stdio: ["ignore", "pipe", "pipe"] });
let appLog = ""; app.stdout.on("data", (d) => { appLog += d; }); app.stderr.on("data", (d) => { appLog += d; });
for (let i = 0; i < 60; i++) { try { const r = await fetch(`${SITE}/projects`); if (r.ok) break; } catch { /* not up yet */ } await sleep(500); }

const GOOGLEBOT = { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" };
// The article streams in after its static shell, so a missing article can
// only say so with a 200: the not-found page plus a noindex meta tag, which
// is what search engines act on. (On Vercel a short list of crawlers is
// rendered in one piece and gets a real 404; Googlebot is not on it.)
const isNotFoundPage = (r) => r.status === 200 && r.html.includes("garbage collected") && /<meta name="robots" content="noindex/.test(r.html);
const get = async (url, opts = {}) => { const r = await fetch(url, { redirect: "manual", ...opts }); return { status: r.status, location: r.headers.get("location"), type: r.headers.get("content-type") || "", html: r.status < 300 ? await r.text() : "" }; };
const canonical = (html) => (html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];

try {
    // ---------- 1. dev.to down before anything was ever read ----------
    state.mode = "500";
    let r = await get(`${BLOG}/`);
    check("cold + dev.to down: the index says dev.to is not answering, not 'nothing published'", r.status === 200 && r.html.includes("dev.to is not answering") && !r.html.includes("Nothing published yet"));
    r = await get(`${BLOG}/first-post-ab12`);
    check("cold + dev.to down: an article page is 'not answering' (not a 404) and noindex", r.status === 200 && r.html.includes("dev.to is not answering") && /<meta name="robots" content="noindex/.test(r.html), `status ${r.status}`);

    // ---------- 2. dev.to back, one article ----------
    state.articles = [article("first-post-ab12", "First post", "Original body.", 1)];
    state.mode = "ok";
    await sleep(RETRY + 500);
    r = await get(`${BLOG}/`);
    check("dev.to back: the index lists the article", r.html.includes("First post") && r.html.includes("1 article"));
    r = await get(`${BLOG}/first-post-ab12`);
    check("the article renders at /<slug> on the blog host", r.status === 200 && r.html.includes("Original body."));
    check("canonical of the article is its blog-host URL", canonical(r.html) === `${BLOG}/first-post-ab12`, canonical(r.html));
    // Next writes the root canonical without its trailing slash; same URL.
    check("canonical of the index is the blog host root", [BLOG, `${BLOG}/`].includes(canonical((await get(`${BLOG}/`)).html)), canonical((await get(`${BLOG}/`)).html));

    // ---------- 3. publish ----------
    state.articles = [{ ...article("second-post-cd34", "Second post", "Fresh body.", 2), cover_image: MEDIA2_COVER }, ...state.articles];
    await sleep(TTL + 500);
    r = await get(`${BLOG}/`);
    check("a newly published article shows on the first load after the 10 s window", r.html.includes("Second post") && r.html.includes("2 articles"));

    // ---------- 4. edit ----------
    state.articles = state.articles.map((a) => (a.slug === "first-post-ab12" ? { ...a, title: "First post, revised", body_html: "<p>Edited body.</p>" } : a));
    await sleep(TTL + 500);
    check("an edited title shows on the index within the window", (await get(`${BLOG}/`)).html.includes("First post, revised"));
    check("an edited body shows on the article within the window", (await get(`${BLOG}/first-post-ab12`)).html.includes("Edited body."));

    // ---------- 5. delete ----------
    state.articles = state.articles.filter((a) => a.slug !== "first-post-ab12");
    await sleep(TTL + 500);
    r = await get(`${BLOG}/first-post-ab12`);
    check("a deleted article shows the not-found page (noindex) within the window", isNotFoundPage(r), `status ${r.status}`);
    r = await get(`${BLOG}/first-post-ab12`, { headers: GOOGLEBOT });
    check("and Googlebot is told noindex for it", isNotFoundPage(r), `status ${r.status}`);
    check("and leaves the index", !(await get(`${BLOG}/`)).html.includes("First post"));

    // ---------- 6. dev.to fails after a success: last good copy ----------
    state.mode = "500";
    await sleep(TTL + 500);
    r = await get(`${BLOG}/`);
    check("dev.to failing after a success: the index keeps the last good list", r.html.includes("Second post") && !r.html.includes("not answering"));

    // ---------- 7. 429: stop asking until Retry-After passes ----------
    state.mode = "429"; state.retryAfter = "15";
    await sleep(RETRY + 500);
    await get(`${BLOG}/`); // this read meets the 429
    const after429 = state.hits.list;
    for (let i = 0; i < 6; i++) { await get(`${BLOG}/`); await get(`${BLOG}/second-post-cd34`); await sleep(1000); }
    check("while throttled, no request reaches dev.to", state.hits.list === after429, `${state.hits.list - after429} extra list reads`);
    check("while throttled, readers still get the last good list", (await get(`${BLOG}/`)).html.includes("Second post"));
    state.mode = "ok";
    await sleep(9_000);
    await get(`${BLOG}/`);
    check("after Retry-After, dev.to is asked again", state.hits.list === after429 + 1, `${state.hits.list - after429} reads`);

    // ---------- 8. scanners cost nothing upstream ----------
    const before = JSON.stringify(state.hits.article);
    const scans = await Promise.all(["admin", "login", "wp-admin", "phpmyadmin", "xmlrpc"].map((p) => get(`${BLOG}/${p}`)));
    check("scanner paths get the not-found page without an upstream article read", scans.every(isNotFoundPage) && JSON.stringify(state.hits.article) === before, scans.map((s) => s.status).join(","));
    const guesses = await Promise.all(Array.from({ length: 25 }, (_, i) => get(`${BLOG}/made-up-post-${(i + 10).toString(26)}`)));
    check("25 slug-shaped guesses get the not-found page and cost dev.to nothing", guesses.every(isNotFoundPage) && JSON.stringify(state.hits.article) === before, `${Object.keys(state.hits.article).length} article keys hit`);

    // ---------- 9. a burst costs one upstream read ----------
    await sleep(TTL + 500);
    const listBefore = state.hits.list;
    await Promise.all(Array.from({ length: 40 }, () => get(`${BLOG}/`)));
    check("40 concurrent loads cost one dev.to read", state.hits.list - listBefore === 1, `${state.hits.list - listBefore} reads`);

    // ---------- 10. routing ----------
    const moves = [
        [`${SITE}/blog`, `${BLOG}/`], [`${SITE}/blog/second-post-cd34`, `${BLOG}/second-post-cd34`],
        [`${BLOG}/blog`, "/"], [`${BLOG}/blog/second-post-cd34`, "/second-post-cd34"],
        [`${BLOG}/room`, `${SITE}/room`], [`${BLOG}/lab/boids`, `${SITE}/lab/boids`], [`${BLOG}/projects/dstardb`, `${SITE}/projects/dstardb`], [`${BLOG}/r`, `${SITE}/r`],
    ];
    for (const [from, to] of moves) { const m = await get(from); check(`${from.replace("http://", "")} → 308 ${to.replace("http://", "")}`, m.status === 308 && m.location === to, `${m.status} ${m.location}`); }
    check("favicon is served on the blog host", (await get(`${BLOG}/favicon.ico`)).status === 200);
    const og = await get(`${BLOG}/api/og?title=x`);
    check("/api/og is served on the blog host", og.status === 200 && og.type.includes("image/png"), `${og.status} ${og.type}`);
    check("the main host still serves the homepage at /", (await get(`${SITE}/`)).html.includes("Machines you can run"));

    // ---------- 11. in the browser ----------
    const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage(); const errors = [];
    // Failed requests are logged with their URL; /_vercel/* (Speed Insights)
    // only exists on Vercel, so it 404s under `next start` by design.
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text().slice(0, 160)); });
    page.on("response", (res) => { if (res.status() >= 400 && !new URL(res.url()).pathname.startsWith("/_vercel/")) errors.push(`${res.status()} ${res.url()}`); });
    await page.goto(`${BLOG}/`, { waitUntil: "load" }); await page.waitForSelector("text=Second post");
    const bar = await page.evaluate(() => ({ mark: document.querySelector(".site-mark")?.textContent, markHref: document.querySelector(".site-mark")?.getAttribute("href"), active: document.querySelector(".site-links a.is-active")?.textContent, home: [...document.querySelectorAll(".site-links a")].find((a) => a.textContent === "Home")?.getAttribute("href") }));
    await page.waitForFunction(() => { const img = document.querySelector(".g3 img"); return img && img.complete && img.naturalWidth > 0; }, null, { timeout: 15000 }).catch(() => {});
    const cover = await page.evaluate(() => { const img = document.querySelector(".g3 img"); return img ? { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 } : null; });
    check("a media2.dev.to cover loads straight from dev.to, not through the optimizer", cover && cover.loaded && cover.src.startsWith("https://media2.dev.to/"), JSON.stringify(cover));
    check("on the blog host the bar reads 'dhruuv.me / blog', Blog is active, Home leaves the subdomain", bar.mark === "DAdhruuv.me / blog" && bar.active === "Blog" && bar.home === `${SITE}/` && bar.markHref === `${SITE}/`, JSON.stringify(bar));
    await page.click("text=Second post");
    await page.waitForURL(`${BLOG}/second-post-cd34`); await page.waitForSelector("text=Fresh body.");
    check("clicking a card opens the article on the blog host", page.url() === `${BLOG}/second-post-cd34`);
    // Publish while the reader is on the article, then go back to the index
    // by an in-app link: the browser's router cache must not show the old list.
    state.articles = [article("third-post-ef56", "Third post", "Newest body.", 3), ...state.articles];
    await sleep(TTL + 500);
    await page.click("text=← All articles");
    await page.waitForURL(`${BLOG}/`);
    const sawNew = await page.waitForSelector("text=Third post", { timeout: 8000 }).then(() => true, () => false);
    check("an article published while reading shows when returning to the index in-app", sawNew);
    await page.click(".site-links >> text=Home");
    await page.waitForURL(`${SITE}/`);
    check("Home from the blog lands on the main site", page.url() === `${SITE}/`);
    await page.goto(`${BLOG}/`, { waitUntil: "load" });
    await page.waitForSelector("text=Second post"); await page.waitForTimeout(1200); // the palette mounts after hydration
    await page.keyboard.press("Meta+k"); await page.waitForSelector("[role=dialog][aria-label='Command palette']");
    await page.keyboard.type("control room"); await page.keyboard.press("Enter");
    await page.waitForURL(`${SITE}/room`);
    check("⌘K → Control room from the blog lands on the main site", page.url() === `${SITE}/room`);
    await page.goto(`${SITE}/projects`, { waitUntil: "load" });
    const blogLink = await page.evaluate(() => [...document.querySelectorAll(".site-links a")].find((a) => a.textContent === "Blog")?.getAttribute("href"));
    check("on the main site the bar's Blog link goes straight to the subdomain", blogLink === `${BLOG}/`, blogLink);
    check("no page errors in the browser", errors.length === 0, errors.slice(0, 3).join(" | "));
    await browser.close();
} finally {
    app.kill("SIGTERM"); mock.close();
}
const failed = results.filter((x) => !x.ok).length;
if (failed) console.log("\n--- next start log (tail) ---\n" + appLog.split("\n").slice(-25).join("\n"));
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
