// Control room simulation: queues, thread pools, timeouts, retries,
// circuit breakers, DB failover, autoscaling, and a cache with real keys.
//
// Clock: model time runs at SCALE × real time (1 real second = 200 model
// ms), so a 24 ms network hop is readable on screen while every latency
// shown stays in honest model milliseconds.

import { NODES, NodeDef } from "./data";

const R = Math.random;
export const SCALE = 0.2;
const S = (realMs: number) => realMs * SCALE;
const lognorm = (mean: number, sigma = 0.35) => {
    const u = 1 - R(), v = R();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(6.2831853 * v);
    return mean * Math.exp(sigma * z - (sigma * sigma) / 2);
};
const zipf = (n: number) => Math.floor(n * Math.pow(R(), 2.2));
const DEP: Record<string, { timeout: number }> = { cache: { timeout: 300 }, razorpay: { timeout: 700 }, maps: { timeout: 400 } };
const MIX: [ReqType, number][] = [["ride", 0.55], ["product", 0.27], ["checkout", 0.1], ["ws", 0.08]];
const HOP = 24, REQ_TIMEOUT = 1200, JOB_TIMEOUT = 8000;

export type ReqType = "ride" | "product" | "checkout" | "ws" | "job" | "cron" | "msg";
export type ReqState = "new" | "travel" | "queued" | "serving" | "retrying" | "done" | "failed";
export interface TraceHop { node: string; wait: number; svc: number }
export interface Req {
    id: number; type: ReqType; plan: string[]; hopIdx: number; state: ReqState; t0: number; held: string[]; trace: TraceHop[]; retries: number; you: boolean; isRead: boolean; key: string | null; hops: string[]; cur: string;
    msg?: boolean; tFrom?: string; tTo?: string; tStart?: number; tEnd?: number; qStart?: number; qNode?: string | null; svcNode?: string | null; svcStart?: number; svcEnd?: number; wait?: number; depFail?: boolean; retryAt?: number; mapsDone?: boolean; edgeHit?: boolean; latency?: number; error?: string;
}
export interface NodeState { id: string; def: NodeDef; alive: boolean; replicas: number; baseReplicas: number; busy: number; queue: Req[]; util: number; sparks: number[]; served: number; errors: number; provisioningUntil: number; lastScale: number; highSince: number; lowSince: number; promoted: boolean }
export interface Extra { kind: "tele" | "hb" | "event"; path: string[]; idx: number; tStart: number; tEnd: number }
export interface Resp { path: string[]; idx: number; tStart: number; tEnd: number; you: boolean }
export interface Metrics { rps: number; p50: number; p99: number; errRate: number; shedRate: number; queueDepth: number; cacheHit: number; costHr: number; replicas: number; costPerRide: number; health: Health; total: number; errors: number; concurrency: number }
export type Health = "nominal" | "degraded" | "outage" | "booting";
export type LogKind = "info" | "warn" | "err" | "ok";
export interface LogEvent { t: number; text: string; kind: LogKind }
export interface Flags { breaker: boolean; jitter: boolean; index: boolean; rtdbMumbai: boolean; tokens: boolean; nplus1: boolean; retries: boolean; spikeUntil: number; slowUntil: number; partitionUntil: number; failoverAt: number }
export interface Breaker { state: "closed" | "open" | "half"; fails: number[]; openUntil: number }
export interface Records { maxRps: number; longestOutage: number; fastestRecovery: number }
interface CacheEntry { v: string; exp: number; at: number }

const BASE_FLAGS = (): Flags => ({ breaker: false, jitter: false, index: true, rtdbMumbai: true, tokens: true, nplus1: false, retries: false, spikeUntil: 0, slowUntil: 0, partitionUntil: 0, failoverAt: 0 });

export class Sim {
    now = 0; load = 300; booting = true; bootIndex = 0; seq = 0; readonly SCALE = SCALE;
    flags: Flags = BASE_FLAGS();
    nodes: Record<string, NodeState> = {};
    active: Req[] = []; responses: Resp[] = []; extras: Extra[] = []; events: LogEvent[] = [];
    breakers: Record<string, Breaker> = {};
    cache = new Map<string, CacheEntry>(); cacheAlive = true; cacheStats = { hit: 0, miss: 0, ring: [] as number[] }; evictions = 0;
    lat: number[] = []; completions: number[] = []; errorsWin: number[] = []; shedWin: number[] = []; mapsCalls = 0; rides = 0;
    metrics: Metrics = { rps: 0, p50: 0, p99: 0, errRate: 0, shedRate: 0, queueDepth: 0, cacheHit: 0, costHr: 420, replicas: 4, costPerRide: 3, health: "booting", total: 0, errors: 0, concurrency: 0 };
    health: Health = "nominal"; outageSince = 0; records: Records = { maxRps: 0, longestOutage: 0, fastestRecovery: 0 }; lastChaosAt = 0; nominalSince = 0;
    private arrivalAcc = 0; private teleAcc = 0; private hbAcc = 0; private cronAcc = 0; private metricAcc = 0;
    onLog: ((e: LogEvent) => void) | null = null; onTrace: ((r: Req) => void) | null = null; onHealth: ((h: Health) => void) | null = null; onMsg: ((r: Req) => void) | null = null;
    you: Req | null = null;

    constructor() {
        for (const d of NODES) this.nodes[d.id] = { id: d.id, def: d, alive: true, replicas: d.replicas || 1, baseReplicas: d.replicas || 1, busy: 0, queue: [], util: 0, sparks: new Array(48).fill(0), served: 0, errors: 0, provisioningUntil: 0, lastScale: 0, highSince: 0, lowSince: 0, promoted: false };
        for (const k in DEP) this.breakers[k] = { state: "closed", fails: [], openUntil: 0 };
        this.warmCache(260);
    }
    log(text: string, kind: LogKind = "info") { const e: LogEvent = { t: this.now, text, kind }; this.events.push(e); if (this.events.length > 240) this.events.shift(); if (this.onLog) this.onLog(e); }
    slots(n: NodeState) { return (n.def.threads || 1) * Math.max(0, n.replicas); }

    /* ---------- cache (a real key space the REPL shares) ---------- */
    cacheGet(k: string): CacheEntry | null { if (!this.cacheAlive) return null; const e = this.cache.get(k); if (!e) return null; if (e.exp && e.exp < this.now) { this.cache.delete(k); return null; } return e; }
    cacheSet(k: string, v: string, ttl: number) { if (!this.cacheAlive) return; if (this.cache.size > 5000) { const first = this.cache.keys().next().value; if (first !== undefined) this.cache.delete(first); this.evictions++; } this.cache.set(k, { v, exp: ttl ? this.now + ttl : 0, at: this.now }); }
    warmCache(n = 300) { for (let i = 0; i < n; i++) { this.cacheSet("ride:" + i, JSON.stringify({ id: i, status: i % 7 ? "completed" : "ongoing", fare: 120 + (i * 37) % 480, city: "Bengaluru" }), S(120000)); if (i < 200) this.cacheSet("product:" + i, JSON.stringify({ id: i, sku: "SKU-" + (1000 + i), price: 99 + (i * 13) % 900, stock: (i * 7) % 40 }), S(120000)); } }
    private noteCache(hit: boolean) { const s = this.cacheStats; if (hit) s.hit++; else s.miss++; s.ring.push(hit ? 1 : 0); if (s.ring.length > 240) s.ring.shift(); }

    /* ---------- requests ---------- */
    mkReq(type: ReqType, opts?: Partial<Req>): Req {
        const r: Req = { id: ++this.seq, type, plan: [], hopIdx: 0, state: "new", t0: this.now, held: [], trace: [], retries: 0, you: false, isRead: type === "ride" || type === "product", key: null, hops: [], cur: "" };
        if (type === "ride") { r.plan = ["users", "edge", "gateway", "auth", "ride", "cache"]; r.key = "ride:" + zipf(400); }
        else if (type === "product") { r.plan = ["users", "edge", "gateway", "auth", "readmodel", "cache"]; r.key = "product:" + zipf(600); }
        else if (type === "checkout") r.plan = ["users", "edge", "gateway", "auth", "payments", "razorpay"];
        else if (type === "ws") r.plan = ["users", "edge", "gateway", "signal"];
        else if (type === "job") r.plan = ["razorpay", "queue", "workers", "pg"];
        else if (type === "cron") r.plan = ["cron", "queue", "workers", "pg"];
        if (opts) Object.assign(r, opts);
        return r;
    }
    spawn(type: ReqType, opts?: Partial<Req>): Req { const r = this.mkReq(type, opts); this.active.push(r); r.cur = r.plan[0]; r.hops.push(r.cur); this.arriveAt(r, r.plan[0], true); return r; }
    private travel(r: Req, to: string) { r.state = "travel"; r.tFrom = r.cur; r.tTo = to; r.tStart = this.now; r.tEnd = this.now + HOP; r.cur = to; }
    private arriveAt(r: Req, id: string, initial = false) {
        const n = this.nodes[id]; r.cur = id; if (!initial) r.hops.push(id);
        if (id === "users" || id === "cron" || (id === "razorpay" && r.type === "job")) { this.nextHop(r); return; }
        if (DEP[id] && this.flags.breaker) { const b = this.breakers[id]; if (b.state === "open") { if (this.now < b.openUntil) { this.depFail(r, id, true); return; } b.state = "half"; } }
        if (!n.alive) { if (id === "pg" && r.isRead && this.nodes.pgr.alive) { r.plan[r.hopIdx] = "pgr"; this.arriveAt(r, "pgr"); return; } this.fail(r, n.def.label + " down"); return; }
        if (id === "cache" && !this.cacheAlive) { this.startService(r, n, DEP.cache.timeout, true); return; }
        if (n.def.hold && r.held.includes(id)) { this.startService(r, n, null, false, true); return; } // re-entry: it still holds its thread here
        if (n.busy < this.slots(n)) this.startService(r, n);
        else if (n.def.hold && n.queue.length >= (n.def.qmax || 48) * Math.max(1, n.replicas)) { n.errors++; this.fail(r, n.def.label + " queue full · shed (503)"); }
        else { n.queue.push(r); r.state = "queued"; r.qStart = this.now; r.qNode = id; }
    }
    private unqueue(r: Req) { if (r.qNode) { const q = this.nodes[r.qNode].queue; const i = q.indexOf(r); if (i >= 0) q.splice(i, 1); r.qNode = null; } }
    private svcTime(n: NodeState, r: Req) {
        const f = this.flags; let m = n.def.svc || 1; const id = n.id;
        if ((id === "pg" || id === "pgr") && r.isRead) { if (!f.index) m *= 3; if (f.nplus1) m *= 2; }
        if (id === "ride" && !f.rtdbMumbai) m += 70;
        if (id === "razorpay" && this.now < f.slowUntil) m = 900;
        return lognorm(m);
    }
    private startService(r: Req, n: NodeState, forcedDur: number | null = null, depTimeout = false, reentry = false) {
        r.qNode = null; if (!reentry) { n.busy++; if (n.def.hold) r.held.push(n.id); }
        const wait = r.state === "queued" ? this.now - (r.qStart || this.now) : 0;
        let d = forcedDur != null ? forcedDur : this.svcTime(n, r); r.depFail = depTimeout;
        const dep = DEP[n.id]; if (dep && !depTimeout && d > dep.timeout) { d = dep.timeout; r.depFail = true; }
        r.state = "serving"; r.svcNode = n.id; r.svcStart = this.now; r.svcEnd = this.now + d; r.wait = wait;
    }
    private release(r: Req) {
        if (r.state === "serving" && r.svcNode) { const n = this.nodes[r.svcNode]; if (!n.def.hold && n.busy > 0) n.busy--; }
        r.svcNode = null; for (const id of r.held) { const n = this.nodes[id]; if (n.busy > 0) n.busy--; } r.held = [];
    }
    private finishHop(r: Req) {
        const n = this.nodes[r.cur]; if (!n.def.hold && n.busy > 0) n.busy--; r.svcNode = null; n.served++;
        r.trace.push({ node: n.id, wait: Math.round(r.wait || 0), svc: Math.round(this.now - (r.svcStart || this.now)) });
        const dep = DEP[n.id];
        if (dep) {
            const b = this.breakers[n.id];
            if (r.depFail) {
                b.fails.push(this.now); b.fails = b.fails.filter((t) => t > this.now - S(5000));
                if (this.flags.breaker && b.state !== "open" && (b.state === "half" || b.fails.length >= 6)) { b.state = "open"; b.openUntil = this.now + S(5000); this.log("circuit breaker OPEN on " + n.def.label + " · failing fast for 5 s", "warn"); }
                this.depFail(r, n.id, false); return;
            }
            if (b.state === "half") { b.state = "closed"; b.fails = []; this.log("breaker on " + n.def.label + " closed · probe succeeded", "ok"); }
        }
        this.nextHop(r);
    }
    private depFail(r: Req, id: string, fast: boolean) {
        if (id === "cache") { this.noteCache(false); this.nodes.cache.errors++; const owner = r.type === "product" ? "readmodel" : "ride"; const store = r.type === "product" ? "pgr" : "pg"; r.plan.push(owner, store); r.hopIdx++; this.travel(r, owner); return; }
        if (id === "maps") { this.nextHop(r, true); return; }
        this.nodes[id].errors++; this.fail(r, fast ? "payment failed fast (breaker open)" : "Razorpay timeout");
    }
    private nextHop(r: Req, skipMaps = false) {
        const id = r.cur;
        if (id === "edge" && r.type === "product" && r.hopIdx === 1 && R() < 0.3) { r.edgeHit = true; this.complete(r); return; }
        if (id === "cache" && r.isRead) { const hit = this.cacheGet(r.key || ""); this.noteCache(!!hit); if (hit) { this.complete(r); return; } const owner = r.type === "product" ? "readmodel" : "ride"; const store = r.type === "product" ? "pgr" : "pg"; r.plan.push(owner, store); }
        if ((id === "pg" || id === "pgr") && r.isRead) { const key = r.key || "k:0"; this.cacheSet(key, '{"id":' + key.split(":")[1] + ',"fetched_at":' + Math.round(this.now) + "}", S(120000)); if (r.type === "ride" && !skipMaps && R() < 0.35 && !r.mapsDone) { r.mapsDone = true; r.plan.push("ride", "maps"); } else { this.complete(r); return; } }
        if (id === "maps") { this.mapsCalls += this.flags.tokens ? 1 : 12; this.complete(r); return; }
        if (id === "razorpay" && r.type === "checkout") { this.complete(r); this.spawn("job"); this.spawn("job"); this.extras.push({ kind: "event", path: ["product", "bus", "readmodel"], idx: 0, tStart: this.now, tEnd: this.now + HOP }); return; }
        if (id === "signal" || id === "storage" || (id === "pg" && (r.type === "job" || r.type === "cron"))) { this.complete(r); return; }
        r.hopIdx++; const next = r.plan[r.hopIdx]; if (!next) { this.complete(r); return; } this.travel(r, next);
    }
    private complete(r: Req) {
        this.unqueue(r); this.release(r); r.state = "done"; const lat = this.now - r.t0; const i = this.active.indexOf(r); if (i >= 0) this.active.splice(i, 1);
        if (r.msg && this.onMsg) this.onMsg(r);
        if (r.type !== "job" && r.type !== "cron" && r.type !== "msg") {
            this.lat.push(lat); if (this.lat.length > 600) this.lat.shift(); this.completions.push(this.now); this.metrics.total++; if (r.type === "ride") this.rides++;
            const path = r.hops.slice().reverse(); if (path.length > 1) this.responses.push({ path, idx: 0, tStart: this.now, tEnd: this.now + HOP * 0.6, you: r.you });
        }
        if (r.you) { r.latency = lat; this.you = null; if (this.onTrace) this.onTrace(r); }
    }
    private fail(r: Req, reason: string) {
        this.unqueue(r); this.release(r); r.state = "failed"; const i = this.active.indexOf(r); if (i >= 0) this.active.splice(i, 1);
        const shed = /breaker|shed/.test(reason); if (shed) this.shedWin.push(this.now); else { this.errorsWin.push(this.now); this.metrics.errors++; }
        if (r.you) { this.you = null; r.error = reason; r.latency = this.now - r.t0; if (this.onTrace) this.onTrace(r); }
        if (this.flags.retries && r.retries < 2 && r.type !== "ws" && r.type !== "job" && r.type !== "cron" && r.type !== "msg") {
            const backoff = this.flags.jitter ? (60 * Math.pow(2, r.retries)) * (0.5 + R()) : 30;
            const rr = this.mkReq(r.type, { retries: r.retries + 1, key: r.key, t0: r.t0 }); rr.plan = rr.plan.slice(2); rr.retryAt = this.now + backoff; rr.state = "retrying"; rr.cur = "gateway"; this.active.push(rr);
        }
        if (R() < 0.05) this.log("request failed · " + reason, "err");
    }

    /* ---------- actions ---------- */
    act(id: string): boolean {
        const f = this.flags, n = this.nodes; this.lastChaosAt = this.now; let cap = true;
        switch (id) {
            case "killWorker": if (n.workers.replicas > 0) { n.workers.replicas--; n.workers.busy = Math.min(n.workers.busy, this.slots(n.workers)); this.log("worker replica killed · " + n.workers.replicas + " left", "err"); } break;
            case "killDb": if (n.pg.alive) { n.pg.alive = false; n.pg.queue.slice().forEach((r) => this.fail(r, "primary down")); n.pg.queue = []; n.pg.busy = 0; f.failoverAt = this.now + S(4200); this.log("Postgres primary DOWN · writes failing · replica promotion started", "err"); } break;
            case "partitionCache": this.cacheAlive = false; f.partitionUntil = this.now + S(14000); this.log("network partition: services ↔ DStarDB · 14 s", "err"); break;
            case "slowPayments": f.slowUntil = this.now + S(16000); this.log("Razorpay latency injected: 900 ms for 16 s", "err"); break;
            case "spike": f.spikeUntil = this.now + S(8000); this.log("traffic spike ×8 for 8 s", "warn"); break;
            case "retryStorm": f.retries = true; f.jitter = false; this.log("naive retries enabled: 3 attempts, fixed backoff, no budget", "warn"); break;
            case "dropIndex": f.index = false; this.log("index dropped on rides(user_id, created_at) · sequential scans", "err"); break;
            case "singapore": f.rtdbMumbai = false; this.log("RTDB moved to asia-southeast1 (Singapore) · +70 ms per ride read", "warn"); break;
            case "breaker": f.breaker = !f.breaker; if (!f.breaker) for (const k in this.breakers) this.breakers[k] = { state: "closed", fails: [], openUntil: 0 }; this.log("circuit breakers " + (f.breaker ? "ARMED" : "disarmed"), f.breaker ? "ok" : "warn"); cap = f.breaker; break;
            case "jitter": f.jitter = !f.jitter; if (f.jitter) f.retries = true; this.log(f.jitter ? "retry budget + exponential backoff with jitter" : "jitter off", f.jitter ? "ok" : "warn"); cap = f.jitter; break;
            case "scaleOut": n.ride.replicas = Math.min(6, n.ride.replicas + 1); n.workers.replicas = Math.min(6, n.workers.replicas + 1); this.log("manual scale-out · ride " + n.ride.replicas + " · workers " + n.workers.replicas, "ok"); break;
            case "addIndex": f.index = true; this.log("index created · seeks instead of scans", "ok"); break;
            case "fixNplus1": f.nplus1 = false; this.log("N+1 fixed · one batched query per request", "ok"); break;
            case "moveRtdb": f.rtdbMumbai = true; this.log("RTDB moved to asia-south1 (Mumbai)", "ok"); break;
            case "tokens": f.tokens = !f.tokens; this.log(f.tokens ? "Places session tokens + debounce ON · 1 billed call per ride" : "session tokens OFF · 12 billed calls per ride", f.tokens ? "ok" : "warn"); cap = f.tokens; break;
            case "debounce": f.tokens = true; this.log("Distance Matrix debounced · unused billed fields dropped", "ok"); break;
            case "warmCache": this.cacheAlive = true; f.partitionUntil = 0; this.warmCache(320); this.log("cache warmed · 320 hot keys loaded", "ok"); break;
            case "heal":
                for (const k in n) { const x = n[k]; x.alive = true; x.replicas = x.baseReplicas; x.queue = []; x.busy = 0; x.provisioningUntil = 0; x.highSince = 0; x.lowSince = 0; x.promoted = false; }
                this.active = []; this.responses = []; this.flags = BASE_FLAGS(); for (const k in this.breakers) this.breakers[k] = { state: "closed", fails: [], openUntil: 0 };
                this.cacheAlive = true; this.warmCache(300); this.load = 300; this.errorsWin = []; this.shedWin = []; this.lat = []; this.log("all systems restored to baseline", "ok"); break;
            default: cap = false;
        }
        return cap;
    }
    applySetup(s: Partial<Flags & { cold: boolean }>) { const f = this.flags; for (const k of ["index", "nplus1", "rtdbMumbai", "breaker", "jitter", "tokens"] as const) { const v = s[k]; if (v != null) f[k] = v; } if (s.cold) this.cache.clear(); }
    trace(): Req { if (this.you) return this.you; const r = this.spawn("ride", { you: true }); this.you = r; return r; }

    /* ---------- step (realDt in real ms) ---------- */
    step(realDt: number) {
        if (realDt <= 0) return; const dt = realDt * SCALE; this.now += dt; const f = this.flags; if (this.booting) return;
        const spike = this.now < f.spikeUntil ? 8 : 1; this.arrivalAcc += (this.load * spike * dt) / 1000;
        while (this.arrivalAcc >= 1) { this.arrivalAcc -= 1; let x = R(); let t: ReqType = "ride"; for (const [k, p] of MIX) { if (x < p) { t = k; break; } x -= p; } if (this.active.length < 3000) this.spawn(t); }
        this.teleAcc += dt; if (this.teleAcc > S(420)) { this.teleAcc = 0; const src = ["gateway", "ride", "product", "payments", "readmodel", "workers"][Math.floor(R() * 6)]; this.extras.push({ kind: "tele", path: [src, "otel", "grafana"], idx: 0, tStart: this.now, tEnd: this.now + HOP * 1.4 }); }
        this.hbAcc += dt; if (this.hbAcc > S(1600)) { this.hbAcc = 0; for (const s of ["ride", "product", "payments"]) this.extras.push({ kind: "hb", path: [s, "discovery"], idx: 0, tStart: this.now, tEnd: this.now + HOP * 1.4 }); }
        this.cronAcc += dt; if (this.cronAcc > S(9000)) { this.cronAcc = 0; for (let i = 0; i < 3; i++) this.spawn("cron"); this.log("cron: reconciliation batch enqueued (3 jobs)", "info"); }
        for (const r of this.active.slice()) {
            if (r.state === "travel") { if (this.now >= (r.tEnd || 0)) { const k = r.plan.indexOf(r.tTo || "", r.hopIdx); if (k >= 0) r.hopIdx = k; this.arriveAt(r, r.tTo || r.cur); } }
            else if (r.state === "serving") { if (this.now >= (r.svcEnd || 0)) this.finishHop(r); }
            else if (r.state === "retrying") { if (this.now >= (r.retryAt || 0)) { r.state = "new"; this.arriveAt(r, "gateway"); } continue; }
            const lim = r.type === "job" || r.type === "cron" || r.type === "msg" ? JOB_TIMEOUT : REQ_TIMEOUT;
            if (r.state !== "done" && r.state !== "failed" && this.now - r.t0 > lim) this.fail(r, "timeout after " + lim + " ms");
        }
        for (const id in this.nodes) {
            const n = this.nodes[id];
            if (n.alive) { while (n.queue.length && n.busy < this.slots(n)) { const r = n.queue.shift() as Req; if (r.state === "queued") this.startService(r, n); } }
            const s = this.slots(n); const u = s ? Math.min(1, (n.busy + Math.min(n.queue.length, s)) / s) : n.queue.length ? 1 : 0; n.util += (u - n.util) * Math.min(1, realDt / 500);
        }
        const adv = (list: { idx: number; path: string[]; tStart: number; tEnd: number }[], speed: number) => { for (const e of list.slice()) { if (this.now >= e.tEnd) { e.idx++; if (e.idx >= e.path.length - 1) list.splice(list.indexOf(e), 1); else { e.tStart = this.now; e.tEnd = this.now + HOP * speed; } } } };
        adv(this.extras, 1.4); adv(this.responses, 0.6);
        if (f.failoverAt && this.now >= f.failoverAt) { f.failoverAt = 0; this.nodes.pg.alive = true; this.nodes.pg.promoted = true; this.log("failover complete · replica promoted to primary in 4.2 s", "ok"); }
        if (f.partitionUntil && this.now >= f.partitionUntil) { f.partitionUntil = 0; this.cacheAlive = true; this.log("partition healed · DStarDB reachable", "ok"); }
        if (f.slowUntil && this.now >= f.slowUntil) { f.slowUntil = 0; this.log("Razorpay latency back to normal", "ok"); }
        if (f.spikeUntil && this.now >= f.spikeUntil) { f.spikeUntil = 0; this.log("spike over", "info"); }
        for (const id of ["ride", "workers"]) {
            const n = this.nodes[id];
            if (n.provisioningUntil && this.now >= n.provisioningUntil) { n.provisioningUntil = 0; n.replicas = Math.min(6, n.replicas + 1); this.log("autoscaler: " + n.def.label + " " + (n.replicas - 1) + " → " + n.replicas + " replicas", "ok"); }
            const hi = n.util > 0.75 || (n.replicas === 0 && n.queue.length > 0);
            if (hi) { if (!n.highSince) n.highSince = this.now; if (this.now - n.highSince > S(2500) && !n.provisioningUntil && n.replicas < 6 && this.now - n.lastScale > S(3000)) { n.provisioningUntil = this.now + S(3000); n.lastScale = this.now; n.highSince = 0; this.log("autoscaler: " + n.def.label + " util " + Math.round(n.util * 100) + " % · provisioning +1 (3 s)", "warn"); } } else n.highSince = 0;
            if (n.util < 0.2 && n.replicas > n.baseReplicas) { if (!n.lowSince) n.lowSince = this.now; if (this.now - n.lowSince > S(25000)) { n.replicas--; n.lowSince = 0; this.log("autoscaler: " + n.def.label + " scaled in to " + n.replicas, "info"); } } else n.lowSince = 0;
        }
        this.metricAcc += realDt; if (this.metricAcc > 250) { this.metricAcc = 0; this.updateMetrics(); }
    }
    private updateMetrics() {
        const m = this.metrics, now = this.now;
        this.completions = this.completions.filter((t) => t > now - 1000); this.errorsWin = this.errorsWin.filter((t) => t > now - 1500); this.shedWin = this.shedWin.filter((t) => t > now - 1500);
        const sorted = this.lat.slice(-300).sort((a, b) => a - b); const q = (p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0);
        m.rps = this.completions.length; m.p50 = q(0.5); m.p99 = q(0.99);
        const done3 = Math.max(1, this.completions.length * 3); const denom = this.errorsWin.length + this.shedWin.length + done3; m.errRate = this.errorsWin.length / denom; m.shedRate = this.shedWin.length / denom;
        let qd = 0; for (const id in this.nodes) qd += this.nodes[id].queue.length; m.queueDepth = qd; m.replicas = this.nodes.ride.replicas + this.nodes.workers.replicas; m.concurrency = this.active.length;
        const ring = this.cacheStats.ring; m.cacheHit = ring.length ? ring.reduce((a, b) => a + b, 0) / ring.length : 0;
        m.costHr = 420 + (this.nodes.ride.replicas - 2) * 90 + (this.nodes.workers.replicas - 2) * 60; m.costPerRide = this.flags.tokens ? 3 : 200;
        for (const id in this.nodes) { const n = this.nodes[id]; n.sparks.push(n.util); if (n.sparks.length > 48) n.sparks.shift(); }
        let h: Health = "nominal";
        if (!this.nodes.pg.alive || !this.cacheAlive || m.errRate > 0.12 || m.shedRate > 0.4) h = "outage"; else if (m.errRate > 0.01 || m.shedRate > 0.02 || m.p99 > 480 || qd > 40) h = "degraded";
        if (h !== this.health) {
            if (h === "outage") this.outageSince = now;
            if (this.health === "outage" && this.outageSince) { const d = (now - this.outageSince) / 1000 / SCALE; this.records.longestOutage = Math.max(this.records.longestOutage, d); this.log("outage lasted " + d.toFixed(1) + " s", "info"); }
            if (h === "nominal" && this.lastChaosAt) { const rec = (now - this.lastChaosAt) / 1000 / SCALE; if (rec > 1 && rec < 180) this.records.fastestRecovery = this.records.fastestRecovery ? Math.min(this.records.fastestRecovery, rec) : rec; this.nominalSince = now; }
            this.health = h; if (this.onHealth) this.onHealth(h);
        }
        if (h === "nominal" && this.load > this.records.maxRps && now - this.nominalSince > S(10000)) this.records.maxRps = this.load;
        m.health = h;
    }

    /* ---------- REPL against the live cache ---------- */
    exec(raw: string): string {
        const a = raw.trim().split(/\s+/); const c = (a[0] || "").toUpperCase(); const k = a[1]; const g = (key: string) => { const e = this.cacheGet(key); return e ? e.v : null; };
        switch (c) {
            case "PING": return "PONG";
            case "SET": if (a.length < 3) throw new Error("wrong number of arguments for 'set'"); this.cacheSet(k, a.slice(2).join(" "), 0); return "OK";
            case "GET": { if (!k) throw new Error("wrong number of arguments for 'get'"); const v = g(k); return v == null ? "(nil)" : '"' + v + '"'; }
            case "DEL": { let n = 0; a.slice(1).forEach((x) => { if (this.cache.delete(x)) n++; }); return "(integer) " + n; }
            case "INCR": { const v = g(k); const num = v == null ? 0 : parseInt(v, 10); if (Number.isNaN(num)) throw new Error("value is not an integer"); this.cacheSet(k, String(num + 1), 0); return "(integer) " + (num + 1); }
            case "EXPIRE": { if (g(k) == null) return "(integer) 0"; const e = this.cache.get(k); if (e) e.exp = this.now + parseInt(a[2], 10) * 1000; return "(integer) 1"; }
            case "TTL": { if (g(k) == null) return "(integer) -2"; const e = this.cache.get(k); return "(integer) " + (e && e.exp ? Math.max(0, Math.ceil((e.exp - this.now) / 1000)) : -1); }
            case "KEYS": { const pat = (k || "*").replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, "."); const re = new RegExp("^" + pat + "$"); const out: string[] = []; for (const key of this.cache.keys()) { if (re.test(key) && this.cacheGet(key)) out.push(key); if (out.length >= 20) break; } return out.length ? out.map((x, i) => i + 1 + ') "' + x + '"').join("  ") + (out.length >= 20 ? "  …" : "") : "(empty array)"; }
            case "DBSIZE": return "(integer) " + this.cache.size;
            case "INFO": { const s = this.cacheStats; const tot = s.hit + s.miss; return "# Stats  keys:" + this.cache.size + "  hits:" + s.hit + "  misses:" + s.miss + "  hit_rate:" + (tot ? Math.round((s.hit / tot) * 1000) / 10 : 0) + "%  evicted:" + this.evictions + "  reachable:" + (this.cacheAlive ? "yes" : "NO (partition)") + "  threads:8  uptime_ms:" + Math.round(this.now); }
            case "FLUSHALL": this.cache.clear(); return "OK";
            case "HELP": return "GET SET DEL INCR EXPIRE TTL KEYS <glob> DBSIZE INFO FLUSHALL PING · these are the running system's keys (try KEYS ride:1*)";
            case "": return "";
            default: throw new Error("unknown command '" + c + "'");
        }
    }
}
