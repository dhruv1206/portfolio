"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { eventBus } from "@/app/lib/event-bus";

/**
 * useIdleCallback - Defer non-critical work to browser idle time.
 * Falls back to setTimeout if requestIdleCallback isn't supported.
 *
 * The latest callback is held in a ref so the effect doesn't re-fire on
 * each render. The ref is written inside an effect (not during render —
 * react-hooks/refs forbids ref writes in render bodies).
 */
export function useIdleCallback(callback, options = { timeout: 2000 }) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const scheduleCallback =
            window.requestIdleCallback ||
            ((cb) => setTimeout(cb, 1));

        const cancelCallback =
            window.cancelIdleCallback ||
            clearTimeout;

        const handle = scheduleCallback(() => {
            callbackRef.current();
        }, options);

        return () => cancelCallback(handle);
    }, [options]);
}

/**
 * useIntersectionObserver - Observer for lazy loading based on viewport.
 */
export function useIntersectionObserver(
    callback,
    options = { threshold: 0.1, rootMargin: "100px" }
) {
    const elementRef = useRef(null);
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") {
            callbackRef.current(true); // Fallback: assume visible
            return undefined;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    callbackRef.current(true);
                    eventBus.emit("io:enter", {
                        target: entry.target.tagName.toLowerCase(),
                        id: entry.target.id || null,
                    });
                    observer.disconnect();
                }
            });
        }, options);

        if (elementRef.current) {
            observer.observe(elementRef.current);
        }

        return () => observer.disconnect();
    }, [options]);

    return elementRef;
}

/**
 * useDevicePerformance - Detect device performance capabilities.
 *
 * Evaluates once at first render via lazy useState — no ref mutation,
 * no setState in effect. Returns the cached result.
 */
function detectLowEnd() {
    if (typeof window === "undefined") return false;

    const cpuCores = navigator.hardwareConcurrency || 4;
    const deviceMemory = navigator.deviceMemory || 8;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    return (
        cpuCores < 4 ||
        deviceMemory < 4 ||
        (isMobile && (cpuCores < 8 || deviceMemory < 6))
    );
}

export function useDevicePerformance() {
    const [isLowEnd] = useState(detectLowEnd);
    return { isLowEnd };
}

/**
 * usePrefersReducedMotion - Reflects the `prefers-reduced-motion: reduce`
 * media query. useSyncExternalStore subscribes to MediaQueryList changes
 * so the value updates live (e.g. user toggles OS setting mid-session),
 * with a stable server snapshot to avoid hydration mismatches.
 */
const reducedMotionQuery =
    typeof window !== "undefined"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

function subscribeReducedMotion(callback) {
    if (!reducedMotionQuery) return () => {};
    reducedMotionQuery.addEventListener("change", callback);
    return () => reducedMotionQuery.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
    return reducedMotionQuery?.matches ?? false;
}

function getReducedMotionServerSnapshot() {
    return false;
}

export function usePrefersReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        getReducedMotionSnapshot,
        getReducedMotionServerSnapshot,
    );
}

const performanceHooks = {
    useIdleCallback,
    useIntersectionObserver,
    useDevicePerformance,
    usePrefersReducedMotion,
};

export default performanceHooks;
