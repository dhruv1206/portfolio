"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// The Lorenz system — three coupled ODEs from a 1963 model of
// atmospheric convection:
//   ẋ = σ(y − x),  ẏ = x(ρ − z) − y,  ż = xy − βz
// With σ=10, ρ=28, β=8/3 the trajectory settles onto the Lorenz
// attractor: it never repeats yet never leaves a bounded region —
// a "strange" attractor. Integrated with RK4, kept in a ring buffer,
// and drawn as a luminous curve you can rotate (drag) in 3D.

const SIGMA = 10;
const RHO = 28;
const BETA = 8 / 3;
const MAX_POINTS = 6500;
const STEPS_PER_FRAME = 12;
const DT = 0.006;

function lorenz(x, y, z) {
    return [SIGMA * (y - x), x * (RHO - z) - y, x * y - BETA * z];
}
function rk4(p, dt) {
    const [x, y, z] = p;
    const k1 = lorenz(x, y, z);
    const k2 = lorenz(x + 0.5 * dt * k1[0], y + 0.5 * dt * k1[1], z + 0.5 * dt * k1[2]);
    const k3 = lorenz(x + 0.5 * dt * k2[0], y + 0.5 * dt * k2[1], z + 0.5 * dt * k2[2]);
    const k4 = lorenz(x + dt * k3[0], y + dt * k3[1], z + dt * k3[2]);
    return [
        x + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        y + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        z + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
    ];
}

export default function Attractor() {
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
        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        resize();

        // Trajectory ring buffer of [x,y,z].
        const pts = [];
        let cur = [0.1, 0.0, 0.0];
        // Pre-warm most of the buffer so the butterfly is already
        // there on arrival instead of slowly drawing in over ~15s.
        for (let i = 0; i < MAX_POINTS - 400; i++) {
            cur = rk4(cur, DT);
            pts.push(cur);
        }

        const view = { yaw: 0.6, pitch: 0.5, dragging: false, lx: 0, ly: 0 };
        const onDown = (e) => {
            view.dragging = true;
            view.lx = e.clientX;
            view.ly = e.clientY;
        };
        const onMove = (e) => {
            if (!view.dragging) return;
            view.yaw += (e.clientX - view.lx) * 0.008;
            view.pitch = Math.max(-1.4, Math.min(1.4, view.pitch + (e.clientY - view.ly) * 0.008));
            view.lx = e.clientX;
            view.ly = e.clientY;
        };
        const onUp = () => {
            view.dragging = false;
        };
        const onResize = () => resize();
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("resize", onResize);

        function project(x, y, z) {
            // Centre the cloud (Lorenz centroid ≈ (0,0,27)).
            let px = x;
            let py = y;
            let pz = z - 27;
            // yaw about vertical (data-z as up), then pitch.
            const cy = Math.cos(view.yaw);
            const sy = Math.sin(view.yaw);
            const rx = px * cy - py * sy;
            const ry = px * sy + py * cy;
            const cp = Math.cos(view.pitch);
            const sp = Math.sin(view.pitch);
            const sz = pz * cp - ry * sp;
            const syv = pz * sp + ry * cp;
            const scale = Math.min(width, height) / 62;
            return [width / 2 + rx * scale, height / 2 - sz * scale, syv];
        }

        function integrate(steps) {
            for (let i = 0; i < steps; i++) {
                cur = rk4(cur, DT);
                pts.push(cur);
            }
            while (pts.length > MAX_POINTS) pts.shift();
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1.4;
            ctx.lineCap = "round";
            let prev = null;
            for (let i = 0; i < pts.length; i++) {
                const [sx, sy] = project(pts[i][0], pts[i][1], pts[i][2]);
                if (prev) {
                    // newest → bright cyan/white, oldest → faint violet
                    const t = i / pts.length;
                    const a = 0.06 + t * 0.85;
                    const r = Math.round(139 + (110 - 139) * t);
                    const g = Math.round(92 + (231 - 92) * t);
                    const b = Math.round(246 + (249 - 246) * t);
                    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
                    ctx.beginPath();
                    ctx.moveTo(prev[0], prev[1]);
                    ctx.lineTo(sx, sy);
                    ctx.stroke();
                }
                prev = [sx, sy];
            }
            // bright head
            if (prev) {
                ctx.fillStyle = "rgba(255,255,255,0.95)";
                ctx.beginPath();
                ctx.arc(prev[0], prev[1], 2.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let raf;
        if (reduced) {
            integrate(MAX_POINTS);
            render();
        } else {
            const loop = () => {
                integrate(STEPS_PER_FRAME);
                if (!view.dragging) view.yaw += 0.0035; // gentle auto-rotate
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
            aria-label="The Lorenz strange attractor traced as a luminous 3D curve. Drag to rotate it."
            className="w-full h-full block cursor-grab active:cursor-grabbing"
        />
    );
}
