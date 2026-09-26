"use client";

// Recruiter Mode TL;DR card — career stats above the fold. Numbers
// come from the résumé (Sep 2026) and match the control room's About
// panel. Every stat is something Dhruv can defend in interview.

const STATS = [
    {
        value: "150K+",
        label: "MAU served",
        sub: "MyRik · CQRS product service",
    },
    {
        value: ">1 s → <300 ms",
        label: "p99 latency cut",
        sub: "OpenTelemetry · N+1 · indexes · cross-region RTDB",
    },
    {
        value: "₹200 → ₹3",
        label: "Maps API cost per ride",
        sub: "MyRik · session tokens · debounce",
    },
    {
        value: "1M+",
        label: "monthly users reached",
        sub: "CarWale · Short Videos + AI chat",
    },
    {
        value: "5M / day",
        label: "events at 99.9 %",
        sub: "JioHotstar · Kafka → Pub/Sub",
    },
    {
        value: "800+",
        label: "DSA solved",
        sub: "LeetCode Knight (1870+) · 6.5K app downloads",
    },
];

export default function TlDr() {
    return (
        <section
            aria-label="Career TL;DR"
            data-recruiter-tldr
            className="glass-card overflow-hidden"
        >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-black/30 font-mono text-xs">
                <span className="text-violet-400">▶</span>
                <span className="text-gray-400">tl;dr · backend engineer</span>
                <span className="ml-auto text-gray-500">defendable numbers only</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-white/5">
                {STATS.map((s) => (
                    <div key={s.label} className="bg-[#06061a]/80 px-5 py-4">
                        <div className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                            {s.value}
                        </div>
                        <div className="text-[11px] uppercase tracking-wider text-violet-300 mt-1">
                            {s.label}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5 leading-snug">
                            {s.sub}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
