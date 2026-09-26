"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// 2D wave equation  ∂²u/∂t² = c²∇²u  solved with an explicit leapfrog
// finite-difference scheme:
//
//   u_next = 2u - u_prev + C² (u_left + u_right + u_up + u_down - 4u)
//
// C² is the squared Courant number; in 2D the CFL stability bound is
// C² ≤ 0.5, so we sit at 0.28 with a little damping for a clean,
// non-exploding ripple. Fixed (u=0) boundaries make the walls
// reflective. Rendered by writing each cell into an ImageData at grid
// resolution, then scaling that up to the canvas.

const COLS = 260;
const C2 = 0.28;
const DAMPING = 0.9965;

function seedSplash(u, cols, rows, cx, cy, amp) {
    const r = 6;
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            const gx = cx + x;
            const gy = cy + y;
            if (gx < 1 || gy < 1 || gx >= cols - 1 || gy >= rows - 1) continue;
            const d2 = x * x + y * y;
            if (d2 > r * r) continue;
            u[gy * cols + gx] += amp * Math.exp(-d2 / (r * 0.7));
        }
    }
}

export default function WaveEquation() {
    const canvasRef = useRef(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        const rect = canvas.getBoundingClientRect();
        const aspect = rect.height / rect.width || 0.6;
        const cols = COLS;
        const rows = Math.max(60, Math.round(COLS * aspect));

        // Backing store at grid resolution; the visible canvas is the
        // CSS size and we let drawImage scale the grid up.
        canvas.width = cols;
        canvas.height = rows;

        let u = new Float32Array(cols * rows);
        let uPrev = new Float32Array(cols * rows);
        const img = ctx.createImageData(cols, rows);

        // Seed an initial ripple so the canvas isn't blank on arrival.
        seedSplash(u, cols, rows, Math.floor(cols / 2), Math.floor(rows / 2), 2.4);

        const pointer = { down: false, gx: 0, gy: 0 };
        const toGrid = (clientX, clientY) => {
            const r = canvas.getBoundingClientRect();
            return {
                gx: Math.round(((clientX - r.left) / r.width) * cols),
                gy: Math.round(((clientY - r.top) / r.height) * rows),
            };
        };
        const onDown = (e) => {
            pointer.down = true;
            const { gx, gy } = toGrid(e.clientX, e.clientY);
            seedSplash(u, cols, rows, gx, gy, 3.0);
        };
        const onMove = (e) => {
            if (!pointer.down) return;
            const { gx, gy } = toGrid(e.clientX, e.clientY);
            seedSplash(u, cols, rows, gx, gy, 1.2);
        };
        const onUp = () => {
            pointer.down = false;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);

        function render() {
            const data = img.data;
            for (let i = 0; i < u.length; i++) {
                const v = u[i];
                // Diverging map: negative → cyan, ~0 → near-black,
                // positive → violet. Brightness ∝ |v|.
                const a = Math.max(-1, Math.min(1, v));
                const mag = Math.min(1, Math.abs(a));
                const p = i * 4;
                if (a >= 0) {
                    data[p] = 90 + 150 * mag; // R toward violet
                    data[p + 1] = 30 + 40 * mag;
                    data[p + 2] = 120 + 135 * mag;
                } else {
                    data[p] = 10;
                    data[p + 1] = 120 + 120 * mag; // G toward cyan
                    data[p + 2] = 140 + 115 * mag;
                }
                data[p + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
        }

        function step() {
            // Leapfrog update into uPrev (reused as scratch for u_next).
            for (let y = 1; y < rows - 1; y++) {
                const row = y * cols;
                for (let x = 1; x < cols - 1; x++) {
                    const i = row + x;
                    const lap =
                        u[i - 1] + u[i + 1] + u[i - cols] + u[i + cols] - 4 * u[i];
                    const next = (2 * u[i] - uPrev[i] + C2 * lap) * DAMPING;
                    uPrev[i] = next;
                }
            }
            // Swap: uPrev now holds u_next, u becomes the new previous.
            const tmp = uPrev;
            uPrev = u;
            u = tmp;
        }

        let raf;
        if (reduced) {
            // Static: a couple of relaxation steps then a single paint.
            for (let k = 0; k < 60; k++) step();
            render();
        } else {
            const loop = () => {
                step();
                render();
                raf = requestAnimationFrame(loop);
            };
            raf = requestAnimationFrame(loop);
        }

        return () => {
            if (raf) cancelAnimationFrame(raf);
            canvas.removeEventListener("pointerdown", onDown);
            canvas.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };
    }, [reduced]);

    return (
        <canvas
            ref={canvasRef}
            role="img"
            aria-label="Interactive 2D wave-equation simulation. Click or drag to create ripples that propagate and reflect off the edges."
            className="w-full h-full block cursor-crosshair"
            style={{ imageRendering: "auto" }}
        />
    );
}
