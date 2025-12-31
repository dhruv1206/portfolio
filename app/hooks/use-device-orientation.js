"use client";

import { useState, useEffect, useCallback } from "react";

/**
 * useDeviceOrientation - Gyroscope access for mobile parallax
 */
export function useDeviceOrientation() {
    const [isSupported, setIsSupported] = useState(false);
    const [hasPermission, setHasPermission] = useState(false);
    const [orientation, setOrientation] = useState({
        alpha: 0, // Z-axis rotation (0-360)
        beta: 0,  // X-axis rotation (-180 to 180)
        gamma: 0, // Y-axis rotation (-90 to 90)
    });
    const [isActive, setIsActive] = useState(false);

    // Check support
    useEffect(() => {
        if (typeof window !== "undefined") {
            setIsSupported("DeviceOrientationEvent" in window);
        }
    }, []);

    // Handle orientation change
    const handleOrientation = useCallback((event) => {
        setOrientation({
            alpha: event.alpha || 0,
            beta: event.beta || 0,
            gamma: event.gamma || 0,
        });
    }, []);

    // Request permission (required on iOS 13+)
    const requestPermission = useCallback(async () => {
        if (!isSupported) return false;

        // Check if permission API exists (iOS 13+)
        if (typeof DeviceOrientationEvent.requestPermission === "function") {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission === "granted") {
                    setHasPermission(true);
                    return true;
                }
            } catch (e) {
                console.debug("DeviceOrientation permission denied:", e);
                return false;
            }
        } else {
            // Permission not required on other platforms
            setHasPermission(true);
            return true;
        }
        return false;
    }, [isSupported]);

    // Start listening
    const startListening = useCallback(async () => {
        if (!isSupported) return;

        if (!hasPermission) {
            const granted = await requestPermission();
            if (!granted) return;
        }

        window.addEventListener("deviceorientation", handleOrientation);
        setIsActive(true);
    }, [isSupported, hasPermission, requestPermission, handleOrientation]);

    // Stop listening
    const stopListening = useCallback(() => {
        window.removeEventListener("deviceorientation", handleOrientation);
        setIsActive(false);
    }, [handleOrientation]);

    // Cleanup
    useEffect(() => {
        return () => {
            window.removeEventListener("deviceorientation", handleOrientation);
        };
    }, [handleOrientation]);

    // Normalized values for 3D camera control (-1 to 1)
    const normalized = {
        x: orientation.gamma / 90,  // Left/right tilt
        y: (orientation.beta - 45) / 45,  // Forward/back tilt (centered at 45°)
        z: orientation.alpha / 360,  // Compass heading
    };

    return {
        isSupported,
        hasPermission,
        isActive,
        orientation,
        normalized,
        requestPermission,
        startListening,
        stopListening,
    };
}

export default useDeviceOrientation;
