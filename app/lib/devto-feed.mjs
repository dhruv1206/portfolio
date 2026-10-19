// Request-time reads of the dev.to API. What the blog shows is at most
// `ttlMs` behind dev.to, and a dev.to failure never turns into a wrong
// page. This module has no Next.js imports so it can be tested in plain
// Node (scripts/devto-feed.test.mjs); app/lib/devto.js wires it into the
// app.
//
// Why each piece exists:
// - A fresh cache-buster on every upstream call, plus
//   `Accept-Encoding: identity`: dev.to's CDN keeps copies of a fixed URL
//   for days (separately per encoding), so every read uses a URL the CDN
//   has never seen.
// - A short per-key window and shared in-flight requests: dev.to allows
//   3 GET/s and 30 GET/min per IP, an API key does not lift that, and
//   Vercel functions share egress IPs with other tenants. One instance
//   therefore asks for a given key at most once per window, however much
//   traffic arrives.
// - 404 is an answer; everything else is a failure. A 429 or a 5xx must
//   not render as "not found" or "nothing published".
// - An upstream budget per instance (bursts of 3, refilling at 20 a
//   minute): per-key windows alone do not bound the total, since a client
//   cycling through many keys could still spend the per-IP limit. One
//   token stays in reserve for high-priority reads (the article list),
//   so a flood of article reads cannot starve the list.
// - The last good answer, a retry pause and dev.to's Retry-After (capped):
//   when dev.to fails, throttles or the budget is spent, keep serving what
//   it last said, and do not ask again until the pause has passed.

const DEFAULTS = {
    ttlMs: 10_000,
    retryMs: 5_000,
    throttleMs: 30_000,
    maxThrottleMs: 120_000,
    burst: 3,
    perMinute: 20,
    timeoutMs: 4_000,
    maxKeys: 200,
    userAgent: "dhruuv.me (+https://dhruuv.me)",
};

/**
 * @typedef {{ status: "ok", data: unknown, live: boolean } | { status: "missing" } | { status: "unavailable" }} FeedResult
 */

export function createFeed(options = {}) {
    const opts = { ...DEFAULTS, ...options };
    const fetchImpl = options.fetch || ((...args) => fetch(...args));
    const now = options.now || (() => Date.now());

    // key -> { result: { kind, value, at } | null, freshUntil, retryAt, inflight: Promise | null }
    const entries = new Map();
    let throttledUntil = 0;
    let seq = 0;
    const budget = { tokens: opts.burst, at: null };

    // Token bucket. `reserve` tokens must remain after spending one.
    function spend(reserve) {
        const t = now();
        if (budget.at === null) budget.at = t;
        budget.tokens = Math.min(opts.burst, budget.tokens + ((t - budget.at) * opts.perMinute) / 60_000);
        budget.at = t;
        if (budget.tokens - 1 < reserve) return false;
        budget.tokens -= 1;
        return true;
    }

    function entryFor(key) {
        let entry = entries.get(key);
        if (entry) {
            entries.delete(key); // re-insert to keep the Map in recency order
        } else {
            entry = { result: null, freshUntil: 0, retryAt: 0, inflight: null };
        }
        entries.set(key, entry);
        while (entries.size > opts.maxKeys) entries.delete(entries.keys().next().value);
        return entry;
    }

    function view(result, live) {
        if (!result) return { status: "unavailable" };
        if (result.kind === "missing") return { status: "missing" };
        return { status: "ok", data: result.value, live };
    }

    async function request(url) {
        const sep = url.includes("?") ? "&" : "?";
        const buster = `${now().toString(36)}${(seq++).toString(36)}`;
        const res = await fetchImpl(`${url}${sep}v=${buster}`, {
            headers: { Accept: "application/json", "Accept-Encoding": "identity", "User-Agent": opts.userAgent },
            cache: "no-store",
            signal: AbortSignal.timeout(opts.timeoutMs),
        });
        if (res.status === 404) return { kind: "missing", value: null };
        if (res.status === 429) {
            const seconds = Number(res.headers.get("retry-after"));
            const wait = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : opts.throttleMs;
            throttledUntil = now() + Math.min(wait, opts.maxThrottleMs);
            throw new Error("dev.to throttled this IP (429)");
        }
        if (!res.ok) throw new Error(`dev.to answered ${res.status}`);
        return { kind: "ok", value: await res.json() };
    }

    /**
     * Reads `url`, memoised under `key` for `ttlMs`. `priority: "high"` may
     * spend the budget's last token; other reads leave it for the list.
     * @returns {Promise<FeedResult>}
     */
    async function read(key, url, { priority = "normal" } = {}) {
        const entry = entryFor(key);
        const t = now();
        if (entry.result && t < entry.freshUntil) return view(entry.result, true);
        if (entry.inflight) return entry.inflight;
        // Throttled, paused after a failure, or out of budget: answer from
        // memory, do not ask.
        if (t < throttledUntil || t < entry.retryAt) return view(entry.result, false);
        if (!spend(priority === "high" ? 0 : 1)) return view(entry.result, false);

        entry.inflight = (async () => {
            try {
                const fresh = await request(url);
                const at = now();
                entry.result = { ...fresh, at };
                entry.freshUntil = at + opts.ttlMs;
                entry.retryAt = 0;
                return view(entry.result, true);
            } catch {
                entry.retryAt = now() + opts.retryMs;
                return view(entry.result, false);
            } finally {
                entry.inflight = null;
            }
        })();
        return entry.inflight;
    }

    return { read };
}

/**
 * dev.to builds slugs as `<title words>-<1 to 4 base-26 digits>`. Used when
 * the article list cannot be read: a path that cannot be a dev.to slug
 * (scanners asking for /admin, /login, /wp-admin) is "not found", while a
 * slug-shaped one is "unavailable" because it may well exist.
 */
export function looksLikeDevtoSlug(slug) {
    return typeof slug === "string" && slug.length <= 200 && /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-p]{1,4}$/.test(slug);
}
