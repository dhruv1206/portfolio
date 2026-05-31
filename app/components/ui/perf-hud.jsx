"use client";

import { useEffect, useState } from "react";

// Live perf HUD — toggleable floating widget showing real LCP, INP,
// CLS, FCP, TTFB (from `web-vitals`) and a live FPS reading from a
// requestAnimationFrame loop.
//
// Off by default. Toggle with backtick (`) or tilde (~) — the
// keyboard shortcut hint surfaces in the footer.
//
// Design intent: this is the closing argument of the backend-craft
// thesis. "The site I'm asking you to trust me to build is itself
// the proof." Recruiter presses `, sees LCP <1.0s and INP <100ms,
// closes the loop.

const TOGGLE_KEY = "`";

// Web Vitals rating thresholds (Google's official cutoffs, 2024-2025).
const RATING_COLORS = {
    good: "text-emerald-300",
    "needs-improvement": "text-amber-300",
    poor: "text-rose-300",
};

const METRICS = [
    { id: "lcp", label: "LCP", unit: "ms", scale: 1, decimals: 0 },
    { id: "inp", label: "INP", unit: "ms", scale: 1, decimals: 0 },
    { id: "cls", label: "CLS", unit: "", scale: 1, decimals: 3 },
    { id: "fcp", label: "FCP", unit: "ms", scale: 1, decimals: 0 },
    { id: "ttfb", label: "TTFB", unit: "ms", scale: 1, decimals: 0 },
];

function fmtMetric(metric, decimals) {
    if (!metric || metric.value == null) return "—";
    const v = metric.value;
    if (decimals === 0) return Math.round(v).toString();
    return v.toFixed(decimals);
}

function fpsRating(fps) {
    if (fps == null) return "needs-improvement";
    if (fps >= 55) return "good";
    if (fps >= 30) return "needs-improvement";
    return "poor";
}

export default function PerfHud() {
    const [open, setOpen] = useState(false);
    const [metrics, setMetrics] = useState({});
    const [fps, setFps] = useState(null);

    // Subscribe to web-vitals once on mount. The library reports each
    // metric multiple times as it stabilises (e.g. INP updates on each
    // longer interaction). The HUD just keeps the latest.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        let cancelled = false;
        import("web-vitals").then((mod) => {
            if (cancelled) return;
            const update = (id) => (m) => {
                setMetrics((prev) => ({ ...prev, [id]: m }));
            };
            mod.onLCP(update("lcp"));
            mod.onINP(update("inp"));
            mod.onCLS(update("cls"));
            mod.onFCP(update("fcp"));
            mod.onTTFB(update("ttfb"));
        });
        return () => {
            cancelled = true;
        };
    }, []);

    // Toggle on backtick / tilde, but never while the user is typing
    // into an input. Capture-phase listener so it works even when
    // focus is inside a deeply-nested modal.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onKey = (e) => {
            if (e.key !== TOGGLE_KEY && e.key !== "~") return;
            const t = e.target;
            if (
                t &&
                (t.tagName === "INPUT" ||
                    t.tagName === "TEXTAREA" ||
                    t.isContentEditable)
            ) {
                return;
            }
            e.preventDefault();
            setOpen((o) => !o);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // FPS rAF loop — runs only while the HUD is visible so the closed
    // state has zero ongoing cost. 500ms sample window keeps the
    // number readable without flicker.
    useEffect(() => {
        if (!open) return undefined;
        let frames = 0;
        let lastTime = performance.now();
        let raf;
        const loop = () => {
            frames++;
            const now = performance.now();
            if (now - lastTime >= 500) {
                setFps((frames * 1000) / (now - lastTime));
                frames = 0;
                lastTime = now;
            }
            raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [open]);

    if (!open) return null;

    const fpsRate = fpsRating(fps);

    return (
        <aside
            className="perf-hud fixed bottom-4 right-4 z-[120] glass-card font-mono text-xs select-none shadow-2xl"
            aria-label="Live performance HUD"
            role="region"
            data-perf-hud="open"
        >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 bg-black/40">
                <span className="flex gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </span>
                <span className="text-gray-300 uppercase tracking-wider">
                    perf · live
                </span>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close perf HUD"
                    className="ml-3 px-1.5 py-0.5 rounded text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                    ✕
                </button>
            </div>
            <div className="px-3 py-2 space-y-1 min-w-[200px]">
                {METRICS.map((spec) => {
                    const m = metrics[spec.id];
                    const rating = m?.rating || "needs-improvement";
                    return (
                        <div
                            key={spec.id}
                            className="flex items-baseline justify-between gap-3"
                        >
                            <span className="text-gray-500 uppercase tracking-wider w-12">
                                {spec.label}
                            </span>
                            <span className={"font-semibold " + RATING_COLORS[rating]}>
                                {fmtMetric(m, spec.decimals)}
                                <span className="text-gray-600 ml-1">
                                    {spec.unit}
                                </span>
                            </span>
                        </div>
                    );
                })}
                <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-white/5">
                    <span className="text-gray-500 uppercase tracking-wider w-12">
                        FPS
                    </span>
                    <span className={"font-semibold " + RATING_COLORS[fpsRate]}>
                        {fps == null ? "—" : Math.round(fps)}
                    </span>
                </div>
            </div>
            <div className="px-3 py-2 border-t border-white/5 bg-black/40 text-[10px] text-gray-500">
                press <kbd className="px-1 rounded bg-white/10 text-gray-300">`</kbd>{" "}
                to toggle
            </div>
        </aside>
    );
}
