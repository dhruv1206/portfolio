"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Gray-Scott reaction-diffusion. Two virtual chemicals A and B diffuse
// at different rates and react via A + 2B → 3B:
//
//   A' = A + (Dₐ·∇²A − A·B² + f·(1−A)) dt
//   B' = B + (D_b·∇²B + A·B² − (k+f)·B) dt
//
// ∇² is a 3×3 Laplacian (the standard 0.05/0.2/-1 stencil). Tiny
// changes to the feed (f) and kill (k) rates flip the system between
// completely different Turing-pattern regimes — spots, stripes,
// mazes, mitosis, coral. Solved on a grid in JS and blitted via
// ImageData; no GPU needed, so this one runs everywhere.

const COLS = 200;
const DA = 1.0;
const DB = 0.5;
const DT = 1.0;
const SUBSTEPS = 8;

const PRESETS = {
    coral: { f: 0.0545, k: 0.062, label: "Coral" },
    mitosis: { f: 0.0367, k: 0.0649, label: "Mitosis" },
    maze: { f: 0.029, k: 0.057, label: "Maze" },
    spots: { f: 0.025, k: 0.06, label: "Spots" },
    worms: { f: 0.078, k: 0.061, label: "Worms" },
};

// Laplacian stencil weights (centre + edges + corners).
const W_CENTER = -1;
const W_EDGE = 0.2;
const W_CORNER = 0.05;

export default function ReactionDiffusion() {
    const canvasRef = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [preset, setPreset] = useState("coral");
    const presetRef = useRef(preset);
    presetRef.current = preset;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        const rect = canvas.getBoundingClientRect();
        const aspect = rect.height / rect.width || 0.6;
        const cols = COLS;
        const rows = Math.max(80, Math.round(COLS * aspect));
        canvas.width = cols;
        canvas.height = rows;
        const n = cols * rows;

        let a = new Float32Array(n).fill(1);
        let b = new Float32Array(n).fill(0);
        let a2 = new Float32Array(n);
        let b2 = new Float32Array(n);
        const img = ctx.createImageData(cols, rows);

        function seed(cx, cy, r, amt = 1) {
            for (let y = -r; y <= r; y++) {
                for (let x = -r; x <= r; x++) {
                    const gx = cx + x;
                    const gy = cy + y;
                    if (gx < 0 || gy < 0 || gx >= cols || gy >= rows) continue;
                    if (x * x + y * y > r * r) continue;
                    b[gy * cols + gx] = amt;
                }
            }
        }
        // Initial seed: a few random blobs of B in the A-filled medium.
        for (let s = 0; s < 6; s++) {
            seed(
                Math.floor(cols * (0.2 + 0.6 * ((s * 0.37) % 1))),
                Math.floor(rows * (0.2 + 0.6 * ((s * 0.61) % 1))),
                4,
            );
        }

        const pointer = { down: false };
        const toGrid = (cx, cy) => {
            const r = canvas.getBoundingClientRect();
            return {
                gx: Math.round(((cx - r.left) / r.width) * cols),
                gy: Math.round(((cy - r.top) / r.height) * rows),
            };
        };
        const onDown = (e) => {
            pointer.down = true;
            const { gx, gy } = toGrid(e.clientX, e.clientY);
            seed(gx, gy, 5);
        };
        const onMove = (e) => {
            if (!pointer.down) return;
            const { gx, gy } = toGrid(e.clientX, e.clientY);
            seed(gx, gy, 4);
        };
        const onUp = () => {
            pointer.down = false;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);

        function step() {
            const { f, k } = PRESETS[presetRef.current];
            for (let y = 0; y < rows; y++) {
                const yUp = y > 0 ? y - 1 : y;
                const yDn = y < rows - 1 ? y + 1 : y;
                for (let x = 0; x < cols; x++) {
                    const xL = x > 0 ? x - 1 : x;
                    const xR = x < cols - 1 ? x + 1 : x;
                    const i = y * cols + x;
                    const rowU = yUp * cols;
                    const rowD = yDn * cols;
                    const row = y * cols;
                    // 3×3 Laplacian for A and B.
                    const lapA =
                        a[i] * W_CENTER +
                        (a[row + xL] + a[row + xR] + a[rowU + x] + a[rowD + x]) *
                            W_EDGE +
                        (a[rowU + xL] +
                            a[rowU + xR] +
                            a[rowD + xL] +
                            a[rowD + xR]) *
                            W_CORNER;
                    const lapB =
                        b[i] * W_CENTER +
                        (b[row + xL] + b[row + xR] + b[rowU + x] + b[rowD + x]) *
                            W_EDGE +
                        (b[rowU + xL] +
                            b[rowU + xR] +
                            b[rowD + xL] +
                            b[rowD + xR]) *
                            W_CORNER;
                    const av = a[i];
                    const bv = b[i];
                    const abb = av * bv * bv;
                    a2[i] = av + (DA * lapA - abb + f * (1 - av)) * DT;
                    b2[i] = bv + (DB * lapB + abb - (k + f) * bv) * DT;
                }
            }
            let tmp = a;
            a = a2;
            a2 = tmp;
            tmp = b;
            b = b2;
            b2 = tmp;
        }

        function render() {
            const data = img.data;
            for (let i = 0; i < n; i++) {
                // Map concentration of B to a violet→cyan→white ramp.
                const v = Math.max(0, Math.min(1, b[i] * 1.6));
                const p = i * 4;
                if (v < 0.5) {
                    const t = v / 0.5;
                    data[p] = 20 + 119 * t; // → violet
                    data[p + 1] = 10 + 82 * t;
                    data[p + 2] = 40 + 206 * t;
                } else {
                    const t = (v - 0.5) / 0.5; // violet → cyan → white
                    data[p] = 139 + (6 - 139) * t;
                    data[p + 1] = 92 + (182 - 92) * t;
                    data[p + 2] = 246 + (255 - 246) * t;
                }
                data[p + 3] = 255;
            }
            ctx.putImageData(img, 0, 0);
        }

        let raf;
        if (reduced) {
            for (let s = 0; s < 400; s++) step();
            render();
        } else {
            const loop = () => {
                for (let s = 0; s < SUBSTEPS; s++) step();
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
        <div className="relative w-full h-full">
            <canvas
                ref={canvasRef}
                role="img"
                aria-label="Gray-Scott reaction-diffusion simulation producing Turing patterns. Click or drag to add chemical; use the buttons to switch pattern regimes."
                className="w-full h-full block cursor-crosshair"
                style={{ imageRendering: "auto" }}
            />
            {/* Preset switcher */}
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {Object.entries(PRESETS).map(([key, p]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => setPreset(key)}
                        className={
                            "px-2 py-1 text-[11px] font-mono rounded border transition-colors " +
                            (preset === key
                                ? "bg-cyan-500/30 border-cyan-400/70 text-cyan-100"
                                : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/10")
                        }
                    >
                        {p.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
