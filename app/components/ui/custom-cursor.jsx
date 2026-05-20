"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { useMounted } from "@/app/hooks/use-mounted";
import { useFeatureSupport } from "@/app/hooks/use-feature-support";

const CustomCursor = () => {
    // Touch-capable devices (phones/tablets) skip the custom cursor —
    // they don't have a hover state to enhance. We read this with
    // useSyncExternalStore-backed `useFeatureSupport` so there's no
    // setState-in-effect anti-pattern; the SSR snapshot returns false
    // so the server renders nothing and hydration completes cleanly.
    const isTouchDevice = useFeatureSupport(
        () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
    );
    const mounted = useMounted();

    const [isHovering, setIsHovering] = useState(false);
    const [isPointerOnPage, setIsPointerOnPage] = useState(true);
    const [cursorText, setCursorText] = useState("");

    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    // Smooth spring animation for cursor movement
    const springConfig = { damping: 25, stiffness: 400 };
    const cursorXSpring = useSpring(cursorX, springConfig);
    const cursorYSpring = useSpring(cursorY, springConfig);

    const moveCursor = useCallback(
        (e) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
        },
        [cursorX, cursorY]
    );

    useEffect(() => {
        if (isTouchDevice) return;

        const handleMouseMove = (e) => {
            moveCursor(e);
        };

        const handleMouseEnter = () => setIsPointerOnPage(true);
        const handleMouseLeave = () => setIsPointerOnPage(false);

        // Add hover detection for interactive elements
        const addHoverListeners = () => {
            const interactiveElements = document.querySelectorAll(
                'a, button, [data-cursor="pointer"], input, textarea, [role="button"]'
            );

            interactiveElements.forEach((el) => {
                el.addEventListener("mouseenter", () => {
                    setIsHovering(true);
                    const text = el.getAttribute("data-cursor-text");
                    if (text) setCursorText(text);
                });
                el.addEventListener("mouseleave", () => {
                    setIsHovering(false);
                    setCursorText("");
                });
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseenter", handleMouseEnter);
        document.addEventListener("mouseleave", handleMouseLeave);

        // Initial setup and mutation observer for dynamic content
        addHoverListeners();

        const observer = new MutationObserver(() => {
            addHoverListeners();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseenter", handleMouseEnter);
            document.removeEventListener("mouseleave", handleMouseLeave);
            observer.disconnect();
        };
    }, [moveCursor, isTouchDevice]);

    const isVisible = mounted && !isTouchDevice && isPointerOnPage;
    if (!isVisible) return null;

    return (
        <>
            {/* Main cursor dot */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
                style={{
                    x: cursorXSpring,
                    y: cursorYSpring,
                }}
            >
                <motion.div
                    className="relative flex items-center justify-center"
                    animate={{
                        width: isHovering ? 80 : 20,
                        height: isHovering ? 80 : 20,
                        marginLeft: isHovering ? -40 : -10,
                        marginTop: isHovering ? -40 : -10,
                    }}
                    transition={{
                        type: "spring",
                        damping: 20,
                        stiffness: 300,
                    }}
                >
                    <div className="rounded-full bg-white w-full h-full transition-all duration-200" />
                    {cursorText && (
                        <span className="absolute text-black text-xs font-medium whitespace-nowrap">
                            {cursorText}
                        </span>
                    )}
                </motion.div>
            </motion.div>

            {/* Trailing cursor ring */}
            <motion.div
                className="fixed top-0 left-0 pointer-events-none z-[9998]"
                style={{
                    x: cursorXSpring,
                    y: cursorYSpring,
                }}
            >
                <motion.div
                    className="border-2 border-violet-500/50 rounded-full"
                    animate={{
                        width: isHovering ? 100 : 40,
                        height: isHovering ? 100 : 40,
                        marginLeft: isHovering ? -50 : -20,
                        marginTop: isHovering ? -50 : -20,
                        opacity: isHovering ? 0.8 : 0.5,
                    }}
                    transition={{
                        type: "spring",
                        damping: 15,
                        stiffness: 200,
                    }}
                />
            </motion.div>
        </>
    );
};

export default CustomCursor;
