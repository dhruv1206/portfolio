// Control room data: the modelled system, the console actions, the
// replayable scenarios, and the person. Every résumé fact here is
// separate from the numbers the model produces at runtime.

export type NodeKind = "users" | "edge" | "svc" | "data" | "ext" | "ctl";
export type Internals = "gateway" | "cache" | "db" | "queue" | "workers";

export interface NodeDef {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    kind: NodeKind;
    label: string;
    /** label used when the node is drawn too small for the full one */
    short?: string;
    sub: string;
    /** concurrent slots per replica */
    threads?: number;
    replicas?: number;
    /** mean service time, model ms */
    svc?: number;
    /** keeps its thread until the whole request finishes (sync call chains) */
    hold?: boolean;
    /** bounded queue per replica for hold nodes; excess is shed as 503 */
    qmax?: number;
    /** autoscaler manages this node */
    scale?: boolean;
    internals?: Internals;
    stack?: string[];
}

// World is 1600 × 900 units. Nodes are centre points.
export const NODES: NodeDef[] = [
    { id: "users", x: 100, y: 470, w: 110, h: 84, kind: "users", label: "Users", short: "Users", sub: "150K / month" },
    { id: "edge", x: 300, y: 470, w: 120, h: 56, kind: "edge", label: "Edge PoP", short: "Edge", sub: "bom1 · CDN cache", threads: 64, svc: 1.5, stack: ["Vercel edge", "Nginx"] },
    { id: "gateway", x: 500, y: 470, w: 132, h: 56, kind: "svc", label: "Gateway", short: "Gateway", sub: "Spring Cloud · 120 threads", threads: 120, qmax: 72, svc: 2.5, hold: true, internals: "gateway", stack: ["Spring Cloud Gateway", "Java"] },
    { id: "auth", x: 500, y: 330, w: 132, h: 50, kind: "svc", label: "Auth", short: "Auth", sub: "JWT · sessions", threads: 16, svc: 3.5, stack: ["Spring Boot", "Redis sessions"] },
    { id: "ride", x: 740, y: 330, w: 144, h: 56, kind: "svc", label: "Ride service", short: "Ride", sub: "Node.js · reads", threads: 16, replicas: 2, svc: 14, hold: true, scale: true, stack: ["Node.js", "TypeScript", "OpenTelemetry"] },
    { id: "product", x: 740, y: 470, w: 144, h: 56, kind: "svc", label: "Product service", short: "Product", sub: "CQRS · writes", threads: 16, replicas: 1, svc: 11, hold: true, stack: ["Spring Boot", "Java", "Pub/Sub"] },
    { id: "payments", x: 740, y: 610, w: 144, h: 56, kind: "svc", label: "Payments", short: "Payments", sub: "orders · webhooks", threads: 24, replicas: 1, svc: 9, hold: true, stack: ["Node.js", "Razorpay SDK"] },
    { id: "signal", x: 740, y: 750, w: 144, h: 56, kind: "svc", label: "Signalling", short: "Signal", sub: "STOMP · WebSocket", threads: 64, svc: 2.5, stack: ["Spring Boot", "WebRTC (SDP · ICE)"] },
    { id: "maps", x: 990, y: 210, w: 132, h: 50, kind: "ext", label: "Google Maps API", short: "Maps API", sub: "external · billed per call", threads: 999, svc: 55, stack: ["Places", "Distance Matrix"] },
    { id: "bus", x: 990, y: 470, w: 132, h: 50, kind: "data", label: "Event bus", short: "Bus", sub: "Pub/Sub · product events", threads: 999, svc: 1.5, stack: ["GCP Pub/Sub"] },
    { id: "readmodel", x: 1240, y: 470, w: 144, h: 56, kind: "svc", label: "Read model", short: "Reads", sub: "denormalised views", threads: 16, svc: 5, hold: true, stack: ["Spring Boot", "Postgres replica"] },
    { id: "razorpay", x: 990, y: 610, w: 132, h: 50, kind: "ext", label: "Razorpay", short: "Razorpay", sub: "external · payments", threads: 999, svc: 110, stack: ["Razorpay"] },
    { id: "cache", x: 1240, y: 330, w: 144, h: 56, kind: "data", label: "DStarDB", short: "DStarDB", sub: "Redis-compatible · C++20", threads: 8, svc: 0.35, internals: "cache", stack: ["C++20", "reactor + thread pool"] },
    { id: "pg", x: 1240, y: 610, w: 144, h: 56, kind: "data", label: "Postgres", short: "Postgres", sub: "primary · pool 40", threads: 40, svc: 16, internals: "db", stack: ["PostgreSQL 16", "pgbouncer"] },
    { id: "pgr", x: 1460, y: 610, w: 118, h: 56, kind: "data", label: "Replica", short: "Replica", sub: "streaming · reads", threads: 40, svc: 16, stack: ["PostgreSQL 16"] },
    { id: "queue", x: 990, y: 750, w: 132, h: 50, kind: "data", label: "Queue", short: "Queue", sub: "Pub/Sub · 4 partitions", threads: 999, svc: 0.8, internals: "queue", stack: ["GCP Pub/Sub", "pull consumers"] },
    { id: "workers", x: 1240, y: 750, w: 144, h: 56, kind: "svc", label: "Workers", short: "Workers", sub: "jobs · reconciliation", threads: 5, replicas: 2, svc: 95, scale: true, internals: "workers", stack: ["Node.js", "cron fallback"] },
    { id: "storage", x: 1460, y: 750, w: 118, h: 50, kind: "data", label: "Object storage", short: "Storage", sub: "Firebase", threads: 999, svc: 6, stack: ["Firebase Storage"] },
    { id: "cron", x: 1460, y: 470, w: 118, h: 50, kind: "ctl", label: "Cron", short: "Cron", sub: "reconcile · 5 min", threads: 1, svc: 1 },
    { id: "config", x: 300, y: 90, w: 120, h: 46, kind: "ctl", label: "Config server", short: "Config", sub: "secrets · env", threads: 4, svc: 1 },
    { id: "discovery", x: 500, y: 90, w: 132, h: 46, kind: "ctl", label: "Discovery", short: "Eureka", sub: "Eureka · heartbeats", threads: 8, svc: 1 },
    { id: "autoscaler", x: 740, y: 90, w: 144, h: 46, kind: "ctl", label: "Autoscaler", short: "HPA", sub: "HPA · util > 75 %", threads: 1, svc: 1 },
    { id: "otel", x: 990, y: 90, w: 132, h: 46, kind: "ctl", label: "OTel collector", short: "OTel", sub: "traces · logs · metrics", threads: 64, svc: 1, stack: ["OpenTelemetry"] },
    { id: "grafana", x: 1240, y: 90, w: 144, h: 46, kind: "ctl", label: "Grafana · Loki · Tempo", short: "Grafana", sub: "self-hosted", threads: 8, svc: 1, stack: ["Grafana", "Loki", "Tempo"] },
];

export const NODE_BY_ID: Record<string, NodeDef> = Object.fromEntries(NODES.map((n) => [n.id, n]));

export const EDGES: [string, string][] = [
    ["users", "edge"], ["edge", "gateway"], ["gateway", "auth"], ["gateway", "ride"], ["gateway", "product"], ["gateway", "payments"], ["gateway", "signal"],
    ["ride", "cache"], ["ride", "pg"], ["ride", "maps"], ["product", "pg"], ["product", "bus"], ["bus", "readmodel"], ["readmodel", "cache"], ["readmodel", "pgr"],
    ["payments", "razorpay"], ["razorpay", "queue"], ["queue", "workers"], ["workers", "pg"], ["workers", "storage"], ["pg", "pgr"], ["cron", "queue"],
    ["gateway", "discovery"], ["ride", "discovery"], ["product", "discovery"], ["payments", "discovery"], ["config", "discovery"], ["otel", "grafana"], ["gateway", "otel"], ["autoscaler", "ride"], ["autoscaler", "workers"],
];

export const CTL_EDGES = new Set([
    "gateway>discovery", "ride>discovery", "product>discovery", "payments>discovery", "config>discovery", "otel>grafana", "gateway>otel", "autoscaler>ride", "autoscaler>workers", "pg>pgr",
]);

export const BOOT_ORDER = [
    "config", "discovery", "autoscaler", "otel", "grafana", "users", "edge", "gateway", "auth", "ride", "product", "payments", "signal", "maps", "bus", "readmodel", "razorpay", "cache", "pg", "pgr", "queue", "workers", "storage", "cron",
];

export const BOOT_LINES: Record<string, string> = {
    config: "mounting config-server · secrets loaded", discovery: "eureka up · registry empty", autoscaler: "hpa armed · target util 75 %", otel: "otel collector listening :4317", grafana: "grafana · loki · tempo reachable", users: "150,000 monthly users · india-first", edge: "edge pop bom1 · cdn warm", gateway: "spring cloud gateway :8222 · 120 threads", auth: "auth · jwt keys rotated", ride: "ride service ×2 · registered", product: "product service · cqrs write side", payments: "payments · razorpay webhooks verified", signal: "signalling · stomp over websocket", maps: "google maps api · session tokens on", bus: "pub/sub · product events topic", readmodel: "read model · views rebuilt", razorpay: "razorpay · live keys", cache: "dstardb · 8 threads · 260 hot keys", pg: "postgres primary · pool 40", pgr: "replica streaming · lag 0 ms", queue: "pub/sub · 4 partitions", workers: "workers ×2 · consumers pulling", storage: "firebase storage · bucket ok", cron: "cron · reconciliation every 5 min",
};

export type ActionKind = "chaos" | "fix";
export interface ActionDef {
    id: string;
    key: string;
    kind: ActionKind;
    label: string;
    caption: string;
    explain: string;
    /** name of the sim flag this action toggles */
    toggle?: string;
}

export const ACTIONS: ActionDef[] = [
    { id: "killWorker", key: "K", kind: "chaos", label: "Kill a worker", caption: "worker replica killed · queue backs up · autoscaler will notice", explain: "Removes one worker replica. Watch queue depth climb until the autoscaler provisions a replacement." },
    { id: "killDb", key: "D", kind: "chaos", label: "Kill DB primary", caption: "Postgres primary down · writes fail · replica promoting", explain: "Primary goes dark. Reads keep flowing through the replica; writes error until failover promotes the replica." },
    { id: "partitionCache", key: "C", kind: "chaos", label: "Partition cache", caption: "DStarDB unreachable · every read misses · Postgres takes the load", explain: "Network partition between services and the cache. With no circuit breaker, callers wait for timeouts." },
    { id: "slowPayments", key: "P", kind: "chaos", label: "Slow Razorpay", caption: "Razorpay at 900 ms · payment threads pile up · watch the gateway", explain: "A slow external dependency. Payments hold gateway threads while they wait; without a breaker the whole gateway starves." },
    { id: "spike", key: "S", kind: "chaos", label: "Traffic spike ×8", caption: "8× arrivals for 8 s · queues form · autoscaler lags", explain: "A burst of traffic. Shows how far the system is from its knee and how slowly capacity follows demand." },
    { id: "retryStorm", key: "R", kind: "chaos", label: "Retry storm", caption: "retries on, no jitter, no budget · synchronized retries amplify the load", explain: "Turns on naive retries. Every timeout becomes three synchronized requests." },
    { id: "dropIndex", key: "I", kind: "chaos", label: "Drop the index", caption: "sequential scans · Postgres service time ×3", explain: "Removes the index the hot query relies on. Zoom into Postgres to watch the scan." },
    { id: "singapore", key: "G", kind: "chaos", label: "RTDB → Singapore", caption: "+70 ms cross-region on every ride read", explain: "The real 2025 bug: a Singapore-hosted Firebase RTDB serving India traffic." },
    { id: "breaker", key: "B", kind: "fix", toggle: "breaker", label: "Circuit breaker", caption: "breaker armed · failing dependencies now fail fast", explain: "Opens after 50 % failures in a window, fails fast for 5 s, then probes. Frees the threads a slow dependency was holding." },
    { id: "jitter", key: "J", kind: "fix", toggle: "jitter", label: "Retries + jitter", caption: "retry budget + exponential backoff with jitter", explain: "Retries stay, but spread out and capped, so they cannot become a storm." },
    { id: "scaleOut", key: "+", kind: "fix", label: "Scale out", caption: "+1 ride replica · +1 worker", explain: "Adds capacity by hand. Costs money every hour; the rail shows it." },
    { id: "addIndex", key: "X", kind: "fix", toggle: "index", label: "Add index", caption: "index in place · seeks instead of scans", explain: "Restores the index. Postgres service time returns to normal." },
    { id: "moveRtdb", key: "M", kind: "fix", toggle: "rtdbMumbai", label: "RTDB → Mumbai", caption: "RTDB in asia-south1 · cross-region latency gone", explain: "The fix that shipped: move the database next to the users." },
    { id: "tokens", key: "T", kind: "fix", toggle: "tokens", label: "Session tokens", caption: "Places session tokens + debounced Distance Matrix · ₹200 → ₹3 per ride", explain: "Bills one session instead of every keystroke and pin drag." },
    { id: "warmCache", key: "W", kind: "fix", label: "Warm cache", caption: "cache warmed · hit rate climbs", explain: "Pre-loads the hot keys so the next reads hit DStarDB instead of Postgres." },
    { id: "heal", key: "H", kind: "fix", label: "Heal all", caption: "all systems restored", explain: "Resets every fault and returns the model to its baseline." },
];

export const ACTION_BY_ID: Record<string, ActionDef> = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

/** The requests you can follow through the model, one at a time, in slow motion. */
export interface TraceKind { id: string; label: string; sub: string; type: "ride" | "product" | "checkout" | "ws" | "job" | "cron"; verb: string; cold?: boolean }
export const TRACE_KINDS: TraceKind[] = [
    { id: "ride", label: "Book a ride", sub: "GET /rides/:id · cache-first read", type: "ride", verb: "GET /rides/:id" },
    { id: "ride-cold", label: "Book a ride · cold cache", sub: "same read, the key is not in DStarDB", type: "ride", verb: "GET /rides/:id", cold: true },
    { id: "product", label: "Open the product page", sub: "GET /products/:id · CQRS read model", type: "product", verb: "GET /products/:id" },
    { id: "checkout", label: "Pay for a ride", sub: "POST /payments · Razorpay, then webhooks", type: "checkout", verb: "POST /payments" },
    { id: "ws", label: "Join a meeting", sub: "WebSocket upgrade → signalling", type: "ws", verb: "GET /ws · upgrade" },
    { id: "job", label: "A payment webhook", sub: "Razorpay → queue → worker → Postgres", type: "job", verb: "POST /webhooks/razorpay" },
];
export const TRACE_KIND_BY_ID: Record<string, TraceKind> = Object.fromEntries(TRACE_KINDS.map((k) => [k.id, k]));

export interface ScenarioStep { label: string; action: string; caption: string }
export type ScenarioMetric = "p99" | "err" | "shed" | "queue" | "cacheHit" | "replicas" | "cost";
export interface Scenario {
    id: string;
    org: string;
    year: string;
    title: string;
    intro: string;
    setup: Partial<{ index: boolean; nplus1: boolean; rtdbMumbai: boolean; breaker: boolean; jitter: boolean; tokens: boolean; cold: boolean }>;
    /** console actions applied after the reset, before the first step */
    pre?: string[];
    /** which live numbers the replay card shows */
    metrics: ScenarioMetric[];
    /** step actions: a console action id, `trace:<kind>`, `focus:<node>` or `wait` */
    steps: ScenarioStep[];
    /** the résumé line this replays; empty for a pattern that is not on the résumé */
    real: string;
}

export const SCENARIOS: Scenario[] = [
    { id: "p99", org: "MyRik", year: "2025", title: "p99 from >1 s to <300 ms",
        intro: "Ride reads were slow. Tracing showed three separate causes stacked on top of each other. Replay the fixes in the order I shipped them.",
        setup: { index: false, nplus1: true, rtdbMumbai: false, cold: true }, metrics: ["p99", "cacheHit", "err"],
        steps: [
            { label: "Trace a ride read", action: "trace:ride-cold", caption: "one traced request in slow motion · most of the time is inside Postgres and the RTDB hop" },
            { label: "Add the missing index", action: "addIndex", caption: "index added · the scan becomes a seek" },
            { label: "Fix the N+1 query", action: "fixNplus1", caption: "one batched query instead of one per row" },
            { label: "Move RTDB to Mumbai", action: "moveRtdb", caption: "cross-region hop removed" },
            { label: "Warm the cache", action: "warmCache", caption: "hot keys served by DStarDB" },
            { label: "Trace the same read again", action: "trace:ride", caption: "same request, three fixes later" },
        ],
        real: "Résumé: cut p99 API latency from >1 s to <300 ms by tracing hot paths with OpenTelemetry, then resolving N+1 queries, missing indexes and cross-region latency from a Singapore-hosted Firebase RTDB serving India traffic." },
    { id: "cascade", org: "Model", year: "", title: "A slow dependency takes the gateway down",
        intro: "The failure mode every synchronous call chain has. One external API gets slow and, with nothing in the way, the whole gateway starves.",
        setup: { breaker: false, jitter: false }, metrics: ["p99", "err", "shed", "queue"],
        steps: [
            { label: "Razorpay slows to 900 ms", action: "slowPayments", caption: "payments hold their threads while they wait" },
            { label: "Watch the gateway starve", action: "focus:gateway", caption: "every thread slot is a payment waiting on Razorpay · unrelated rides queue behind them" },
            { label: "Trace a payment", action: "trace:checkout", caption: "follow one payment into the 700 ms timeout" },
            { label: "Arm the circuit breaker", action: "breaker", caption: "breaker opens · payments fail fast · gateway threads free up" },
            { label: "Add a retry budget with jitter", action: "jitter", caption: "retries spread out · no synchronized storm" },
        ],
        real: "Pattern from the Razorpay payment flow I built at MyRik: order-id persistence, webhook-driven reconciliation and a cron fallback, so no transaction is ever left orphaned." },
    { id: "maps", org: "MyRik", year: "2025", title: "Maps API cost ₹200 → ₹3 per ride",
        intro: "Every keystroke in the address box and every pin drag was a billed call. The fix was mostly restraint.",
        setup: { tokens: false }, metrics: ["cost", "p99"],
        steps: [
            { label: "Look at cost per ride", action: "focus:maps", caption: "12 billed calls per ride · ₹200" },
            { label: "Enable Places session tokens", action: "tokens", caption: "one session per search instead of one call per keystroke" },
            { label: "Debounce Distance Matrix", action: "debounce", caption: "no recomputation on every pin ping · unused billed fields dropped" },
        ],
        real: "Résumé: reduced Google Maps API cost from ₹200 to ₹3 per ride by adding Places session tokens, debouncing Distance Matrix calls during pin selection, eliminating per-ping route recomputation and dropping unused billed fields." },
    { id: "storm", org: "Model", year: "", title: "A retry storm turns a blip into an outage",
        intro: "Naive retries feel safe. Under load they turn every timeout into three synchronized requests and finish the job the blip started.",
        setup: { breaker: false, jitter: false }, pre: ["retryStorm"], metrics: ["err", "shed", "queue", "p99"],
        steps: [
            { label: "Spike the traffic ×8", action: "spike", caption: "queues form at the gateway · the first timeouts appear" },
            { label: "Watch the retries", action: "focus:gateway", caption: "every timeout becomes three retries at once · the pink packets" },
            { label: "Retry budget + jitter", action: "jitter", caption: "retries spread out and capped · the storm dissipates" },
            { label: "Arm the breaker", action: "breaker", caption: "failing calls fail fast instead of holding threads" },
        ],
        real: "" },
    { id: "herd", org: "Model", year: "", title: "Cache partition → thundering herd on Postgres",
        intro: "The cache absorbs most reads. Lose it and every one of those reads lands on the database at once, each after a 300 ms timeout.",
        setup: { breaker: false }, metrics: ["cacheHit", "p99", "err", "queue"],
        steps: [
            { label: "Partition the cache", action: "partitionCache", caption: "every read misses · callers wait for the 300 ms timeout first" },
            { label: "Trace a read", action: "trace:ride", caption: "watch the request wait on DStarDB, then fall back to Postgres" },
            { label: "Watch Postgres", action: "focus:pg", caption: "pool of 40 saturates · reads queue behind each other" },
            { label: "Arm the breaker", action: "breaker", caption: "the cache fails fast · no 300 ms wait before the fallback" },
            { label: "Warm the cache", action: "warmCache", caption: "partition healed, hot keys reloaded · hit rate climbs" },
        ],
        real: "" },
    { id: "backlog", org: "JioHotstar", year: "2024", title: "A consumer dies, the backlog grows, capacity follows",
        intro: "A pull-based queue only heals itself if something watches the backlog. Kill a worker and watch the autoscaler notice.",
        setup: {}, metrics: ["queue", "replicas", "err"],
        steps: [
            { label: "Kill a worker", action: "killWorker", caption: "one replica left · jobs pile up in the four partitions" },
            { label: "Watch the backlog", action: "focus:queue", caption: "the queue absorbs the burst · nothing is lost, only late" },
            { label: "Trace a job through", action: "trace:job", caption: "a webhook job waits in its partition until a worker thread pulls it" },
            { label: "Let the autoscaler catch up", action: "wait", caption: "util above 75 % for 2.5 s → +1 replica after a 3 s provision" },
        ],
        real: "Résumé: migrated event ingestion from Kafka to GCP Pub/Sub with pull-based consumption, handling 5M+ content-quality events a day at 99.9 % reliability." },
    { id: "failover", org: "Model", year: "", title: "The primary dies · reads survive, writes wait 4.2 s",
        intro: "What a streaming replica buys you: reads keep flowing while promotion runs, and the writes that failed are the ones to reconcile afterwards.",
        setup: {}, metrics: ["err", "p99", "shed"],
        steps: [
            { label: "Kill the primary", action: "killDb", caption: "writes fail · reads move to the streaming replica" },
            { label: "Trace a read", action: "trace:ride-cold", caption: "the cold read lands on the replica instead of the primary" },
            { label: "Watch the promotion", action: "focus:pg", caption: "replica promoted to primary in 4.2 s · writes resume" },
        ],
        real: "" },
];

export interface Role { when: string; org: string; title: string; where: string; bullets: string[] }
export const ROLES: Role[] = [
    { when: "2025 →", org: "MyRik", title: "Software Engineer", where: "Bengaluru", bullets: [
        "Zero-downtime GCP → AWS migration with a hybrid VPC-tunnel phase; observability re-platformed to self-hosted Grafana / Loki / Tempo.",
        "p99 from >1 s to <300 ms (OpenTelemetry, N+1, indexes, cross-region RTDB).",
        "CQRS, event-driven product service for 150K+ MAU; Razorpay flow with webhook reconciliation.",
        "Runs the backend interview loop: rubric, debugging exercises, 4 interviews a week." ] },
    { when: "2025", org: "CarWale · CarTrade Tech", title: "Associate Software Engineer", where: "Navi Mumbai", bullets: [
        "Desktop Short Videos and AI chat support for 1M+ monthly users: +15 % engagement, 50 % faster query resolution.",
        "20 % fewer Kubernetes pods, 25 % lower infra cost; legacy frontend to 70 % coverage, 40 % fewer defects." ] },
    { when: "2024", org: "JioHotstar", title: "Software Engineering Intern", where: "Bengaluru", bullets: [
        "Kafka → GCP Pub/Sub with pull-based consumption: 5M+ content-quality events a day at 99.9 %; Go APIs for 10,000+ jobs a day." ] },
    { when: "2024", org: "MyRik", title: "Product Engineering Intern", where: "Remote", bullets: [] },
    { when: "2023", org: "AllUsedCars · Benam", title: "SDE Intern", where: "Remote", bullets: [] },
    { when: "2022", org: "Mitra Fintech", title: "Android Development Intern", where: "Remote", bullets: [] },
];

export interface Project { id: string; node: string; title: string; sub: string; text: string; cta: string; link: string }
export const PROJECTS: Project[] = [
    { id: "dstardb", node: "cache", title: "DStarDB", sub: "Redis-compatible in-memory store · C++20", text: "Reactor event loop plus a worker pool with reader-writer concurrency. 40+ commands, MULTI/EXEC/WATCH, snapshot and AOF persistence. YCSB: 13 % more throughput and 50 % lower latency than Redis under concurrent reads. In this model it is the cache node: zoom in and type commands against the live keys.", cta: "Open the live cache", link: "https://github.com/dhruv1206/DStar-DB" },
    { id: "rooms", node: "signal", title: "Real-time rooms", sub: "Spring Boot · STOMP over WebSocket · WebRTC", text: "Seven services, one capability each. Signalling carries SDP and ICE over one topic per room; media goes peer to peer and never touches the servers. The case study opens a real RTCPeerConnection.", cta: "Focus signalling", link: "/projects/realtime-collaboration" },
    { id: "pipeline", node: "workers", title: "Press-release pipeline", sub: "Flask · GPT · 10 languages · MoviePy", text: "PIB press releases in, narrated multilingual videos out: scrape, summarise, translate, speak, compose, publish. Cut production time by 45 %. It runs as a batch job on the workers here.", cta: "Focus workers", link: "/projects/ai-press-release-generator" },
    { id: "cctv", node: "workers", title: "Warehouse CCTV anomaly detection", sub: "MyRik · 35 cameras · 8 warehouses", text: "A self-contained monitoring service that flags tampering, repositioning, blur and disconnection, plus per-zone person counting for live occupancy.", cta: "Focus workers", link: "" },
];

export interface StackLayer { layer: string; tools: string[]; nodes: string[] }
export const STACK: StackLayer[] = [
    { layer: "Transport", tools: ["WebSockets", "WebRTC", "GraphQL", "REST", "STOMP"], nodes: ["signal", "gateway", "edge"] },
    { layer: "Runtime", tools: ["Spring Boot", "Node.js", "Go", "Flask", "Next.js", "React", "Flutter"], nodes: ["gateway", "auth", "ride", "product", "payments", "readmodel", "workers"] },
    { layer: "Data", tools: ["PostgreSQL", "Redis · DStarDB", "MongoDB", "MySQL", "Elasticsearch", "Kafka", "Pub/Sub"], nodes: ["pg", "pgr", "cache", "bus", "queue"] },
    { layer: "Infra", tools: ["AWS", "GCP", "Kubernetes", "Docker", "Terraform", "Nginx", "Firebase", "CI/CD"], nodes: ["edge", "autoscaler", "storage", "config", "discovery"] },
    { layer: "Observability", tools: ["OpenTelemetry", "Grafana", "Loki", "Tempo", "TDD"], nodes: ["otel", "grafana"] },
    { layer: "Languages", tools: ["C++", "Java", "Go", "Python", "TypeScript", "Kotlin", "SQL"], nodes: ["cache", "gateway", "ride", "workers"] },
];

export const ABOUT = {
    name: "Dhruv Agrawal",
    role: "Software Engineer · MyRik · Bengaluru",
    lines: [
        "Backend engineer. The platforms I run serve 150,000 people a month; their latency, cost and uptime are my job.",
        "Before MyRik: CarWale (CarTrade Tech) and JioHotstar. B.Tech in Computer Science, LNCT Bhopal, 8.23 CGPA. 800+ DSA problems, LeetCode Knight 1870+.",
    ],
    stats: [
        ["150K+", "monthly active users", "MyRik · CQRS product service"],
        [">1 s → <300 ms", "p99 latency", "traced with OpenTelemetry"],
        ["₹200 → ₹3", "Maps API cost per ride", "session tokens · debounce"],
        ["1M+", "monthly users reached", "CarWale · Short Videos"],
        ["5M / day", "events at 99.9 %", "JioHotstar · Kafka → Pub/Sub"],
        ["6.5K+", "app downloads · 4.4 ★", "college attendance app"],
    ] as [string, string, string][],
    email: "agrawaldhruv1006@gmail.com",
    links: [
        ["GitHub", "https://github.com/dhruv1206"],
        ["LinkedIn", "https://www.linkedin.com/in/dhruvagrawal1206/"],
        ["LeetCode", "https://leetcode.com/u/TrickyGuy/"],
        ["X", "https://x.com/dhruv_1206"],
        ["Résumé (PDF)", "https://drive.google.com/file/d/1n6uXQ-9NOMCxO2RZi03-F0Sl4x32bREw/view"],
    ] as [string, string][],
};

const TZ_CITY: Record<string, string> = { "Asia/Kolkata": "India", "Asia/Calcutta": "India", "Asia/Singapore": "Singapore", "Europe/London": "London", "Europe/Berlin": "Berlin", "Europe/Paris": "Paris", "America/New_York": "New York", "America/Los_Angeles": "San Francisco", "America/Chicago": "Chicago", "Asia/Dubai": "Dubai", "Asia/Tokyo": "Tokyo", "Australia/Sydney": "Sydney", "Asia/Shanghai": "Shanghai", "Europe/Amsterdam": "Amsterdam", "America/Toronto": "Toronto", "Asia/Karachi": "Karachi", "Asia/Dhaka": "Dhaka" };
export function cityOf(tz: string | undefined): string {
    if (!tz) return "somewhere";
    if (TZ_CITY[tz]) return TZ_CITY[tz];
    const p = tz.split("/").pop();
    return p ? p.replace(/_/g, " ") : "somewhere";
}

export interface Ghost { city: string; ago: string; path: [number, number][] }
export const GHOSTS: Ghost[] = [
    { city: "Berlin", ago: "2 h ago", path: [[500, 400], [740, 270], [1240, 270], [1240, 540], [990, 540]] },
    { city: "San Francisco", ago: "yesterday", path: [[1240, 690], [990, 690], [740, 540], [500, 400], [300, 400]] },
    { city: "Singapore", ago: "3 d ago", path: [[990, 150], [740, 260], [500, 260], [500, 160], [990, 160]] },
];

export const EXAMPLE_RECORDS = [
    { metric: "Highest load survived", value: "440 rps", who: "example · Berlin" },
    { metric: "Longest outage caused", value: "19.4 s", who: "example · San Francisco" },
    { metric: "Fastest recovery", value: "6.1 s", who: "example · Singapore" },
];
