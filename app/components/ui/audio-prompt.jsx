"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useAudio } from "@/app/providers/audio-provider";
import { useMounted } from "@/app/hooks/use-mounted";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";
import { useLocalStorageBoolean } from "@/app/hooks/use-localstorage-state";
import { HiSpeakerWave, HiXMark } from "react-icons/hi2";

// First-visit ambient-sound prompt.
//
// Why a prompt instead of autoplay: browsers block audio until a user
// gesture, AND auto-sound is hostile to a recruiter browsing with
// other tabs/calls open. So we stay muted by default and offer a
// one-tap opt-in. The tap itself is the gesture that lets the
// AudioContext resume, so enabling here actually produces sound (vs
// flipping a default that the browser would still gate).
//
// Shows once (localStorage), bottom-LEFT so it doesn't collide with
// the voice button (bottom-right). Skipped entirely under
// prefers-reduced-motion — a strong signal the visitor wants calm.

export default function AudioPrompt() {
    const mounted = useMounted();
    const reduced = usePrefersReducedMotion();
    const { isMuted, toggleMute, toggleAmbient, isAmbientEnabled } = useAudio();
    const [seen, setSeen] = useLocalStorageBoolean("audio-prompt-seen", false);

    // Render nothing until mounted (avoids hydration flash), if the
    // visitor has seen it, if reduced-motion is on, or if audio is
    // already unmuted (they found the navbar control first).
    const visible = mounted && !seen && !reduced && isMuted;

    const enable = () => {
        if (isMuted) toggleMute(); // unmute
        if (!isAmbientEnabled) toggleAmbient(); // arm ambient
        setSeen(true);
    };
    const dismiss = () => setSeen(true);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                    className="fixed bottom-6 left-6 z-[90] max-w-[300px]"
                    role="dialog"
                    aria-label="Enable ambient sound"
                    data-audio-prompt
                >
                    <div className="glass-card overflow-hidden shadow-2xl shadow-violet-500/10">
                        <div className="flex items-start gap-3 p-4">
                            <span className="mt-0.5 flex-shrink-0 w-9 h-9 rounded-full bg-violet-500/15 border border-violet-500/40 flex items-center justify-center text-violet-300">
                                <HiSpeakerWave size={18} />
                            </span>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-200 font-medium leading-snug">
                                    This site has a gentle ambient soundscape.
                                </p>
                                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                    Section-aware, –28&nbsp;dB. Off by default —
                                    your call.
                                </p>
                                <div className="flex items-center gap-2 mt-3">
                                    <button
                                        type="button"
                                        onClick={enable}
                                        data-audio-prompt-enable
                                        className="px-3 py-1.5 text-xs font-semibold rounded-md bg-violet-500/20 border border-violet-500/50 text-violet-100 hover:bg-violet-500/40 hover:border-violet-500/80 transition-colors"
                                    >
                                        Enable sound
                                    </button>
                                    <button
                                        type="button"
                                        onClick={dismiss}
                                        className="px-3 py-1.5 text-xs font-medium rounded-md text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                                    >
                                        No thanks
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={dismiss}
                                aria-label="Dismiss"
                                className="flex-shrink-0 text-gray-500 hover:text-white transition-colors"
                            >
                                <HiXMark size={16} />
                            </button>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
