import { GoogleTagManager } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./css/card.scss";
import "./css/globals.scss";
import ClientProviders from "./components/client-providers";
import { personalData } from "@/utils/data/personal-data";
import { archivo, geist, geistMono } from "./fonts";

const TITLE = "Dhruv Agrawal · Backend Engineer";
const DESCRIPTION =
    "Backend engineer at MyRik. The homepage is a live, breakable model of the production systems I run: kill a worker, partition the cache, watch it heal, then replay the incidents I actually fixed.";

export const metadata = {
    title: TITLE,
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
    authors: [{ name: personalData.name }],
    creator: personalData.name,
    metadataBase: new URL("https://dhruuv.me"),
    alternates: { canonical: "/" },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dhruuv.me",
        title: TITLE,
        description: DESCRIPTION,
        siteName: "dhruuv.me",
        images: [{ url: "/og-image.png", width: 1200, height: 630, alt: TITLE }],
    },
    twitter: {
        card: "summary_large_image",
        title: TITLE,
        description: DESCRIPTION,
        creator: "@dhruv_1206",
        images: ["/og-image.png"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
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
                <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM} />
                <SpeedInsights />
            </body>
        </html>
    );
}
