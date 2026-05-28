// Signaling store for the WebRTC demo. Two interchangeable backends:
//
// 1. UpstashStore — Redis over REST. Production-ready, works across
//    Vercel function instances. Activated when both
//    UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set.
//
// 2. InMemoryStore — Map-backed. Fine for `next dev` (single process)
//    and a single warm Vercel function instance. Logs a clear warning
//    on activation so a deployed-without-env state is obvious.
//
// The shared interface (join / leave / send / poll) lets the route
// handler stay backend-agnostic.

import { Redis } from "@upstash/redis";

const TTL_SECONDS = 30 * 60;
const MAX_PEERS_PER_ROOM = 2;
const MAX_MSGS_PER_ROOM = 500;

// ---------- In-memory fallback ----------

class InMemoryStore {
    constructor() {
        const g = globalThis;
        if (!g.__wrtcRooms) g.__wrtcRooms = new Map();
        this.rooms = g.__wrtcRooms;
        this.kind = "in-memory";
    }

    _reapStale() {
        const cutoff = Date.now() - TTL_SECONDS * 1000;
        for (const [id, r] of this.rooms) {
            if (r.touched < cutoff) this.rooms.delete(id);
        }
    }

    async join(roomId, peerId, password) {
        this._reapStale();
        let room = this.rooms.get(roomId);
        if (!room) {
            room = {
                password: password || "",
                peers: new Set(),
                msgs: [],
                createdAt: Date.now(),
                touched: Date.now(),
            };
            this.rooms.set(roomId, room);
        }
        if (room.password && room.password !== (password || "")) {
            return { ok: false, error: "wrong-password" };
        }
        if (room.peers.size >= MAX_PEERS_PER_ROOM && !room.peers.has(peerId)) {
            return { ok: false, error: "room-full" };
        }
        room.peers.add(peerId);
        room.touched = Date.now();
        return {
            ok: true,
            peers: Array.from(room.peers),
            cursor: room.msgs.length,
        };
    }

    async leave(roomId, peerId) {
        const room = this.rooms.get(roomId);
        if (!room) return { ok: true };
        room.peers.delete(peerId);
        if (room.peers.size === 0) this.rooms.delete(roomId);
        return { ok: true };
    }

    async send(roomId, peerId, password, message) {
        const room = this.rooms.get(roomId);
        if (!room) return { ok: false, error: "room-not-found" };
        if (room.password && room.password !== (password || "")) {
            return { ok: false, error: "wrong-password" };
        }
        if (!room.peers.has(peerId)) {
            return { ok: false, error: "not-in-room" };
        }
        room.msgs.push({ from: peerId, ...message });
        if (room.msgs.length > MAX_MSGS_PER_ROOM) room.msgs.shift();
        room.touched = Date.now();
        return { ok: true };
    }

    async poll(roomId, peerId, password, cursor, timeoutMs) {
        const deadline = Date.now() + timeoutMs;
        let scanCursor = cursor;
        while (Date.now() < deadline) {
            const room = this.rooms.get(roomId);
            if (!room) {
                await sleep(200);
                continue;
            }
            if (room.password && room.password !== (password || "")) {
                return { ok: false, error: "wrong-password" };
            }
            if (room.msgs.length > scanCursor) {
                const slice = room.msgs.slice(scanCursor);
                const filtered = slice.filter(
                    (m) =>
                        m.from !== peerId && (!m.to || m.to === peerId),
                );
                scanCursor = room.msgs.length;
                if (filtered.length > 0) {
                    return {
                        ok: true,
                        messages: filtered,
                        cursor: scanCursor,
                        peers: Array.from(room.peers),
                    };
                }
            }
            await sleep(100);
        }
        const room = this.rooms.get(roomId);
        return {
            ok: true,
            messages: [],
            cursor: room ? room.msgs.length : cursor,
            peers: room ? Array.from(room.peers) : [],
        };
    }
}

// ---------- Upstash Redis ----------

class UpstashStore {
    constructor(url, token) {
        this.redis = new Redis({ url, token });
        this.kind = "upstash";
    }

    _key(roomId, kind) {
        return `wrtc:room:${roomId}:${kind}`;
    }

    async _check(roomId, password) {
        const meta = await this.redis.hgetall(this._key(roomId, "meta"));
        const existing = meta?.password ?? null;
        if (
            existing != null &&
            existing !== "" &&
            existing !== (password || "")
        ) {
            return { ok: false, error: "wrong-password" };
        }
        return { ok: true, meta };
    }

    async join(roomId, peerId, password) {
        const check = await this._check(roomId, password);
        if (!check.ok) return check;
        const peersKey = this._key(roomId, "peers");
        const metaKey = this._key(roomId, "meta");
        const msgsKey = this._key(roomId, "msgs");

        const existingPeers = await this.redis.smembers(peersKey);
        if (
            existingPeers.length >= MAX_PEERS_PER_ROOM &&
            !existingPeers.includes(peerId)
        ) {
            return { ok: false, error: "room-full" };
        }
        if (!check.meta || Object.keys(check.meta).length === 0) {
            await this.redis.hset(metaKey, {
                password: password || "",
                createdAt: Date.now(),
            });
        }
        await this.redis.sadd(peersKey, peerId);
        await Promise.all([
            this.redis.expire(metaKey, TTL_SECONDS),
            this.redis.expire(peersKey, TTL_SECONDS),
        ]);
        const [peers, cursor] = await Promise.all([
            this.redis.smembers(peersKey),
            this.redis.llen(msgsKey).then((n) => n || 0),
        ]);
        return { ok: true, peers, cursor };
    }

    async leave(roomId, peerId) {
        await this.redis.srem(this._key(roomId, "peers"), peerId);
        return { ok: true };
    }

    async send(roomId, peerId, password, message) {
        const check = await this._check(roomId, password);
        if (!check.ok) return check;
        const peersKey = this._key(roomId, "peers");
        const msgsKey = this._key(roomId, "msgs");
        const peers = await this.redis.smembers(peersKey);
        if (!peers.includes(peerId)) {
            return { ok: false, error: "not-in-room" };
        }
        await this.redis.rpush(
            msgsKey,
            JSON.stringify({ from: peerId, ...message }),
        );
        await this.redis.ltrim(msgsKey, -MAX_MSGS_PER_ROOM, -1);
        await this.redis.expire(msgsKey, TTL_SECONDS);
        return { ok: true };
    }

    async poll(roomId, peerId, password, cursor, timeoutMs) {
        const check = await this._check(roomId, password);
        if (!check.ok) return check;
        const msgsKey = this._key(roomId, "msgs");
        const peersKey = this._key(roomId, "peers");
        const deadline = Date.now() + timeoutMs;
        let scanCursor = cursor;
        while (Date.now() < deadline) {
            const len = (await this.redis.llen(msgsKey)) || 0;
            if (len > scanCursor) {
                const raw = await this.redis.lrange(
                    msgsKey,
                    scanCursor,
                    len - 1,
                );
                const filtered = raw
                    .map((s) => (typeof s === "string" ? JSON.parse(s) : s))
                    .filter(
                        (m) =>
                            m.from !== peerId &&
                            (!m.to || m.to === peerId),
                    );
                scanCursor = len;
                if (filtered.length > 0) {
                    const peers = await this.redis.smembers(peersKey);
                    return {
                        ok: true,
                        messages: filtered,
                        cursor: scanCursor,
                        peers,
                    };
                }
            }
            // Upstash REST has per-call latency, so a 250ms inner-loop
            // sleep keeps us under the free-tier command budget while
            // still surfacing messages within ~250ms.
            await sleep(250);
        }
        const [len, peers] = await Promise.all([
            this.redis.llen(msgsKey).then((n) => n || 0),
            this.redis.smembers(peersKey),
        ]);
        return { ok: true, messages: [], cursor: len, peers };
    }
}

// ---------- Factory ----------

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

let storeInstance = null;
export function getStore() {
    if (storeInstance) return storeInstance;
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (url && token) {
        console.log("[signaling] using Upstash Redis store");
        storeInstance = new UpstashStore(url, token);
    } else {
        console.warn(
            "[signaling] UPSTASH_REDIS_REST_URL/_TOKEN not set — using " +
                "in-memory store. Cross-device rooms only work locally " +
                "or on a single warm Vercel instance. Add Upstash creds " +
                "for production cross-instance routing.",
        );
        storeInstance = new InMemoryStore();
    }
    return storeInstance;
}
