// Chrome for the reading pages (/r, /lab, /projects, /blog): navbar,
// footer, the centred reading container and the site-only overlays
// (custom cursor, scroll progress, voice control, ambient prompt).
// The homepage (app/(home)) shares the navbar and footer without the
// container; the control room at app/(room)/room draws its own chrome.

import Footer from "@/app/components/footer";
import { Suspense } from "react";
import Navbar, { NavbarShell } from "@/app/components/navbar";
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
                <Suspense fallback={<NavbarShell />}>
                    <Navbar />
                </Suspense>
                {children}
                <ScrollToTop />
            </main>
            <Footer />
        </SiteChrome>
    );
}
