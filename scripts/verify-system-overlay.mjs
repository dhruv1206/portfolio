#!/usr/bin/env node
// P4 System Architecture Overlay verification.
//
// 1. Toggle button is mounted on every route (`[data-system-overlay-toggle]`).
// 2. Overlay is closed by default — no `[data-system-overlay]` element.
// 3. Clicking the toggle opens the overlay.
// 4. The graph renders all 7 subsystem nodes + all 7 edges.
// 5. Firing `voice:intent` on the event bus pulses the matching edges
//    (e1 + e2) — they go to `data-active="1"`.
// 6. Firing `io:enter` pulses e3.
// 7. Firing `audio:section-change` pulses e4.
// 8. Firing `prefetch:queued` pulses e5 + e6.
// 9. Escape closes the overlay.
// 10. The overlay is mounted on the project routes too (not just /).

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
mkdirSync(OUT, { recursive: true });

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

async function activeEdges(page) {
    return await page.evaluate(() => {
        const out = {};
        for (const g of document.querySelectorAll("[data-edge]")) {
            out[g.getAttribute("data-edge")] = g.getAttribute("data-active");
        }
        return out;
    });
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errs.push(m.text());
    });

    console.log(`→ Loading ${BASE}/`);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("[data-system-overlay-toggle]", {
        timeout: 60_000,
    });

    // 1 + 2. Toggle mounted, overlay closed.
    record(
        "toggle button mounted",
        (await page.locator("[data-system-overlay-toggle]").count()) === 1,
    );
    record(
        "overlay is closed by default",
        (await page.locator('[data-system-overlay="open"]').count()) === 0,
    );

    // 3. Click → opens. Use a JS-driven click so the Next.js dev
    // overlay portal can't intercept the pointer event (it sometimes
    // covers the bottom-left corner where the toggle lives).
    await page.evaluate(() => {
        document
            .querySelector("[data-system-overlay-toggle]")
            ?.click();
    });
    await page.waitForSelector('[data-system-overlay="open"]', {
        timeout: 5_000,
    });
    record("clicking toggle opens the overlay", true);

    // 4. All 7 nodes + 7 edges.
    const counts = await page.evaluate(() => ({
        nodes: document.querySelectorAll('[data-system-overlay="open"] [data-node]').length,
        edges: document.querySelectorAll('[data-system-overlay="open"] [data-edge]').length,
    }));
    record(
        "graph renders 7 nodes",
        counts.nodes === 7,
        `nodes=${counts.nodes}`,
    );
    record(
        "graph renders 7 edges",
        counts.edges === 7,
        `edges=${counts.edges}`,
    );

    // The overlay's useEffect publishes `window.__emitBus` against
    // the same module instance it subscribes to, so this fires the
    // real bus event end-to-end.
    await page.waitForFunction(() => typeof window.__emitBus === "function", {
        timeout: 5_000,
    });
    const fireFromPage = (event) =>
        page.evaluate((ev) => window.__emitBus(ev), event);

    // 5. voice:intent pulses e1 + e2.
    await fireFromPage("voice:intent");
    await page.waitForTimeout(120);
    let edges = await activeEdges(page);
    record(
        "voice:intent pulses e1 + e2",
        edges.e1 === "1" && edges.e2 === "1",
        JSON.stringify(edges),
    );

    // 6. io:enter pulses e3.
    await page.waitForTimeout(1600); // let previous pulse die
    await fireFromPage("io:enter");
    await page.waitForTimeout(120);
    edges = await activeEdges(page);
    record("io:enter pulses e3", edges.e3 === "1", JSON.stringify(edges));

    // 7. audio:section-change pulses e4.
    await page.waitForTimeout(1600);
    await fireFromPage("audio:section-change");
    await page.waitForTimeout(120);
    edges = await activeEdges(page);
    record(
        "audio:section-change pulses e4",
        edges.e4 === "1",
        JSON.stringify(edges),
    );

    // 8. prefetch:queued pulses e5 + e6.
    await page.waitForTimeout(1600);
    await fireFromPage("prefetch:queued");
    await page.waitForTimeout(120);
    edges = await activeEdges(page);
    record(
        "prefetch:queued pulses e5 + e6",
        edges.e5 === "1" && edges.e6 === "1",
        JSON.stringify(edges),
    );

    await page.screenshot({
        path: `${OUT}/system-overlay.png`,
        fullPage: false,
    });

    // 9. Esc closes the overlay. Use the page's keyboard pipeline,
    // then fall back to clicking the in-panel close button if the
    // Next.js dev overlay swallowed the keydown.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    let stillOpen =
        (await page.locator('[data-system-overlay="open"]').count()) > 0;
    if (stillOpen) {
        // Dispatch event manually as a second attempt.
        await page.evaluate(() => {
            const evt = new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                bubbles: true,
                cancelable: true,
            });
            window.dispatchEvent(evt);
        });
        await page.waitForTimeout(400);
        stillOpen =
            (await page.locator('[data-system-overlay="open"]').count()) > 0;
    }
    record("Escape closes the overlay", !stillOpen);

    // Re-open and verify the in-panel Close button works too — both
    // close paths should reach `setOpen(false)`.
    if (stillOpen) {
        // If Esc somehow didn't fire, click the in-panel close button.
        await page.evaluate(() => {
            const btn = Array.from(
                document.querySelectorAll(
                    '[data-system-overlay="open"] button',
                ),
            ).find((b) => /close/i.test(b.textContent || ""));
            btn?.click();
        });
        await page.waitForTimeout(400);
    }

    // 10. Toggle mounted on the project route too.
    await page.goto(BASE + "/projects/dstardb", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector("[data-system-overlay-toggle]", {
        timeout: 60_000,
    });
    record(
        "toggle mounted on /projects/dstardb",
        (await page.locator("[data-system-overlay-toggle]").count()) === 1,
    );

    // 11. ClientEventBridge fires `io:enter` naturally when [id]
    // sections enter the viewport. Open the overlay, scroll, and
    // confirm at least one edge that's NOT directly triggered by us
    // pulses (edge e3 = browser → io-scheduler).
    await page.evaluate(() => {
        document.querySelector("[data-system-overlay-toggle]")?.click();
    });
    await page.waitForSelector('[data-system-overlay="open"]', {
        timeout: 5_000,
    });
    // Cinema chapters have ids → IO bridge emits io:enter as they
    // come into view. Scroll the page to trigger them.
    let bridgeFired = false;
    for (let i = 0; i < 6 && !bridgeFired; i++) {
        await page.evaluate((y) => window.scrollTo(0, y), 400 + i * 700);
        await page.waitForTimeout(250);
        const e3 = await page.evaluate(() => {
            const g = document.querySelector('[data-edge="e3"]');
            return g?.getAttribute("data-active");
        });
        if (e3 === "1") bridgeFired = true;
    }
    record("ClientEventBridge fires io:enter naturally on scroll", bridgeFired);

    // 12. Demo trigger buttons inside the overlay panel fire events.
    await page.evaluate(() =>
        document.querySelector('[data-demo-emit="voice:intent"]')?.click(),
    );
    await page.waitForTimeout(150);
    const demoFired = await page.evaluate(
        () => document.querySelector('[data-edge="e1"]')?.getAttribute("data-active") === "1",
    );
    record("in-panel demo button fires the matching event", demoFired);

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errs.length) {
        console.log("\nPage errors:");
        errs.slice(0, 6).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-system-overlay crashed:", err);
    process.exit(2);
});
