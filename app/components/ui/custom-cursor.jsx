"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

const CustomCursor = () => {
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
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
        // Check if device has touch capability (mobile)
        const isTouchDevice =
            "ontouchstart" in window || navigator.maxTouchPoints > 0;
        if (isTouchDevice) return;

        setIsVisible(true);

        const handleMouseMove = (e) => {
            moveCursor(e);
        };

        const handleMouseEnter = () => setIsVisible(true);
        const handleMouseLeave = () => setIsVisible(false);

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
    }, [moveCursor]);

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
                    <div
                        className={`rounded-full bg-white transition-all duration-200 ${isHovering ? "w-full h-full" : "w-full h-full"
                            }`}
                    />
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
