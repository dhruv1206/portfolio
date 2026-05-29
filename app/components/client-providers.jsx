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
const AudioPrompt = dynamic(() => import("./ui/audio-prompt"), { ssr: false });

// System architecture overlay + its DOM event bridge are temporarily
// hidden — the visualization shipped working but didn't read as
// useful enough yet (edges felt arbitrary on a homepage scroll-
// through, the toggle competes with the voice button for real
// estate). Source preserved at:
//   - app/components/ui/system-architecture-overlay.jsx
//   - app/components/ui/client-event-bridge.jsx
//   - app/lib/event-bus.js
//   - instrumented emit() calls in use-voice-commands /
//     use-performance / use-predictive-prefetch /
//     audio/generative-audio (these emit() are zero-cost when
//     nothing subscribes, so they can stay).
// To re-enable: uncomment the imports + mounts below and run
// `node scripts/verify-system-overlay.mjs`.
//
// const SystemArchitectureOverlay = dynamic(
//     () => import("./ui/system-architecture-overlay"),
//     { ssr: false },
// );
// const ClientEventBridge = dynamic(
//     () => import("./ui/client-event-bridge"),
//     { ssr: false },
// );

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

            {/* First-visit ambient-sound opt-in (bottom-left). */}
            <AudioPrompt />

            {/* System architecture overlay + event bridge are
                disabled — see comment block at the top of this file. */}
            {/* <SystemArchitectureOverlay /> */}
            {/* <ClientEventBridge /> */}

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
