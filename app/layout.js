import { GoogleTagManager } from "@next/third-parties/google";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "./components/footer";
import Navbar from "./components/navbar";
import "./css/card.scss";
import "./css/globals.scss";
import ScrollToTop from "./components/helper/scroll-to-top";
import ClientProviders from "./components/client-providers";
import { personalData } from "@/utils/data/personal-data";
import { spaceGrotesk, inter } from "./fonts";

export const metadata = {
    title: `${personalData.name} | ${personalData.designation}`,
    description: `${personalData.designation} specializing in System Design, NLP, and High-Performance Backends. ${personalData.description}`,
    keywords: [
        "Software Developer",
        "Full Stack Developer",
        "System Design",
        "Backend Engineer",
        personalData.name,
        "Portfolio",
        "React",
        "Next.js",
        "Node.js",
        "Flutter",
        "ElasticSearch",
        "AWS",
    ],
    authors: [{ name: personalData.name }],
    creator: personalData.name,
    metadataBase: new URL("https://dhruuv.me"),
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        locale: "en_US",
        url: "https://dhruuv.me",
        title: `${personalData.name} | ${personalData.designation}`,
        description: `Specializing in System Design, NLP, and High-Performance Backends. Building scalable applications and solving complex problems.`,
        siteName: `${personalData.name} Portfolio`,
        images: [
            {
                url: "/og-image.png",
                width: 1200,
                height: 630,
                alt: `${personalData.name} - ${personalData.designation}`,
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: `${personalData.name} | ${personalData.designation}`,
        description: "Specializing in System Design, NLP, and High-Performance Backends.",
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

export default function RootLayout({ children }) {
    return (
        <html
            lang="en"
            className={`${spaceGrotesk.variable} ${inter.variable}`}
        >
            <body className="font-body antialiased">
                {/* Skip-to-content: first focusable element so keyboard
                    + screen-reader users can bypass the nav. Styles in
                    globals.scss (.skip-to-content). */}
                <a href="#main-content" className="skip-to-content">
                    Skip to content
                </a>
                <ClientProviders>
                    {/* Toast Notifications */}
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

                    {/* Main Content. `id` is the skip-link target;
                        tabIndex=-1 lets it receive programmatic focus
                        without entering the tab order. */}
                    <main
                        id="main-content"
                        tabIndex={-1}
                        className="relative min-h-screen mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] text-white outline-none"
                    >
                        <Navbar />
                        {children}
                        <ScrollToTop />
                    </main>

                    {/* Footer */}
                    <Footer />
                </ClientProviders>

                {/* Google Tag Manager */}
                <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM} />
            </body>
        </html>
    );
}
