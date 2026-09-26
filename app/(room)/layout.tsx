// The control room shares the site bar with every other page and draws
// the rest of its chrome itself (toolbar, rail, console). No SiteChrome:
// the room needs the native cursor for grab and pinch gestures.
import { Suspense } from "react";
import Navbar, { NavbarShell } from "@/app/components/navbar";

export default function RoomLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={<NavbarShell solid />}>
                <Navbar />
            </Suspense>
            {children}
        </>
    );
}
