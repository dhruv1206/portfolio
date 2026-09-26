"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";

// Fourier epicycles. Any closed path is a sum of rotating circles —
// take the discrete Fourier transform of the path's points, and each
// coefficient becomes a circle spinning at its own integer frequency
// with a fixed radius and phase. Chain them tip-to-tip (biggest
// first) and the final tip retraces the original drawing. The DFT,
// made visible.

const SAMPLES = 180;

// Closed shapes as parametric point generators (θ ∈ [0,2π)).
const SHAPES = {
    star: (th) => {
        // 5-point star via alternating radius.
        const k = 5;
        const spikes = Math.cos(k * th);
        const rr = 1 + 0.5 * spikes;
        return [Math.cos(th) * rr, Math.sin(th) * rr];
    },
    heart: (th) => {
        const t = th;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y =
            13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t);
        return [x / 17, -y / 17];
    },
    infinity: (th) => {
        const s = 1 / (1 + Math.sin(th) * Math.sin(th));
        return [Math.cos(th) * s * 1.4, Math.sin(th) * Math.cos(th) * s * 1.4];
    },
};
const SHAPE_ORDER = ["star", "heart", "infinity"];

// DFT → [{freq, amp, phase}] sorted by amplitude descending.
function computeDFT(points) {
    const N = points.length;
    const out = [];
    for (let k = 0; k < N; k++) {
        let re = 0;
        let im = 0;
        for (let n = 0; n < N; n++) {
            const phi = (-2 * Math.PI * k * n) / N;
            const c = Math.cos(phi);
            const s = Math.sin(phi);
            re += points[n][0] * c - points[n][1] * s;
            im += points[n][0] * s + points[n][1] * c;
        }
        re /= N;
        im /= N;
        out.push({
            freq: k,
            amp: Math.hypot(re, im),
            phase: Math.atan2(im, re),
        });
    }
    out.sort((a, b) => b.amp - a.amp);
    return out;
}

export default function Fourier() {
    const canvasRef = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [shape, setShape] = useState("star");
    const shapeRef = useRef(shape);
    useEffect(() => {
        shapeRef.current = shape;
    }, [shape]);

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

        let epicycles = [];
        let activeShape = null;
        function build(name) {
            const gen = SHAPES[name];
            const raw = [];
            for (let i = 0; i < SAMPLES; i++) {
                const th = (i / SAMPLES) * Math.PI * 2;
                raw.push(gen(th));
            }
            epicycles = computeDFT(raw);
            activeShape = name;
        }
        build(shapeRef.current);

        const onResize = () => resize();
        window.addEventListener("resize", onResize);

        let t = 0;
        let path = [];

        function render() {
            if (activeShape !== shapeRef.current) {
                build(shapeRef.current);
                t = 0;
                path = [];
            }
            ctx.clearRect(0, 0, width, height);
            const scale = Math.min(width, height) * 0.3;
            const cx = width / 2;
            const cy = height / 2;

            // Sum epicycles at time t, drawing each circle.
            let x = cx;
            let y = cy;
            ctx.lineWidth = 1;
            for (let i = 0; i < epicycles.length; i++) {
                const e = epicycles[i];
                const prevX = x;
                const prevY = y;
                const r = e.amp * scale;
                const ang = e.freq * t + e.phase;
                x += r * Math.cos(ang);
                y += r * Math.sin(ang);
                // Only draw circles big enough to see (keeps it crisp).
                if (r > 1.2 && i < 90) {
                    ctx.strokeStyle = "rgba(139,92,246,0.18)";
                    ctx.beginPath();
                    ctx.arc(prevX, prevY, r, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.strokeStyle = "rgba(160,140,255,0.35)";
                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, y);
                    ctx.stroke();
                }
            }

            // Accumulate + draw the traced path.
            path.push([x, y]);
            if (path.length > SAMPLES) path.shift();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(110,231,249,0.95)";
            ctx.beginPath();
            for (let i = 0; i < path.length; i++) {
                if (i === 0) ctx.moveTo(path[i][0], path[i][1]);
                else ctx.lineTo(path[i][0], path[i][1]);
            }
            ctx.stroke();

            // tip dot
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            ctx.arc(x, y, 2.5, 0, Math.PI * 2);
            ctx.fill();

            // advance time; one full loop = 2π over SAMPLES steps
            t += (Math.PI * 2) / SAMPLES;
            if (t > Math.PI * 2) {
                t -= Math.PI * 2;
                path = [];
            }
        }

        let raf;
        if (reduced) {
            // Trace the whole shape in one static frame.
            ctx.clearRect(0, 0, width, height);
            const scale = Math.min(width, height) * 0.3;
            const cx = width / 2;
            const cy = height / 2;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(110,231,249,0.95)";
            ctx.beginPath();
            for (let step = 0; step <= SAMPLES; step++) {
                const tt = (step / SAMPLES) * Math.PI * 2;
                let x = cx;
                let y = cy;
                for (const e of epicycles) {
                    x += e.amp * scale * Math.cos(e.freq * tt + e.phase);
                    y += e.amp * scale * Math.sin(e.freq * tt + e.phase);
                }
                if (step === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        } else {
            const loop = () => {
                render();
                raf = requestAnimationFrame(loop);
            };
            raf = requestAnimationFrame(loop);
        }

        return () => {
            if (raf) cancelAnimationFrame(raf);
            window.removeEventListener("resize", onResize);
        };
    }, [reduced]);

    return (
        <div className="relative w-full h-full">
            <canvas
                ref={canvasRef}
                role="img"
                aria-label="Fourier epicycles: nested rotating circles derived from the discrete Fourier transform of a shape, whose chained tip retraces the shape. Use the buttons to switch shapes."
                className="w-full h-full block"
            />
            <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                {SHAPE_ORDER.map((name) => (
                    <button
                        key={name}
                        type="button"
                        onClick={() => setShape(name)}
                        className={
                            "px-2.5 py-1 text-[11px] font-mono rounded border transition-colors capitalize " +
                            (shape === name
                                ? "bg-cyan-500/30 border-cyan-400/70 text-cyan-100"
                                : "bg-black/40 border-white/10 text-gray-400 hover:bg-white/10")
                        }
                    >
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );
}
