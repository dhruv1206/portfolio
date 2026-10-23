import { NextResponse } from "next/server";
import { inlineStreamedHtml } from "./app/lib/inline-streamed-html.mjs";

// Crawlers that do not run JavaScript get each page as it reads once its
// scripts have run.
//
// The blog streams: its titles, canonicals and text arrive after </head>,
// as hidden parts that a script moves into place. AI crawlers and
// fetchers (ChatGPT, Claude, Perplexity, Common Crawl…), Bing and plain
// HTTP clients do not run that script; text extractors such as
// Readability then find no article at all. So for those user agents this
// proxy fetches the page itself, with a token from Next's own list of
// bots that cannot run JavaScript ("Bingbot") added to the User-Agent, so
// Next puts the metadata in <head>, then moves each hidden part into
// place (app/lib/inline-streamed-html.mjs). Same page, same content, no
// fallbacks. If anything fails, the request goes on as before.
//
// The matcher keeps this to those user agents; nobody else's request
// passes through here, and Googlebot, which renders JavaScript, gets the
// page everyone gets. Keep the list in step with htmlLimitedBots in
// next.config.js, which makes Vercel skip the prerendered shell for them.
//
// The proxy only ever fetches this site: the origin comes from the list
// below, matched against the request's Host, never from a header the
// client can choose (X-Forwarded-Host, the protocol). Any other host is
// left to render as usual.

const INNER = "x-rendered-whole"; // marks the proxy's own fetch, which the matcher lets through
const OWN_ORIGINS = [
    process.env.SITE_ORIGIN, // set with BLOG_ORIGIN by next.config.js when the blog has its own host
    process.env.BLOG_ORIGIN,
    ...[process.env.VERCEL_PROJECT_PRODUCTION_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL].filter(Boolean).map((host) => `https://${host}`),
].filter(Boolean).map((origin) => new URL(origin));
// Request headers worth passing on: content negotiation, plus what a
// protected preview deployment needs to let the proxy's own fetch in.
const FORWARD = ["accept", "accept-language", "cookie", "x-vercel-protection-bypass"];
const HOP_BY_HOP = ["connection", "keep-alive", "transfer-encoding", "upgrade", "te", "trailer", "proxy-authenticate", "proxy-authorization", "content-length", "content-encoding", "set-cookie"];

export async function proxy(request) {
    const userAgent = `${request.headers.get("user-agent") || ""} (rendered whole; compatible; Bingbot)`;
    const own = OWN_ORIGINS.find((origin) => origin.host === request.headers.get("host"));
    if (request.method === "GET" && own && !request.headers.has(INNER)) {
        try {
            const inner = new Headers({ "user-agent": userAgent, [INNER]: "1" });
            for (const name of FORWARD) if (request.headers.has(name)) inner.set(name, request.headers.get(name));
            const res = await fetch(new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, own.origin), { headers: inner, redirect: "manual", signal: AbortSignal.timeout(8_000) });
            if (res.ok && (res.headers.get("content-type") || "").includes("text/html")) {
                const { html } = inlineStreamedHtml(await res.text());
                const out = new Headers(res.headers);
                for (const name of HOP_BY_HOP) out.delete(name);
                // This answer is for crawlers only; no shared cache may hand it to a browser.
                out.set("vary", "User-Agent");
                out.set("cache-control", "private, no-store");
                // A streamed page cannot change its status once its first bytes
                // are out, so a page that should not be a 200 says so in its
                // markup: Next marks a notFound() mid-stream with the status it
                // meant (NEXT_HTTP_ERROR_FALLBACK;404), and the blog marks a
                // dev.to outage 503. With the whole page here, the crawler can
                // be told.
                const declared = /data-dgst="NEXT_HTTP_ERROR_FALLBACK;(\d{3})"/.exec(html) || /<(?:main|article|div)\b[^>]*\sdata-http-status="(\d{3})"/.exec(html);
                const status = declared ? Number(declared[1]) : res.status;
                if (status === 503) out.set("retry-after", "120");
                return new Response(html, { status, headers: out });
            }
        } catch {
            // fall through: the page as Next renders it for this bot
        }
    }
    const headers = new Headers(request.headers);
    headers.set("user-agent", userAgent);
    return NextResponse.next({ request: { headers } });
}

export const config = {
    matcher: [
        {
            // Pages only: no Next assets, no API, no files (robots.txt, sitemap.xml…).
            source: "/((?!_next/|api/|.*\\.).*)",
            has: [{ type: "header", key: "user-agent", value: ".*(?:GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|meta-externalagent|meta-externalfetcher|Amazonbot|CCBot|DuckAssistBot|MistralAI-User|cohere-ai|YouBot|Bytespider|Diffbot|Applebot|[Bb]ingbot|curl/|Wget/|python-requests|python-httpx|aiohttp|Go-http-client|node-fetch|undici|axios/|okhttp|Java/).*" }],
            missing: [{ type: "header", key: "x-rendered-whole" }],
        },
    ],
};
