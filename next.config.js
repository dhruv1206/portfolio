const path = require("path");
const dns = require("dns");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
});

// ---------------------------------------------------------------------------
// The blog's own subdomain.
//
// Production serves the blog from https://blog.dhruuv.me; `next dev` and
// preview deployments keep it at /blog on one host. BLOG_ORIGIN overrides
// the production default (`off` disables the subdomain, a URL changes it).
//
// The subdomain only switches on once its hostname resolves. Moving the
// blog means 308s that browsers cache for good, so a deploy that ran
// before the DNS record existed would send every old /blog link to a
// host that does not exist. A definite "no such host" keeps the blog at
// /blog for that build; any other DNS trouble is treated as transient so
// the setting does not flap between deploys.
// ---------------------------------------------------------------------------
const PRODUCTION_BLOG_ORIGIN = "https://blog.dhruuv.me";

async function resolveBlogOrigin() {
    const explicit = (process.env.BLOG_ORIGIN || "").trim();
    if (explicit === "off") return "";
    const origin = (explicit || (process.env.VERCEL_ENV === "production" ? PRODUCTION_BLOG_ORIGIN : "")).replace(/\/+$/, "");
    if (!origin) return "";
    const { hostname } = new URL(origin);
    if (hostname === "localhost" || hostname.endsWith(".localhost")) return origin;
    try {
        await Promise.race([
            dns.promises.lookup(hostname),
            new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "ETIMEOUT" })), 4000)),
        ]);
        return origin;
    } catch (err) {
        if (err && err.code === "ENOTFOUND") {
            console.warn(`[blog] ${hostname} does not resolve yet, so this build keeps the blog at /blog. Add the DNS record, then redeploy.`);
            return "";
        }
        return origin;
    }
}

// The main site's origin, for links from the blog back to it.
function siteOriginFor(blogOrigin) {
    const fromEnv = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
    if (fromEnv) return fromEnv;
    const url = new URL(blogOrigin);
    url.hostname = url.hostname.replace(/^blog\./, "");
    return url.origin;
}

const escapeHost = (host) => host.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function blogRedirects(blog, site) {
    const onBlog = [{ type: "host", value: escapeHost(new URL(blog).hostname) }];
    const sections = ["/room", "/projects", "/projects/:path*", "/lab", "/lab/:path*", "/r"];
    return [
        // Old links to the blog on the main site move to the subdomain.
        { source: "/blog", missing: onBlog, destination: `${blog}/`, permanent: true },
        { source: "/blog/:slug", missing: onBlog, destination: `${blog}/:slug`, permanent: true },
        // On the subdomain, /blog/... would be every page twice.
        { source: "/blog", has: onBlog, destination: "/", permanent: true },
        { source: "/blog/:slug", has: onBlog, destination: "/:slug", permanent: true },
        // The rest of the site asked for on the blog host goes home.
        ...sections.map((source) => ({ source, has: onBlog, destination: `${site}${source}`, permanent: true })),
    ];
}

// beforeFiles: these must win over the real homepage at `/`. A slug is
// one path segment without a dot, so /_next, /api, favicon.ico and every
// static file pass through untouched. Order matters: rewrites apply in
// sequence, so with `/` first, `/` → `/blog` would then match the slug
// rule as the slug "blog" and land on /blog/blog.
function blogRewrites(blog) {
    const onBlog = [{ type: "host", value: escapeHost(new URL(blog).hostname) }];
    return [
        // The blog host's own robots.txt, sitemap, feed and llms.txt
        // (app/(blog)/blog/), not the main site's.
        ...["/robots.txt", "/sitemap.xml", "/feed.xml", "/llms.txt"].map((source) => ({ source, has: onBlog, destination: `/blog${source}` })),
        { source: "/:slug([A-Za-z0-9][A-Za-z0-9_-]*)", has: onBlog, destination: "/blog/:slug" },
        { source: "/", has: onBlog, destination: "/blog" },
    ];
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    sassOptions: {
        includePaths: [path.join(__dirname, "styles")],
    },

    // Build-time substituted env vars. Treated as static literals after
    // build, so they don't trip Cache Components' "current-time" guard.
    env: {
        BUILD_YEAR: new Date().getFullYear().toString(),
    },

    // Optimized image configuration
    images: {
        // Use modern formats
        formats: ["image/avif", "image/webp"],

        // Device breakpoints for responsive images
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

        // Remote patterns for external images
        remotePatterns: [
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
                pathname: "**",
            },
            {
                protocol: "https",
                hostname: "media.dev.to",
                pathname: "**",
            },
            {
                protocol: "https",
                hostname: "i.ytimg.com",
                pathname: "**",
            },
        ],

        // Minimize image data footprint
        minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    },

    // Performance optimizations
    experimental: {
        // Optimize package imports
        optimizePackageImports: ["framer-motion", "react-icons"],
    },

    // Cache Components (formerly PPR / `experimental.ppr` in Next 15).
    // Strict mode: every dynamic-value access (params, fetch, Date,
    // localStorage…) must sit under a Suspense boundary. We comply by
    // wrapping route content in Suspense at the page level and isolating
    // client-only providers below the route.
    cacheComponents: true,

    // Compiler options for production
    compiler: {
        // Remove console.log in production
        removeConsole: process.env.NODE_ENV === "production",
    },

    // Headers for caching and security
    async headers() {
        return [
            {
                // `jpeg` is spelled out: the suffix match is literal, so a
                // `jpg` alternative does not cover `profile.jpeg` — which
                // was shipping with `max-age=0, must-revalidate`.
                source: "/:all*(svg|jpg|jpeg|png|webp|avif|gif|ico)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
            {
                source: "/:all*(woff|woff2)",
                headers: [
                    {
                        key: "Cache-Control",
                        value: "public, max-age=31536000, immutable",
                    },
                ],
            },
        ];
    },
};

module.exports = async () => {
    const blog = await resolveBlogOrigin();
    const site = blog ? siteOriginFor(blog) : "";
    return withBundleAnalyzer({
        ...nextConfig,
        // Inlined for app/lib/origins.js; "" means the blog lives at /blog.
        env: { ...nextConfig.env, BLOG_ORIGIN: blog, SITE_ORIGIN: site },
        async redirects() {
            return blog ? blogRedirects(blog, site) : [];
        },
        async rewrites() {
            return blog ? { beforeFiles: blogRewrites(blog), afterFiles: [], fallback: [] } : [];
        },
    });
};