"use client";

import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register ScrollTrigger plugin
if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

/**
 * RevealAnimation - Scroll-triggered reveal animation wrapper
 *
 * @param {React.ReactNode} children - Content to animate
 * @param {string} animation - 'fade-up' | 'fade-down' | 'fade-left' | 'fade-right' | 'scale' | 'rotate'
 * @param {number} delay - Animation delay in seconds
 * @param {number} duration - Animation duration in seconds
 * @param {string} className - Additional CSS classes
 * @param {boolean} stagger - Enable stagger effect for children
 * @param {number} staggerAmount - Stagger delay between children
 */
const RevealAnimation = ({
    children,
    animation = "fade-up",
    delay = 0,
    duration = 0.8,
    className = "",
    stagger = false,
    staggerAmount = 0.1,
    threshold = 0.2,
}) => {
    const elementRef = useRef(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) {
            gsap.set(element, { opacity: 1, x: 0, y: 0, scale: 1, rotation: 0 });
            return;
        }

        // Animation configurations
        const animations = {
            "fade-up": { y: 60, opacity: 0 },
            "fade-down": { y: -60, opacity: 0 },
            "fade-left": { x: 60, opacity: 0 },
            "fade-right": { x: -60, opacity: 0 },
            scale: { scale: 0.8, opacity: 0 },
            rotate: { rotation: -10, opacity: 0 },
        };

        const fromVars = animations[animation] || animations["fade-up"];

        // Set initial state
        gsap.set(element, fromVars);

        // Animate to final state
        const targets = stagger ? element.children : element;

        gsap.to(targets, {
            y: 0,
            x: 0,
            scale: 1,
            rotation: 0,
            opacity: 1,
            duration,
            delay,
            ease: "power3.out",
            stagger: stagger ? staggerAmount : 0,
            scrollTrigger: {
                trigger: element,
                start: `top ${100 - threshold * 100}%`,
                end: "bottom 20%",
                toggleActions: "play none none reverse",
            },
        });

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => {
                if (trigger.trigger === element) {
                    trigger.kill();
                }
            });
        };
    }, [animation, delay, duration, stagger, staggerAmount, threshold]);

    return (
        <div ref={elementRef} className={className}>
            {children}
        </div>
    );
};

/**
 * ParallaxWrapper - Parallax scrolling effect wrapper
 *
 * @param {React.ReactNode} children - Content to apply parallax
 * @param {number} speed - Parallax speed multiplier (0.5 = half speed, 2 = double speed)
 * @param {string} direction - 'vertical' | 'horizontal'
 * @param {string} className - Additional CSS classes
 */
export const ParallaxWrapper = ({
    children,
    speed = 0.5,
    direction = "vertical",
    className = "",
}) => {
    const elementRef = useRef(null);

    useEffect(() => {
        const element = elementRef.current;
        if (!element) return;

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) return;

        const property = direction === "vertical" ? "y" : "x";
        const distance = 100 * speed;

        gsap.to(element, {
            [property]: -distance,
            ease: "none",
            scrollTrigger: {
                trigger: element,
                start: "top bottom",
                end: "bottom top",
                scrub: true,
            },
        });

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => {
                if (trigger.trigger === element) {
                    trigger.kill();
                }
            });
        };
    }, [speed, direction]);

    return (
        <div ref={elementRef} className={className}>
            {children}
        </div>
    );
};

/**
 * TextReveal - Character-by-character text reveal animation
 */
export const TextReveal = ({
    text,
    className = "",
    delay = 0,
    staggerAmount = 0.03,
}) => {
    const textRef = useRef(null);

    useEffect(() => {
        const element = textRef.current;
        if (!element) return;

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) {
            gsap.set(element.children, { opacity: 1, y: 0 });
            return;
        }

        gsap.set(element.children, { opacity: 0, y: 40 });

        gsap.to(element.children, {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay,
            stagger: staggerAmount,
            ease: "power3.out",
            scrollTrigger: {
                trigger: element,
                start: "top 80%",
                toggleActions: "play none none reverse",
            },
        });

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => {
                if (trigger.trigger === element) {
                    trigger.kill();
                }
            });
        };
    }, [text, delay, staggerAmount]);

    return (
        <span ref={textRef} className={`inline-flex flex-wrap ${className}`}>
            {text.split("").map((char, index) => (
                <span key={index} className="inline-block">
                    {char === " " ? "\u00A0" : char}
                </span>
            ))}
        </span>
    );
};

/**
 * SplitTextLines - Line-by-line text reveal
 */
export const SplitTextLines = ({
    children,
    className = "",
    delay = 0,
    staggerAmount = 0.15,
}) => {
    const containerRef = useRef(null);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) return;

        const lines = element.querySelectorAll(".split-line");

        gsap.set(lines, { opacity: 0, y: 30 });

        gsap.to(lines, {
            opacity: 1,
            y: 0,
            duration: 0.8,
            delay,
            stagger: staggerAmount,
            ease: "power3.out",
            scrollTrigger: {
                trigger: element,
                start: "top 80%",
                toggleActions: "play none none reverse",
            },
        });

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => {
                if (trigger.trigger === element) {
                    trigger.kill();
                }
            });
        };
    }, [delay, staggerAmount]);

    return (
        <div ref={containerRef} className={className}>
            {children}
        </div>
    );
};

export default RevealAnimation;
