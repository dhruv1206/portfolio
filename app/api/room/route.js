// Presence and records for the control room.
//
// One request does both directions: the client posts its own cursor
// (world coordinates) and optional chaos action, and gets back everyone
// else present, the actions since its last poll, and the shared board.
//
// Backend: Upstash Redis when UPSTASH_REDIS_REST_URL/_TOKEN are set
// (works across Vercel function instances), otherwise an in-memory map
// that is fine for `next dev` and a single warm instance. Clients poll
// every 3 s while visible, so a visitor costs roughly 20 commands a
// minute on Upstash: well inside the free tier.

import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const PEER_TTL_MS = 15_000;
const ACTION_KEEP = 40;
const RECORD_KEYS = ["maxRps", "longestOutage", "fastestRecovery"];

function clean(str, max) { return typeof str === "string" ? str.replace(/[^\w .\-·]/g, "").slice(0, max) : ""; }
function num(v, lo, hi) { const n = Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : 0; }

class MemoryRoom {
    constructor() { const g = globalThis; if (!g.__crRoom) g.__crRoom = { peers: new Map(), actions: [], records: {} }; this.s = g.__crRoom; }
    async touch(peer) { this.s.peers.set(peer.id, { ...peer, at: Date.now() }); const cutoff = Date.now() - PEER_TTL_MS; for (const [id, p] of this.s.peers) if (p.at < cutoff) this.s.peers.delete(id); return Array.from(this.s.peers.values()); }
    async pushAction(a) { this.s.actions.push(a); if (this.s.actions.length > ACTION_KEEP) this.s.actions.shift(); }
    async actionsSince(t) { return this.s.actions.filter((a) => a.at > t); }
    async records() { return this.s.records; }
    async record(metric, value, city) { const cur = this.s.records[metric]; const better = metric === "fastestRecovery" ? !cur || value < cur.value : !cur || value > cur.value; if (better) this.s.records[metric] = { value, city, at: Date.now() }; }
}

class UpstashRoom {
    constructor(url, token) { this.r = new Redis({ url, token }); }
    async touch(peer) {
        const now = Date.now();
        await this.r.hset("cr:peers", { [peer.id]: JSON.stringify({ ...peer, at: now }) });
        await this.r.expire("cr:peers", 120);
        const all = await this.r.hgetall("cr:peers");
        const peers = []; const stale = [];
        for (const [id, raw] of Object.entries(all || {})) { const p = typeof raw === "string" ? JSON.parse(raw) : raw; if (now - p.at > PEER_TTL_MS) stale.push(id); else peers.push(p); }
        if (stale.length) await this.r.hdel("cr:peers", ...stale);
        return peers;
    }
    async pushAction(a) { await this.r.rpush("cr:actions", JSON.stringify(a)); await this.r.ltrim("cr:actions", -ACTION_KEEP, -1); await this.r.expire("cr:actions", 600); }
    async actionsSince(t) { const raw = await this.r.lrange("cr:actions", 0, -1); return raw.map((s) => (typeof s === "string" ? JSON.parse(s) : s)).filter((a) => a.at > t); }
    async records() { const all = await this.r.hgetall("cr:records"); const out = {}; for (const [k, v] of Object.entries(all || {})) out[k] = typeof v === "string" ? JSON.parse(v) : v; return out; }
    async record(metric, value, city) { const cur = (await this.records())[metric]; const better = metric === "fastestRecovery" ? !cur || value < cur.value : !cur || value > cur.value; if (better) await this.r.hset("cr:records", { [metric]: JSON.stringify({ value, city, at: Date.now() }) }); }
}

let room = null;
function getRoom() {
    if (room) return room;
    const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
    room = url && token ? new UpstashRoom(url, token) : new MemoryRoom();
    return room;
}

export async function POST(request) {
    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
    const id = clean(body.id, 24); if (!id) return NextResponse.json({ ok: false }, { status: 400 });
    const store = getRoom();
    const me = { id, x: num(body.x, -500, 2500), y: num(body.y, -500, 2000), city: clean(body.city, 32) || "somewhere" };
    const since = num(body.since, 0, Number.MAX_SAFE_INTEGER);
    if (body.action) { const action = clean(body.action, 24); if (action) await store.pushAction({ id, action, city: me.city, at: Date.now() }); }
    if (body.record && RECORD_KEYS.includes(body.record.metric)) { const v = num(body.record.value, 0, 1e6); if (v > 0) await store.record(body.record.metric, v, me.city); }
    const [peers, actions, records] = await Promise.all([store.touch(me), store.actionsSince(since), store.records()]);
    return NextResponse.json({ ok: true, now: Date.now(), peers: peers.filter((p) => p.id !== id).map((p) => ({ id: p.id, x: p.x, y: p.y, city: p.city })), actions: actions.filter((a) => a.id !== id), records }, { headers: { "Cache-Control": "no-store" } });
}
