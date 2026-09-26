"use client";

// Site-only overlays, mounted by app/(site)/layout.jsx and app/(home)/
// layout.tsx: the custom and fluid cursors and the scroll progress line.
// Everything here is client-only, so it is loaded with `ssr: false` and
// kept out of the control room at /room, which uses the native cursor
// for grab and pinch gestures. Voice navigation and the ambient
// soundscape are reached through the ⌘K palette instead of popups.

import { useEffect } from "react";
import dynamic from "next/dynamic";

const CustomCursor = dynamic(() => import("./ui/custom-cursor"), { ssr: false });
const FluidCursor = dynamic(() => import("./ui/fluid-cursor"), { ssr: false });
const ScrollProgress = dynamic(() => import("./ui/scroll-progress"), { ssr: false });

export default function SiteChrome({ children }) {
    // `body.site` scopes the custom-cursor rules in globals.scss so the
    // control room keeps the browser cursor.
    useEffect(() => {
        document.body.classList.add("site");
        return () => document.body.classList.remove("site");
    }, []);

    return (
        <>
            <FluidCursor opacity={0.03} />
            <CustomCursor />
            <ScrollProgress />
            {children}
        </>
    );
}
