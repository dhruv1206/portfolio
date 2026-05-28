"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";

// SVG architecture diagram that cross-fades between named states.
//
// Props:
//   states         { [stateId]: { nodes, edges, caption } }
//   activeStateId  the id currently visible
//
// Node shape:
//   { x, y (in [0,1]), label, kind: "circle"|"rect"|"small", color, w?, h?, r? }
//
// Edge shape:
//   { from, to, color?, strong?: bool, animated?: bool }
//
// The renderer takes the UNION of all node + edge ids across every
// state so the same SVG element animates smoothly between positions
// instead of unmount → remount → flicker.  Nodes absent from the
// active state fade to opacity 0; nodes present in both states
// interpolate position via Framer Motion's spring layout.

const VIEW_W = 1000;
const VIEW_H = 600;
const SPRING = { type: "spring", stiffness: 110, damping: 22, mass: 0.8 };
const FADE = { duration: 0.4, ease: [0.4, 0, 0.2, 1] };

function nodeRadius(node) {
    if (node.kind === "small") return 22;
    if (node.kind === "circle") return (node.r ?? 0.08) * VIEW_W;
    return 0;
}

function rectSize(node) {
    return {
        w: (node.w ?? 0.16) * VIEW_W,
        h: (node.h ?? 0.22) * VIEW_H,
    };
}

function NodeShape({ node }) {
    const fill = node.color
        ? `color-mix(in srgb, ${node.color} 18%, transparent)`
        : "rgba(255,255,255,0.08)";
    const stroke = node.color || "rgba(255,255,255,0.4)";
    if (node.kind === "rect") {
        const { w, h } = rectSize(node);
        return (
            <>
                <rect
                    x={-w / 2}
                    y={-h / 2}
                    width={w}
                    height={h}
                    rx={10}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                />
                <text
                    textAnchor="middle"
                    dy={4}
                    fill="#fff"
                    fontSize={14}
                    fontWeight={600}
                    style={{
                        fontFamily:
                            "ui-sans-serif, system-ui, -apple-system, sans-serif",
                    }}
                >
                    {node.label}
                </text>
            </>
        );
    }
    const r = nodeRadius(node);
    return (
        <>
            <circle
                r={r}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
            />
            <text
                textAnchor="middle"
                dy={r + 16}
                fill="rgba(229,231,235,0.85)"
                fontSize={12}
                style={{
                    fontFamily: "ui-monospace, monospace",
                }}
            >
                {node.label}
            </text>
        </>
    );
}

export default function AnimatedArchitecture({
    states,
    activeStateId,
    className = "",
}) {
    const reduced = useReducedMotion();
    const transition = reduced ? { duration: 0 } : SPRING;
    const fadeTransition = reduced ? { duration: 0 } : FADE;

    const activeState = states[activeStateId] || Object.values(states)[0] || {};

    // Union of all node ids across all states — rendered once each,
    // hidden/repositioned per active state.
    const allNodeIds = useMemo(() => {
        const ids = new Set();
        for (const s of Object.values(states)) {
            for (const id of Object.keys(s.nodes || {})) ids.add(id);
        }
        return Array.from(ids);
    }, [states]);

    // Union of edges (keyed by "from->to") with the latest spec per id.
    const allEdges = useMemo(() => {
        const map = new Map();
        for (const s of Object.values(states)) {
            for (const e of s.edges || []) {
                map.set(`${e.from}->${e.to}`, e);
            }
        }
        return Array.from(map.values());
    }, [states]);

    return (
        <div
            className={"relative w-full " + className}
            style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
            data-active-state={activeStateId}
        >
            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="absolute inset-0 w-full h-full"
                role="img"
                aria-label={
                    activeState.caption ||
                    "Architecture diagram for the current chapter"
                }
            >
                {/* Edges underneath nodes. */}
                {allEdges.map((edge) => {
                    const active = (activeState.edges || []).some(
                        (ae) => ae.from === edge.from && ae.to === edge.to,
                    );
                    const fromNode = activeState.nodes?.[edge.from];
                    const toNode = activeState.nodes?.[edge.to];
                    const visible = active && fromNode && toNode;
                    return (
                        <motion.line
                            key={`${edge.from}->${edge.to}`}
                            initial={false}
                            animate={{
                                x1: visible ? fromNode.x * VIEW_W : VIEW_W / 2,
                                y1: visible ? fromNode.y * VIEW_H : VIEW_H / 2,
                                x2: visible ? toNode.x * VIEW_W : VIEW_W / 2,
                                y2: visible ? toNode.y * VIEW_H : VIEW_H / 2,
                                opacity: visible ? 1 : 0,
                            }}
                            transition={transition}
                            stroke={edge.color || "rgba(148,163,184,0.45)"}
                            strokeWidth={edge.strong ? 2.2 : 1.4}
                            strokeDasharray={edge.animated ? "6 6" : undefined}
                            strokeLinecap="round"
                        >
                            {edge.animated && !reduced && (
                                <animate
                                    attributeName="stroke-dashoffset"
                                    from={0}
                                    to={-24}
                                    dur="1.4s"
                                    repeatCount="indefinite"
                                />
                            )}
                        </motion.line>
                    );
                })}

                {/* Nodes. */}
                {allNodeIds.map((id) => {
                    const node = activeState.nodes?.[id];
                    const visible = !!node;
                    // When a node is hidden we collapse it toward the
                    // diagram centre so its disappearance reads as a
                    // "fold-in" rather than a teleport.
                    const x = visible ? node.x * VIEW_W : VIEW_W / 2;
                    const y = visible ? node.y * VIEW_H : VIEW_H / 2;
                    return (
                        <motion.g
                            key={id}
                            initial={false}
                            animate={{
                                x,
                                y,
                                opacity: visible ? 1 : 0,
                                scale: visible ? 1 : 0.6,
                            }}
                            transition={{
                                ...transition,
                                opacity: fadeTransition,
                            }}
                            style={{ transformBox: "fill-box", transformOrigin: "center" }}
                        >
                            {visible && <NodeShape node={node} />}
                        </motion.g>
                    );
                })}
            </svg>

            {/* Caption pinned to the bottom of the diagram. */}
            {activeState.caption && (
                <motion.div
                    key={activeStateId + "-caption"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={fadeTransition}
                    className="absolute bottom-3 left-4 right-4 text-[12px] md:text-[13px] font-mono text-gray-400 leading-relaxed"
                >
                    {activeState.caption}
                </motion.div>
            )}
        </div>
    );
}
