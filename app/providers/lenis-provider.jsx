"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import Lenis from "@studio-freight/lenis";

const LenisContext = createContext(null);

// Friction weights for different section types
const FRICTION_WEIGHTS = {
    default: 0.1,
    heavy: 0.15, // 3D scenes, hero sections
    light: 0.05, // Empty space, minimal content
};

export function LenisProvider({ children }) {
    const lenisRef = useRef(null);
    const rafRef = useRef(null);
    const [scrollVelocity, setScrollVelocity] = useState(0);

    useEffect(() => {
        // Initialize Lenis with smooth scrolling
        lenisRef.current = new Lenis({
            duration: 1.2,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // Exponential ease-out
            orientation: "vertical",
            gestureOrientation: "vertical",
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 2,
            infinite: false,
        });

        // Track scroll velocity
        lenisRef.current.on("scroll", ({ velocity }) => {
            setScrollVelocity(velocity);
        });

        // Animation frame loop
        const raf = (time) => {
            lenisRef.current?.raf(time);
            rafRef.current = requestAnimationFrame(raf);
        };
        rafRef.current = requestAnimationFrame(raf);

        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            lenisRef.current?.destroy();
        };
    }, []);

    // Adaptive friction based on section weight
    useEffect(() => {
        if (!lenisRef.current) return;

        const observeSections = () => {
            const sections = document.querySelectorAll("[data-scroll-weight]");

            const observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => {
                        if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                            const weight = entry.target.dataset.scrollWeight;
                            const friction = FRICTION_WEIGHTS[weight] || FRICTION_WEIGHTS.default;

                            // Adjust Lenis duration (higher = slower/heavier)
                            if (lenisRef.current) {
                                lenisRef.current.options.duration = friction === FRICTION_WEIGHTS.heavy
                                    ? 1.8
                                    : friction === FRICTION_WEIGHTS.light
                                        ? 0.8
                                        : 1.2;
                            }
                        }
                    });
                },
                { threshold: 0.5 }
            );

            sections.forEach((section) => observer.observe(section));
            return () => observer.disconnect();
        };

        // Wait for DOM to be ready
        const timeout = setTimeout(observeSections, 100);
        return () => clearTimeout(timeout);
    }, []);

    // Scroll to element helper
    const scrollTo = useCallback((target, options = {}) => {
        lenisRef.current?.scrollTo(target, {
            offset: 0,
            duration: 1.5,
            easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            ...options,
        });
    }, []);

    // Stop/start scroll
    const stop = useCallback(() => lenisRef.current?.stop(), []);
    const start = useCallback(() => lenisRef.current?.start(), []);

    return (
        <LenisContext.Provider
            value={{
                lenis: lenisRef.current,
                scrollVelocity,
                scrollTo,
                stop,
                start,
            }}
        >
            {children}
        </LenisContext.Provider>
    );
}

export function useLenis() {
    const context = useContext(LenisContext);
    if (!context) {
        // Return defaults if not in provider
        return {
            lenis: null,
            scrollVelocity: 0,
            scrollTo: () => { },
            stop: () => { },
            start: () => { },
        };
    }
    return context;
}

export default LenisProvider;
