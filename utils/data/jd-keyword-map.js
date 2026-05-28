// Curated JD-keyword → project / experience / skill mapping for the
// Recruiter Mode role-fitter at /r. When a recruiter pastes a job
// description, the role-fitter:
//
//   1. Tokenises the JD and looks each token (+ a few multi-word
//      phrases) up against the keys below.
//   2. Collects the matched `items` (deduped).
//   3. Renders a tailored "Why I fit" panel grouping items by kind
//      (project / experience / skill / note), with the reason
//      strings pulled straight from this file.
//
// Every reason here is a phrase Dhruv can defend in an interview —
// no marketing fluff. Keywords are stored lowercase + multi-word
// aliases under the same item; lookup is case-insensitive substring
// after both sides are lowercased.

// Each `item` has:
//   kind:   "project" | "experience" | "skill" | "note"
//   id:     the matching record (project slug, experience company,
//           skill name) — used to deep-link and to dedupe.
//   reason: 1-line concrete reason this item is relevant.

const ITEM = (kind, id, reason) => ({ kind, id, reason });

export const jdKeywordMap = {
    // ---------- Languages ----------
    java: [
        ITEM(
            "project",
            "realtime-collaboration",
            "7 Spring Boot microservices in Java — Gateway, Eureka, Config, MeetingSignaling, User, Product, Frontend.",
        ),
        ITEM(
            "experience",
            "carwale",
            "Java backend at CarWale (150k+ MAU).",
        ),
    ],
    "spring boot": [
        ITEM(
            "project",
            "realtime-collaboration",
            "Built the 7-service Spring Boot meeting platform; Eureka service discovery + Spring Cloud Gateway routing.",
        ),
        ITEM("skill", "SpringBoot", "Production-deployed in 2 prior roles."),
    ],
    "spring cloud": [
        ITEM(
            "project",
            "realtime-collaboration",
            "Spring Cloud Gateway predicate routes + Spring Cloud Config + Eureka discovery.",
        ),
    ],
    kotlin: [
        ITEM("skill", "Kotlin", "Android development at Mitra Fintech."),
        ITEM("experience", "mitra", "Android dev intern."),
    ],
    python: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Flask + Selenium + MoviePy + gTTS pipeline that ships videos in 10 Indian languages.",
        ),
        ITEM("skill", "Python"),
    ],
    flask: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Flask backend exposing the press-release ingestion + video generation API.",
        ),
    ],
    "c++": [
        ITEM(
            "project",
            "dstardb",
            "Multithreaded in-memory database in modern C++ — std::thread, std::mutex, condition variables, event loop on select().",
        ),
    ],
    node: [
        ITEM(
            "project",
            "college-attendance-app",
            "Node.js backend deployed on DigitalOcean, 3.5k+ Play Store downloads in 2-3 months.",
        ),
    ],
    "node.js": [
        ITEM(
            "project",
            "college-attendance-app",
            "Node.js backend on DigitalOcean.",
        ),
    ],
    typescript: [
        ITEM(
            "note",
            "ts-portfolio",
            "This site is Next 16 + React 19 + TypeScript with WebGPU compute, scrollytelling case studies, and 6 Playwright suites.",
        ),
        ITEM("skill", "TypeScript"),
    ],
    go: [ITEM("skill", "Go", "Used in side projects; production-ready.")],

    // ---------- Frameworks / runtime ----------
    react: [
        ITEM(
            "note",
            "ts-portfolio",
            "React 19 portfolio with Suspense + Cache Components + custom WebGPU hero.",
        ),
        ITEM("skill", "React"),
    ],
    "next.js": [
        ITEM(
            "note",
            "ts-portfolio",
            "Next 16 with Partial Prerender, View Transitions, Turbopack.",
        ),
        ITEM("skill", "Next JS"),
    ],
    nextjs: [
        ITEM(
            "note",
            "ts-portfolio",
            "Next 16 with Partial Prerender, View Transitions, Turbopack.",
        ),
    ],
    nodejs: [ITEM("skill", "Node")],
    flutter: [
        ITEM("project", "college-attendance-app"),
        ITEM("project", "amazon-clone"),
        ITEM("project", "whatsapp-clone"),
        ITEM("skill", "Flutter"),
    ],
    android: [
        ITEM("experience", "mitra", "Android dev intern (Kotlin)."),
        ITEM("project", "college-attendance-app", "Flutter Android app, 3.5k+ downloads."),
    ],

    // ---------- Databases ----------
    redis: [
        ITEM(
            "project",
            "dstardb",
            "DStarDB *is* a Redis-style command set — strings, hashes, lists, sorted sets, streams with consumer groups. Beats redis-benchmark single-thread by ~10× on M1.",
        ),
        ITEM("skill", "Redis"),
    ],
    postgresql: [ITEM("skill", "PostgreSQL")],
    postgres: [ITEM("skill", "PostgreSQL")],
    mysql: [ITEM("skill", "MySQL")],
    mongodb: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Mongo persists every scraped PIB release + the LLM-summarised DescriptiveContent.",
        ),
        ITEM("skill", "MongoDB"),
    ],
    mongo: [ITEM("skill", "MongoDB")],
    elasticsearch: [ITEM("skill", "ElasticSearch")],

    // ---------- Real-time / streaming ----------
    webrtc: [
        ITEM(
            "project",
            "realtime-collaboration",
            "Real RTCPeerConnection negotiation; signaling broker pairs peers, media is P2P.",
        ),
        ITEM("skill", "WebRTC"),
    ],
    websocket: [
        ITEM(
            "project",
            "realtime-collaboration",
            "STOMP-over-WebSocket signaling with 6 message types (CHAT, MIC, VIDEO, HAND_RAISE, JOIN, LEAVE).",
        ),
        ITEM("skill", "WebSockets"),
    ],
    stomp: [
        ITEM(
            "project",
            "realtime-collaboration",
            "STOMP broker fan-out into /topic/room/{roomId}.",
        ),
    ],
    signaling: [
        ITEM(
            "project",
            "realtime-collaboration",
            "Built the custom signaling service that pairs peers + carries SDP/ICE.",
        ),
    ],
    "pub/sub": [
        ITEM("skill", "Pub/Sub", "Pub/sub patterns shipped in 2 prior roles."),
    ],
    kafka: [
        ITEM(
            "experience",
            "carwale",
            "Event-driven workflows on Kafka; cut P99 latency 1s → 300ms.",
        ),
    ],

    // ---------- Cloud & infra ----------
    aws: [
        ITEM("experience", "carwale", "EC2 / S3 / SQS / Lambda in production."),
        ITEM("skill", "AWS"),
    ],
    gcp: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Firebase Storage on GCP for final MP4 + 10-language MP3 distribution.",
        ),
        ITEM("skill", "GCP"),
    ],
    firebase: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Firebase Storage + FCM push notifications.",
        ),
        ITEM(
            "project",
            "college-attendance-app",
            "Firebase auth + analytics + WorkManager-driven notifications.",
        ),
        ITEM("skill", "Firebase"),
    ],
    docker: [
        ITEM(
            "experience",
            "myrik",
            "Container-deployed services at MyRik.",
        ),
        ITEM("skill", "Docker"),
    ],
    kubernetes: [
        ITEM("experience", "carwale", "Pod-based deployments + horizontal scaling."),
        ITEM("skill", "Kubernetes"),
    ],
    k8s: [
        ITEM("experience", "carwale", "Pod-based deployments + horizontal scaling."),
    ],
    terraform: [ITEM("skill", "Terraform")],
    nginx: [ITEM("skill", "Nginx")],
    "ci/cd": [ITEM("note", "ci", "Lighthouse CI + bundle-budget CI on this portfolio.")],

    // ---------- Architecture ----------
    microservices: [
        ITEM(
            "project",
            "realtime-collaboration",
            "7-service Spring Cloud architecture with Gateway, Discovery, Config, and per-capability services.",
        ),
        ITEM("skill", "Microservices"),
    ],
    "event-driven": [
        ITEM(
            "project",
            "dstardb",
            "EventLoop + ThreadPool + Observer-pattern persistence (Snapshot + AOF).",
        ),
        ITEM("experience", "carwale", "Event-driven workflows in production."),
    ],
    "system design": [
        ITEM(
            "project",
            "dstardb",
            "Custom thread pool, event loop, IValue polymorphism, TTL decorator, persistence observers — the system-design textbook patterns, in C++.",
        ),
        ITEM(
            "project",
            "realtime-collaboration",
            "7-service architecture with explicit discovery + config + gateway separation.",
        ),
    ],
    rest: [
        ITEM(
            "note",
            "rest-apis",
            "Designed and shipped REST APIs at all 3 prior roles (CarWale, JioHotstar, MyRik).",
        ),
    ],
    api: [
        ITEM(
            "note",
            "rest-apis",
            "API design + versioning + auth in production at CarWale + MyRik.",
        ),
    ],
    grpc: [
        ITEM("note", "grpc", "Familiar from system-design study; not yet shipped to prod."),
    ],

    // ---------- Performance ----------
    "low latency": [
        ITEM(
            "project",
            "dstardb",
            "p50/p90/p99 under timer resolution (sub-µs); p999 < 100µs on M1.",
        ),
        ITEM(
            "experience",
            "carwale",
            "Drove API P99 from ~1s to <300ms across CarWale's catalog stack.",
        ),
    ],
    p99: [
        ITEM(
            "experience",
            "carwale",
            "P99 1s → <300ms reduction is the headline number on this site.",
        ),
    ],
    "high throughput": [
        ITEM(
            "project",
            "dstardb",
            "~1.5M ops/sec for SET in the in-browser port; same shape in the C++ original.",
        ),
    ],
    scalability: [
        ITEM(
            "project",
            "realtime-collaboration",
            "Server-side cost per meeting is just WebSocket fan-out; media goes P2P so bandwidth doesn't scale with meeting count.",
        ),
        ITEM(
            "experience",
            "carwale",
            "150k+ MAU on the systems I owned.",
        ),
    ],
    "150k": [
        ITEM(
            "experience",
            "carwale",
            "150,000+ monthly active users at CarWale.",
        ),
    ],
    mau: [
        ITEM(
            "experience",
            "carwale",
            "150,000+ MAU across the catalog APIs.",
        ),
    ],
    cost: [
        ITEM(
            "experience",
            "carwale",
            "Cut infrastructure spend by 95% via caching + query optimisation.",
        ),
    ],

    // ---------- AI / ML ----------
    llm: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "DescriptiveContentGenerator prompts GPT (and MetaAI) to summarise press releases + extract image-search keywords.",
        ),
    ],
    gpt: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "GPT-driven summarisation step in the press-release pipeline.",
        ),
    ],
    openai: [
        ITEM(
            "project",
            "ai-press-release-generator",
            "OpenAI integration for the summarisation step.",
        ),
    ],
    "prompt engineering": [
        ITEM(
            "project",
            "ai-press-release-generator",
            "Structured-JSON prompts with char-budget constraints for per-slide summary + keywords.",
        ),
    ],
    embeddings: [
        ITEM("note", "ml-study", "Familiar from learning + side reading; not shipped."),
    ],

    // ---------- Frontend ----------
    "view transitions": [
        ITEM("note", "ts-portfolio", "Native View Transitions API used for all route transitions on this site."),
    ],
    webgpu: [
        ITEM("note", "ts-portfolio", "90k-particle hero with WGSL compute shader + OffscreenCanvas worker."),
    ],
    canvas: [
        ITEM("note", "ts-portfolio", "Canvas slide composition in the press-release demo + WebGPU canvas + canvas2D fallback hero."),
    ],

    // ---------- Soft / general ----------
    "open source": [
        ITEM(
            "project",
            "dstardb",
            "DStarDB is public source on GitHub.",
        ),
    ],
    "data structures": [
        ITEM(
            "note",
            "dsa",
            "1000+ DSA problems solved across LeetCode (Knight, 1870+), Codeforces, CodeChef.",
        ),
        ITEM(
            "project",
            "dstardb",
            "IValue polymorphism for strings, lists, hashes, sorted sets, streams, HyperLogLog.",
        ),
    ],
    leetcode: [
        ITEM(
            "note",
            "dsa",
            "LeetCode Knight (1870+), 1000+ problems across competitive platforms.",
        ),
    ],
    "competitive programming": [
        ITEM(
            "note",
            "dsa",
            "LeetCode Knight 1870+, Codeforces + CodeChef active.",
        ),
    ],
};

// Helpful additional non-curated aliases.
export const tokenAliases = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rdbms: "postgresql",
    nosql: "mongodb",
    pubsub: "pub/sub",
    "in-memory": "redis",
    rt: "real-time",
    realtime: "websocket",
    "real-time": "websocket",
    realtimecollaboration: "websocket",
    multiplayer: "websocket",
};

export default jdKeywordMap;
