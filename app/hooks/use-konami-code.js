"use client";

import { useEffect, useCallback, useRef } from "react";

const KONAMI_CODE = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "KeyB",
    "KeyA",
];

/**
 * useKonamiCode - Detects the Konami code sequence
 */
export function useKonamiCode(onActivate) {
    const inputSequence = useRef([]);
    const timeoutRef = useRef(null);

    const handleKeyDown = useCallback(
        (e) => {
            // Clear timeout on each keypress
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }

            // Add key to sequence
            inputSequence.current.push(e.code);

            // Keep only the last N keys
            if (inputSequence.current.length > KONAMI_CODE.length) {
                inputSequence.current.shift();
            }

            // Check if sequence matches
            const isMatch =
                inputSequence.current.length === KONAMI_CODE.length &&
                inputSequence.current.every(
                    (key, index) => key === KONAMI_CODE[index]
                );

            if (isMatch) {
                inputSequence.current = [];
                onActivate?.();
            }

            // Reset sequence after 2 seconds of no input
            timeoutRef.current = setTimeout(() => {
                inputSequence.current = [];
            }, 2000);
        },
        [onActivate]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [handleKeyDown]);
}

/**
 * useDoubleEscape - Detects double-tap Escape for stealth mode
 */
export function useDoubleEscape(onActivate) {
    const lastEscape = useRef(0);

    const handleKeyDown = useCallback(
        (e) => {
            if (e.code !== "Escape") return;

            const now = Date.now();
            if (now - lastEscape.current < 400) {
                onActivate?.();
                lastEscape.current = 0;
            } else {
                lastEscape.current = now;
            }
        },
        [onActivate]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);
}

const konamiCodeHooks = { useKonamiCode, useDoubleEscape };

export default konamiCodeHooks;
