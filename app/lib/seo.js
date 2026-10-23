// Page metadata in one shape. Next.js replaces a parent's `openGraph` and
// `twitter` objects outright rather than merging them, so a page that set
// only `openGraph.images` used to lose the URL, type, site name and
// locale the root layout declared. Every page now builds its metadata
// here, with all of them.

import { blogUrl } from "./origins";

export const NAME = "Dhruv Agrawal";
export const SITE_NAME = "dhruuv.me";
export const X_HANDLE = "@dhruv_1206";
// Canonical URLs and structured data always name production, whichever
// host served the page (a preview deployment, `next start`).
export const ORIGIN = "https://dhruuv.me";
export const SITE_TITLE = "Dhruv Agrawal · Backend Engineer";
export const SITE_DESCRIPTION =
    "Backend engineer at MyRik. The platforms I run serve 150,000 people a month; their latency, cost and uptime are my job. Every claim on this site is backed by something you can run: a REPL, a real WebRTC room, a live model of the production system.";
export const BLOG_NAME = "Notes from the backend";
export const BLOG_DESCRIPTION = "Notes on backend systems: what broke, what the trace said, what shipped. Written by Dhruv Agrawal and published on dev.to.";

/** Absolute URL for a path on the main site, or an absolute URL as it is. */
export const abs = (url) => new URL(url, ORIGIN).href;

/** The blog's RSS feed, advertised from the homepage and the blog. */
export const FEED_URL = blogUrl("feed.xml");
export const FEED_LINK = { types: { "application/rss+xml": [{ url: FEED_URL, title: `${BLOG_NAME} · ${NAME}` }] } };

/** `text` cut to `max` characters for a meta description: whole sentences if they fit, else whole words. */
export function summary(text, max = 160) {
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const sentence = cut.lastIndexOf(". ");
    return sentence > max / 2 ? cut.slice(0, sentence + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

/**
 * An /api/og card: the page's title, a one-line sub, the path it lives at.
 * @param {{ title: string, sub: string, path: string, color?: string }} card
 */
export function ogImage({ title, sub, path, color }) {
    const query = new URLSearchParams({ title, sub, path });
    if (color) query.set("color", color);
    return `/api/og?${query}`;
}

/**
 * Metadata for one page. `url` is a path on the main site or an absolute
 * URL (the blog's). `title` goes through the root layout's template for
 * <title>; Open Graph and X get it with the name attached, unless
 * `absoluteTitle` says it already carries it. `openGraph` adds fields for
 * the page's type (article dates, profile names).
 * @param {{ title: string, description: string, url: string, image: string, type?: "website" | "article" | "profile", absoluteTitle?: boolean, openGraph?: object, alternates?: object, robots?: object }} page
 * @returns {import("next").Metadata}
 */
export function pageMetadata({ title, description, url, image, type = "website", absoluteTitle = false, openGraph = {}, alternates = {}, robots }) {
    const shareTitle = absoluteTitle ? title : `${title} · ${NAME}`;
    return {
        title: absoluteTitle ? { absolute: title } : title,
        description,
        alternates: { canonical: url, ...alternates },
        openGraph: { type, url, siteName: SITE_NAME, locale: "en_US", title: shareTitle, description, images: [{ url: image, width: 1200, height: 630, alt: shareTitle }], ...openGraph },
        twitter: { card: "summary_large_image", site: X_HANDLE, creator: X_HANDLE, title: shareTitle, description, images: [image] },
        ...(robots ? { robots } : {}),
    };
}
