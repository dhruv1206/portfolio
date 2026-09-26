// Chrome for every page except the control room at `/`: navbar,
// footer, the centred reading container and the site-only overlays
// (custom cursor, scroll progress, voice control, ambient prompt).
// The control room at app/(room) draws its own chrome.

import Footer from "@/app/components/footer";
import Navbar from "@/app/components/navbar";
import ScrollToTop from "@/app/components/helper/scroll-to-top";
import SiteChrome from "@/app/components/site-chrome";

export default function SiteLayout({ children }) {
    return (
        <SiteChrome>
            <main
                id="main-content"
                tabIndex={-1}
                className="relative min-h-screen mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] text-white outline-none"
            >
                <Navbar />
                {children}
                <ScrollToTop />
            </main>
            <Footer />
        </SiteChrome>
    );
}
