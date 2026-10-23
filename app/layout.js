import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./css/card.scss";
import "./css/globals.scss";
import "./css/reading.scss";
import ClientProviders from "./components/client-providers";
import { NAME, ORIGIN, SITE_DESCRIPTION as DESCRIPTION, SITE_TITLE as TITLE } from "./lib/seo";
import { archivo, geist, geistMono } from "./fonts";

// Defaults only: every page declares its own canonical, Open Graph and X
// card through app/lib/seo.js. No canonical here, or a page that forgot
// its own would claim to be the homepage.
export const metadata = {
    title: { default: TITLE, template: "%s · Dhruv Agrawal" },
    description: DESCRIPTION,
    keywords: [
        "Dhruv Agrawal",
        "Backend Engineer",
        "Software Engineer",
        "Distributed Systems",
        "System Design",
        "Spring Boot",
        "Node.js",
        "Kubernetes",
        "Postgres",
        "Redis",
        "Portfolio",
    ],
    authors: [{ name: NAME, url: ORIGIN }],
    creator: NAME,
    metadataBase: new URL(ORIGIN),
    openGraph: {
        type: "website",
        locale: "en_US",
        title: TITLE,
        description: DESCRIPTION,
        siteName: "dhruuv.me",
        images: [{ url: "/api/og?title=Dhruv%20Agrawal&sub=Backend%20engineer%20%C2%B7%20MyRik%20%C2%B7%20Bengaluru%20%C2%B7%20the%20platforms%20I%20run%20serve%20150%2C000%20people%20a%20month&path=/", width: 1200, height: 630, alt: TITLE }],
    },
    twitter: {
        card: "summary_large_image",
        title: TITLE,
        description: DESCRIPTION,
        creator: "@dhruv_1206",
        images: ["/api/og?title=Dhruv%20Agrawal&sub=Backend%20engineer%20%C2%B7%20MyRik%20%C2%B7%20Bengaluru%20%C2%B7%20the%20platforms%20I%20run%20serve%20150%2C000%20people%20a%20month&path=/"],
    },
    // Indexing is the default and is not restated: an explicit
    // "index, follow" sat next to the noindex Next adds to 404 pages.
    // These let search and AI answers quote and preview pages in full.
    robots: { "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
};

export const viewport = {
    themeColor: "#050508",
    viewportFit: "cover",
};

export default function RootLayout({ children }) {
    return (
        <html
            lang="en"
            className={`${archivo.variable} ${geist.variable} ${geistMono.variable}`}
        >
            <body className="font-body antialiased">
                {/* Skip-to-content: first focusable element so keyboard and
                    screen-reader users can bypass any chrome. */}
                <a href="#main-content" className="skip-to-content">
                    Skip to content
                </a>
                <ClientProviders>
                    <ToastContainer
                        position="bottom-right"
                        autoClose={3000}
                        hideProgressBar={false}
                        newestOnTop
                        closeOnClick
                        rtl={false}
                        pauseOnFocusLoss
                        draggable
                        pauseOnHover
                        theme="dark"
                    />
                    {children}
                </ClientProviders>
                {/* The Speed Insights script is served only by Vercel; anywhere
                    else (next start, CI) it is a 404 in the console. */}
                {process.env.VERCEL ? <SpeedInsights /> : null}
            </body>
        </html>
    );
}
