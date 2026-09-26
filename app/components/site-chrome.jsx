"use client";

// Site-only overlays, mounted by app/(site)/layout.jsx. Everything here
// is client-only (cursor tracking, scroll listeners, Web Speech), so it
// is loaded with `ssr: false` and kept out of the control room, which
// uses the native cursor for grab and pinch gestures.

import { useEffect } from "react";
import dynamic from "next/dynamic";

const CustomCursor = dynamic(() => import("./ui/custom-cursor"), { ssr: false });
const FluidCursor = dynamic(() => import("./ui/fluid-cursor"), { ssr: false });
const ScrollProgress = dynamic(() => import("./ui/scroll-progress"), { ssr: false });
const VoiceControlButton = dynamic(() => import("./ui/voice-control-button"), { ssr: false });
const AudioPrompt = dynamic(() => import("./ui/audio-prompt"), { ssr: false });

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
            <VoiceControlButton />
            <AudioPrompt />
            {children}
        </>
    );
}
