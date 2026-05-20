"use client";

import { useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * usePredictivePrefetch - Detect mouse velocity and prefetch data
 * when user is moving toward a target element
 */
export function usePredictivePrefetch(targets = []) {
    const router = useRouter();
    const mouseHistory = useRef([]);
    const prefetchedUrls = useRef(new Set());
    const animationFrame = useRef(null);

    // Track mouse position history (last 100ms)
    const trackMouse = useCallback((e) => {
        const now = Date.now();
        mouseHistory.current.push({
            x: e.clientX,
            y: e.clientY,
            time: now,
        });

        // Keep only last 100ms of history
        mouseHistory.current = mouseHistory.current.filter(
            (point) => now - point.time < 100
        );
    }, []);

    // Calculate velocity vector
    const getVelocity = useCallback(() => {
        const history = mouseHistory.current;
        if (history.length < 2) return { vx: 0, vy: 0, speed: 0 };

        const oldest = history[0];
        const newest = history[history.length - 1];
        const dt = (newest.time - oldest.time) / 1000; // seconds

        if (dt === 0) return { vx: 0, vy: 0, speed: 0 };

        const vx = (newest.x - oldest.x) / dt;
        const vy = (newest.y - oldest.y) / dt;
        const speed = Math.sqrt(vx * vx + vy * vy);

        return { vx, vy, speed };
    }, []);

    // Project trajectory and find intersection
    const projectTrajectory = useCallback((velocity, elements) => {
        if (velocity.speed < 200) return null; // Ignore slow movements

        const history = mouseHistory.current;
        if (history.length === 0) return null;

        const current = history[history.length - 1];
        
        // Project 200ms into the future
        const futureX = current.x + velocity.vx * 0.2;
        const futureY = current.y + velocity.vy * 0.2;

        // Find which element the trajectory intersects
        for (const { element, url } of elements) {
            const rect = element.getBoundingClientRect();
            
            // Check if future position is inside element bounds
            if (
                futureX >= rect.left - 50 &&
                futureX <= rect.right + 50 &&
                futureY >= rect.top - 50 &&
                futureY <= rect.bottom + 50
            ) {
                return url;
            }
        }

        return null;
    }, []);

    // Main prediction loop
    useEffect(() => {
        if (targets.length === 0) return;

        const checkPrediction = () => {
            const velocity = getVelocity();
            
            // Get current element positions
            const elements = targets
                .map((target) => ({
                    element: document.querySelector(target.selector),
                    url: target.url,
                }))
                .filter((t) => t.element);

            const predictedUrl = projectTrajectory(velocity, elements);

            if (predictedUrl && !prefetchedUrls.current.has(predictedUrl)) {
                // Prefetch the predicted URL
                router.prefetch(predictedUrl);
                prefetchedUrls.current.add(predictedUrl);
            }

            animationFrame.current = requestAnimationFrame(checkPrediction);
        };

        window.addEventListener("mousemove", trackMouse);
        animationFrame.current = requestAnimationFrame(checkPrediction);

        return () => {
            window.removeEventListener("mousemove", trackMouse);
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, [targets, router, trackMouse, getVelocity, projectTrajectory]);

    // Expose the prefetched-set as a getter — reading `.current` during
    // render is rejected by react-hooks/refs. Callers invoke
    // `getPrefetchedUrls()` when they actually need the data.
    return {
        getVelocity,
        getPrefetchedUrls: () => prefetchedUrls.current,
    };
}

export default usePredictivePrefetch;
