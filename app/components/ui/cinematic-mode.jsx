"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    startGenerativeAudio,
    stopGenerativeAudio,
    setSection,
    setVolume,
} from "@/app/audio/generative-audio";

// Cinematic camera path - sections to visit with timing
const CAMERA_PATH = [
    { section: "hero", duration: 5000, description: "The Journey Begins" },
    { section: "about", duration: 4000, description: "Meet the Developer" },
    { section: "skills", duration: 4000, description: "Technical Arsenal" },
    { section: "experience", duration: 5000, description: "Professional Story" },
    { section: "projects", duration: 6000, description: "Creative Works" },
    { section: "education", duration: 3000, description: "Academic Foundation" },
    { section: "contact", duration: 4000, description: "Let's Connect" },
];

const CinematicMode = () => {
    const pathname = usePathname();
    const [isActive, setIsActive] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [showButton, setShowButton] = useState(true);
    const timeoutRef = useRef(null);
    const volumeIntervalRef = useRef(null);

    // Only show on homepage
    const isMainPage = pathname === "/" || pathname.startsWith("/#");

    // Start cinematic mode
    const startCinematic = useCallback(async () => {
        setIsActive(true);
        setCurrentIndex(0);
        setShowButton(false);

        // Start generative audio with swell
        await startGenerativeAudio();
        let vol = 0;
        volumeIntervalRef.current = setInterval(() => {
            vol = Math.min(vol + 0.02, 0.7);
            setVolume(vol);
        }, 100);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, []);

    // Stop cinematic mode
    const stopCinematic = useCallback(() => {
        setIsActive(false);
        setShowButton(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);

        // Fade out audio
        let vol = 0.7;
        const fadeOut = setInterval(() => {
            vol = Math.max(vol - 0.05, 0);
            setVolume(vol);
            if (vol <= 0) {
                clearInterval(fadeOut);
                stopGenerativeAudio();
            }
        }, 100);
    }, []);

    // Animate through sections. Terminal condition (last section
    // reached) is detected inside the setTimeout callback rather than
    // synchronously in the effect body — react-hooks/set-state-in-effect
    // forbids calling setState directly during effect, so we defer the
    // stop into the timer, which is an event-handler context.
    useEffect(() => {
        if (!isActive) return undefined;

        const currentPath = CAMERA_PATH[currentIndex];
        if (!currentPath) return undefined;

        // Update generative audio section
        setSection(currentPath.section);

        // Scroll to section
        const element = document.getElementById(currentPath.section);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
        }

        // Schedule next section, or stop if we've reached the end.
        timeoutRef.current = setTimeout(() => {
            const nextIndex = currentIndex + 1;
            if (nextIndex >= CAMERA_PATH.length) {
                stopCinematic();
            } else {
                setCurrentIndex(nextIndex);
            }
        }, currentPath.duration);

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [isActive, currentIndex, stopCinematic]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (volumeIntervalRef.current) clearInterval(volumeIntervalRef.current);
            stopGenerativeAudio();
        };
    }, []);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape" && isActive) {
                stopCinematic();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isActive, stopCinematic]);

    if (!isMainPage) return null;
    return (
        <>
            {/* Director's Cut Button */}
            <AnimatePresence>
                {showButton && (
                    <motion.button
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        onClick={startCinematic}
                        className="hidden lg:block fixed top-1/2 -translate-y-1/2 right-4 z-50 px-4 py-3
                            bg-gradient-to-b from-dark-800/90 to-dark-900/90 backdrop-blur-sm
                            border border-violet-500/30 rounded-lg shadow-lg
                            hover:border-violet-500/50 hover:shadow-violet-500/20
                            transition-all duration-300 group"
                        title="Watch the Director's Cut"
                    >
                        <div className="flex flex-col items-center gap-1">
                            {/* Film icon */}
                            <svg
                                className="w-5 h-5 text-violet-400 group-hover:text-violet-300"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                                />
                            </svg>
                            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-medium">
                                Director&apos;s<br />Cut
                            </span>
                        </div>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Cinematic Overlay */}
            <AnimatePresence>
                {isActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] pointer-events-none"
                    >
                        {/* Letterbox bars */}
                        <div className="absolute top-0 left-0 right-0 h-16 bg-black" />
                        <div className="absolute bottom-0 left-0 right-0 h-16 bg-black" />

                        {/* Section title */}
                        <div className="absolute bottom-20 left-8">
                            <motion.div
                                key={currentIndex}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="text-white"
                            >
                                <div className="text-xs text-violet-400 uppercase tracking-widest mb-1">
                                    {currentIndex + 1} / {CAMERA_PATH.length}
                                </div>
                                <div className="text-2xl font-light tracking-wide">
                                    {CAMERA_PATH[currentIndex]?.description}
                                </div>
                            </motion.div>
                        </div>

                        {/* Progress bar */}
                        <div className="absolute bottom-4 left-8 right-8">
                            <div className="h-1 bg-white/20 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500"
                                    initial={{ width: "0%" }}
                                    animate={{
                                        width: `${((currentIndex + 1) / CAMERA_PATH.length) * 100}%`,
                                    }}
                                    transition={{ duration: 0.5 }}
                                />
                            </div>
                        </div>

                        {/* Skip button */}
                        <button
                            onClick={stopCinematic}
                            className="absolute top-4 right-8 px-4 py-2 text-white/60 hover:text-white
                                text-sm uppercase tracking-wider transition-colors pointer-events-auto"
                        >
                            Skip (ESC)
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default CinematicMode;
