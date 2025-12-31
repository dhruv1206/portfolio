"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * useIdleCallback - Defer non-critical work to browser idle time
 * Falls back to setTimeout if requestIdleCallback is not supported
 */
export function useIdleCallback(callback, options = { timeout: 2000 }) {
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    useEffect(() => {
        if (typeof window === "undefined") return;

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
 * useIntersectionObserver - Observer for lazy loading based on viewport
 */
export function useIntersectionObserver(
    callback,
    options = { threshold: 0.1, rootMargin: "100px" }
) {
    const elementRef = useRef(null);
    const observerRef = useRef(null);

    useEffect(() => {
        if (typeof IntersectionObserver === "undefined") {
            callback(true); // Fallback: assume visible
            return;
        }

        observerRef.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    callback(true);
                    observerRef.current?.disconnect();
                }
            });
        }, options);

        if (elementRef.current) {
            observerRef.current.observe(elementRef.current);
        }

        return () => observerRef.current?.disconnect();
    }, [callback, options]);

    return elementRef;
}

/**
 * useDevicePerformance - Detect device performance capabilities
 */
export function useDevicePerformance() {
    const isLowEnd = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        // Check for hardware concurrency (CPU cores)
        const cpuCores = navigator.hardwareConcurrency || 4;

        // Check for device memory (if available)
        const deviceMemory = navigator.deviceMemory || 8;

        // Check if it's a mobile device
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        );

        // Consider low-end if:
        // - Less than 4 CPU cores
        // - Less than 4GB memory
        // - Mobile device with any of the above
        isLowEnd.current =
            cpuCores < 4 || deviceMemory < 4 || (isMobile && (cpuCores < 8 || deviceMemory < 6));
    }, []);

    return { isLowEnd: isLowEnd.current };
}

/**
 * usePrefersReducedMotion - Check for reduced motion preference
 */
export function usePrefersReducedMotion() {
    const prefersReducedMotion = useRef(false);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
        prefersReducedMotion.current = mediaQuery.matches;

        const handler = (e) => {
            prefersReducedMotion.current = e.matches;
        };

        mediaQuery.addEventListener("change", handler);
        return () => mediaQuery.removeEventListener("change", handler);
    }, []);

    return prefersReducedMotion.current;
}

export default {
    useIdleCallback,
    useIntersectionObserver,
    useDevicePerformance,
    usePrefersReducedMotion,
};
