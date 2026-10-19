// The blog: articles mirrored live from dev.to. In production this group
// is served from https://blog.dhruuv.me (next.config.js rewrites `/` and
// `/<slug>` on that host to /blog and /blog/<slug>); in `next dev` and on
// previews it stays at /blog. The shell is the reading pages' shell with
// the bar and footer pointing back to the main site.

import ReadingShell from "@/app/components/reading-shell";

export default function BlogLayout({ children }) {
    return <ReadingShell site="blog">{children}</ReadingShell>;
}
