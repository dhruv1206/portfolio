// Where the two halves of the site live. In production the blog has its
// own subdomain (blog.dhruuv.me) and everything else stays on the apex,
// so any link that crosses between them must be absolute. In `next dev`
// and on preview deployments both live on one host and links stay
// relative. next.config.js decides the values at build time and inlines
// them as BLOG_ORIGIN / SITE_ORIGIN ("" when the blog is at /blog).

const BLOG = process.env.BLOG_ORIGIN || "";
const SITE = process.env.SITE_ORIGIN || "";

/** Host of the blog subdomain, or "" when the blog is served at /blog. */
export const BLOG_HOST = BLOG ? new URL(BLOG).host : "";

/** Origins that belong to this site; links to them open in the same tab. */
export const OWN_ORIGINS = [SITE, BLOG].filter(Boolean);

/** The blog index, or one article when `slug` is given. */
export function blogUrl(slug) {
    if (BLOG) return slug ? `${BLOG}/${slug}` : `${BLOG}/`;
    return slug ? `/blog/${slug}` : "/blog";
}

/** A page on the main site; absolute only when the blog has its own host. */
export function siteUrl(path = "/") {
    return `${SITE}${path}`;
}

/** Browser only: is this page being served from the blog subdomain? */
export function onBlogHost() {
    return BLOG_HOST !== "" && typeof window !== "undefined" && window.location.host === BLOG_HOST;
}
