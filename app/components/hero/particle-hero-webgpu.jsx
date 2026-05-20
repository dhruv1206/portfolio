"use client";

import { useEffect, useRef } from "react";
import { useWebGPUSupport } from "@/app/hooks/use-webgpu-support";
import { useMounted } from "@/app/hooks/use-mounted";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Particle counts tuned for ~60fps on a 4-year-old laptop GPU.
const PARTICLE_COUNT_WEBGPU = 60000;
const PARTICLE_COUNT_CANVAS = 1200;
const MOUSE_RADIUS = 140; // pixels (CSS), scaled by DPR before posting

/**
 * ParticleHeroWebGPU
 *
 * Hero-background particle field. Tries renderers in order:
 *   1. WebGPU compute (OffscreenCanvas + worker), 60k particles
 *   2. Canvas2D ambient flow, 1.2k particles
 *   3. Static SVG vignette (no animation)
 *
 * Mounted as an absolute-positioned layer behind the hero content;
 * `pointer-events: none` so it doesn't steal hover from CTAs.
 *
 * The chosen renderer is exposed via `data-renderer` on the container so
 * tests / debugging can confirm which path executed; we set it via the
 * DOM ref rather than React state to avoid setState-in-effect.
 */
export default function ParticleHeroWebGPU() {
    const mounted = useMounted();
    const support = useWebGPUSupport();
    const reduced = usePrefersReducedMotion();

    const containerRef = useRef(null);
    const canvasRef = useRef(null);
    const workerRef = useRef(null);
    const rafRef = useRef(null);
    const cleanupRef = useRef(() => {});

    useEffect(() => {
        if (!mounted) return undefined;
        if (support.isChecking) return undefined;
        const container = containerRef.current;
        const setRenderer = (value) => {
            container?.setAttribute("data-renderer", value);
        };
        if (reduced) {
            setRenderer("static");
            return undefined;
        }

        let disposed = false;
        const canvas = canvasRef.current;
        if (!container || !canvas) return undefined;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = container.getBoundingClientRect();
        const cssWidth = Math.max(rect.width, 1);
        const cssHeight = Math.max(rect.height, 1);
        const width = Math.floor(cssWidth * dpr);
        const height = Math.floor(cssHeight * dpr);
        canvas.style.width = cssWidth + "px";
        canvas.style.height = cssHeight + "px";

        // ---------- WebGPU branch ----------
        async function tryWebGPU() {
            try {
                const response = await fetch("/shaders/particles.wgsl");
                if (!response.ok) throw new Error("shader fetch " + response.status);
                const shaderCode = await response.text();
                if (disposed) return false;

                const offscreen = canvas.transferControlToOffscreen();
                const worker = new Worker(
                    new URL("../../workers/particles.worker.js", import.meta.url),
                );
                workerRef.current = worker;

                const readyPromise = new Promise((resolve, reject) => {
                    worker.onmessage = (e) => {
                        if (e.data?.type === "ready") resolve();
                        if (e.data?.type === "error") reject(new Error(e.data.error));
                    };
                    worker.onerror = (e) => reject(new Error(e.message || "worker error"));
                });

                worker.postMessage(
                    {
                        type: "init",
                        canvas: offscreen,
                        particleCount: PARTICLE_COUNT_WEBGPU,
                        width,
                        height,
                        shaderCode,
                    },
                    [offscreen],
                );

                await readyPromise;
                if (disposed) return false;
                setRenderer("webgpu");

                // Pointer + resize handlers (CSS-pixel coords; the worker scales).
                const handlePointerMove = (e) => {
                    const r = container.getBoundingClientRect();
                    worker.postMessage({
                        type: "mouse",
                        x: (e.clientX - r.left) * dpr,
                        y: (e.clientY - r.top) * dpr,
                        radius: MOUSE_RADIUS * dpr,
                    });
                };
                const handlePointerLeave = () => {
                    worker.postMessage({ type: "mouse-leave" });
                };

                const ro = new ResizeObserver(() => {
                    const r = container.getBoundingClientRect();
                    worker.postMessage({
                        type: "resize",
                        width: Math.floor(Math.max(r.width, 1) * dpr),
                        height: Math.floor(Math.max(r.height, 1) * dpr),
                    });
                });
                ro.observe(container);

                container.addEventListener("pointermove", handlePointerMove);
                container.addEventListener("pointerleave", handlePointerLeave);

                cleanupRef.current = () => {
                    ro.disconnect();
                    container.removeEventListener("pointermove", handlePointerMove);
                    container.removeEventListener("pointerleave", handlePointerLeave);
                    worker.postMessage({ type: "dispose" });
                    worker.terminate();
                    workerRef.current = null;
                };

                return true;
            } catch (err) {
                console.warn("[particles] WebGPU init failed; falling back:", err);
                if (workerRef.current) {
                    workerRef.current.terminate();
                    workerRef.current = null;
                }
                return false;
            }
        }

        // ---------- Canvas2D fallback ----------
        function runCanvas2D() {
            // If we already called transferControlToOffscreen, the canvas
            // can't be drawn to from this thread anymore. Render into a
            // sibling canvas instead.
            const fallbackCanvas =
                canvasRef.current?.isConnected && !canvasRef.current.transferControlToOffscreen
                    ? document.createElement("canvas")
                    : canvas;
            if (fallbackCanvas !== canvas) {
                fallbackCanvas.className = canvas.className;
                fallbackCanvas.style.width = cssWidth + "px";
                fallbackCanvas.style.height = cssHeight + "px";
                container.appendChild(fallbackCanvas);
            }
            fallbackCanvas.width = width;
            fallbackCanvas.height = height;

            const ctx = fallbackCanvas.getContext("2d");
            if (!ctx) {
                setRenderer("static");
                return;
            }
            setRenderer("canvas2d");

            const particles = new Array(PARTICLE_COUNT_CANVAS).fill(0).map(() => ({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 40,
                vy: (Math.random() - 0.5) * 40,
            }));

            let mx = -10000;
            let my = -10000;
            const handlePointerMove = (e) => {
                const r = container.getBoundingClientRect();
                mx = (e.clientX - r.left) * dpr;
                my = (e.clientY - r.top) * dpr;
            };
            const handlePointerLeave = () => {
                mx = -10000;
                my = -10000;
            };
            container.addEventListener("pointermove", handlePointerMove);
            container.addEventListener("pointerleave", handlePointerLeave);

            let last = performance.now();
            const draw = () => {
                if (disposed) return;
                const now = performance.now();
                const dt = Math.min((now - last) / 1000, 1 / 30);
                last = now;

                ctx.globalCompositeOperation = "source-over";
                ctx.fillStyle = "rgba(0,0,0,0.0)";
                ctx.clearRect(0, 0, width, height);
                ctx.globalCompositeOperation = "lighter";

                const radius = MOUSE_RADIUS * dpr;
                for (const p of particles) {
                    // Lightweight flow: sinusoidal forcing per quadrant.
                    const fx = Math.sin(p.y * 0.005 + now * 0.0006) * 25;
                    const fy = Math.cos(p.x * 0.005 + now * 0.0005) * 25;
                    let ax = fx;
                    let ay = fy;

                    const dx = p.x - mx;
                    const dy = p.y - my;
                    const d2 = dx * dx + dy * dy;
                    if (d2 < radius * radius) {
                        const d = Math.sqrt(d2) || 1;
                        const falloff = 1 - d / radius;
                        ax += (dx / d) * falloff * 1800;
                        ay += (dy / d) * falloff * 1800;
                    }

                    p.vx = (p.vx + ax * dt) * 0.92;
                    p.vy = (p.vy + ay * dt) * 0.92;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;

                    if (p.x < -10) p.x = width + 10;
                    else if (p.x > width + 10) p.x = -10;
                    if (p.y < -10) p.y = height + 10;
                    else if (p.y > height + 10) p.y = -10;

                    const speed = Math.min(
                        Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 200,
                        1,
                    );
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 1.6 * dpr, 0, Math.PI * 2);
                    // violet -> cyan ramp
                    const r = Math.round(139 + (6 - 139) * speed);
                    const g = Math.round(92 + (182 - 92) * speed);
                    const b = Math.round(246 + (212 - 246) * speed);
                    ctx.fillStyle = `rgba(${r},${g},${b},0.55)`;
                    ctx.fill();
                }

                rafRef.current = requestAnimationFrame(draw);
            };
            rafRef.current = requestAnimationFrame(draw);

            cleanupRef.current = () => {
                container.removeEventListener("pointermove", handlePointerMove);
                container.removeEventListener("pointerleave", handlePointerLeave);
                if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
                if (fallbackCanvas !== canvas) fallbackCanvas.remove();
            };
        }

        // ---------- Dispatch ----------
        if (support.hasWebGPU) {
            tryWebGPU().then((ok) => {
                if (!ok && !disposed) runCanvas2D();
            });
        } else {
            runCanvas2D();
        }

        return () => {
            disposed = true;
            cleanupRef.current?.();
            cleanupRef.current = () => {};
        };
    }, [mounted, support.isChecking, support.hasWebGPU, reduced]);

    return (
        <div
            ref={containerRef}
            aria-hidden="true"
            className="absolute inset-0 overflow-hidden pointer-events-none"
            data-renderer="init"
        >
            <canvas
                ref={canvasRef}
                // Container has pointer-events:none, but re-enable on the
                // canvas so the particle layer captures the mouse.
                className="absolute inset-0 pointer-events-auto"
                style={{ mixBlendMode: "screen" }}
            />
        </div>
    );
}
