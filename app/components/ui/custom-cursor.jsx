"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";
import { useMounted } from "@/app/hooks/use-mounted";
import { useFeatureSupport } from "@/app/hooks/use-feature-support";

// Everything the cursor treats as "interactive" lives here so the
// delegated listener has a single source of truth.
const INTERACTIVE_SELECTOR =
    'a, button, [data-cursor="pointer"], input, textarea, select, [role="button"]';

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

    // framer-motion writes motion values straight to the element's
    // transform, bypassing React's render cycle. We bind the cursor to
    // these RAW values — NOT a useSpring derivative — so it tracks the
    // pointer 1:1. A spring here is what made the cursor feel laggy.
    const cursorX = useMotionValue(-100);
    const cursorY = useMotionValue(-100);

    const moveCursor = useCallback(
        (e) => {
            cursorX.set(e.clientX);
            cursorY.set(e.clientY);
        },
        [cursorX, cursorY],
    );

    useEffect(() => {
        if (isTouchDevice) return undefined;

        const handleMouseMove = (e) => moveCursor(e);
        const handleMouseEnter = () => setIsPointerOnPage(true);
        const handleMouseLeave = () => setIsPointerOnPage(false);

        // Hover detection by EVENT DELEGATION. `pointerover` bubbles, so a
        // single document-level listener plus `closest()` tells us whether
        // the pointer is over something interactive, and dynamically-added
        // elements just work. setState bails out when the value is
        // unchanged, so this stays cheap even though pointerover fires on
        // each element boundary crossing. (This replaced a MutationObserver
        // that re-scanned the whole document and leaked per-element
        // listeners on every DOM mutation.)
        const handlePointerOver = (e) => {
            const el =
                e.target instanceof Element
                    ? e.target.closest(INTERACTIVE_SELECTOR)
                    : null;
            setIsHovering(Boolean(el));
        };

        window.addEventListener("mousemove", handleMouseMove, { passive: true });
        document.addEventListener("mouseenter", handleMouseEnter);
        document.addEventListener("mouseleave", handleMouseLeave);
        document.addEventListener("pointerover", handlePointerOver, {
            passive: true,
        });

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseenter", handleMouseEnter);
            document.removeEventListener("mouseleave", handleMouseLeave);
            document.removeEventListener("pointerover", handlePointerOver);
        };
    }, [moveCursor, isTouchDevice]);

    const isVisible = mounted && !isTouchDevice && isPointerOnPage;
    if (!isVisible) return null;

    return (
        <>
            {/* Dot — a small, crisp point bound to the RAW motion values
                (instant tracking). It deliberately does NOT grow on hover:
                the old design ballooned it to an 80px white
                mix-blend-difference disc that blotted out button labels
                (which read as the button being "cut off"). The hover
                signal lives on the ring instead. */}
            <motion.div
                data-custom-cursor="dot"
                className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
                style={{ x: cursorX, y: cursorY }}
            >
                <div className="w-3 h-3 -ml-1.5 -mt-1.5 rounded-full bg-white" />
            </motion.div>

            {/* Ring — also tracks 1:1, and expands + brightens on hover to
                signal interactivity. Being a thin outline, it frames the
                cursor without covering whatever is underneath. */}
            <motion.div
                data-custom-cursor="ring"
                className="fixed top-0 left-0 pointer-events-none z-[9998]"
                style={{ x: cursorX, y: cursorY }}
            >
                <motion.div
                    className="border-2 border-violet-500 rounded-full"
                    animate={{
                        width: isHovering ? 56 : 36,
                        height: isHovering ? 56 : 36,
                        marginLeft: isHovering ? -28 : -18,
                        marginTop: isHovering ? -28 : -18,
                        opacity: isHovering ? 0.9 : 0.45,
                    }}
                    transition={{ type: "spring", damping: 22, stiffness: 350 }}
                />
            </motion.div>
        </>
    );
};

export default CustomCursor;
