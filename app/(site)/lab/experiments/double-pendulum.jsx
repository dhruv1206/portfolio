"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// A fan of double pendulums released from almost-identical angles.
// Each is the classic two-link chaotic pendulum, integrated with RK4
// (explicit Euler injects energy and blows the chaos up). They start
// indistinguishable, then sensitive-dependence pulls them apart into
// completely different trajectories — drawn as crisp rods + bobs with
// fading tip trails, violet→cyan across the fan.

const N = 22; // pendulums in the fan
const TRAIL = 90; // tip-trail length
const SUBSTEPS = 8;
const DT = 0.045; // normalized time step per substep
const G = 1.0;
const L1 = 1.0;
const L2 = 1.0;
const M1 = 1.0;
const M2 = 1.0;

const VIOLET = [139, 92, 246];
const CYAN = [6, 182, 212];

// ODE: state = [a1, a2, w1, w2] → derivatives.
function deriv(a1, a2, w1, w2) {
    const d = a1 - a2;
    const cd = Math.cos(d);
    const sd = Math.sin(d);
    const den1 = (M1 + M2) * L1 - M2 * L1 * cd * cd;
    const a1dd =
        (M2 * L1 * w1 * w1 * sd * cd +
            M2 * G * Math.sin(a2) * cd +
            M2 * L2 * w2 * w2 * sd -
            (M1 + M2) * G * Math.sin(a1)) /
        den1;
    const den2 = (L2 / L1) * den1;
    const a2dd =
        (-M2 * L2 * w2 * w2 * sd * cd +
            (M1 + M2) *
                (G * Math.sin(a1) * cd - L1 * w1 * w1 * sd - G * Math.sin(a2))) /
        den2;
    return [w1, w2, a1dd, a2dd];
}

function rk4(s, dt) {
    const [a1, a2, w1, w2] = s;
    const k1 = deriv(a1, a2, w1, w2);
    const k2 = deriv(
        a1 + 0.5 * dt * k1[0],
        a2 + 0.5 * dt * k1[1],
        w1 + 0.5 * dt * k1[2],
        w2 + 0.5 * dt * k1[3],
    );
    const k3 = deriv(
        a1 + 0.5 * dt * k2[0],
        a2 + 0.5 * dt * k2[1],
        w1 + 0.5 * dt * k2[2],
        w2 + 0.5 * dt * k2[3],
    );
    const k4 = deriv(
        a1 + dt * k3[0],
        a2 + dt * k3[1],
        w1 + dt * k3[2],
        w2 + dt * k3[3],
    );
    return [
        a1 + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        a2 + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
        w1 + (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
        w2 + (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]),
    ];
}

export default function DoublePendulum() {
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
        let pivot = { x: 0, y: 0 };
        let scale = 1;
        let pends = [];

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            pivot = { x: width / 2, y: height * 0.34 };
            scale = Math.min(width, height) * 0.2; // pixels per unit length
        }

        function reset() {
            pends = [];
            const base1 = Math.PI * 0.95; // near-horizontal, high energy
            const base2 = Math.PI * 0.95;
            for (let i = 0; i < N; i++) {
                pends.push({
                    s: [base1 + i * 1e-4, base2, 0, 0],
                    trail: [],
                });
            }
        }
        resize();
        reset();

        const onResize = () => {
            resize();
        };
        const onClick = () => reset();
        window.addEventListener("resize", onResize);
        canvas.addEventListener("pointerdown", onClick);

        function positions(s) {
            const [a1, a2] = s;
            const x1 = pivot.x + scale * L1 * Math.sin(a1);
            const y1 = pivot.y + scale * L1 * Math.cos(a1);
            const x2 = x1 + scale * L2 * Math.sin(a2);
            const y2 = y1 + scale * L2 * Math.cos(a2);
            return { x1, y1, x2, y2 };
        }

        function step() {
            for (const p of pends) {
                p.s = rk4(p.s, DT);
            }
        }

        function render() {
            ctx.clearRect(0, 0, width, height);
            // Pivot dot.
            ctx.fillStyle = "rgba(255,255,255,0.5)";
            ctx.beginPath();
            ctx.arc(pivot.x, pivot.y, 3, 0, Math.PI * 2);
            ctx.fill();

            for (let i = 0; i < pends.length; i++) {
                const p = pends[i];
                const t = i / (pends.length - 1);
                const r = Math.round(VIOLET[0] + (CYAN[0] - VIOLET[0]) * t);
                const g = Math.round(VIOLET[1] + (CYAN[1] - VIOLET[1]) * t);
                const b = Math.round(VIOLET[2] + (CYAN[2] - VIOLET[2]) * t);
                const { x1, y1, x2, y2 } = positions(p.s);

                p.trail.push([x2, y2]);
                if (p.trail.length > TRAIL) p.trail.shift();

                // Fading tip trail.
                ctx.lineWidth = 1.5;
                for (let k = 1; k < p.trail.length; k++) {
                    const a = (k / p.trail.length) * 0.5;
                    ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
                    ctx.beginPath();
                    ctx.moveTo(p.trail[k - 1][0], p.trail[k - 1][1]);
                    ctx.lineTo(p.trail[k][0], p.trail[k][1]);
                    ctx.stroke();
                }

                // Rods — thin, semi-transparent so the fan layers nicely.
                ctx.strokeStyle = `rgba(${r},${g},${b},0.55)`;
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.moveTo(pivot.x, pivot.y);
                ctx.lineTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();

                // Bobs.
                ctx.fillStyle = `rgba(${r},${g},${b},0.95)`;
                ctx.beginPath();
                ctx.arc(x2, y2, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        let raf;
        if (reduced) {
            for (let k = 0; k < SUBSTEPS * 40; k++) step();
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
            window.removeEventListener("resize", onResize);
            canvas.removeEventListener("pointerdown", onClick);
        };
    }, [reduced]);

    return (
        <canvas
            ref={canvasRef}
            role="img"
            aria-label="A fan of double pendulums demonstrating chaos: released from nearly identical angles, they diverge into completely different paths. Click to release a fresh fan."
            className="w-full h-full block cursor-pointer"
        />
    );
}
