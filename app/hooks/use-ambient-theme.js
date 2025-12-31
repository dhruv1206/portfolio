"use client";

import { useEffect, useState, useCallback } from "react";

// Color palettes for different times of day
const TIME_PALETTES = {
    dawn: {
        // 5am - 8am
        primary: "#f472b6", // pink
        secondary: "#fbbf24", // amber
        ambient: "#fef3c7", // warm
    },
    morning: {
        // 8am - 12pm
        primary: "#06b6d4", // cyan
        secondary: "#8b5cf6", // violet
        ambient: "#e0f2fe", // light blue
    },
    afternoon: {
        // 12pm - 5pm
        primary: "#8b5cf6", // violet
        secondary: "#06b6d4", // cyan
        ambient: "#f5f3ff", // light purple
    },
    evening: {
        // 5pm - 8pm
        primary: "#f97316", // orange
        secondary: "#ec4899", // pink
        ambient: "#fef3c7", // warm
    },
    night: {
        // 8pm - 5am
        primary: "#8b5cf6", // violet
        secondary: "#06b6d4", // cyan
        ambient: "#1e1b4b", // deep indigo
    },
};

/**
 * Get time-based palette
 */
function getTimePalette() {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 8) return TIME_PALETTES.dawn;
    if (hour >= 8 && hour < 12) return TIME_PALETTES.morning;
    if (hour >= 12 && hour < 17) return TIME_PALETTES.afternoon;
    if (hour >= 17 && hour < 20) return TIME_PALETTES.evening;
    return TIME_PALETTES.night;
}

/**
 * Extract dominant color from an image
 */
async function extractDominantColor(imageUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(img, 0, 0, 50, 50);

            try {
                const imageData = ctx.getImageData(0, 0, 50, 50);
                const data = imageData.data;

                let r = 0, g = 0, b = 0, count = 0;
                for (let i = 0; i < data.length; i += 4) {
                    r += data[i];
                    g += data[i + 1];
                    b += data[i + 2];
                    count++;
                }

                resolve({
                    r: Math.round(r / count),
                    g: Math.round(g / count),
                    b: Math.round(b / count),
                });
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });
}

/**
 * useAmbientTheme - Dynamic ambient lighting based on time or project colors
 */
export function useAmbientTheme(options = {}) {
    const { mode = "time", projectImage = null } = options;
    const [palette, setPalette] = useState(getTimePalette());

    // Apply CSS custom properties
    const applyPalette = useCallback((newPalette) => {
        if (typeof document === "undefined") return;

        const root = document.documentElement;
        root.style.setProperty("--color-primary", newPalette.primary);
        root.style.setProperty("--color-secondary", newPalette.secondary);
        root.style.setProperty("--ambient-glow", newPalette.ambient);
    }, []);

    // Time-based palette update
    useEffect(() => {
        if (mode !== "time") return;

        const updatePalette = () => {
            const newPalette = getTimePalette();
            setPalette(newPalette);
            applyPalette(newPalette);
        };

        updatePalette();

        // Update every minute
        const interval = setInterval(updatePalette, 60000);
        return () => clearInterval(interval);
    }, [mode, applyPalette]);

    // Project color extraction
    useEffect(() => {
        if (mode !== "project" || !projectImage) return;

        extractDominantColor(projectImage).then((color) => {
            if (!color) return;

            const newPalette = {
                primary: `rgb(${color.r}, ${color.g}, ${color.b})`,
                secondary: `rgb(${Math.min(255, color.r + 50)}, ${Math.min(255, color.g + 50)}, ${Math.min(255, color.b + 50)})`,
                ambient: `rgba(${color.r}, ${color.g}, ${color.b}, 0.1)`,
            };

            setPalette(newPalette);
            applyPalette(newPalette);
        });
    }, [mode, projectImage, applyPalette]);

    return {
        palette,
        applyPalette,
    };
}

export default useAmbientTheme;
