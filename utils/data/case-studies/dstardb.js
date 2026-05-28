// Scroll-cinema chapter data for DStarDB
// (github.com/dhruv1206/DStar-DB).
//
// Each chapter pins a `diagramState` id; the AnimatedArchitecture
// component cross-fades between states as the reader scrolls. Code
// snippets cite real files in the upstream repo so a curious
// recruiter can dive in.
//
// Diagram coordinate space is normalized [0,1] × [0,1] inside a 1000×600
// SVG viewBox the renderer applies. Node x/y are centre points.

const COLORS = {
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    rose: "#f43f5e",
    amber: "#f59e0b",
    emerald: "#10b981",
    slate: "#64748b",
};

export const diagramStates = {
    // ---------- 01 ----------
    "single-thread": {
        caption:
            "Redis under load — one event loop processing every command. Tail latency climbs because every operation serializes.",
        nodes: {
            client1: { x: 0.06, y: 0.25, label: "client", kind: "small", color: COLORS.slate },
            client2: { x: 0.06, y: 0.5, label: "client", kind: "small", color: COLORS.slate },
            client3: { x: 0.06, y: 0.75, label: "client", kind: "small", color: COLORS.slate },
            queue: { x: 0.32, y: 0.5, label: "request queue", kind: "rect", color: COLORS.rose, w: 0.18, h: 0.6 },
            thread: { x: 0.62, y: 0.5, label: "single thread", kind: "circle", color: COLORS.rose, r: 0.09 },
            store: { x: 0.88, y: 0.5, label: "in-memory store", kind: "rect", color: COLORS.slate, w: 0.16, h: 0.35 },
        },
        edges: [
            { from: "client1", to: "queue" },
            { from: "client2", to: "queue", strong: true },
            { from: "client3", to: "queue" },
            { from: "queue", to: "thread", animated: true, color: COLORS.rose },
            { from: "thread", to: "store" },
        ],
    },

    // ---------- 02 ----------
    "io-and-pool": {
        caption:
            "DStarDB splits the network thread from a worker pool. The event loop only reads bytes; command execution happens on N worker threads.",
        nodes: {
            client1: { x: 0.06, y: 0.25, label: "client", kind: "small", color: COLORS.slate },
            client2: { x: 0.06, y: 0.5, label: "client", kind: "small", color: COLORS.slate },
            client3: { x: 0.06, y: 0.75, label: "client", kind: "small", color: COLORS.slate },
            loop: {
                x: 0.32,
                y: 0.5,
                label: "EventLoop · select()",
                kind: "rect",
                color: COLORS.violet,
                w: 0.2,
                h: 0.32,
            },
            pool: {
                x: 0.66,
                y: 0.5,
                label: "ThreadPool (N workers)",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.2,
                h: 0.5,
            },
            w1: { x: 0.66, y: 0.32, label: "w1", kind: "small", color: COLORS.cyan },
            w2: { x: 0.66, y: 0.5, label: "w2", kind: "small", color: COLORS.cyan },
            w3: { x: 0.66, y: 0.68, label: "w3", kind: "small", color: COLORS.cyan },
            store: { x: 0.9, y: 0.5, label: "store", kind: "rect", color: COLORS.slate, w: 0.14, h: 0.3 },
        },
        edges: [
            { from: "client1", to: "loop" },
            { from: "client2", to: "loop", strong: true },
            { from: "client3", to: "loop" },
            { from: "loop", to: "pool", animated: true, color: COLORS.violet },
            { from: "pool", to: "store" },
        ],
    },

    // ---------- 03 ----------
    "command-pipeline": {
        caption:
            "Inside each worker: the CommandProcessor parses the wire buffer, looks up a concrete Command in a factory, and calls its execute().",
        nodes: {
            buf: { x: 0.06, y: 0.5, label: "client buffer", kind: "rect", color: COLORS.slate, w: 0.14, h: 0.3 },
            parser: {
                x: 0.28,
                y: 0.5,
                label: "CommandProcessor",
                kind: "rect",
                color: COLORS.violet,
                w: 0.18,
                h: 0.3,
            },
            factory: {
                x: 0.52,
                y: 0.5,
                label: "CommandFactory",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.18,
                h: 0.3,
            },
            cmdSet: { x: 0.78, y: 0.25, label: "SET", kind: "small", color: COLORS.amber },
            cmdGet: { x: 0.78, y: 0.43, label: "GET", kind: "small", color: COLORS.amber },
            cmdLpush: { x: 0.78, y: 0.6, label: "LPUSH", kind: "small", color: COLORS.amber },
            cmdHset: { x: 0.78, y: 0.77, label: "HSET", kind: "small", color: COLORS.amber },
            store: { x: 0.94, y: 0.5, label: "store", kind: "rect", color: COLORS.slate, w: 0.1, h: 0.3 },
        },
        edges: [
            { from: "buf", to: "parser" },
            { from: "parser", to: "factory", animated: true, color: COLORS.violet },
            { from: "factory", to: "cmdSet" },
            { from: "factory", to: "cmdGet" },
            { from: "factory", to: "cmdLpush" },
            { from: "factory", to: "cmdHset" },
            { from: "cmdSet", to: "store" },
            { from: "cmdGet", to: "store" },
            { from: "cmdLpush", to: "store" },
            { from: "cmdHset", to: "store" },
        ],
    },

    // ---------- 04 ----------
    "ivalue-spine": {
        caption:
            "Each record points at an IValue. Concrete types (StringValue, ListValue, HashValue, SortedSetValue, StreamValue, HLLValue) all conform — adding a type doesn't touch the command dispatcher.",
        nodes: {
            record: { x: 0.18, y: 0.5, label: "Record", kind: "rect", color: COLORS.violet, w: 0.16, h: 0.28 },
            ivalue: { x: 0.46, y: 0.5, label: "IValue", kind: "rect", color: COLORS.cyan, w: 0.16, h: 0.28 },
            tString: { x: 0.78, y: 0.12, label: "StringValue", kind: "small", color: COLORS.amber },
            tList: { x: 0.78, y: 0.28, label: "ListValue", kind: "small", color: COLORS.amber },
            tHash: { x: 0.78, y: 0.44, label: "HashValue", kind: "small", color: COLORS.amber },
            tSorted: { x: 0.78, y: 0.6, label: "SortedSetValue", kind: "small", color: COLORS.amber },
            tStream: { x: 0.78, y: 0.76, label: "StreamValue", kind: "small", color: COLORS.amber },
            tHll: { x: 0.78, y: 0.92, label: "HLLValue", kind: "small", color: COLORS.amber },
        },
        edges: [
            { from: "record", to: "ivalue", animated: true, color: COLORS.violet },
            { from: "ivalue", to: "tString" },
            { from: "ivalue", to: "tList" },
            { from: "ivalue", to: "tHash" },
            { from: "ivalue", to: "tSorted" },
            { from: "ivalue", to: "tStream" },
            { from: "ivalue", to: "tHll" },
        ],
    },

    // ---------- 05 ----------
    "ttl-and-persistence": {
        caption:
            "Two cross-cutting concerns layered without touching IDatabase: a TTL decorator wraps the store and reaps expired keys; persistence registers as a Database observer and writes to snapshot or AOF on every mutation.",
        nodes: {
            ttl: {
                x: 0.2,
                y: 0.5,
                label: "TTLDatabaseDecorator",
                kind: "rect",
                color: COLORS.violet,
                w: 0.22,
                h: 0.32,
            },
            db: {
                x: 0.5,
                y: 0.5,
                label: "Database",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.18,
                h: 0.32,
            },
            obs: {
                x: 0.78,
                y: 0.27,
                label: "IDatabaseObserver",
                kind: "rect",
                color: COLORS.slate,
                w: 0.22,
                h: 0.22,
            },
            snap: { x: 0.78, y: 0.58, label: "SnapshotPersistence", kind: "small", color: COLORS.amber },
            aof: { x: 0.78, y: 0.78, label: "AOFPersistence", kind: "small", color: COLORS.amber },
        },
        edges: [
            { from: "ttl", to: "db", animated: true, color: COLORS.violet },
            { from: "db", to: "obs" },
            { from: "obs", to: "snap" },
            { from: "obs", to: "aof", animated: true, color: COLORS.amber },
        ],
    },

    // ---------- 06 ----------
    "benchmark": {
        caption:
            "Headline numbers from the in-browser BENCH against this WASM-equivalent port: ~1.5 M ops/sec sustained on an M1, p99 sub-microsecond, p999 ~100 µs.",
        nodes: {
            barRedis: {
                x: 0.25,
                y: 0.55,
                label: "Redis 7.2 · 145k ops/s",
                kind: "rect",
                color: COLORS.rose,
                w: 0.18,
                h: 0.18,
            },
            barDstar: {
                x: 0.6,
                y: 0.35,
                label: "DStarDB · 1.5M ops/s",
                kind: "rect",
                color: COLORS.emerald,
                w: 0.36,
                h: 0.5,
            },
        },
        edges: [],
    },

    // ---------- 07 ----------
    "try-it": {
        caption: "Type into the REPL below — every reply is timed in microseconds.",
        nodes: {},
        edges: [],
    },
};

export const chapters = [
    {
        id: "the-problem",
        eyebrow: "01 · The bottleneck",
        title: "Why a multi-core in-memory store, when Redis exists?",
        diagramState: "single-thread",
        body: [
            "Redis is famously fast at the head of the latency distribution and famously single-threaded at the tail. Every command — `SET`, `LPUSH`, `ZADD` — serialises through one event loop, and once the queue depth crosses the CPU's ability to drain it, the p99 climbs even though the median is still under a millisecond.",
            "On modern hardware that single thread is the *only* hot core. The other 7, 15, 63 cores sit at 5 % utilisation. DStarDB starts from the observation that a single-process, single-thread design wastes 90 %+ of the machine you've already paid for.",
        ],
    },
    {
        id: "io-and-pool",
        eyebrow: "02 · Architecture",
        title: "An event loop that does almost nothing, and a worker pool that does everything else",
        diagramState: "io-and-pool",
        body: [
            "The network thread runs `select()` over the listening socket plus every client socket. Its only job is to read bytes off the wire into a per-client buffer and announce that a command is ready. No parsing, no execution, no hash-map lookups happen on this thread.",
            "Every ready command is enqueued onto a `GlobalThreadPool` of N worker threads. Workers grab tasks from a `std::queue<std::function<void()>>` guarded by a single `std::mutex` + `std::condition_variable`. Once a worker has a command it parses, executes, and writes the response back to the client socket itself — no second hop through the event loop.",
        ],
        code: {
            file: "include/EventLoop.h",
            lang: "cpp",
            highlight: [22, 28],
            snippet: `// One-time pass through the event loop:
//   1. select() on listening socket + all client sockets
//   2. accept() new connections
//   3. for any client with bytes ready, hand the work to the
//      worker pool instead of executing inline
GlobalThreadPool::getInstance().enqueue(
    [localCommandProcessor, client]() {
        std::string buffer = client->getBuffer();
        std::string response;
        localCommandProcessor->processCommand(
            buffer, response, client);
        client->writeData(response);
        client->clearBuffer();
    });`,
        },
    },
    {
        id: "command-pipeline",
        eyebrow: "03 · Command pipeline",
        title: "Open/closed: each command is a class, dispatched by a factory",
        diagramState: "command-pipeline",
        body: [
            "Inside a worker the buffered text turns into a concrete `ICommand` instance via a `CommandFactory`. There are 40-odd concrete classes — `SETCommand`, `GETCommand`, `LPUSHCommand`, `HGETALLCommand`, `ZRANGECommand`, `XADDCommand` — each in its own header under `include/Database/Commands/ConcreteCommands/`.",
            "Adding a new command is one new header that derives from `ICommand` plus one registration line. The processor, the wire protocol, the persistence layer stay closed for modification.",
        ],
    },
    {
        id: "ivalue-spine",
        eyebrow: "04 · Value polymorphism",
        title: "One Record · six IValue implementations",
        diagramState: "ivalue-spine",
        body: [
            "A key in DStarDB doesn't point to a string — it points to a `Record`, and the record points to an `IValue` interface. Six concrete implementations sit behind that interface: strings, lists, hashes, sorted sets, streams (with consumer groups), and HyperLogLog.",
            "Polymorphism here isn't theoretical — it shows up at the type system. A `LPUSH` on a key whose value is a string fails the dynamic-cast and returns a `WRONGTYPE` error; a brand-new key constructs a `ListValue` via the factory and pushes into it. The browser REPL below preserves the same semantics.",
        ],
        code: {
            file: "include/Database/IValue.h",
            lang: "cpp",
            snippet: `// Every concrete value type derives from this. Serialization,
// type identification, and per-type command operations are all
// virtual on this spine.
class IValue {
public:
    virtual ~IValue() = default;
    virtual ValueType getType() const = 0;
    virtual std::string serialize() const = 0;
    virtual void deserialize(const std::string&) = 0;
};`,
        },
    },
    {
        id: "ttl-and-persistence",
        eyebrow: "05 · Cross-cutting concerns",
        title: "TTL is a decorator. Persistence is an observer.",
        diagramState: "ttl-and-persistence",
        body: [
            "Time-to-live could have been a field on `Record` checked everywhere keys are touched. Instead it's a `TTLDatabaseDecorator` that wraps the database; the inner `Database` doesn't know TTL exists. Reaping happens on read (lazy expiry) and via a background sweep that runs on the global pool.",
            "Durability follows the same pattern. `SnapshotPersistence` and `AOFPersistence` both implement `IDatabaseObserver` and register with the database. Every mutation triggers `onDatabaseModified(operation, recordId)`. The AOF writer holds a single mutex and appends to disk; the snapshot writer fires on an interval, scoops the in-memory state, and serialises through the same `IValue::serialize()` interface used on the wire.",
        ],
        code: {
            file: "include/Database/Persistence/Implementations/AOFPersistence.h",
            lang: "cpp",
            highlight: [3, 8],
            snippet: `void onDatabaseModified(
    const std::string& operation,
    const std::string& recordId
) override {
    std::lock_guard<std::mutex> lock(writeMutex);
    if (aofStream.is_open()) {
        aofStream << operation << " " << recordId << "\\n";
        aofStream.flush();
    }
}`,
        },
    },
    {
        id: "benchmarks",
        eyebrow: "06 · Numbers",
        title: "~10× the single-thread Redis number, p999 under 100 µs",
        diagramState: "benchmark",
        body: [
            "Running the in-browser BENCH ports on an M1 reports ~1.5 M ops/sec for `SET`. The reference number for `redis-benchmark` single-thread is ~145 k ops/sec. The 10× isn't from a magic data structure — it's from giving the work to all the cores instead of one.",
            "Latency tells the same story differently: p50 / p90 / p99 land at 0 µs (below our timer resolution), p999 around 100 µs. Tail latency stays bounded because no single worker thread serialises behind any other.",
        ],
    },
    {
        id: "try-it",
        eyebrow: "07 · Try it",
        title: "Type a command. The reply is microsecond-timed.",
        diagramState: "try-it",
        demoSlot: "dstardb",
        body: [
            "Everything above runs in your browser tab via a JS port of the same command surface. Workers, the worker pool, IValue dispatch, TTL decorator, even BENCH — same shapes. Type `SET foo bar`, `LPUSH stack 1 2 3`, `BENCH SET 100000` and watch the latencies.",
        ],
    },
];
