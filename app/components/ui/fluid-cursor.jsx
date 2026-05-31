"use client";

import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Hoisted out of the component so the class identity is stable across
// renders.
//
// Each particle paints itself as a SOFT radial gradient — the glow's
// softness is baked into the sprite. That replaces the old approach of
// drawing hard circles and then running a full-viewport
// `filter: blur(30px)` over the whole canvas every frame, which was the
// dominant source of site-wide jank (a 30px Gaussian blur over the
// entire viewport, recomputed 60×/second, for an effect at 0.03 opacity).
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.life = 1;
        // Generous radius — the soft gradient edge gives the blurred,
        // fluid look without a post-process blur.
        this.size = 42 + Math.random() * 46;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.94;
        this.vy *= 0.94;
        // Decay quickly enough that the trail fades in ~1s, so the gated
        // animation loop falls idle soon after the pointer stops moving.
        this.life *= 0.93;
    }

    draw(ctx) {
        if (this.life < 0.02) return;
        const r = this.size * (0.65 + this.life * 0.35);
        const a = this.life * 0.55;
        const grad = ctx.createRadialGradient(
            this.x,
            this.y,
            0,
            this.x,
            this.y,
            r,
        );
        grad.addColorStop(0, `rgba(167, 139, 250, ${a})`); // violet-400 core
        grad.addColorStop(0.45, `rgba(139, 92, 246, ${a * 0.45})`); // violet-500
        grad.addColorStop(1, "rgba(139, 92, 246, 0)"); // soft transparent edge
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * FluidCursor — a soft violet glow that trails the pointer. Drawn on a
 * transparent canvas with `mix-blend-mode: screen` so the glow adds light
 * over the dark theme. The animation loop is GATED: it only runs while
 * particles are alive and stops entirely once the trail fades, so the
 * effect costs nothing while the pointer is still.
 */
const FluidCursor = ({ opacity = 0.05 }) => {
    const canvasRef = useRef(null);
    const particlesRef = useRef([]);
    const rafRef = useRef(0);
    const reduced = usePrefersReducedMotion();

    useEffect(() => {
        if (reduced) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext("2d");
        if (!ctx) return undefined;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();

        const mouse = { x: 0, y: 0, px: 0, py: 0, seen: false };

        // One animation step; reschedules itself only while particles
        // remain. When the list drains it sets rafRef back to 0 and the
        // loop dies — so there is no idle cost.
        const loop = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const live = [];
            const list = particlesRef.current;
            for (let i = 0; i < list.length; i++) {
                const p = list[i];
                p.update();
                if (p.life > 0.02) {
                    p.draw(ctx);
                    live.push(p);
                }
            }
            particlesRef.current = live;
            rafRef.current = live.length > 0 ? requestAnimationFrame(loop) : 0;
        };

        const ensureRunning = () => {
            if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
        };

        const onMove = (e) => {
            if (!mouse.seen) {
                mouse.x = e.clientX;
                mouse.y = e.clientY;
                mouse.seen = true;
            }
            mouse.px = mouse.x;
            mouse.py = mouse.y;
            mouse.x = e.clientX;
            mouse.y = e.clientY;

            const vx = (mouse.x - mouse.px) * 0.5;
            const vy = (mouse.y - mouse.py) * 0.5;
            const speed = Math.hypot(vx, vy);

            // Movement spawns a few particles, then we make sure the loop
            // is running. No movement → no spawns → loop stays idle.
            if (speed > 2) {
                const count = Math.min(Math.floor(speed / 6) + 1, 3);
                for (let i = 0; i < count; i++) {
                    const p = new Particle(
                        mouse.x + (Math.random() - 0.5) * 16,
                        mouse.y + (Math.random() - 0.5) * 16,
                    );
                    p.vx = vx * 0.25 + (Math.random() - 0.5) * 1.5;
                    p.vy = vy * 0.25 + (Math.random() - 0.5) * 1.5;
                    particlesRef.current.push(p);
                }
                if (particlesRef.current.length > 60) {
                    particlesRef.current = particlesRef.current.slice(-60);
                }
                ensureRunning();
            }
        };

        window.addEventListener("resize", resize);
        window.addEventListener("mousemove", onMove, { passive: true });

        return () => {
            window.removeEventListener("resize", resize);
            window.removeEventListener("mousemove", onMove);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = 0;
            particlesRef.current = [];
        };
    }, [reduced]);

    // Reduced motion: no decorative glow at all.
    if (reduced) return null;

    return (
        <motion.canvas
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            transition={{ duration: 1 }}
            className="fixed inset-0 pointer-events-none z-[1]"
            // mix-blend screen makes the glow add light over the dark
            // theme. NOTE: no `filter: blur()` — softness is in the
            // gradient sprites, so there is no per-frame full-screen blur.
            style={{ mixBlendMode: "screen" }}
            aria-hidden="true"
        />
    );
};

export default FluidCursor;
