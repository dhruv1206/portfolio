// Shared pieces of the machine-readable files: robots.txt, the sitemaps,
// the RSS feed and llms.txt (app/robots.js, app/sitemap.js,
// app/llms.txt/, app/(blog)/blog/*). They name production URLs, like the
// canonical links do.

import { blogUrl } from "./origins";
import { abs } from "./seo";

/** The blog's root URL without a trailing slash: https://blog.dhruuv.me in production. */
export const BLOG_ROOT = abs(blogUrl()).replace(/\/$/, "");

export const articleUrl = (slug) => abs(blogUrl(slug));

/** Escapes text for XML element content and attribute values. */
export function xml(text) {
    return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

/** A plain-text or XML response; `status` 503 tells crawlers to come back later. */
export function fileResponse(body, type, { status = 200 } = {}) {
    const headers = { "Content-Type": `${type}; charset=utf-8` };
    if (status === 503) headers["Retry-After"] = "120";
    return new Response(body, { status, headers });
}

/** dev.to could not be read: crawlers should retry rather than see an empty blog. */
export const unavailable = () => fileResponse("dev.to, where the articles live, did not answer. Try again in a couple of minutes.\n", "text/plain", { status: 503 });
