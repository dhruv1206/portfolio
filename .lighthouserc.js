// Lighthouse CI (.github/workflows/lighthouse.yml). JavaScript rather than
// JSON so each relaxed assertion can say why it is relaxed.

const assertions = {
    "categories:performance": ["error", { minScore: 0.95 }],
    "categories:accessibility": ["error", { minScore: 0.95 }],
    "categories:best-practices": ["error", { minScore: 0.95 }],
    "categories:seo": ["error", { minScore: 0.95 }],
    "first-contentful-paint": ["warn", { maxNumericValue: 1500 }],
    "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
    interactive: ["warn", { maxNumericValue: 3500 }],
    "cumulative-layout-shift": ["error", { maxNumericValue: 0.05 }],
    "unused-javascript": "off",
    "unused-css-rules": "off",
    // Lighthouse 12 "insights" are diagnostics, not pass/fail checks; the
    // performance category above (0.99 to 1 on every page) is what holds
    // the line. The preset makes them errors.
    // network-dependency-tree: scores 0 whenever any request chain exists,
    //   with no items to act on.
    // legacy-javascript: the flagged polyfills (Array.prototype.at, .flat,
    //   …) ship inside Next.js's own client runtime.
    // forced-reflow: Lighthouse 12.6's trace handler keeps one call stack
    //   for every thread, so V8 parsing scripts on background threads makes
    //   an ordinary style recalc on the main thread look forced by
    //   JavaScript ("[unattributed]"). That failed main's run on every page;
    //   replayed on the main thread alone, the same trace has no forced
    //   reflow. Upstream: github.com/GoogleChrome/lighthouse/issues/17306;
    //   make it an error again once that is fixed. The forced layouts it led
    //   to in this repo's code are fixed; framer-motion's scroll measurement
    //   (ScrollProgress) still forces one, about 23 ms with the CPU slowed 4x.
    "network-dependency-tree-insight": "warn",
    "legacy-javascript-insight": "warn",
    "forced-reflow-insight": "warn",
};

// The blog's pages, on whatever host and port the URLs below use. Every
// URL must match exactly one assertMatrix entry: none, and it is not
// asserted at all.
const BLOG = "[a-z]+://[^/]+/blog(?:[/?#]|$)";

module.exports = {
    ci: {
        collect: {
            url: [
                "http://localhost:3000/",
                "http://localhost:3000/blog",
                "http://localhost:3000/projects/dstardb",
            ],
            numberOfRuns: 3,
            startServerCommand: "npm run start",
            startServerReadyPattern: "Ready in",
            settings: {
                preset: "desktop",
                throttlingMethod: "devtools",
                skipAudits: ["uses-http2"],
            },
        },
        assert: {
            assertMatrix: [
                { matchingUrlPattern: `^(?!${BLOG})`, preset: "lighthouse:recommended", assertions },
                {
                    // The blog's images are dev.to's. image-delivery's target
                    // is AVIF-sized files (1/6 byte per pixel), and dev.to's
                    // resizer only returns WebP: of the 30 covers on dev.to's
                    // front page (October 2026), 12 miss it even at the
                    // quality devto-cover.jsx asks for. As an error it would
                    // fail CI on which cover the next post has. The size
                    // covers are fetched at is this repo's, and
                    // uses-responsive-images still asserts it.
                    matchingUrlPattern: `^${BLOG}`,
                    preset: "lighthouse:recommended",
                    assertions: { ...assertions, "image-delivery-insight": "warn" },
                },
            ],
        },
        upload: {
            target: "temporary-public-storage",
        },
    },
};
