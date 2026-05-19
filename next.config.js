const path = require("path");
const withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    sassOptions: {
        includePaths: [path.join(__dirname, "styles")],
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

    // Compiler options for production
    compiler: {
        // Remove console.log in production
        removeConsole: process.env.NODE_ENV === "production",
    },

    // Headers for caching and security
    async headers() {
        return [
            {
                source: "/:all*(svg|jpg|png|webp|avif)",
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

module.exports = withBundleAnalyzer(nextConfig);