import { ORIGIN } from "./lib/seo";

// robots.txt for dhruuv.me. Search engines and AI crawlers alike may read
// every page; only the API is off limits, except /api/og, which X,
// LinkedIn and Slack fetch share cards from. The blog has its own
// robots.txt (app/(blog)/blog/robots.txt).
export default function robots() {
    return {
        rules: [{ userAgent: "*", allow: ["/", "/api/og"], disallow: ["/api/"] }],
        sitemap: `${ORIGIN}/sitemap.xml`,
    };
}
