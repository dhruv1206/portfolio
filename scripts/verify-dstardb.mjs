#!/usr/bin/env node
// Playwright check for the DStarDB REPL on /projects/dstardb. Loads the
// page, types a script of commands, asserts each reply, runs a small
// BENCH, screenshots the result.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
mkdirSync(OUT, { recursive: true });

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(`${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`);
}

async function typeCmd(page, line) {
    const input = page.locator('input[placeholder^="try"]').last();
    await input.fill(line);
    await input.press("Enter");
    await page.waitForTimeout(120);
}

async function lastResultText(page) {
    return await page
        .locator("div.font-mono > div")
        .last()
        .innerText();
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
    });

    console.log("→ Loading /projects/dstardb");
    await page.goto(BASE + "/projects/dstardb", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector('input[placeholder^="try"]', { timeout: 60_000 });

    // Scroll the REPL into view so screenshots show it.
    await page
        .locator(".dstardb-repl")
        .scrollIntoViewIfNeeded()
        .catch(() => {});

    // ---- functional commands ----
    await typeCmd(page, "SET foo bar");
    record("SET foo bar returns OK", /OK/.test(await lastResultText(page)));

    await typeCmd(page, "GET foo");
    record('GET foo returns "bar"', /bar/.test(await lastResultText(page)));

    await typeCmd(page, "INCR counter");
    record("INCR counter returns 1", /\b1\b/.test(await lastResultText(page)));

    await typeCmd(page, "INCR counter");
    record("INCR counter returns 2", /\b2\b/.test(await lastResultText(page)));

    await typeCmd(page, "HSET user:1 name Dhruv age 22");
    record("HSET reports 2 fields added", /\b2\b/.test(await lastResultText(page)));

    await typeCmd(page, "HGETALL user:1");
    record(
        "HGETALL user:1 returns Dhruv",
        /Dhruv/.test(await lastResultText(page)),
    );

    await typeCmd(page, "LPUSH stack a b c");
    record(
        "LPUSH stack a b c length 3",
        /\b3\b/.test(await lastResultText(page)),
    );

    await typeCmd(page, "LRANGE stack 0 -1");
    record(
        "LRANGE stack 0 -1 returns c, b, a",
        /a/.test(await lastResultText(page)),
    );

    await typeCmd(page, "ZADD lb 1870 dhruv 1654 alice");
    record(
        "ZADD lb adds 2 members",
        /\b2\b/.test(await lastResultText(page)),
    );

    await typeCmd(page, "ZRANGE lb 0 -1 WITHSCORES");
    record(
        "ZRANGE returns members + scores",
        /(dhruv|1870)/i.test(await lastResultText(page)),
    );

    await typeCmd(page, "GET missing");
    record(
        "GET missing returns (nil)",
        /\(nil\)/i.test(await lastResultText(page)),
    );

    await typeCmd(page, "WRONG cmd here");
    record(
        "Unknown command errors gracefully",
        /unknown command/i.test(await lastResultText(page)),
    );

    // ---- benchmark ----
    console.log("\n→ Running BENCH SET 5000");
    await typeCmd(page, "BENCH SET 5000");
    await page.waitForTimeout(800); // give the worker time
    const benchText = await lastResultText(page);
    console.log("BENCH result:\n" + benchText);
    record(
        "BENCH SET reports ops/sec",
        /ops\/sec/.test(benchText),
        benchText.split("\n")[1] || "",
    );
    record(
        "BENCH SET reports latency percentiles",
        /p50.*p99/.test(benchText),
    );

    // Take a screenshot scoped to the REPL.
    await page.locator(".dstardb-repl").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/dstardb-repl.png`, fullPage: false });

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) {
        for (const c of checks.filter((c) => !c.pass)) {
            console.log(`  - ${c.name}`);
        }
    }
    if (errors.length) {
        console.log("\nConsole errors:");
        errors.slice(0, 5).forEach((e) => console.log("  " + e));
    }
    console.log(`Screenshot: ${OUT}/dstardb-repl.png`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-dstardb crashed:", err);
    process.exit(2);
});
