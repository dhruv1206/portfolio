"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Cloth as position-based dynamics: a grid of point masses connected
// by distance constraints. Each frame we (1) Verlet-integrate every
// free point, then (2) relax the constraints over several passes so
// the sticks settle toward their rest length. Top row is pinned.
// Drag through the sheet to push it; stretch a stick past the tear
// threshold and it snaps.

const COLS = 42;
const ROWS = 28;
const SPACING = 16; // px between points at rest
const GRAVITY = 0.28;
const FRICTION = 0.99;
const RELAX_PASSES = 3;
const TEAR_FACTOR = 4.0; // tear when a stick is stretched > 4× rest
const DRAG_RADIUS = 26;

export default function VerletCloth() {
    const canvasRef = useRef(null);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        let width = 0;
        let height = 0;

        const points = [];
        const sticks = [];

        function build() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            points.length = 0;
            sticks.length = 0;
            // Centre the cloth horizontally, hang it from near the top.
            const startX = (width - (COLS - 1) * SPACING) / 2;
            const startY = Math.max(24, height * 0.12);
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const px = startX + x * SPACING;
                    const py = startY + y * SPACING;
                    points.push({
                        x: px,
                        y: py,
                        oldx: px,
                        oldy: py,
                        pinned: y === 0 && x % 4 === 0, // pin every 4th top point
                    });
                }
            }
            for (let y = 0; y < ROWS; y++) {
                for (let x = 0; x < COLS; x++) {
                    const i = y * COLS + x;
                    if (x < COLS - 1)
                        sticks.push({ a: i, b: i + 1, len: SPACING, torn: false });
                    if (y < ROWS - 1)
                        sticks.push({ a: i, b: i + COLS, len: SPACING, torn: false });
                }
            }
        }
        build();

        const pointer = { x: 0, y: 0, px: 0, py: 0, down: false };
        const setPointer = (e) => {
            const r = canvas.getBoundingClientRect();
            pointer.px = pointer.x;
            pointer.py = pointer.y;
            pointer.x = e.clientX - r.left;
            pointer.y = e.clientY - r.top;
        };
        const onDown = (e) => {
            pointer.down = true;
            setPointer(e);
            pointer.px = pointer.x;
            pointer.py = pointer.y;
        };
        const onMove = (e) => setPointer(e);
        const onUp = () => {
            pointer.down = false;
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        const onResize = () => build();
        window.addEventListener("resize", onResize);

        function integrate() {
            for (const p of points) {
                if (p.pinned) continue;
                const vx = (p.x - p.oldx) * FRICTION;
                const vy = (p.y - p.oldy) * FRICTION;
                p.oldx = p.x;
                p.oldy = p.y;
                p.x += vx;
                p.y += vy + GRAVITY;
            }
            // Pointer interaction — drag pushes nearby points along the
            // cursor's motion vector.
            if (pointer.down) {
                const mvx = pointer.x - pointer.px;
                const mvy = pointer.y - pointer.py;
                for (const p of points) {
                    if (p.pinned) continue;
                    const dx = p.x - pointer.x;
                    const dy = p.y - pointer.y;
                    if (dx * dx + dy * dy < DRAG_RADIUS * DRAG_RADIUS) {
                        p.x += mvx * 0.6;
                        p.y += mvy * 0.6;
                    }
                }
            }
        }

        function relax() {
            for (let pass = 0; pass < RELAX_PASSES; pass++) {
                for (const s of sticks) {
                    if (s.torn) continue;
                    const a = points[s.a];
                    const b = points[s.b];
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const dist = Math.hypot(dx, dy) || 0.0001;
                    if (dist > s.len * TEAR_FACTOR) {
                        s.torn = true;
                        continue;
                    }
                    const diff = (s.len - dist) / dist;
                    const ox = dx * 0.5 * diff;
                    const oy = dy * 0.5 * diff;
                    if (!a.pinned) {
                        a.x -= ox;
                        a.y -= oy;
                    }
                    if (!b.pinned) {
                        b.x += ox;
                        b.y += oy;
                    }
                }
            }
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1;
            for (const s of sticks) {
                if (s.torn) continue;
                const a = points[s.a];
                const b = points[s.b];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy);
                // Strain → hue: relaxed violet, stretched cyan-ish.
                const strain = Math.min(1, Math.max(0, (dist - s.len) / s.len));
                const r = Math.round(139 + (6 - 139) * strain);
                const g = Math.round(92 + (182 - 92) * strain);
                const b2 = Math.round(246 + (212 - 246) * strain);
                ctx.strokeStyle = `rgba(${r},${g},${b2},${0.5 + 0.4 * strain})`;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }

        let raf;
        if (reduced) {
            for (let k = 0; k < 40; k++) {
                integrate();
                relax();
            }
            render();
        } else {
            const loop = () => {
                integrate();
                relax();
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
            window.removeEventListener("resize", onResize);
        };
    }, [reduced]);

    return (
        <canvas
            ref={canvasRef}
            role="img"
            aria-label="Interactive cloth simulation using Verlet integration. Drag through the cloth to push and tear it."
            className="w-full h-full block cursor-grab active:cursor-grabbing"
        />
    );
}
