"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const VIEWBOX_W = 400;
const VIEWBOX_H = 500;

const NODES = [
    { id: "gateway", label: "Gateway", x: 200, y: 70, r: 32, accent: "violet" },
    { id: "auth", label: "Auth", x: 80, y: 200, r: 26, accent: "violet" },
    { id: "api", label: "API", x: 200, y: 230, r: 38, accent: "cyan" },
    { id: "cache", label: "Cache", x: 320, y: 200, r: 26, accent: "pink" },
    { id: "db", label: "DB", x: 80, y: 380, r: 26, accent: "violet" },
    { id: "queue", label: "Queue", x: 200, y: 410, r: 28, accent: "cyan" },
    { id: "worker", label: "Worker", x: 320, y: 380, r: 26, accent: "pink" },
];

const EDGES = [
    { id: "e-gw-api", from: "gateway", to: "api", delay: 0.0 },
    { id: "e-gw-auth", from: "gateway", to: "auth", delay: 0.6 },
    { id: "e-auth-api", from: "auth", to: "api", delay: 1.2 },
    { id: "e-api-cache", from: "api", to: "cache", delay: 0.3 },
    { id: "e-api-db", from: "api", to: "db", delay: 0.9 },
    { id: "e-api-queue", from: "api", to: "queue", delay: 1.5 },
    { id: "e-queue-worker", from: "queue", to: "worker", delay: 1.8 },
];

const ACCENT = {
    violet: { stroke: "rgba(139, 92, 246, 0.85)", fill: "rgba(139, 92, 246, 0.08)", glow: "rgba(139, 92, 246, 0.55)" },
    cyan: { stroke: "rgba(6, 182, 212, 0.85)", fill: "rgba(6, 182, 212, 0.08)", glow: "rgba(6, 182, 212, 0.55)" },
    pink: { stroke: "rgba(244, 114, 182, 0.85)", fill: "rgba(244, 114, 182, 0.06)", glow: "rgba(244, 114, 182, 0.55)" },
};

function getNode(id) {
    return NODES.find((n) => n.id === id);
}

function edgePath(from, to) {
    const a = getNode(from);
    const b = getNode(to);
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

function SystemTopology() {
    const reducedMotion = useReducedMotion();
    const containerRef = useRef(null);
    const [pointer, setPointer] = useState({ x: 0.5, y: 0.5 });

    useEffect(() => {
        if (reducedMotion) return;
        const el = containerRef.current;
        if (!el) return;
        let frame = 0;
        const handle = (e) => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect();
                setPointer({
                    x: (e.clientX - rect.left) / rect.width,
                    y: (e.clientY - rect.top) / rect.height,
                });
                frame = 0;
            });
        };
        const reset = () => setPointer({ x: 0.5, y: 0.5 });
        el.addEventListener("pointermove", handle);
        el.addEventListener("pointerleave", reset);
        return () => {
            el.removeEventListener("pointermove", handle);
            el.removeEventListener("pointerleave", reset);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [reducedMotion]);

    const tiltX = (pointer.x - 0.5) * 6;
    const tiltY = (pointer.y - 0.5) * 6;

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full flex items-center justify-center select-none"
            aria-label="Animated system architecture diagram"
            role="img"
        >
            {/* Ambient backdrop glow */}
            <div
                aria-hidden
                className="absolute inset-0 pointer-events-none"
                style={{
                    background:
                        "radial-gradient(ellipse 60% 50% at 50% 45%, rgba(139,92,246,0.18), transparent 70%), radial-gradient(ellipse 40% 30% at 70% 70%, rgba(6,182,212,0.14), transparent 75%)",
                    filter: "blur(8px)",
                }}
            />

            <motion.svg
                viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
                className="relative w-full h-full max-w-[460px]"
                style={{
                    transform: reducedMotion
                        ? undefined
                        : `perspective(900px) rotateY(${tiltX}deg) rotateX(${-tiltY}deg)`,
                    transformStyle: "preserve-3d",
                    transition: "transform 250ms ease-out",
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
            >
                <defs>
                    <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="rgba(139, 92, 246, 0.55)" />
                        <stop offset="100%" stopColor="rgba(6, 182, 212, 0.55)" />
                    </linearGradient>
                    <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </radialGradient>
                    <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Edges */}
                <g strokeLinecap="round">
                    {EDGES.map((edge) => (
                        <path
                            key={edge.id}
                            id={edge.id}
                            d={edgePath(edge.from, edge.to)}
                            stroke="url(#edgeGradient)"
                            strokeWidth={1.2}
                            strokeDasharray="3 4"
                            fill="none"
                            opacity={0.55}
                        />
                    ))}
                </g>

                {/* Traffic dots travelling along edges */}
                {!reducedMotion && (
                    <g>
                        {EDGES.map((edge) => (
                            <circle
                                key={`dot-${edge.id}`}
                                r={2.6}
                                fill="rgb(186, 233, 254)"
                                opacity={0.95}
                                filter="url(#softGlow)"
                            >
                                <animateMotion
                                    dur="2.4s"
                                    begin={`${edge.delay}s`}
                                    repeatCount="indefinite"
                                    rotate="auto"
                                >
                                    <mpath href={`#${edge.id}`} />
                                </animateMotion>
                                <animate
                                    attributeName="opacity"
                                    values="0;0.95;0.95;0"
                                    keyTimes="0;0.1;0.9;1"
                                    dur="2.4s"
                                    begin={`${edge.delay}s`}
                                    repeatCount="indefinite"
                                />
                            </circle>
                        ))}
                    </g>
                )}

                {/* Nodes */}
                <g>
                    {NODES.map((node, idx) => {
                        const colors = ACCENT[node.accent] || ACCENT.violet;
                        return (
                            <g key={node.id} transform={`translate(${node.x} ${node.y})`}>
                                {/* outer pulse */}
                                {!reducedMotion && (
                                    <circle
                                        r={node.r}
                                        fill="none"
                                        stroke={colors.glow}
                                        strokeWidth={1}
                                        opacity={0.0}
                                    >
                                        <animate
                                            attributeName="r"
                                            values={`${node.r};${node.r + 18}`}
                                            dur="3.6s"
                                            begin={`${idx * 0.45}s`}
                                            repeatCount="indefinite"
                                        />
                                        <animate
                                            attributeName="opacity"
                                            values="0.5;0"
                                            dur="3.6s"
                                            begin={`${idx * 0.45}s`}
                                            repeatCount="indefinite"
                                        />
                                    </circle>
                                )}
                                {/* main node */}
                                <circle
                                    r={node.r}
                                    fill={colors.fill}
                                    stroke={colors.stroke}
                                    strokeWidth={1.4}
                                    filter="url(#softGlow)"
                                />
                                {/* inner highlight */}
                                <circle r={node.r * 0.95} fill="url(#nodeGlow)" />
                                {/* label */}
                                <text
                                    textAnchor="middle"
                                    dy=".35em"
                                    fontFamily="var(--font-space-grotesk), system-ui, sans-serif"
                                    fontSize={node.r > 30 ? "13" : "11"}
                                    fontWeight={600}
                                    fill="rgba(245, 245, 255, 0.92)"
                                    letterSpacing="0.04em"
                                >
                                    {node.label}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </motion.svg>

            {/* Status chip */}
            <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="absolute bottom-3 left-3 glass-card px-3 py-2 flex items-center gap-2 text-xs"
            >
                <span className="relative inline-flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-gray-300">7 services · p99 &lt; 300ms</span>
            </motion.div>
        </div>
    );
}

export default SystemTopology;
