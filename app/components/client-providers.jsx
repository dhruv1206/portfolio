"use client";

// Root-level client providers, mounted once in app/layout.js for every
// route: audio, stealth résumé (Esc Esc), the Konami terminal, native
// view transitions and the perf HUD (backtick). Page-specific chrome
// lives in app/components/site-chrome.jsx (reading pages) and in the
// control room itself (app/components/room).

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AudioProvider } from "@/app/providers/audio-provider";
import { StealthModeProvider } from "@/app/providers/stealth-mode-provider";
import { useKonamiCode } from "@/app/hooks/use-konami-code";

const TerminalOverlay = dynamic(() => import("./ui/terminal-overlay"), { ssr: false });
const ViewTransitions = dynamic(
    () => import("./ui/view-transitions").then((m) => m.ViewTransitions),
    { ssr: false },
);
const PerfHud = dynamic(() => import("./ui/perf-hud"), { ssr: false });

// System architecture overlay + its DOM event bridge stay parked; see
// app/components/ui/system-architecture-overlay.jsx.

function ClientProvidersInner({ children }) {
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);

    // Konami code opens the terminal. The control room's ⌘K palette
    // opens it too, through a DOM event, so both entry points share
    // one instance.
    useKonamiCode(() => setIsTerminalOpen(true));
    useEffect(() => {
        const open = () => setIsTerminalOpen(true);
        window.addEventListener("cr:terminal", open);
        return () => window.removeEventListener("cr:terminal", open);
    }, []);

    return (
        <>
            <ViewTransitions />
            <TerminalOverlay
                isOpen={isTerminalOpen}
                onClose={() => setIsTerminalOpen(false)}
            />
            <PerfHud />
            {children}
        </>
    );
}

export default function ClientProviders({ children }) {
    return (
        <AudioProvider>
            <StealthModeProvider>
                <ClientProvidersInner>{children}</ClientProvidersInner>
            </StealthModeProvider>
        </AudioProvider>
    );
}
