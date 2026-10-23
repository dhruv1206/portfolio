// robots.txt for the blog's host (next.config.js rewrites /robots.txt on
// blog.dhruuv.me here): every page may be read by search engines and AI
// crawlers alike.

import { BLOG_ROOT, fileResponse } from "@/app/lib/feeds";

export function GET() {
    return fileResponse(`User-agent: *\nAllow: /\n\nSitemap: ${BLOG_ROOT}/sitemap.xml\n`, "text/plain");
}
