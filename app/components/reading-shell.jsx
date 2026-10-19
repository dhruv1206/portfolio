// Chrome for the reading pages: navbar, footer, the centred reading
// container and the site-only overlays (custom cursor, scroll progress).
// `site="blog"` is the blog, which in production is served from its own
// subdomain: its bar and footer then link back to the main site with
// absolute URLs. Used by app/(site)/layout.jsx and app/(blog)/layout.jsx.

import { Suspense } from "react";
import Footer from "@/app/components/footer";
import Navbar, { NavbarShell } from "@/app/components/navbar";
import ScrollToTop from "@/app/components/helper/scroll-to-top";
import SiteChrome from "@/app/components/site-chrome";

export default function ReadingShell({ site = "main", children }) {
    return (
        <SiteChrome>
            <main
                id="main-content"
                tabIndex={-1}
                className="relative min-h-screen mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] text-white outline-none"
            >
                <Suspense fallback={<NavbarShell site={site} />}>
                    <Navbar site={site} />
                </Suspense>
                {children}
                <ScrollToTop />
            </main>
            <Footer site={site} />
        </SiteChrome>
    );
}
