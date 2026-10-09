// The control room's brain: owns the simulation, the renderer, presence
// and records, and publishes an immutable snapshot that the React
// components read through useSyncExternalStore. Components stay thin;
// everything that has to happen in order (boot, tour, scenarios,
// actions and their captions) lives here.

import { ACTIONS, ACTION_BY_ID, BOOT_LINES, BOOT_ORDER, GHOSTS, NODE_BY_ID, NodeDef, SCENARIOS, TRACE_KINDS, TRACE_KIND_BY_ID, cityOf } from "./data";
import { Sim, type Flags, type Health, type HopEvent, type LogEvent, type Metrics, type Req } from "./sim";
import { World } from "./world";
import { PresenceClient, type SharedRecords } from "./presence";
import { snd, setSoundEnabled } from "./sound";

export type PanelName = "about" | "work" | "projects" | "stack" | "contact" | "records" | "notes" | "node";
export type Sheet = "console" | "trace" | "rail" | "panel";
export interface ScenarioState { id: string; step: number; p99Start: number | null }
export interface TraceLine { t: number; text: string; kind: "info" | "ok" | "warn" | "err" }
export interface TraceHopView { node: string; label: string; wait: number; svc: number | null; queued?: number }
/** One request followed through the model: the narrated lines, the per-hop timings, where it is now. */
export interface TraceView { kind: string; label: string; city: string; running: boolean; latency: number; error?: string; hops: TraceHopView[]; lines: TraceLine[]; cur: string | null; t0: number; /** model ms since the request left, updated while it runs */ now: number }
export interface TipState { node: NodeDef; x: number; y: number; rows: [string, string][] }
export interface LocalRecords { maxRps: number; longestOutage: number; fastestRecovery: number; visits: number }

export interface RoomSnapshot {
    booted: boolean; bootIndex: number; bootLines: { i: number; text: string }[]; bootReady: boolean; bootHidden: boolean;
    health: Health; metrics: Metrics; flags: Flags; fps: number; load: number; replicas: { ride: number; workers: number };
    panel: { name: PanelName; arg?: string } | null;
    caption: { text: string; n: number } | null; toast: { text: string; n: number } | null;
    tour: boolean; scenario: ScenarioState | null; sound: boolean; railHidden: boolean; sheet: Sheet; mobile: boolean;
    peersText: string; city: string; trace: TraceView | null; traceBusy: boolean; traceOpen: boolean; traceKind: string; traceSpeed: number; log: (LogEvent & { rel: number })[];
    records: LocalRecords; shared: SharedRecords; hist: { rps: number[]; p99: number[]; err: number[]; q: number[] };
    tip: TipState | null; version: number;
}

const fmt = (n: number, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
const TOUR: { c: string; w: number; f: (ctl: RoomController) => void }[] = [
    { c: "This is a live model of the systems I run. Every dot is a request.", w: 4500, f: (c) => c.fit() },
    { c: "The bright one is you. Requests enter at the edge, pass the gateway and fan out to services.", w: 5000, f: (c) => c.trace("ride", 0.5) },
    { c: "Zoom into DStarDB: eight threads serving the cache. The keys are real; the REPL in the inspector reads them.", w: 5000, f: (c) => c.focus("cache", 2.6) },
    { c: "Now break something. Killing a worker backs up the queue; the autoscaler notices in a few seconds.", w: 6500, f: (c) => { c.focus("workers", 2.0); c.doAction("killWorker"); } },
    { c: "Kill the database primary. Writes fail, reads move to the replica, promotion takes about four seconds.", w: 7000, f: (c) => { c.focus("pg", 2.0); c.doAction("killDb"); } },
    { c: "Slow one external dependency and the whole gateway starves. That is a cascading failure.", w: 7500, f: (c) => { c.focus("gateway", 2.4); c.doAction("slowPayments"); } },
    { c: "A circuit breaker turns a slow failure into a fast one and frees the threads.", w: 6000, f: (c) => c.doAction("breaker") },
    { c: "Heal everything. Then try the incidents I actually fixed, under Work.", w: 5000, f: (c) => { c.doAction("heal"); c.fit(); } },
];

export class RoomController {
    sim = new Sim();
    world: World | null = null;
    presence: PresenceClient | null = null;
    private listeners = new Set<() => void>();
    private raf = 0; private last = 0; private uiAcc = 0; private fpsAcc = 0; private fpsN = 0;
    private captionT: ReturnType<typeof setTimeout> | null = null; private toastT: ReturnType<typeof setTimeout> | null = null; private tourT: ReturnType<typeof setTimeout> | null = null;
    private ghostsOn = true; private reduced = false; private canvas: HTMLCanvasElement | null = null; private unbind: (() => void)[] = [];
    private lastHealth: Health = "nominal"; private msgCallback: (() => void) | null = null; private t0 = 0;
    snapshot: RoomSnapshot;

    constructor() {
        const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ""; } })();
        this.snapshot = {
            booted: false, bootIndex: 0, bootLines: [], bootReady: false, bootHidden: false,
            health: "booting", metrics: this.sim.metrics, flags: this.sim.flags, fps: 0, load: this.sim.load, replicas: { ride: 2, workers: 2 },
            panel: null, caption: null, toast: null, tour: false, scenario: null, sound: false, railHidden: false, sheet: "console", mobile: false,
            peersText: "alone here", city: cityOf(tz), trace: null, traceBusy: false, traceOpen: false, traceKind: "ride", traceSpeed: 0.25, log: [],
            records: { maxRps: 0, longestOutage: 0, fastestRecovery: 0, visits: 0 }, shared: {}, hist: { rps: [], p99: [], err: [], q: [] }, tip: null, version: 0,
        };
        this.sim.onLog = (e) => this.set({ log: [...this.snapshot.log.slice(-59), { ...e, rel: this.t0 ? (performance.now() - this.t0) / 1000 : 0 }] });
        // A `you` request that was not narrated (the boot packet) still lands in the rail as the last request.
        this.sim.onTrace = (r) => { if (this.traceReq) return; const lat = Math.round(r.latency || 0); const k = TRACE_KINDS[0]; this.set({ traceBusy: false, trace: { kind: k.id, label: k.label, city: this.snapshot.city, running: false, latency: lat, error: r.error, hops: r.trace.map((t) => ({ node: t.node, label: NODE_BY_ID[t.node].label, wait: t.wait, svc: t.svc })), lines: [{ t: lat, text: (r.error ? "failed after " + lat + " ms · " + r.error : "done · " + lat + " ms end to end, in real time") + " · press Trace to follow one in slow motion", kind: r.error ? "err" : "ok" }], cur: null, t0: 0, now: lat } }); };
        this.sim.onHop = (r, ev) => this.onHop(r, ev);
        this.startPresence();
        this.sim.onMsg = () => { this.toast("delivered · the worker wrote it to storage and the message is on its way to my phone.", 5200); snd.chime(); if (this.msgCallback) this.msgCallback(); };
    }

    /* ---------- store ---------- */
    subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
    getSnapshot = () => this.snapshot;
    private set(patch: Partial<RoomSnapshot>) { this.snapshot = { ...this.snapshot, ...patch, version: this.snapshot.version + 1 }; for (const l of this.listeners) l(); }

    /* ---------- lifecycle ---------- */
    attach(canvas: HTMLCanvasElement) {
        if (this.canvas) this.detach();
        this.canvas = canvas; this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const world = new World(canvas, this.sim); this.world = world; world.nodeIndex = BOOT_ORDER;
        this.layout(); world.cam = { ...world.tgt };
        this.bindPointer(canvas); this.bindKeys();
        const onResize = () => { this.layout(); }; window.addEventListener("resize", onResize); this.unbind.push(() => window.removeEventListener("resize", onResize));
        if (!this.attachedOnce) {
            this.attachedOnce = true;
            this.loadRecords(); this.baseTitle = document.title.replace(/^▲ (outage|degraded) · /, "");
            this.t0 = performance.now(); this.boot();
        } else { this.set({ panel: null, tip: null }); }
        this.presence?.start();
        this.last = performance.now(); this.raf = requestAnimationFrame(this.loop);
    }
    /** Called when the canvas unmounts (stealth résumé, route change). The model keeps its state and resumes on the next attach. */
    detach() {
        cancelAnimationFrame(this.raf); for (const u of this.unbind) u(); this.unbind = []; this.presence?.stop(); this.stopTour(); this.world = null; this.canvas = null;
    }
    private attachedOnce = false; private baseTitle = "Control room · Dhruv Agrawal";
    private layout() {
        const w = this.world; if (!w) return; w.resize(); const mobile = innerWidth < 821; w.minScale = mobile ? 0.42 : 0;
        w.inset = mobile ? { top: 52, right: 0, bottom: Math.round(innerHeight * 0.42) + 40, left: 0 } : { top: 56, right: this.snapshot.railHidden ? 0 : 288, bottom: 194, left: this.snapshot.traceOpen ? 472 : 0 };
        if (mobile !== this.snapshot.mobile) this.set({ mobile }); w.fit();
    }
    private loop = (now: number) => {
        this.raf = requestAnimationFrame(this.loop); const dt = Math.max(0, Math.min(50, now - this.last)); this.last = now; if (document.hidden || !this.world) return;
        this.sim.step(dt); if (this.presence) this.world.peers = this.presence.tick(dt).map((p) => ({ x: p.x, y: p.y, label: p.city })); this.ghosts(); this.world.frame(dt);
        this.fpsAcc += dt; this.fpsN++; this.uiAcc += dt;
        if (this.uiAcc > 250) { this.uiAcc = 0; const fps = this.fpsN / (this.fpsAcc / 1000); this.fpsAcc = 0; this.fpsN = 0; this.tick(fps); }
    };
    private tick(fps: number) {
        const m = this.sim.metrics; const h = this.snapshot.hist; const push = (a: number[], v: number) => { const b = [...a, v]; return b.length > 90 ? b.slice(-90) : b; };
        const hist = { rps: push(h.rps, m.rps), p99: push(h.p99, m.p99), err: push(h.err, (m.errRate + m.shedRate) * 100), q: push(h.q, m.queueDepth) };
        const health = this.sim.booting ? "booting" : this.sim.health;
        if (this.snapshot.booted && health !== this.lastHealth) {
            if (health === "outage") snd.buzz();
            if (health === "nominal" && this.lastHealth !== "nominal") { snd.chime(); this.caption("recovered · " + (this.sim.records.fastestRecovery ? this.sim.records.fastestRecovery.toFixed(1) + " s since the last fault" : "systems nominal"), 4000); }
            document.title = (health === "nominal" ? "" : health === "outage" ? "▲ outage · " : "▲ degraded · ") + this.baseTitle;
        }
        this.lastHealth = health;
        this.mergeRecords();
        const tv = this.snapshot.trace; let trace = tv && tv.running ? { ...tv, now: Math.round(this.sim.now - tv.t0) } : tv;
        // Slow motion is for watching, not waiting: after 12 real seconds (a request parked on a timeout) the rest runs at real time.
        if (trace && trace.running && this.sim.speed < 1 && performance.now() - this.traceStartReal > 12000) { this.sim.speed = 1; trace = { ...trace, lines: [...trace.lines, { t: trace.now, text: "12 s in slow motion · the rest runs in real time", kind: "warn" }] }; }
        this.set({ metrics: { ...m }, flags: { ...this.sim.flags }, fps, health, hist, trace, load: this.sim.load, replicas: { ride: this.sim.nodes.ride.replicas, workers: this.sim.nodes.workers.replicas } });
    }

    /* ---------- boot ---------- */
    private boot() {
        const order = BOOT_ORDER; let i = 0; const stepMs = 105;
        const done = () => {
            this.sim.bootIndex = order.length; this.sim.booting = false; this.set({ booted: true, bootIndex: order.length, bootReady: true });
            setTimeout(() => this.set({ bootHidden: true }), 900);
            this.sim.trace(); this.caption("that bright packet is you · " + this.snapshot.city + " · watch it come back", 5000);
            setTimeout(() => { if (!this.snapshot.tour && !this.snapshot.scenario) this.caption("break something: press K to kill a worker, or use the console below", 7000); }, 5200);
        };
        if (this.reduced) { done(); return; }
        const tick = () => {
            if (this.snapshot.booted) return;
            if (i >= order.length) { this.set({ bootLines: [...this.snapshot.bootLines, { i: -1, text: "system ready · 24/24 healthy · you are request #" + (48213 + Math.floor(Math.random() * 400)) + " from " + this.snapshot.city }] }); setTimeout(() => { if (!this.snapshot.booted) done(); }, 700); return; }
            const id = order[i]; this.set({ bootLines: [...this.snapshot.bootLines, { i: i + 1, text: BOOT_LINES[id] || id }], bootIndex: i + 1 }); snd.boot(i); i++; this.sim.bootIndex = i; setTimeout(tick, stepMs);
        };
        setTimeout(tick, 500);
        this.skipBoot = () => { if (!this.snapshot.booted) { i = order.length; done(); } };
    }
    skipBoot: () => void = () => {};

    /* ---------- pointer + keys ---------- */
    private bindPointer(cv: HTMLCanvasElement) {
        const w = () => this.world as World; let drag: { x: number; y: number } | null = null; let pinch: { d: number; s: number } | null = null; let moved = false; const pts = new Map<number, { x: number; y: number }>();
        const down = (e: PointerEvent) => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const a = [...pts.values()]; pinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), s: w().tgt.s }; drag = null; } else { drag = { x: e.clientX, y: e.clientY }; moved = false; } };
        const move = (e: PointerEvent) => {
            if (pts.has(e.pointerId)) pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && pts.size === 2) { const a = [...pts.values()]; const d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); const mid: [number, number] = [(a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2]; const f = ((d / pinch.d) * pinch.s) / w().tgt.s; w().zoomAt(f, mid[0], mid[1]); pinch.d = d; pinch.s = w().tgt.s; return; }
            if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; if (moved) { w().pan(dx, dy); drag = { x: e.clientX, y: e.clientY }; cv.style.cursor = "grabbing"; } return; }
            const n = w().nodeAt(e.clientX, e.clientY); w().hover = n ? n.id : null; cv.style.cursor = n ? "pointer" : "grab"; this.showTip(n, e.clientX, e.clientY);
            if (this.presence && this.snapshot.booted) { const [wx, wy] = w().s2w(e.clientX, e.clientY); this.presence.setCursor(wx, wy); }
        };
        const up = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (drag && !moved) { const n = w().nodeAt(e.clientX, e.clientY); if (n) this.selectNode(n.id); else { w().selected = null; if (this.snapshot.panel?.name === "node") this.closePanel(); } } drag = null; cv.style.cursor = "grab"; };
        const leave = () => { w().hover = null; this.set({ tip: null }); };
        const wheel = (e: WheelEvent) => { e.preventDefault(); w().zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX, e.clientY); };
        const dbl = (e: MouseEvent) => { const n = w().nodeAt(e.clientX, e.clientY); if (n) w().focus(n.id, 2.6); else w().fit(); };
        cv.addEventListener("pointerdown", down); cv.addEventListener("pointermove", move); cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up); cv.addEventListener("pointerleave", leave); cv.addEventListener("wheel", wheel, { passive: false }); cv.addEventListener("dblclick", dbl);
        this.unbind.push(() => { cv.removeEventListener("pointerdown", down); cv.removeEventListener("pointermove", move); cv.removeEventListener("pointerup", up); cv.removeEventListener("pointercancel", up); cv.removeEventListener("pointerleave", leave); cv.removeEventListener("wheel", wheel); cv.removeEventListener("dblclick", dbl); });
    }
    private bindKeys() {
        const onKey = (e: KeyboardEvent) => {
            const typing = /INPUT|TEXTAREA/.test((document.activeElement && document.activeElement.tagName) || "");
            if (e.key === "Escape") { if (this.snapshot.tour) this.stopTour(); else if (this.snapshot.panel) this.closePanel(); else if (this.snapshot.trace?.running) this.endTrace(); else if (this.snapshot.traceOpen) this.closeTrace(); else this.fit(); return; }
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            const a = ACTIONS.find((x) => x.key.toLowerCase() === e.key.toLowerCase()); if (a) { e.preventDefault(); this.doAction(a.id); return; }
            if (e.key === "f" || e.key === "0") this.fit(); if (e.key === "=") this.world?.zoomAt(1.25, innerWidth / 2, innerHeight / 2); if (e.key === "-") this.world?.zoomAt(0.8, innerWidth / 2, innerHeight / 2); if (e.key === "?") this.openPanel("notes");
        };
        window.addEventListener("keydown", onKey); this.unbind.push(() => window.removeEventListener("keydown", onKey));
    }
    private showTip(n: NodeDef | null, x: number, y: number) {
        if (!n) { if (this.snapshot.tip) this.set({ tip: null }); return; }
        const st = this.sim.nodes[n.id]; const rows: [string, string][] = [];
        if (n.kind !== "users" && n.kind !== "ctl") { rows.push(["util", Math.round(st.util * 100) + " %"], ["busy", st.busy + " / " + this.sim.slots(st)], ["queued", String(st.queue.length)], ["served", fmt(st.served)], ["errors", fmt(st.errors)]); if (n.replicas) rows.push(["replicas", String(st.replicas)]); }
        if (n.stack) rows.push(["stack", n.stack.join(" · ")]);
        this.set({ tip: { node: n, x, y, rows } });
    }

    /* ---------- messaging ---------- */
    caption(text: string, ms = 6500) { if (this.captionT) clearTimeout(this.captionT); this.set({ caption: { text, n: this.snapshot.version } }); this.captionT = setTimeout(() => this.set({ caption: null }), ms); }
    toast(text: string, ms = 3400) { if (this.toastT) clearTimeout(this.toastT); this.set({ toast: { text, n: this.snapshot.version } }); this.toastT = setTimeout(() => this.set({ toast: null }), ms); }

    /* ---------- actions ---------- */
    doAction(id: string, by: "you" | "peer" = "you", peerCity?: string) {
        if (!this.snapshot.booted) return; if (this.snapshot.trace?.running) this.endTrace(); const a = ACTION_BY_ID[id]; const r = this.sim.act(id); if (!a) { this.set({ flags: { ...this.sim.flags } }); return; }
        const flashNode: Record<string, string> = { killWorker: "workers", killDb: "pg", partitionCache: "cache", slowPayments: "razorpay", dropIndex: "pg", singapore: "ride", retryStorm: "gateway" };
        if (this.world && flashNode[id] && a.kind === "chaos") this.world.flash[flashNode[id]] = this.world.time + 1200;
        if (a.kind === "chaos") snd.thud(); else snd.chime();
        const cap = a.toggle && !r ? a.label + " off" : a.caption; this.caption(by === "peer" ? "a visitor in " + (peerCity || "another city") + " · " + cap : cap);
        if (by === "you" && this.presence) this.presence.sendAction(id);
        this.set({ flags: { ...this.sim.flags } });
    }
    setLoad(n: number) { this.sim.load = n; this.set({ load: n }); }
    /* ---------- trace: one request in slow motion, narrated hop by hop ---------- */
    private traceReq: Req | null = null; private traceArm = false; private traceEndT: ReturnType<typeof setTimeout> | null = null; private traceStartReal = 0;
    openTrace() { const was = this.snapshot.traceOpen; this.set({ traceOpen: true, sheet: this.snapshot.mobile ? "trace" : this.snapshot.sheet }); if (!was) this.layout(); }
    closeTrace() { this.endTrace(); this.set({ traceOpen: false, sheet: this.snapshot.mobile && this.snapshot.sheet === "trace" ? "console" : this.snapshot.sheet }); this.layout(); }
    setTraceKind(id: string) { if (TRACE_KIND_BY_ID[id]) this.set({ traceKind: id }); }
    setTraceSpeed(x: number) { this.set({ traceSpeed: x }); if (this.traceReq && this.snapshot.trace?.running) this.sim.speed = x; }
    /** Follows one request. `speed` overrides the dock's setting for this trace only (the tour uses it). */
    trace(kind = this.snapshot.traceKind, speed?: number) {
        if (!this.snapshot.booted) return;
        if (this.sim.you && !this.sim.active.includes(this.sim.you)) this.sim.you = null; // dropped by a reset while in flight
        if (this.sim.you) { this.openTrace(); return; }
        const k = TRACE_KIND_BY_ID[kind] || TRACE_KINDS[0]; if (this.traceEndT) { clearTimeout(this.traceEndT); this.traceEndT = null; }
        const view: TraceView = { kind: k.id, label: k.label, city: this.snapshot.city, running: true, latency: 0, hops: [], lines: [], cur: null, t0: this.sim.now, now: 0 };
        const was = this.snapshot.traceOpen; this.set({ traceOpen: true, traceBusy: true, traceKind: k.id, sheet: this.snapshot.mobile ? "trace" : this.snapshot.sheet, trace: view }); if (!was && this.world) { this.layout(); }
        this.sim.speed = speed ?? this.snapshot.traceSpeed; this.traceArm = true; this.traceStartReal = performance.now();
        const r = this.sim.trace(k.id); this.traceReq = r; this.traceArm = false;
        const path = r.plan.slice(); if (r.type === "ride") path.push("pg", "maps"); if (r.type === "product") path.push("readmodel", "pgr");
        if (this.world) { this.world.tracePath = new Set(path); this.world.fitNodes(path); }
    }
    /** Back to real time. The dock keeps the last trace on screen. */
    endTrace() {
        if (this.traceEndT) { clearTimeout(this.traceEndT); this.traceEndT = null; }
        this.sim.speed = 1; this.traceReq = null; this.traceArm = false; if (this.world) this.world.tracePath = null;
        const tv = this.snapshot.trace; if (tv && tv.running) this.set({ trace: { ...tv, running: false }, traceBusy: false });
    }
    private onHop(r: Req, ev: HopEvent) {
        if (this.traceArm && r.you) { this.traceReq = r; this.traceArm = false; }
        if (r !== this.traceReq) return; const tv = this.snapshot.trace; if (!tv || !tv.running) return;
        const t = Math.round(this.sim.now - tv.t0); const lines = tv.lines.slice(); let hops = tv.hops; let cur = tv.cur; let running = true; let latency = tv.latency; let error = tv.error;
        const push = (text: string | null, kind: TraceLine["kind"] = "info") => { if (text) lines.push({ t, text, kind }); };
        const label = (id: string) => (NODE_BY_ID[id] ? NODE_BY_ID[id].label : id);
        switch (ev.kind) {
            case "arrive": cur = ev.node; push(this.narrateArrive(r, ev)); break;
            case "queued": push(label(ev.node) + ": all " + ev.slots + " threads busy · queued behind " + Math.max(0, (ev.queue || 1) - 1), "warn"); hops = [...hops, { node: ev.node, label: label(ev.node), wait: 0, svc: null, queued: ev.queue }]; break;
            case "serve": {
                const slow = ev.node === "razorpay" && this.sim.now < this.sim.flags.slowUntil; push(this.narrateServe(r, ev), slow ? "warn" : "info");
                const last = hops[hops.length - 1];
                if (last && last.node === ev.node && last.svc === null && last.queued) { hops = hops.slice(0, -1).concat({ ...last, wait: ev.wait || 0 }); if (ev.wait) push(label(ev.node) + ": got a thread after " + ev.wait + " ms", "warn"); }
                else hops = [...hops, { node: ev.node, label: label(ev.node), wait: ev.wait || 0, svc: null }];
                break; }
            case "served": { const i = hops.map((h) => h.node).lastIndexOf(ev.node); if (i >= 0) { hops = hops.slice(); hops[i] = { ...hops[i], svc: ev.svc || 0, wait: ev.wait || hops[i].wait }; } push(this.narrateServed(ev)); break; }
            case "travel": break;
            case "edge-hit": push("CDN hit at the edge: served from bom1 in 2 ms, it never reached the gateway", "ok"); break;
            case "cache-hit": push("DStarDB hit: " + ev.key + " was warm", "ok"); break;
            case "cache-miss": push("DStarDB miss: " + ev.key + " is not in the cache · falling back to " + (r.type === "product" ? "the read model and the replica" : "the ride service and Postgres"), "warn"); break;
            case "dep-fail": push(label(ev.node) + ": " + ev.reason, "err"); break;
            case "fail": running = false; error = ev.reason; latency = Math.round(ev.latency || 0); push("failed after " + latency + " ms · " + ev.reason, "err"); break;
            case "complete": { running = false; latency = Math.round(ev.latency || 0); const svc = hops.reduce((a, h) => a + (h.svc || 0), 0), wait = hops.reduce((a, h) => a + h.wait, 0); const wire = Math.max(0, latency - svc - wait); push("done · " + latency + " ms end to end: " + wire + " ms on the wire, " + wait + " ms waiting for threads, " + svc + " ms of work", "ok"); break; }
        }
        this.set({ trace: { ...tv, hops, lines: lines.slice(-40), cur, running, latency, error, now: t }, traceBusy: running });
        if (!running) { snd.tick(); this.traceEndT = setTimeout(() => this.endTrace(), 1500); }
    }
    private narrateArrive(r: Req, ev: HopEvent): string | null {
        const k = TRACE_KIND_BY_ID[this.snapshot.trace?.kind || "ride"];
        if (ev.node === "users") return (k ? k.verb : "request") + " leaves your device in " + this.snapshot.city + " · request #" + r.id;
        if (ev.node === "cron") return "cron fires · reconciliation batch";
        if (ev.node === "razorpay" && r.type === "job") return "Razorpay calls back · payment.captured webhook";
        return null;
    }
    private narrateServe(r: Req, ev: HopEvent): string {
        const f = this.sim.flags, s = this.sim, n = NODE_BY_ID[ev.node], st = s.nodes[ev.node];
        switch (ev.node) {
            case "edge": return "Edge PoP bom1: TLS terminated · " + (r.type === "product" ? "the CDN checks its cache" : r.type === "checkout" ? "a POST is never cached, straight to the gateway" : r.type === "ws" ? "the WebSocket upgrade passes through" : "rides are per user, so the CDN passes it on");
            case "gateway": return "Gateway: takes thread " + ev.busy + " of " + ev.slots + " and holds it until the response is back" + (f.retries && !f.jitter ? " · naive retries armed" : "");
            case "auth": return "Auth: verifies the JWT signature · no database call";
            case "ride": return (r.trace.some((h) => h.node === "ride") ? "Ride service: back with the row from Postgres" : "Ride service: looks up " + r.key + " · cache first") + (!f.rtdbMumbai ? " · +70 ms, the RTDB is in Singapore" : "");
            case "readmodel": return "Read model: denormalised view for " + r.key + " · cache first";
            case "cache": return s.cacheAlive ? "DStarDB: GET " + r.key + " · 8 threads · " + fmt(s.cache.size) + " keys" : "DStarDB unreachable (partition) · waiting for the 300 ms timeout";
            case "pg": return (f.index ? "Postgres: index seek · pool " + ev.busy + " / " + ev.slots : "Postgres: sequential scan, the index is missing · ×3 service time") + (f.nplus1 ? " · N+1: one query per row" : "");
            case "pgr": return "Replica: the streaming replica takes the read · pool " + ev.busy + " / " + ev.slots;
            case "maps": return f.tokens ? "Google Maps: Places lookup · 1 billed call (session token)" : "Google Maps: 12 billed calls · no session tokens";
            case "payments": return "Payments: creates the order, persists the order id, calls Razorpay";
            case "razorpay": return s.now < f.slowUntil ? "Razorpay: 900 ms today (injected) · the gateway thread waits · timeout at 700 ms" : "Razorpay: external · about 110 ms · the gateway thread waits";
            case "signal": return "Signalling: WebSocket upgrade · STOMP subscribe to /topic/room";
            case "queue": return "Queue: published to 1 of 4 partitions · " + s.nodes.workers.queue.length + " jobs waiting";
            case "workers": return "Worker: pulled the job · " + st.replicas + " replicas × " + (n.threads || 1) + " threads";
            case "storage": return "Object storage: object written";
            default: return n.label + ": serving";
        }
    }
    private narrateServed(ev: HopEvent): string | null {
        if (ev.node === "cache" || ev.node === "pg" || ev.node === "pgr" || ev.node === "maps" || ev.node === "razorpay") return NODE_BY_ID[ev.node].label + ": " + ev.svc + " ms";
        return null;
    }
    exec(cmd: string) { return this.sim.exec(cmd); }
    sendMessage(payload: { name: string; email: string; message: string }, onDone: () => void) {
        this.msgCallback = () => { this.msgCallback = null; onDone(); const url = (process.env.NEXT_PUBLIC_APP_URL || "") + "/api/contact"; fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => {}); };
        this.sim.spawn("msg", { plan: ["users", "edge", "gateway", "queue", "workers", "storage"], msg: true, isRead: false });
        this.caption("your message is in the queue · watch the workers", 5000); this.closePanel(); this.focus("workers", 1.8);
    }

    /* ---------- camera / panels ---------- */
    fit() { this.world?.fit(); }
    focus(id: string, scale = 2.4) { this.world?.focus(id, scale); }
    selectNode(id: string) { if (this.world) this.world.selected = id; this.openPanel("node", id); }
    setHighlight(nodes: string[] | null) { if (this.world) this.world.highlight = nodes ? new Set(nodes) : null; }
    openPanel(name: PanelName, arg?: string) { this.set({ panel: { name, arg }, sheet: this.snapshot.mobile ? "panel" : this.snapshot.sheet }); }
    closePanel() { if (this.world) this.world.selected = null; this.set({ panel: null, sheet: this.snapshot.mobile && this.snapshot.sheet === "panel" ? "console" : this.snapshot.sheet }); }
    toggleRail() { this.set({ railHidden: !this.snapshot.railHidden }); setTimeout(() => this.layout(), 0); }
    setSheet(sheet: Sheet) { this.set({ sheet }); }
    setSound(on: boolean) { if (on === this.snapshot.sound) return; setSoundEnabled(on); this.set({ sound: on }); }
    nodeLive(id: string): [string, string][] {
        const n = NODE_BY_ID[id]; const st = this.sim.nodes[id]; const s = this.sim; const m: [string, string][] = [];
        if (n.kind !== "users" && n.kind !== "ctl") m.push(["utilisation", Math.round(st.util * 100) + " %"], ["busy", st.busy + " / " + s.slots(st)], ["queued", String(st.queue.length)], ["served", fmt(st.served)], ["errors", fmt(st.errors)]);
        if (n.replicas) m.push(["replicas", st.replicas + (st.provisioningUntil ? " (+1 provisioning)" : "")]);
        if (id === "cache") m.push(["keys", fmt(s.cache.size)], ["hit rate", Math.round(s.metrics.cacheHit * 100) + " %"], ["reachable", s.cacheAlive ? "yes" : "no · partition"]);
        if (id === "pg") m.push(["index", s.flags.index ? "present" : "MISSING"], ["primary", st.alive ? (st.promoted ? "promoted replica" : "up") : "DOWN"]);
        if (id === "gateway") m.push(["circuit breakers", s.flags.breaker ? "armed" : "off"], ["retries", s.flags.retries ? (s.flags.jitter ? "budget + jitter" : "naive") : "off"]);
        if (id === "razorpay") m.push(["latency", s.now < s.flags.slowUntil ? "900 ms (injected)" : "110 ms"], ["breaker", s.breakers.razorpay.state]);
        if (id === "maps") m.push(["billed calls / ride", s.flags.tokens ? "1" : "12"], ["cost / ride", "₹" + s.metrics.costPerRide]);
        if (id === "ride") m.push(["rtdb region", s.flags.rtdbMumbai ? "asia-south1 · Mumbai" : "asia-southeast1 · Singapore (+70 ms)"]);
        if (id === "users") m.push(["load", fmt(s.load) + " rps"], ["in flight", fmt(s.metrics.concurrency)]);
        return m;
    }

    /* ---------- scenarios ---------- */
    startScenario(id: string) {
        const sc = SCENARIOS.find((s) => s.id === id); if (!sc) return;
        this.endTrace(); this.sim.act("heal"); this.sim.applySetup(sc.setup); for (const a of sc.pre || []) this.sim.act(a); this.fit(); this.set({ scenario: { id, step: 0, p99Start: null }, panel: { name: "work" }, flags: { ...this.sim.flags } });
        this.caption(sc.title + " · the system is now in the broken state · press next", 6000);
        setTimeout(() => { const s = this.snapshot.scenario; if (s && s.id === id && s.p99Start == null) this.set({ scenario: { ...s, p99Start: this.sim.metrics.p99 } }); }, 5000);
    }
    nextStep() {
        const s = this.snapshot.scenario; if (!s) return; const sc = SCENARIOS.find((x) => x.id === s.id); if (!sc) return;
        if (s.step >= sc.steps.length) { this.set({ scenario: null, panel: { name: "work" } }); return; }
        const st = sc.steps[s.step];
        const act = st.action;
        if (act === "trace" || act.startsWith("trace:")) this.trace(act.split(":")[1] || "ride");
        else if (act.startsWith("focus:")) this.focus(act.slice(6), 2.2);
        else if (act !== "wait") this.doAction(act);
        this.caption(st.caption, 7000); this.set({ scenario: { ...s, step: s.step + 1 } });
    }
    stopScenario() { this.set({ scenario: null, panel: { name: "work" } }); this.sim.act("heal"); this.set({ flags: { ...this.sim.flags } }); }

    /* ---------- tour ---------- */
    startTour() {
        this.stopTour(); this.closePanel(); this.endTrace(); this.set({ tour: true }); let i = 0;
        const step = () => { if (!this.snapshot.tour) return; const s = TOUR[i]; if (!s) { this.stopTour(); this.caption("end of tour · the console is yours", 4000); return; } if (i !== 1 && this.snapshot.traceOpen) this.closeTrace(); s.f(this); this.caption(s.c, s.w - 300); i++; this.tourT = setTimeout(step, s.w); };
        step();
    }
    stopTour() { if (this.tourT) clearTimeout(this.tourT); this.tourT = null; if (this.snapshot.tour) { this.set({ tour: false }); if (this.snapshot.traceOpen) this.closeTrace(); } }

    /* ---------- presence, ghosts, records ---------- */
    private startPresence() {
        if (process.env.NEXT_PUBLIC_ROOM_PRESENCE === "off" || this.presence) return;
        const p = new PresenceClient({
            city: this.snapshot.city,
            onPeers: (peers) => { this.ghostsOn = peers.length < 2; this.set({ peersText: peers.length ? "you + " + peers.length + " here · live" : "alone here · live" }); },
            onAction: (a) => { if (ACTION_BY_ID[a.action]) { this.doAction(a.action, "peer", a.city); } },
            onRecords: (r) => this.set({ shared: r }),
        });
        this.presence = p;
    }
    private ghosts() {
        const w = this.world; if (!w) return; if (!this.ghostsOn || !this.snapshot.booted) { w.ghosts = []; return; }
        const t = w.time / 1000;
        w.ghosts = GHOSTS.map((g, i) => { const p = g.path; const u = (t * 0.06 + i * 0.37) % 1; const seg = u * (p.length - 1); const k = Math.min(p.length - 2, Math.floor(seg)); const f = seg - k; const a = p[k], b = p[k + 1]; return { x: a[0] + (b[0] - a[0]) * f + Math.sin(t * 1.3 + i) * 14, y: a[1] + (b[1] - a[1]) * f + Math.cos(t * 1.1 + i) * 10, label: "ghost · " + g.city + " · " + g.ago, ghost: true }; });
    }
    private loadRecords() { let r: Partial<LocalRecords> = {}; try { r = JSON.parse(localStorage.getItem("cr.records") || "{}"); } catch { /* optional */ } const records = { ...this.snapshot.records, ...r, visits: (r.visits || 0) + 1 }; this.set({ records }); this.saveRecords(records); }
    private saveRecords(r: LocalRecords) { try { localStorage.setItem("cr.records", JSON.stringify(r)); } catch { /* optional */ } }
    private mergeRecords() {
        const r = this.sim.records, u = this.snapshot.records; let ch = false; const next = { ...u };
        if (r.maxRps > u.maxRps) { next.maxRps = r.maxRps; ch = true; this.presence?.sendRecord("maxRps", r.maxRps); }
        if (r.longestOutage > u.longestOutage) { next.longestOutage = r.longestOutage; ch = true; this.presence?.sendRecord("longestOutage", r.longestOutage); }
        if (r.fastestRecovery && (!u.fastestRecovery || r.fastestRecovery < u.fastestRecovery)) { next.fastestRecovery = r.fastestRecovery; ch = true; this.presence?.sendRecord("fastestRecovery", r.fastestRecovery); }
        if (ch) { this.set({ records: next }); this.saveRecords(next); }
    }
}
