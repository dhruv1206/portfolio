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

const INNER = "x-rendered-whole"; // marks the proxy's own fetch, which the matcher lets through

export async function proxy(request) {
    const headers = new Headers(request.headers);
    headers.set("user-agent", `${request.headers.get("user-agent") || ""} (rendered whole; compatible; Bingbot)`);
    if (request.method === "GET" && !request.headers.has(INNER)) {
        try {
            const inner = new Headers(headers);
            inner.set(INNER, "1");
            // The host the client asked for: request.url can carry the
            // server's own address instead, and fetch() cannot set Host, so
            // a page on blog.dhruuv.me would be fetched from the main site.
            const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || request.nextUrl.host;
            const proto = (request.headers.get("x-forwarded-proto") || request.nextUrl.protocol).replace(/:$/, "");
            const url = new URL(`${request.nextUrl.pathname}${request.nextUrl.search}`, `${proto}://${host}`);
            const res = await fetch(url, { headers: inner, redirect: "manual", signal: AbortSignal.timeout(8_000) });
            if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
            const { html } = inlineStreamedHtml(await res.text());
            const out = new Headers(res.headers);
            for (const h of ["content-length", "content-encoding", "transfer-encoding"]) out.delete(h);
            // A streamed page cannot change its status once its first bytes
            // are out, so a page that should not be a 200 says so in its
            // markup: Next marks a notFound() mid-stream with the status it
            // meant (NEXT_HTTP_ERROR_FALLBACK;404), and the blog marks a
            // dev.to outage 503. With the whole page here, the crawler can
            // be told.
            const declared = /data-dgst="NEXT_HTTP_ERROR_FALLBACK;(\d{3})"/.exec(html) || /<(?:main|article|div)\b[^>]*\sdata-http-status="(\d{3})"/.exec(html);
            const status = res.status === 200 && declared ? Number(declared[1]) : res.status;
            if (status === 503) out.set("retry-after", "120");
            return new Response(html, { status, headers: out });
        } catch {
            // fall through: the page as Next renders it for this bot
        }
    }
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
