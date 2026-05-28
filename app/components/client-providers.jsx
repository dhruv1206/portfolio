"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AudioProvider } from "@/app/providers/audio-provider";
import { StealthModeProvider } from "@/app/providers/stealth-mode-provider";
import { useKonamiCode } from "@/app/hooks/use-konami-code";

// Dynamically import client-only components
const CustomCursor = dynamic(() => import("./ui/custom-cursor"), { ssr: false });
const ScrollProgress = dynamic(() => import("./ui/scroll-progress"), { ssr: false });
const LoadingScreen = dynamic(() => import("./ui/loading-screen"), { ssr: false });
const NoiseOverlay = dynamic(() => import("./ui/noise-overlay"), { ssr: false });
const FluidCursor = dynamic(() => import("./ui/fluid-cursor"), { ssr: false });
const TerminalOverlay = dynamic(() => import("./ui/terminal-overlay"), { ssr: false });
const VoiceControlButton = dynamic(() => import("./ui/voice-control-button"), { ssr: false });
const CinematicMode = dynamic(() => import("./ui/cinematic-mode"), { ssr: false });
const ViewTransitions = dynamic(() => import("./ui/view-transitions").then((m) => m.ViewTransitions), { ssr: false });
const PerfHud = dynamic(() => import("./ui/perf-hud"), { ssr: false });

// Inner component to use hooks (must be inside providers)
function ClientProvidersInner({ children }) {
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);

    // Konami code activates terminal
    useKonamiCode(() => setIsTerminalOpen(true));

    return (
        <>
            {/* Native View Transitions wrapper for route navigation */}
            <ViewTransitions />

            {/* Loading Screen */}
            <LoadingScreen />

            {/* Fluid Cursor (behind everything) */}
            <FluidCursor opacity={0.03} />

            {/* Custom Cursor (on top) */}
            <CustomCursor />

            {/* Scroll Progress Indicator */}
            <ScrollProgress />

            {/* Noise texture overlay */}
            <NoiseOverlay />

            {/* Animated Mesh Gradient Background */}
            <div className="mesh-gradient-bg" aria-hidden="true" />

            {/* Terminal Overlay (Konami code easter egg) */}
            <TerminalOverlay
                isOpen={isTerminalOpen}
                onClose={() => setIsTerminalOpen(false)}
            />

            {/* Voice Control Button */}
            <VoiceControlButton />

            {/* Cinematic Director's Cut Mode */}
            <CinematicMode />

            {/* Live perf HUD — off by default; press ` to toggle.
                Hint is visible in the footer. */}
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
