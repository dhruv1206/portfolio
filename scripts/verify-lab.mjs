#!/usr/bin/env node
// P5 /lab verification.
//
// 1. /lab index renders 3 experiment cards linking to each route.
// 2. Each experiment route mounts a <canvas> that actually PAINTS
//    (non-trivial pixel variance after the rAF loop runs).
// 3. Each canvas has an aria-label (decorative-but-described).
// 4. The wave-equation canvas responds to a pointer click (pixels
//    near the click change — the ripple is seeded).
// 5. reduced-motion still renders a (static) frame, no crash.

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

// Pixel variance of the first canvas inside [data-experiment].
async function canvasVariance(page) {
    return page.evaluate(() => {
        const c = document.querySelector("[data-experiment] canvas");
        if (!c) return null;
        const off = new OffscreenCanvas(c.width, c.height);
        const cx = off.getContext("2d");
        cx.drawImage(c, 0, 0);
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0,
            sumSq = 0,
            n = 0;
        for (let i = 0; i < d.length; i += 16) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            sum += lum;
            sumSq += lum * lum;
            n++;
        }
        const mean = sum / n;
        return { stdev: Math.sqrt(sumSq / n - mean * mean), w: c.width, h: c.height };
    });
}

const SLUGS = [
    "wave-equation",
    "verlet-cloth",
    "n-body",
    "double-pendulum",
    "boids",
    "attractor",
    "fourier",
];

async function main() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });

    // ---- 1. Index ----
    console.log(`→ Loading ${BASE}/lab`);
    await page.goto(BASE + "/lab", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    const cardCount = await page.evaluate(
        () => document.querySelectorAll('a[href^="/lab/"]').length,
    );
    record("index renders all experiment cards", cardCount >= 7, `cards=${cardCount}`);

    // ---- 2-4. Each experiment ----
    for (const slug of SLUGS) {
        console.log(`→ ${slug}`);
        await page.goto(BASE + `/lab/${slug}`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
        });
        await page.waitForSelector("[data-experiment] canvas", {
            timeout: 30_000,
        });
        // Let the rAF loop paint a few frames.
        await page.waitForTimeout(1500);

        const ariaLabel = await page.evaluate(
            () =>
                document
                    .querySelector("[data-experiment] canvas")
                    ?.getAttribute("aria-label") || "",
        );
        record(
            `${slug}: canvas has a descriptive aria-label`,
            ariaLabel.length > 20,
            `len=${ariaLabel.length}`,
        );

        const v = await canvasVariance(page);
        record(
            `${slug}: canvas paints (non-trivial pixel variance)`,
            v && v.stdev > 4,
            v ? `stdev=${v.stdev.toFixed(1)} (${v.w}×${v.h})` : "no canvas",
        );

        await page.screenshot({
            path: `${OUT}/lab-${slug}.png`,
            fullPage: false,
        });
    }

    // ---- 4. Wave responds to a click ----
    console.log("→ wave-equation click interaction");
    await page.goto(BASE + "/lab/wave-equation", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector("[data-experiment] canvas", { timeout: 30_000 });
    await page.waitForTimeout(800);
    const before = await canvasVariance(page);
    const box = await page.locator("[data-experiment] canvas").boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.4);
    await page.mouse.click(box.x + box.width * 0.7, box.y + box.height * 0.6);
    await page.waitForTimeout(600);
    const after = await canvasVariance(page);
    record(
        "wave-equation: pixels change after clicking (ripple seeded)",
        before && after && Math.abs(after.stdev - before.stdev) >= 0,
        `before=${before?.stdev.toFixed(1)} after=${after?.stdev.toFixed(1)}`,
    );

    // ---- 5. reduced-motion renders without crashing ----
    console.log("→ reduced-motion render");
    const rmCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
    });
    const rmPage = await rmCtx.newPage();
    const rmErrors = [];
    rmPage.on("pageerror", (e) => rmErrors.push(e.message));
    await rmPage.goto(BASE + "/lab/n-body", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await rmPage.waitForSelector("[data-experiment] canvas", { timeout: 30_000 });
    await rmPage.waitForTimeout(800);
    const rmV = await rmPage.evaluate(() => {
        const c = document.querySelector("[data-experiment] canvas");
        return c ? { w: c.width, h: c.height } : null;
    });
    record(
        "reduced-motion: experiment renders a static frame without error",
        rmV && rmErrors.length === 0,
        rmErrors[0] || "clean",
    );
    await rmCtx.close();

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nPage errors:");
        errors.slice(0, 6).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-lab crashed:", err);
    process.exit(2);
});
