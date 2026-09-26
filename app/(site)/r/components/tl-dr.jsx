// Recruiter-mode TL;DR: career stats above the fold. Numbers come from
// the résumé (Sep 2026) and match the homepage and the control room.

const STATS = [
    { value: "150K+", label: "MAU served", sub: "MyRik · CQRS product service" },
    { value: ">1 s → <300 ms", label: "p99 latency cut", sub: "OpenTelemetry · N+1 · indexes · cross-region RTDB", sm: true },
    { value: "₹200 → ₹3", label: "Maps API cost per ride", sub: "MyRik · session tokens · debounce", sm: true },
    { value: "1M+", label: "monthly users reached", sub: "CarWale · Short Videos + AI chat" },
    { value: "5M / day", label: "events at 99.9 %", sub: "JioHotstar · Kafka → Pub/Sub" },
    { value: "800+", label: "DSA solved", sub: "LeetCode Knight 1870+ · 6.5K app downloads" },
];

export default function TlDr() {
    return (
        <section aria-label="Career TL;DR" data-recruiter-tldr className="cell">
            <div className="cell-h"><i>▶</i><b>tl;dr</b><span>backend engineer</span><span className="r">defendable numbers only</span></div>
            <div className="cells cells-3" style={{ border: 0 }}>
                {STATS.map((s) => (
                    <div key={s.label} className={"stat" + (s.sm ? " stat-sm" : "")}><b>{s.value}</b><span>{s.label}<em>{s.sub}</em></span></div>
                ))}
            </div>
        </section>
    );
}
