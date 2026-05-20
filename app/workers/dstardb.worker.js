// DStarDB REPL worker.
//
// In-browser Redis-style key-value store mirroring the C++ project's
// command surface. Strings, hashes, lists, sorted sets, TTL, multi-key
// ops, and a BENCH command that measures throughput + p50/p99/p999.
//
// Receives { id, cmd, args } over postMessage; replies with
// { id, result, latency (microseconds), error }.

// ---- store ------------------------------------------------------------

const TYPE_STRING = "string";
const TYPE_HASH = "hash";
const TYPE_LIST = "list";
const TYPE_ZSET = "zset";

const store = new Map(); // key -> { type, value, expireAt? }
let startedAt = Date.now();
let stats = {
    commandsProcessed: 0,
    hits: 0,
    misses: 0,
    benchRuns: 0,
};

function getEntry(key) {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expireAt != null && entry.expireAt < Date.now()) {
        store.delete(key);
        return null;
    }
    return entry;
}

function setEntry(key, type, value, ttlMs) {
    store.set(key, {
        type,
        value,
        expireAt: ttlMs != null ? Date.now() + ttlMs : null,
    });
}

function assertType(entry, type) {
    if (entry.type !== type) {
        throw new Error(
            `WRONGTYPE Operation against a key holding the wrong kind of value`,
        );
    }
}

// Glob-style KEYS pattern matcher (Redis subset: *, ?, [chars]).
function globToRegExp(pattern) {
    let out = "^";
    for (let i = 0; i < pattern.length; i++) {
        const c = pattern[i];
        if (c === "*") out += ".*";
        else if (c === "?") out += ".";
        else if (c === "[") {
            const end = pattern.indexOf("]", i);
            if (end === -1) {
                out += "\\[";
            } else {
                out += "[" + pattern.slice(i + 1, end) + "]";
                i = end;
            }
        } else if (/[\\^$.+()|{}]/.test(c)) {
            out += "\\" + c;
        } else {
            out += c;
        }
    }
    return new RegExp(out + "$");
}

// ---- command handlers ----------------------------------------------------

const handlers = {
    PING(args) {
        return args[0] != null ? args[0] : "PONG";
    },

    INFO() {
        const uptimeS = ((Date.now() - startedAt) / 1000).toFixed(1);
        const memBytes = JSON.stringify([...store.entries()]).length;
        const types = { string: 0, hash: 0, list: 0, zset: 0 };
        for (const v of store.values()) types[v.type]++;
        return [
            "# Server",
            "dstardb_version:0.1.0 (browser/JS)",
            "process_id:worker",
            `uptime_in_seconds:${uptimeS}`,
            "",
            "# Memory",
            `used_memory_bytes:${memBytes}`,
            `used_memory_human:${(memBytes / 1024).toFixed(1)}K`,
            "",
            "# Stats",
            `total_commands_processed:${stats.commandsProcessed}`,
            `keyspace_hits:${stats.hits}`,
            `keyspace_misses:${stats.misses}`,
            `bench_runs:${stats.benchRuns}`,
            "",
            "# Keyspace",
            `db0:keys=${store.size},strings=${types.string},hashes=${types.hash},lists=${types.list},zsets=${types.zset}`,
        ].join("\n");
    },

    // ---- strings --------------------------------------------------------

    SET(args) {
        if (args.length < 2) {
            throw new Error("wrong number of arguments for 'set' command");
        }
        const [key, value, ...rest] = args;
        let ttlMs = null;
        for (let i = 0; i < rest.length; i++) {
            const flag = rest[i].toUpperCase();
            if (flag === "EX") ttlMs = parseInt(rest[++i], 10) * 1000;
            else if (flag === "PX") ttlMs = parseInt(rest[++i], 10);
        }
        setEntry(key, TYPE_STRING, value, ttlMs);
        return "OK";
    },

    GET(args) {
        if (args.length !== 1) {
            throw new Error("wrong number of arguments for 'get' command");
        }
        const entry = getEntry(args[0]);
        if (!entry) {
            stats.misses++;
            return null;
        }
        assertType(entry, TYPE_STRING);
        stats.hits++;
        return entry.value;
    },

    DEL(args) {
        let count = 0;
        for (const key of args) if (store.delete(key)) count++;
        return count;
    },

    EXISTS(args) {
        let count = 0;
        for (const key of args) if (getEntry(key)) count++;
        return count;
    },

    INCR(args) {
        const entry = getEntry(args[0]);
        const current = entry ? parseInt(entry.value, 10) : 0;
        if (entry && Number.isNaN(current)) {
            throw new Error("value is not an integer or out of range");
        }
        const next = current + 1;
        setEntry(args[0], TYPE_STRING, String(next));
        return next;
    },

    DECR(args) {
        const entry = getEntry(args[0]);
        const current = entry ? parseInt(entry.value, 10) : 0;
        if (entry && Number.isNaN(current)) {
            throw new Error("value is not an integer or out of range");
        }
        const next = current - 1;
        setEntry(args[0], TYPE_STRING, String(next));
        return next;
    },

    INCRBY(args) {
        const [key, byStr] = args;
        const by = parseInt(byStr, 10);
        if (Number.isNaN(by)) throw new Error("value is not an integer");
        const entry = getEntry(key);
        const current = entry ? parseInt(entry.value, 10) : 0;
        if (entry && Number.isNaN(current)) {
            throw new Error("value is not an integer or out of range");
        }
        const next = current + by;
        setEntry(key, TYPE_STRING, String(next));
        return next;
    },

    EXPIRE(args) {
        const [key, secondsStr] = args;
        const seconds = parseInt(secondsStr, 10);
        const entry = store.get(key);
        if (!entry) return 0;
        entry.expireAt = Date.now() + seconds * 1000;
        return 1;
    },

    TTL(args) {
        const entry = store.get(args[0]);
        if (!entry) return -2;
        if (entry.expireAt == null) return -1;
        const remaining = entry.expireAt - Date.now();
        if (remaining < 0) {
            store.delete(args[0]);
            return -2;
        }
        return Math.ceil(remaining / 1000);
    },

    MSET(args) {
        if (args.length === 0 || args.length % 2 !== 0) {
            throw new Error("wrong number of arguments for 'mset' command");
        }
        for (let i = 0; i < args.length; i += 2) {
            setEntry(args[i], TYPE_STRING, args[i + 1]);
        }
        return "OK";
    },

    MGET(args) {
        return args.map((k) => {
            const entry = getEntry(k);
            if (!entry || entry.type !== TYPE_STRING) return null;
            return entry.value;
        });
    },

    KEYS(args) {
        const pattern = args[0] || "*";
        const re = globToRegExp(pattern);
        const out = [];
        for (const key of store.keys()) {
            if (re.test(key) && getEntry(key)) out.push(key);
        }
        return out;
    },

    TYPE(args) {
        const entry = getEntry(args[0]);
        return entry ? entry.type : "none";
    },

    DBSIZE() {
        return store.size;
    },

    FLUSHALL() {
        store.clear();
        stats = { commandsProcessed: 0, hits: 0, misses: 0, benchRuns: 0 };
        startedAt = Date.now();
        return "OK";
    },

    // ---- hashes ---------------------------------------------------------

    HSET(args) {
        const [key, ...rest] = args;
        if (rest.length < 2 || rest.length % 2 !== 0) {
            throw new Error("wrong number of arguments for 'hset' command");
        }
        let entry = getEntry(key);
        if (entry) assertType(entry, TYPE_HASH);
        else {
            entry = { type: TYPE_HASH, value: new Map(), expireAt: null };
            store.set(key, entry);
        }
        let added = 0;
        for (let i = 0; i < rest.length; i += 2) {
            if (!entry.value.has(rest[i])) added++;
            entry.value.set(rest[i], rest[i + 1]);
        }
        return added;
    },

    HGET(args) {
        const entry = getEntry(args[0]);
        if (!entry) return null;
        assertType(entry, TYPE_HASH);
        return entry.value.get(args[1]) ?? null;
    },

    HDEL(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_HASH);
        let removed = 0;
        for (let i = 1; i < args.length; i++) {
            if (entry.value.delete(args[i])) removed++;
        }
        if (entry.value.size === 0) store.delete(args[0]);
        return removed;
    },

    HEXISTS(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_HASH);
        return entry.value.has(args[1]) ? 1 : 0;
    },

    HKEYS(args) {
        const entry = getEntry(args[0]);
        if (!entry) return [];
        assertType(entry, TYPE_HASH);
        return [...entry.value.keys()];
    },

    HVALS(args) {
        const entry = getEntry(args[0]);
        if (!entry) return [];
        assertType(entry, TYPE_HASH);
        return [...entry.value.values()];
    },

    HGETALL(args) {
        const entry = getEntry(args[0]);
        if (!entry) return [];
        assertType(entry, TYPE_HASH);
        const out = [];
        for (const [k, v] of entry.value) out.push(k, v);
        return out;
    },

    HLEN(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_HASH);
        return entry.value.size;
    },

    // ---- lists ----------------------------------------------------------

    LPUSH(args) {
        const [key, ...values] = args;
        let entry = getEntry(key);
        if (entry) assertType(entry, TYPE_LIST);
        else {
            entry = { type: TYPE_LIST, value: [], expireAt: null };
            store.set(key, entry);
        }
        for (const v of values) entry.value.unshift(v);
        return entry.value.length;
    },

    RPUSH(args) {
        const [key, ...values] = args;
        let entry = getEntry(key);
        if (entry) assertType(entry, TYPE_LIST);
        else {
            entry = { type: TYPE_LIST, value: [], expireAt: null };
            store.set(key, entry);
        }
        for (const v of values) entry.value.push(v);
        return entry.value.length;
    },

    LPOP(args) {
        const entry = getEntry(args[0]);
        if (!entry) return null;
        assertType(entry, TYPE_LIST);
        const out = entry.value.shift() ?? null;
        if (entry.value.length === 0) store.delete(args[0]);
        return out;
    },

    RPOP(args) {
        const entry = getEntry(args[0]);
        if (!entry) return null;
        assertType(entry, TYPE_LIST);
        const out = entry.value.pop() ?? null;
        if (entry.value.length === 0) store.delete(args[0]);
        return out;
    },

    LLEN(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_LIST);
        return entry.value.length;
    },

    LRANGE(args) {
        const entry = getEntry(args[0]);
        if (!entry) return [];
        assertType(entry, TYPE_LIST);
        const len = entry.value.length;
        let start = parseInt(args[1], 10);
        let stop = parseInt(args[2], 10);
        if (start < 0) start = Math.max(0, len + start);
        if (stop < 0) stop = len + stop;
        return entry.value.slice(start, stop + 1);
    },

    LINDEX(args) {
        const entry = getEntry(args[0]);
        if (!entry) return null;
        assertType(entry, TYPE_LIST);
        let i = parseInt(args[1], 10);
        if (i < 0) i = entry.value.length + i;
        return entry.value[i] ?? null;
    },

    // ---- sorted sets ----------------------------------------------------

    ZADD(args) {
        const [key, ...rest] = args;
        if (rest.length === 0 || rest.length % 2 !== 0) {
            throw new Error("wrong number of arguments for 'zadd' command");
        }
        let entry = getEntry(key);
        if (entry) assertType(entry, TYPE_ZSET);
        else {
            entry = { type: TYPE_ZSET, value: new Map(), expireAt: null };
            store.set(key, entry);
        }
        let added = 0;
        for (let i = 0; i < rest.length; i += 2) {
            const score = parseFloat(rest[i]);
            const member = rest[i + 1];
            if (!entry.value.has(member)) added++;
            entry.value.set(member, score);
        }
        return added;
    },

    ZSCORE(args) {
        const entry = getEntry(args[0]);
        if (!entry) return null;
        assertType(entry, TYPE_ZSET);
        const s = entry.value.get(args[1]);
        return s == null ? null : String(s);
    },

    ZRANGE(args) {
        const entry = getEntry(args[0]);
        if (!entry) return [];
        assertType(entry, TYPE_ZSET);
        const withScores = args
            .slice(3)
            .some((s) => s.toUpperCase() === "WITHSCORES");
        const sorted = [...entry.value.entries()].sort((a, b) => a[1] - b[1]);
        const len = sorted.length;
        let start = parseInt(args[1], 10);
        let stop = parseInt(args[2], 10);
        if (start < 0) start = Math.max(0, len + start);
        if (stop < 0) stop = len + stop;
        const slice = sorted.slice(start, stop + 1);
        if (withScores) {
            const out = [];
            for (const [m, s] of slice) out.push(m, String(s));
            return out;
        }
        return slice.map(([m]) => m);
    },

    ZREM(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_ZSET);
        let removed = 0;
        for (let i = 1; i < args.length; i++) {
            if (entry.value.delete(args[i])) removed++;
        }
        if (entry.value.size === 0) store.delete(args[0]);
        return removed;
    },

    ZCARD(args) {
        const entry = getEntry(args[0]);
        if (!entry) return 0;
        assertType(entry, TYPE_ZSET);
        return entry.value.size;
    },

    // ---- benchmark ------------------------------------------------------

    BENCH(args) {
        // BENCH <cmd> <count>   e.g. BENCH SET 100000
        const cmd = (args[0] || "SET").toUpperCase();
        const count = Math.max(100, Math.min(parseInt(args[1] || "10000", 10), 1_000_000));
        if (!["SET", "GET", "HSET", "HGET", "LPUSH", "INCR"].includes(cmd)) {
            throw new Error(`BENCH does not support ${cmd}`);
        }

        // Pre-seed for read benchmarks.
        if (cmd === "GET" || cmd === "HGET") {
            for (let i = 0; i < 10_000; i++) {
                if (cmd === "GET") {
                    store.set(`bench:k${i}`, {
                        type: TYPE_STRING,
                        value: `v${i}`,
                        expireAt: null,
                    });
                } else {
                    let entry = store.get("bench:hash");
                    if (!entry) {
                        entry = { type: TYPE_HASH, value: new Map(), expireAt: null };
                        store.set("bench:hash", entry);
                    }
                    entry.value.set(`f${i}`, `v${i}`);
                }
            }
        }

        const latenciesNs = new Float64Array(count);
        const start = performance.now();
        for (let i = 0; i < count; i++) {
            const t0 = performance.now();
            switch (cmd) {
                case "SET":
                    store.set(`bench:k${i}`, {
                        type: TYPE_STRING,
                        value: `value-${i}`,
                        expireAt: null,
                    });
                    break;
                case "GET": {
                    const entry = store.get(`bench:k${i % 10_000}`);
                    if (entry) entry.value;
                    break;
                }
                case "INCR": {
                    const entry = store.get(`bench:counter`);
                    const cur = entry ? parseInt(entry.value, 10) : 0;
                    store.set(`bench:counter`, {
                        type: TYPE_STRING,
                        value: String(cur + 1),
                        expireAt: null,
                    });
                    break;
                }
                case "LPUSH": {
                    let entry = store.get(`bench:list`);
                    if (!entry) {
                        entry = { type: TYPE_LIST, value: [], expireAt: null };
                        store.set(`bench:list`, entry);
                    }
                    entry.value.unshift(`v${i}`);
                    break;
                }
                case "HSET": {
                    let entry = store.get(`bench:h`);
                    if (!entry) {
                        entry = {
                            type: TYPE_HASH,
                            value: new Map(),
                            expireAt: null,
                        };
                        store.set(`bench:h`, entry);
                    }
                    entry.value.set(`f${i}`, `v${i}`);
                    break;
                }
                case "HGET": {
                    const entry = store.get(`bench:hash`);
                    if (entry) entry.value.get(`f${i % 10_000}`);
                    break;
                }
            }
            latenciesNs[i] = (performance.now() - t0) * 1000; // micros
        }
        const totalMs = performance.now() - start;

        // Sort once for percentile lookup.
        latenciesNs.sort();
        const p = (q) => latenciesNs[Math.min(count - 1, Math.floor(count * q))];

        stats.benchRuns++;

        // Reference numbers (single-threaded localhost loopback on a 2024
        // M-series Mac; sourced from the redis-benchmark tool's typical
        // output and noted on the project README).
        const redisRef = {
            SET: 145_000,
            GET: 178_000,
            INCR: 162_000,
            LPUSH: 138_000,
            HSET: 121_000,
            HGET: 156_000,
        };

        const opsPerSec = Math.round(count / (totalMs / 1000));

        return {
            __bench: true,
            cmd,
            count,
            totalMs: Number(totalMs.toFixed(2)),
            opsPerSec,
            p50: Number(p(0.5).toFixed(2)),
            p90: Number(p(0.9).toFixed(2)),
            p99: Number(p(0.99).toFixed(2)),
            p999: Number(p(0.999).toFixed(2)),
            max: Number(latenciesNs[count - 1].toFixed(2)),
            redisRef: redisRef[cmd] ?? null,
        };
    },

    HELP() {
        return [
            "Strings:  SET key val [EX sec] | GET key | DEL key... | EXISTS key... |",
            "          INCR key | INCRBY key n | DECR key | EXPIRE key sec | TTL key |",
            "          MSET k1 v1 k2 v2... | MGET k1 k2... | KEYS pattern | TYPE key",
            "",
            "Hashes:   HSET k f v [f v...] | HGET k f | HDEL k f... | HEXISTS k f |",
            "          HKEYS k | HVALS k | HGETALL k | HLEN k",
            "",
            "Lists:    LPUSH k v... | RPUSH k v... | LPOP k | RPOP k | LLEN k |",
            "          LRANGE k start stop | LINDEX k i",
            "",
            "Sorted:   ZADD k score member... | ZSCORE k m | ZRANGE k start stop [WITHSCORES] |",
            "          ZREM k m... | ZCARD k",
            "",
            "Admin:    PING [msg] | INFO | DBSIZE | FLUSHALL",
            "",
            "Bench:    BENCH SET|GET|HSET|HGET|LPUSH|INCR  count",
            "",
            "Try:      SET foo bar  →  GET foo  →  BENCH SET 100000",
        ].join("\n");
    },
};

// ---- dispatch ------------------------------------------------------------

self.onmessage = (event) => {
    const { id, cmd, args } = event.data || {};
    const t0 = performance.now();
    try {
        const handler = handlers[(cmd || "").toUpperCase()];
        if (!handler) {
            throw new Error(`unknown command '${cmd}'`);
        }
        const result = handler(args || []);
        const latency = (performance.now() - t0) * 1000; // microseconds
        stats.commandsProcessed++;
        self.postMessage({ id, result, latency, error: null });
    } catch (err) {
        const latency = (performance.now() - t0) * 1000;
        self.postMessage({
            id,
            result: null,
            latency,
            error: err && err.message ? err.message : String(err),
        });
    }
};
