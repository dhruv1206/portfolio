"use client";

import { useCallback } from "react";

/**
 * useHaptics - Hook for haptic feedback on supported devices
 */
export function useHaptics() {
    const vibrate = useCallback((pattern = 50) => {
        if (typeof window === "undefined") return;
        if (!("vibrate" in navigator)) return;

        try {
            navigator.vibrate(pattern);
        } catch (error) {
            // Silently fail if vibration not supported
            console.debug("Haptic feedback not available:", error);
        }
    }, []);

    const vibrateOnSuccess = useCallback(() => {
        vibrate([50, 30, 50]); // Double pulse
    }, [vibrate]);

    const vibrateOnError = useCallback(() => {
        vibrate([100, 50, 100, 50, 100]); // Triple long pulse
    }, [vibrate]);

    const vibrateOnTap = useCallback(() => {
        vibrate(10); // Very short tap
    }, [vibrate]);

    return {
        vibrate,
        vibrateOnSuccess,
        vibrateOnError,
        vibrateOnTap,
    };
}

export default useHaptics;
