// Unit tests for app/lib/devto-feed.mjs (the blog's dev.to reader).
// Run: node --test scripts/devto-feed.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFeed, looksLikeDevtoSlug } from "../app/lib/devto-feed.mjs";

// A fake dev.to: a queue of responses per call, a clock we move by hand,
// and a log of every URL and header set that reached it.
function harness(responses) {
    let clock = 1_000_000;
    const calls = [];
    const queue = [...responses];
    const fetch = async (url, init) => {
        calls.push({ url, init });
        const next = queue.length > 1 ? queue.shift() : queue[0];
        if (next instanceof Error) throw next;
        if (typeof next === "function") return next();
        const { status = 200, body = [], headers = {} } = next;
        return new Response(JSON.stringify(body), { status, headers });
    };
    const feed = createFeed({ fetch, now: () => clock, ttlMs: 10_000, retryMs: 5_000, throttleMs: 30_000 });
    return { feed, calls, tick: (ms) => { clock += ms; } };
}
const LIST = "https://dev.to/api/articles?username=x&per_page=1000";

test("a read within the window is served from memory; after it, dev.to is asked again", async () => {
    const h = harness([{ body: [{ slug: "a-1" }] }, { body: [{ slug: "a-1" }, { slug: "b-2" }] }]);
    assert.deepEqual(await h.feed.read("list", LIST), { status: "ok", data: [{ slug: "a-1" }], live: true });
    h.tick(9_999);
    assert.equal((await h.feed.read("list", LIST)).data.length, 1);
    assert.equal(h.calls.length, 1);
    h.tick(2);
    const fresh = await h.feed.read("list", LIST);
    assert.equal(fresh.data.length, 2, "the new article shows up on the first read after the window");
    assert.equal(h.calls.length, 2);
});

test("every upstream call carries a never-seen cache-buster and asks for the uncompressed variant", async () => {
    const h = harness([{ body: [] }]);
    await h.feed.read("list", LIST);
    h.tick(10_001);
    await h.feed.read("list", LIST);
    const [a, b] = h.calls.map((c) => new URL(c.url).searchParams.get("v"));
    assert.ok(a && b && a !== b, `busters ${a} and ${b} must differ`);
    assert.ok(h.calls[0].url.startsWith(LIST + "&v="), "the buster is appended to the existing query");
    assert.equal(h.calls[0].init.headers["Accept-Encoding"], "identity");
    assert.equal(h.calls[0].init.cache, "no-store");
});

test("concurrent reads of one key share a single upstream request", async () => {
    let release;
    const gate = new Promise((r) => { release = r; });
    const h = harness([async () => { await gate; return new Response("[]", { status: 200 }); }]);
    const reads = Array.from({ length: 25 }, () => h.feed.read("list", LIST));
    release();
    const results = await Promise.all(reads);
    assert.equal(h.calls.length, 1);
    assert.ok(results.every((r) => r.status === "ok"));
});

test("404 is an answer (missing), and is remembered for the window", async () => {
    const h = harness([{ status: 404, body: { error: "not found" } }]);
    assert.deepEqual(await h.feed.read("a", "https://dev.to/api/articles/x/gone-1"), { status: "missing" });
    assert.deepEqual(await h.feed.read("a", "https://dev.to/api/articles/x/gone-1"), { status: "missing" });
    assert.equal(h.calls.length, 1);
});

test("a failure with nothing in memory is 'unavailable', never 'missing' or an empty list", async () => {
    for (const failure of [{ status: 500 }, { status: 503 }, new Error("ECONNRESET")]) {
        const h = harness([failure]);
        assert.deepEqual(await h.feed.read("list", LIST), { status: "unavailable" }, JSON.stringify(failure));
    }
});

test("a failure after a success serves the last good answer, marked not live", async () => {
    const h = harness([{ body: [{ slug: "a-1" }] }, { status: 502 }]);
    await h.feed.read("list", LIST);
    h.tick(10_001);
    assert.deepEqual(await h.feed.read("list", LIST), { status: "ok", data: [{ slug: "a-1" }], live: false });
});

test("after a failure dev.to is left alone for the retry pause, then asked again", async () => {
    const h = harness([{ body: [] }, { status: 500 }, { body: [{ slug: "back-1" }] }]);
    await h.feed.read("list", LIST);
    h.tick(10_001);
    await h.feed.read("list", LIST); // fails
    assert.equal(h.calls.length, 2);
    h.tick(4_000);
    const paused = await h.feed.read("list", LIST); // inside the pause: no upstream call
    assert.equal(h.calls.length, 2);
    assert.equal(paused.live, false, "a copy served during the pause is not live");
    h.tick(1_001);
    const r = await h.feed.read("list", LIST);
    assert.equal(h.calls.length, 3);
    assert.equal(r.data[0].slug, "back-1");
    assert.equal(r.live, true);
});

test("429 pauses every key for Retry-After seconds", async () => {
    const h = harness([{ body: [] }, { status: 429, headers: { "retry-after": "20" } }, { body: [{ slug: "z-1" }] }]);
    await h.feed.read("list", LIST);
    h.tick(10_001);
    await h.feed.read("list", LIST); // 429
    assert.equal(h.calls.length, 2);
    h.tick(6_000);
    // a different key is held back too: the limit is per IP, not per URL
    assert.deepEqual(await h.feed.read("article:z-1", "https://dev.to/api/articles/x/z-1"), { status: "unavailable" });
    assert.equal((await h.feed.read("list", LIST)).live, false);
    assert.equal(h.calls.length, 2);
    h.tick(14_001);
    assert.equal((await h.feed.read("list", LIST)).live, true);
    assert.equal(h.calls.length, 3);
});

test("429 without Retry-After pauses for the default throttle window", async () => {
    const h = harness([{ status: 429 }, { body: [] }]);
    await h.feed.read("list", LIST);
    h.tick(29_000);
    await h.feed.read("list", LIST);
    assert.equal(h.calls.length, 1);
    h.tick(1_001);
    await h.feed.read("list", LIST);
    assert.equal(h.calls.length, 2);
});

test("memory stays bounded however many distinct keys are asked for", async () => {
    const h = harness([{ status: 404 }]);
    const feed = createFeed({ fetch: (...a) => { h.calls.push(a); return Promise.resolve(new Response("{}", { status: 404 })); }, now: () => 0, maxKeys: 3 });
    for (const k of ["a-1", "b-1", "c-1", "d-1"]) await feed.read(k, `https://dev.to/api/articles/x/${k}`);
    await feed.read("a-1", "https://dev.to/api/articles/x/a-1"); // evicted, so it is asked again
    assert.equal(h.calls.length, 5);
    await feed.read("d-1", "https://dev.to/api/articles/x/d-1"); // still remembered
    assert.equal(h.calls.length, 5);
});

test("slug shape: real dev.to slugs pass, scanner paths do not", () => {
    for (const ok of ["test-4fah", "anthropic-replaced-git-the-interesting-part-is-the-merge-queue-5520", "a-0", "x-p"]) assert.ok(looksLikeDevtoSlug(ok), ok);
    for (const bad of ["admin", "login", "wp-admin", "wp-login", ".env", "room", "Test-4fah", "a-q", "a--1", "a-12345", "", undefined]) assert.ok(!looksLikeDevtoSlug(bad), String(bad));
});
