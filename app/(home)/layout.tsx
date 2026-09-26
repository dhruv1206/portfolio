// Homepage chrome: the shared navbar and footer plus the site overlays,
// without the centred reading container the other pages use (the
// stages lay themselves out on a full-width grid).
import Footer from "@/app/components/footer";
import { Suspense } from "react";
import Navbar, { NavbarShell } from "@/app/components/navbar";
import SiteChrome from "@/app/components/site-chrome";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
    return (
        <SiteChrome quiet>
            <Suspense fallback={<NavbarShell />}>
                <Navbar />
            </Suspense>
            {children}
            <Footer />
        </SiteChrome>
    );
}
