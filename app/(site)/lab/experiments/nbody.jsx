"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// N-body gravity. Every body feels Newtonian attraction from every
// other (O(n²) pairs), softened by ε² to keep close encounters finite.
// Integrated with velocity-Verlet, which is symplectic — orbits stay
// bound instead of slowly spiralling out from truncation error the way
// naive Euler would. Trails are a translucent fade-fill each frame.
// Click-drag to slingshot a new body in (drag back, release to fling).

const G = 0.9;
const SOFTENING2 = 80; // ε², avoids the 1/r² singularity at contact
const SUBSTEPS = 2;
const DT = 0.6;
const PALETTE = ["#8b5cf6", "#06b6d4", "#f472b6", "#f59e0b", "#10b981"];

export default function NBody() {
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
        let bodies = [];
        let colorIdx = 0;

        function resize() {
            const rect = canvas.getBoundingClientRect();
            width = rect.width;
            height = rect.height;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function seedBinary() {
            const cx = width / 2;
            const cy = height / 2;
            const d = Math.min(width, height) * 0.16;
            const m = 1400;
            // Circular binary: each mass orbits the barycentre. For two
            // equal masses the relative circular speed is
            // v_rel = sqrt(G·(m₁+m₂)/d); each moves at half that.
            const vRel = Math.sqrt((G * (m + m)) / d);
            const v = vRel / 2;
            bodies = [
                {
                    x: cx - d / 2, y: cy, vx: 0, vy: -v, m,
                    r: 9, color: "#8b5cf6",
                },
                {
                    x: cx + d / 2, y: cy, vx: 0, vy: v, m,
                    r: 9, color: "#06b6d4",
                },
            ];
        }

        resize();
        seedBinary();

        // Compute acceleration for every body from every other.
        function accelerations() {
            const n = bodies.length;
            const ax = new Float64Array(n);
            const ay = new Float64Array(n);
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    const dx = bodies[j].x - bodies[i].x;
                    const dy = bodies[j].y - bodies[i].y;
                    const r2 = dx * dx + dy * dy + SOFTENING2;
                    const invR = 1 / Math.sqrt(r2);
                    const invR3 = invR * invR * invR;
                    const fi = G * bodies[j].m * invR3;
                    const fj = G * bodies[i].m * invR3;
                    ax[i] += dx * fi;
                    ay[i] += dy * fi;
                    ax[j] -= dx * fj;
                    ay[j] -= dy * fj;
                }
            }
            return { ax, ay };
        }

        function stepVerlet(dt) {
            const n = bodies.length;
            let { ax, ay } = accelerations();
            // x += v dt + ½ a dt²
            for (let i = 0; i < n; i++) {
                bodies[i].x += bodies[i].vx * dt + 0.5 * ax[i] * dt * dt;
                bodies[i].y += bodies[i].vy * dt + 0.5 * ay[i] * dt * dt;
            }
            const next = accelerations();
            // v += ½ (a + a_new) dt
            for (let i = 0; i < n; i++) {
                bodies[i].vx += 0.5 * (ax[i] + next.ax[i]) * dt;
                bodies[i].vy += 0.5 * (ay[i] + next.ay[i]) * dt;
            }
        }

        // ----- slingshot interaction -----
        const aim = { active: false, x0: 0, y0: 0, x1: 0, y1: 0 };
        const local = (e) => {
            const r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        };
        const onDown = (e) => {
            const p = local(e);
            aim.active = true;
            aim.x0 = aim.x1 = p.x;
            aim.y0 = aim.y1 = p.y;
        };
        const onMove = (e) => {
            if (!aim.active) return;
            const p = local(e);
            aim.x1 = p.x;
            aim.y1 = p.y;
        };
        const onUp = () => {
            if (!aim.active) return;
            aim.active = false;
            // Drag back to fling: velocity points from release → start.
            const vx = (aim.x0 - aim.x1) * 0.05;
            const vy = (aim.y0 - aim.y1) * 0.05;
            bodies.push({
                x: aim.x0,
                y: aim.y0,
                vx,
                vy,
                m: 700,
                r: 6,
                color: PALETTE[colorIdx++ % PALETTE.length],
            });
        };
        canvas.addEventListener("pointerdown", onDown);
        canvas.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        const onResize = () => resize();
        window.addEventListener("resize", onResize);

        // Bodies that fly far off-screen are culled so the O(n²) loop
        // doesn't accumulate junk forever.
        function cull() {
            const pad = Math.max(width, height) * 2;
            bodies = bodies.filter(
                (b) =>
                    b.x > -pad &&
                    b.x < width + pad &&
                    b.y > -pad &&
                    b.y < height + pad,
            );
        }

        function drawBodies() {
            for (const b of bodies) {
                const grad = ctx.createRadialGradient(
                    b.x, b.y, 0, b.x, b.y, b.r * 3,
                );
                grad.addColorStop(0, b.color);
                grad.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r * 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function drawAim() {
            if (!aim.active) return;
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(aim.x1, aim.y1);
            ctx.lineTo(aim.x0, aim.y0);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,255,255,0.7)";
            ctx.beginPath();
            ctx.arc(aim.x0, aim.y0, 4, 0, Math.PI * 2);
            ctx.fill();
        }

        let raf;
        if (reduced) {
            ctx.fillStyle = "#03000f";
            ctx.fillRect(0, 0, width, height);
            drawBodies();
        } else {
            const loop = () => {
                // Trail effect: translucent wash instead of a hard clear.
                ctx.fillStyle = "rgba(3,0,15,0.16)";
                ctx.fillRect(0, 0, width, height);
                for (let s = 0; s < SUBSTEPS; s++) stepVerlet(DT / SUBSTEPS);
                cull();
                drawBodies();
                drawAim();
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
            aria-label="N-body gravity simulation. A binary star system; click and drag to slingshot additional bodies into orbit."
            className="w-full h-full block cursor-crosshair"
        />
    );
}
