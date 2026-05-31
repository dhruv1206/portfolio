"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Craig Reynolds' boids: each agent steers by three local rules —
// separation (avoid crowding), alignment (match neighbours' heading),
// cohesion (steer toward the local centre of mass). No global plan;
// flocks, splits and swirls emerge. Drawn as crisp arrowheads, hue by
// speed. The cursor parts the school (repel); press to gather them.

const COUNT = 560;
const PERCEPTION = 46;
const SEP_DIST = 22;
const MAX_SPEED = 2.6;
const MAX_FORCE = 0.06;
const VIOLET = [139, 92, 246];
const CYAN = [110, 231, 249];

export default function Boids() {
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
        let boids = [];

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        function seed() {
            boids = [];
            for (let i = 0; i < COUNT; i++) {
                const a = Math.random() * Math.PI * 2;
                const sp = 1 + Math.random() * MAX_SPEED;
                boids.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    vx: Math.cos(a) * sp,
                    vy: Math.sin(a) * sp,
                });
            }
        }
        resize();
        seed();

        const pointer = { x: -1e4, y: -1e4, over: false, down: false };
        const setP = (e) => {
            const r = canvas.getBoundingClientRect();
            pointer.x = e.clientX - r.left;
            pointer.y = e.clientY - r.top;
        };
        const onMove = (e) => {
            pointer.over = true;
            setP(e);
        };
        const onLeave = () => {
            pointer.over = false;
            pointer.x = -1e4;
            pointer.y = -1e4;
        };
        const onDown = (e) => {
            pointer.down = true;
            setP(e);
        };
        const onUp = () => {
            pointer.down = false;
        };
        const onResize = () => {
            resize();
        };
        canvas.addEventListener("pointermove", onMove);
        canvas.addEventListener("pointerleave", onLeave);
        canvas.addEventListener("pointerdown", onDown);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("resize", onResize);

        function limit(vx, vy, max) {
            const m = Math.hypot(vx, vy);
            if (m > max) return [(vx / m) * max, (vy / m) * max];
            return [vx, vy];
        }

        function step() {
            const per2 = PERCEPTION * PERCEPTION;
            const sep2 = SEP_DIST * SEP_DIST;
            for (let i = 0; i < boids.length; i++) {
                const b = boids[i];
                let ax = 0,
                    ay = 0,
                    cx = 0,
                    cy = 0,
                    sx = 0,
                    sy = 0,
                    n = 0,
                    ns = 0;
                for (let j = 0; j < boids.length; j++) {
                    if (i === j) continue;
                    const o = boids[j];
                    const dx = o.x - b.x;
                    const dy = o.y - b.y;
                    const d2 = dx * dx + dy * dy;
                    if (d2 > per2) continue;
                    ax += o.vx;
                    ay += o.vy;
                    cx += o.x;
                    cy += o.y;
                    n++;
                    if (d2 < sep2 && d2 > 0) {
                        sx -= dx / d2;
                        sy -= dy / d2;
                        ns++;
                    }
                }
                let fx = 0,
                    fy = 0;
                if (n > 0) {
                    // alignment
                    let [dax, day] = limit(ax / n, ay / n, MAX_SPEED);
                    fx += (dax - b.vx) * 0.5;
                    fy += (day - b.vy) * 0.5;
                    // cohesion
                    const tx = cx / n - b.x;
                    const ty = cy / n - b.y;
                    let [dcx, dcy] = limit(tx, ty, MAX_SPEED);
                    fx += (dcx - b.vx) * 0.28;
                    fy += (dcy - b.vy) * 0.28;
                }
                if (ns > 0) {
                    let [dsx, dsy] = limit(sx, sy, MAX_SPEED);
                    fx += (dsx - b.vx) * 0.9;
                    fy += (dsy - b.vy) * 0.9;
                }
                // cursor interaction
                if (pointer.over) {
                    const dx = b.x - pointer.x;
                    const dy = b.y - pointer.y;
                    const d2 = dx * dx + dy * dy;
                    const R = 110;
                    if (d2 < R * R && d2 > 0) {
                        const d = Math.sqrt(d2);
                        const w = (1 - d / R) * (pointer.down ? -2.2 : 2.2);
                        fx += (dx / d) * w;
                        fy += (dy / d) * w;
                    }
                }
                [fx, fy] = limit(fx, fy, MAX_FORCE * 8);
                b.vx += fx;
                b.vy += fy;
                [b.vx, b.vy] = limit(b.vx, b.vy, MAX_SPEED);
            }
            // integrate + wrap
            for (const b of boids) {
                b.x += b.vx;
                b.y += b.vy;
                if (b.x < 0) b.x += width;
                else if (b.x > width) b.x -= width;
                if (b.y < 0) b.y += height;
                else if (b.y > height) b.y -= height;
            }
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            for (const b of boids) {
                const sp = Math.hypot(b.vx, b.vy);
                const t = Math.min(1, sp / MAX_SPEED);
                const r = Math.round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * t);
                const g = Math.round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * t);
                const bl = Math.round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * t);
                const ang = Math.atan2(b.vy, b.vx);
                const cos = Math.cos(ang);
                const sin = Math.sin(ang);
                // crisp arrowhead: tip + two tail corners
                const s = 5;
                ctx.fillStyle = `rgba(${r},${g},${bl},0.9)`;
                ctx.beginPath();
                ctx.moveTo(b.x + cos * s * 1.6, b.y + sin * s * 1.6);
                ctx.lineTo(
                    b.x + Math.cos(ang + 2.5) * s,
                    b.y + Math.sin(ang + 2.5) * s,
                );
                ctx.lineTo(
                    b.x + Math.cos(ang - 2.5) * s,
                    b.y + Math.sin(ang - 2.5) * s,
                );
                ctx.closePath();
                ctx.fill();
            }
        }

        let raf;
        if (reduced) {
            for (let k = 0; k < 80; k++) step();
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
            canvas.removeEventListener("pointermove", onMove);
            canvas.removeEventListener("pointerleave", onLeave);
            canvas.removeEventListener("pointerdown", onDown);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("resize", onResize);
        };
    }, [reduced]);

    return (
        <canvas
            ref={canvasRef}
            role="img"
            aria-label="Boids flocking simulation: hundreds of agents following separation, alignment and cohesion rules. Move the cursor to part the flock; press to gather them."
            className="w-full h-full block cursor-crosshair"
        />
    );
}
