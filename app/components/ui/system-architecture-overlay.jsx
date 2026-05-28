"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { eventBus } from "@/app/lib/event-bus";

// System architecture overlay — Stripe-style "open dev mode" toggle for
// this site's own runtime. Click the floating chevron-graph icon (or
// say "show architecture" if voice is wired) to flip into a full-
// screen system graph. Nodes are the live subsystems this page is
// running; edges PULSE in real time whenever the corresponding event
// fires on the event bus.
//
// Subsystems (rendered as nodes):
//   - browser           : the visitor's tab / inputs
//   - voice-parser      : `use-voice-commands` recognizer + intent map
//   - io-scheduler      : `use-performance.useIntersectionObserver`
//   - prefetch          : `use-predictive-prefetch` mouse-trajectory
//   - rsc-server        : Next.js server (route navigations)
//   - webgpu-worker     : particle hero compute worker
//   - audio-worklet     : Tone.js generative audio engine
//
// Edges + event mapping:
//   voice:intent        → browser ──→ voice-parser ──→ rsc-server
//   io:enter            → browser ──→ io-scheduler  (+ scheduler →
//                         audio-worklet when paired with audio:section-change)
//   audio:section-change→ io-scheduler ──→ audio-worklet
//   prefetch:queued     → io-scheduler ──→ prefetch ──→ rsc-server

const NODES = [
    { id: "browser",      label: "browser",          sub: "visitor tab",      x: 0.10, y: 0.55, color: "#94a3b8" },
    { id: "voice-parser", label: "voice intent",     sub: "use-voice-commands", x: 0.30, y: 0.20, color: "#8b5cf6" },
    { id: "io-scheduler", label: "IO scheduler",     sub: "intersection observer", x: 0.30, y: 0.90, color: "#06b6d4" },
    { id: "prefetch",     label: "prefetch",         sub: "use-predictive-prefetch", x: 0.55, y: 0.55, color: "#f59e0b" },
    { id: "rsc-server",   label: "RSC server",       sub: "Next.js route",     x: 0.78, y: 0.20, color: "#10b981" },
    { id: "audio-worklet",label: "audio worklet",    sub: "Tone.js engine",    x: 0.78, y: 0.90, color: "#f472b6" },
    { id: "webgpu-worker",label: "WebGPU worker",    sub: "particle compute",  x: 0.78, y: 0.55, color: "#ec4899" },
];

const EDGES = [
    { id: "e1", from: "browser",      to: "voice-parser" },
    { id: "e2", from: "voice-parser", to: "rsc-server" },
    { id: "e3", from: "browser",      to: "io-scheduler" },
    { id: "e4", from: "io-scheduler", to: "audio-worklet" },
    { id: "e5", from: "io-scheduler", to: "prefetch" },
    { id: "e6", from: "prefetch",     to: "rsc-server" },
    { id: "e7", from: "browser",      to: "webgpu-worker" },
];

// Map an event to the list of edge ids that should pulse.
const EVENT_EDGES = {
    "voice:intent": ["e1", "e2"],
    "io:enter": ["e3"],
    "audio:section-change": ["e4"],
    "prefetch:queued": ["e5", "e6"],
};

const VIEW_W = 1000;
const VIEW_H = 600;
const PULSE_MS = 1400;

export default function SystemArchitectureOverlay() {
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(new Map()); // edgeId → expiresAt
    const reduced = useReducedMotion();

    // Subscribe to the event bus. Each event lights up its mapped
    // edges for PULSE_MS. We store an explicit expiry timestamp so
    // overlapping pulses don't truncate each other — the longer-
    // running pulse wins.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const unsubs = [];
        for (const [event, edgeIds] of Object.entries(EVENT_EDGES)) {
            unsubs.push(
                eventBus.on(event, () => {
                    const now = performance.now();
                    setActive((prev) => {
                        const next = new Map(prev);
                        for (const id of edgeIds) {
                            const prevExp = next.get(id) || 0;
                            next.set(id, Math.max(prevExp, now + PULSE_MS));
                        }
                        return next;
                    });
                }),
            );
        }
        return () => unsubs.forEach((u) => u());
    }, []);

    // Tick that clears expired pulses so they don't leak. Runs only
    // when the overlay is open OR there are active pulses to clear.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        if (active.size === 0) return undefined;
        let raf;
        const tick = () => {
            const now = performance.now();
            setActive((prev) => {
                let changed = false;
                const next = new Map(prev);
                for (const [id, exp] of next) {
                    if (exp <= now) {
                        next.delete(id);
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [active.size]);

    // Esc closes the overlay.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const onKey = (e) => {
            if (e.key === "Escape" && open) setOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open]);

    // Expose a tiny tester hook so Playwright + curious dev-tools
    // users can fire bus events without importing the module
    // directly. Same instance the overlay subscribes to, so the
    // edge-pulse roundtrip is real.
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        window.__emitBus = (ev, data) => eventBus.emit(ev, data || {});
        return () => {
            if (window.__emitBus) delete window.__emitBus;
        };
    }, []);

    const toggle = useCallback(() => setOpen((o) => !o), []);

    return (
        <>
            <ToggleButton open={open} onToggle={toggle} />
            <AnimatePresence>
                {open && (
                    <OverlayPanel
                        active={active}
                        onClose={toggle}
                        reduced={reduced}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ---------- Toggle button ----------

function ToggleButton({ open, onToggle }) {
    return (
        <button
            type="button"
            aria-label={open ? "Close system architecture overlay" : "Open system architecture overlay"}
            aria-expanded={open}
            data-system-overlay-toggle="true"
            onClick={onToggle}
            className={
                "fixed bottom-4 left-4 z-[110] w-11 h-11 flex items-center justify-center rounded-full border backdrop-blur-sm transition-colors " +
                (open
                    ? "bg-violet-500/40 border-violet-400 text-white"
                    : "bg-white/5 border-white/15 text-gray-300 hover:bg-white/10 hover:border-white/30")
            }
        >
            <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <circle cx="6" cy="6" r="2.5" />
                <circle cx="18" cy="6" r="2.5" />
                <circle cx="6" cy="18" r="2.5" />
                <circle cx="18" cy="18" r="2.5" />
                <circle cx="12" cy="12" r="2.5" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="6" y1="8" x2="6" y2="16" />
                <line x1="18" y1="8" x2="18" y2="16" />
                <line x1="8" y1="18" x2="16" y2="18" />
                <line x1="7.5" y1="7.5" x2="10.5" y2="10.5" />
                <line x1="16.5" y1="7.5" x2="13.5" y2="10.5" />
                <line x1="7.5" y1="16.5" x2="10.5" y2="13.5" />
                <line x1="16.5" y1="16.5" x2="13.5" y2="13.5" />
            </svg>
        </button>
    );
}

// ---------- Overlay ----------

function OverlayPanel({ active, onClose, reduced }) {
    return (
        <motion.div
            data-system-overlay="open"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.25 }}
            className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4 py-12"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.96 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.96 }}
                transition={{ duration: reduced ? 0 : 0.25 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-[1100px] glass-card overflow-hidden"
            >
                <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/40 font-mono text-xs">
                    <span className="flex gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-red-500/70" />
                        <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                        <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                    </span>
                    <span className="text-gray-400 flex-1 text-center">
                        system architecture · this site, running
                    </span>
                    <span className="text-emerald-400 inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        live
                    </span>
                </div>
                <div className="p-4 bg-[#06061a]/80">
                    <SystemGraph active={active} />
                </div>
                <div className="flex flex-col gap-2 px-4 py-3 border-t border-white/5 bg-black/40 font-mono text-[11px] text-gray-500">
                    <span>
                        edges PULSE in real time as the matching event
                        fires. try scrolling, hovering a project card,
                        or clicking the mic. or — fire one manually:
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                        <DemoButton event="voice:intent" label="voice:intent" color="text-violet-300" />
                        <DemoButton event="io:enter" label="io:enter" color="text-cyan-300" />
                        <DemoButton event="audio:section-change" label="audio:section-change" color="text-pink-300" />
                        <DemoButton event="prefetch:queued" label="prefetch:queued" color="text-amber-300" />
                        <button
                            type="button"
                            onClick={onClose}
                            className="ml-auto px-3 py-1.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                        >
                            Close (Esc)
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}

// ---------- Graph render ----------

function SystemGraph({ active }) {
    const nodesById = useMemo(
        () => Object.fromEntries(NODES.map((n) => [n.id, n])),
        [],
    );
    const now = useNow(active.size > 0 ? 80 : 1000);

    return (
        <div
            className="relative w-full"
            style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
        >
            <svg
                viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
                className="absolute inset-0 w-full h-full"
                role="img"
                aria-label="System architecture graph showing live subsystems and inter-subsystem events"
            >
                {EDGES.map((edge) => {
                    const from = nodesById[edge.from];
                    const to = nodesById[edge.to];
                    if (!from || !to) return null;
                    const expiresAt = active.get(edge.id);
                    const pulsing = expiresAt != null && expiresAt > now;
                    const remaining = pulsing ? expiresAt - now : 0;
                    const intensity = pulsing
                        ? Math.min(1, remaining / PULSE_MS)
                        : 0;
                    const x1 = from.x * VIEW_W;
                    const y1 = from.y * VIEW_H;
                    const x2 = to.x * VIEW_W;
                    const y2 = to.y * VIEW_H;
                    return (
                        <g key={edge.id} data-edge={edge.id} data-active={pulsing ? "1" : "0"}>
                            <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={pulsing ? to.color : "rgba(148,163,184,0.35)"}
                                strokeWidth={pulsing ? 2.4 : 1.2}
                            />
                            {pulsing && (
                                <line
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    stroke={to.color}
                                    strokeWidth={6}
                                    opacity={0.18 + 0.25 * intensity}
                                    style={{ filter: "blur(2px)" }}
                                />
                            )}
                            {pulsing && (
                                <PacketTraveller
                                    x1={x1}
                                    y1={y1}
                                    x2={x2}
                                    y2={y2}
                                    color={to.color}
                                    expiresAt={expiresAt}
                                    now={now}
                                />
                            )}
                        </g>
                    );
                })}
                {NODES.map((n) => {
                    const cx = n.x * VIEW_W;
                    const cy = n.y * VIEW_H;
                    return (
                        <g key={n.id} data-node={n.id}>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={32}
                                fill={`color-mix(in srgb, ${n.color} 18%, transparent)`}
                                stroke={n.color}
                                strokeWidth={1.5}
                            />
                            <text
                                x={cx}
                                y={cy - 4}
                                textAnchor="middle"
                                fill="#fff"
                                fontSize={13}
                                fontWeight={600}
                                style={{
                                    fontFamily:
                                        "ui-sans-serif, system-ui, sans-serif",
                                }}
                            >
                                {n.label}
                            </text>
                            <text
                                x={cx}
                                y={cy + 10}
                                textAnchor="middle"
                                fill="rgba(229,231,235,0.6)"
                                fontSize={10}
                                style={{ fontFamily: "ui-monospace, monospace" }}
                            >
                                {n.sub}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

function DemoButton({ event, label, color }) {
    return (
        <button
            type="button"
            data-demo-emit={event}
            onClick={() => eventBus.emit(event, { source: "demo" })}
            className={
                "px-2 py-1 rounded border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-colors " +
                color
            }
        >
            ▸ fire {label}
        </button>
    );
}

function PacketTraveller({ x1, y1, x2, y2, color, expiresAt, now }) {
    // 0 at the start of the pulse, 1 at expiry.
    const remaining = expiresAt - now;
    const t = 1 - Math.max(0, Math.min(1, remaining / PULSE_MS));
    const px = x1 + (x2 - x1) * t;
    const py = y1 + (y2 - y1) * t;
    return <circle cx={px} cy={py} r={5} fill={color} opacity={0.9} />;
}

function useNow(intervalMs) {
    const [now, setNow] = useState(() =>
        typeof performance !== "undefined" ? performance.now() : 0,
    );
    useEffect(() => {
        if (typeof window === "undefined") return undefined;
        const id = setInterval(() => setNow(performance.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
}
