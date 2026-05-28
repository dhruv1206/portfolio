"use client";

// Recruiter Mode TL;DR card — career stats above the fold. Numbers
// pulled straight from personal-data + the project descriptions, no
// marketing fluff. Every stat is something Dhruv can defend in
// interview.

const STATS = [
    {
        value: "150k+",
        label: "MAU served",
        sub: "CarWale catalog APIs",
    },
    {
        value: "1s → <300ms",
        label: "P99 latency cut",
        sub: "via caching + query optimisation",
    },
    {
        value: "95%",
        label: "infra cost down",
        sub: "CarWale catalog stack",
    },
    {
        value: "1.5M ops/s",
        label: "DStarDB SET",
        sub: "10× redis-benchmark single-thread (M1)",
    },
    {
        value: "1000+",
        label: "DSA solved",
        sub: "LeetCode Knight (1870+)",
    },
    {
        value: "3.5k+",
        label: "Play Store DLs",
        sub: "College attendance · 2-3 months",
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
