#!/usr/bin/env node
// Phase 3 deep-audit. Beyond the basic cinema smoke (verify-scroll-cinema):
//   1. All 3 demo cinemas trigger >= 3 distinct activeStateId values on
//      scroll (full coverage, not just dstardb).
//   2. `prefers-reduced-motion: reduce` renders the linear fallback —
//      no `[data-cinema-mode="desktop"]` block, every chapter visible
//      stacked.
//   3. Mobile viewport (390×844) renders the linear fallback too, with
//      every chapter's diagram inlined.
//   4. Dev log has no new pageerror / runtime errors after scrolling
//      through a full cinema.
//   5. Full-page screenshots saved for each of the 3 projects in each
//      mode for visual diff review.

import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots/cinema-deep");
const DEV_LOG = resolve(process.cwd(), ".claude/logs/dev.log");
mkdirSync(OUT, { recursive: true });

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

async function readActiveState(page) {
    return await page.evaluate(() => {
        const el = document.querySelector(
            '[data-cinema-mode="desktop"] [data-active-state]',
        );
        return el ? el.getAttribute("data-active-state") : null;
    });
}

async function collectStatesOnScroll(page, totalSteps = 8) {
    const states = new Set();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(900);
    const first = await readActiveState(page);
    if (first) states.add(first);
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    for (let i = 1; i <= totalSteps; i++) {
        const y = Math.floor((totalHeight * i) / totalSteps);
        await page.evaluate((y2) => window.scrollTo(0, y2), y);
        await page.waitForTimeout(550);
        const s = await readActiveState(page);
        if (s) states.add(s);
    }
    return states;
}

async function readDevLogTail(maxBytes = 6000) {
    try {
        const buf = readFileSync(DEV_LOG, "utf8");
        return buf.slice(-maxBytes);
    } catch {
        return "";
    }
}

async function main() {
    const browser = await chromium.launch({ headless: true });

    // ---------- 1. Full scroll coverage for each demo cinema ----------
    const slugs = [
        "dstardb",
        "realtime-collaboration",
        "ai-press-release-generator",
    ];
    for (const slug of slugs) {
        const ctx = await browser.newContext({
            viewport: { width: 1440, height: 900 },
        });
        const page = await ctx.newPage();
        const pageErrors = [];
        page.on("pageerror", (e) =>
            pageErrors.push("pageerror: " + e.message),
        );
        console.log(`\n→ Desktop scroll coverage · /projects/${slug}`);
        await page.goto(`${BASE}/projects/${slug}`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
        });
        await page.waitForSelector(
            '[data-cinema-mode="desktop"] [data-chapter-idx]',
            { state: "attached", timeout: 60_000 },
        );
        const states = await collectStatesOnScroll(page, 8);
        record(
            `${slug}: scroll triggers >= 4 distinct states`,
            states.size >= 4,
            `seen ${states.size}: ${Array.from(states).join(", ")}`,
        );
        record(
            `${slug}: no page errors during scroll`,
            pageErrors.length === 0,
            pageErrors[0] || "clean",
        );
        await page.screenshot({
            path: `${OUT}/${slug}-desktop.png`,
            fullPage: true,
        });
        await ctx.close();
    }

    // ---------- 2. Reduced motion → linear fallback ----------
    console.log("\n→ Reduced-motion fallback (prefers-reduced-motion: reduce)");
    const rmCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
    });
    const rmPage = await rmCtx.newPage();
    await rmPage.goto(`${BASE}/projects/dstardb`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await rmPage.waitForSelector(".scroll-cinema", {
        state: "attached",
        timeout: 60_000,
    });
    const rmShape = await rmPage.evaluate(() => {
        const desktop = document.querySelectorAll(
            '[data-cinema-mode="desktop"]',
        );
        const mobile = document.querySelectorAll('[data-cinema-mode="mobile"]');
        // In reduced-motion the parent only renders LinearChapterFlow.
        // Count chapter sections visible:
        const sections = document.querySelectorAll(".scroll-cinema ol > li");
        return {
            desktopBlockCount: desktop.length,
            mobileBlockCount: mobile.length,
            sectionCount: sections.length,
        };
    });
    record(
        "reduced-motion: NO desktop scrollytelling block rendered",
        rmShape.desktopBlockCount === 0,
        `desktopBlocks=${rmShape.desktopBlockCount}`,
    );
    record(
        "reduced-motion: NO mobile-marker block either (linear only)",
        rmShape.mobileBlockCount === 0,
        `mobileBlocks=${rmShape.mobileBlockCount}`,
    );
    record(
        "reduced-motion: chapter sections render in linear flow",
        rmShape.sectionCount >= 6,
        `sections=${rmShape.sectionCount}`,
    );
    await rmPage.screenshot({
        path: `${OUT}/dstardb-reduced-motion.png`,
        fullPage: true,
    });
    await rmCtx.close();

    // ---------- 3. Mobile viewport → linear fallback ----------
    console.log(`\n→ Mobile viewport (390×844) fallback`);
    const mCtx = await browser.newContext({
        viewport: { width: 390, height: 844 }, // iPhone 14 Pro
        deviceScaleFactor: 3,
    });
    const mPage = await mCtx.newPage();
    await mPage.goto(`${BASE}/projects/dstardb`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await mPage.waitForSelector(".scroll-cinema", {
        state: "attached",
        timeout: 60_000,
    });
    const mShape = await mPage.evaluate(() => {
        const desktopVisible = (() => {
            const el = document.querySelector('[data-cinema-mode="desktop"]');
            return el ? getComputedStyle(el).display !== "none" : false;
        })();
        const mobileVisible = (() => {
            const el = document.querySelector('[data-cinema-mode="mobile"]');
            return el ? getComputedStyle(el).display !== "none" : false;
        })();
        const inlineCanvasCount = document.querySelectorAll(
            '[data-cinema-mode="mobile"] svg',
        ).length;
        return { desktopVisible, mobileVisible, inlineCanvasCount };
    });
    record(
        "mobile: desktop scrollytelling is display:none",
        !mShape.desktopVisible,
        `desktopVisible=${mShape.desktopVisible}`,
    );
    record(
        "mobile: mobile linear flow is visible",
        mShape.mobileVisible,
        `mobileVisible=${mShape.mobileVisible}`,
    );
    record(
        "mobile: every chapter has its diagram inlined (>= 6 SVGs)",
        mShape.inlineCanvasCount >= 6,
        `svgs=${mShape.inlineCanvasCount}`,
    );
    await mPage.screenshot({
        path: `${OUT}/dstardb-mobile.png`,
        fullPage: true,
    });
    await mCtx.close();

    // ---------- 4. Dev log diff ----------
    console.log(`\n→ Dev log tail (last 6KB)`);
    const tail = await readDevLogTail();
    const newErrs = (tail.match(/pageerror|TypeError|ReferenceError/g) || [])
        .length;
    record(
        "dev log shows no fresh pageerror / TypeError / ReferenceError",
        newErrs === 0,
        `matches=${newErrs}`,
    );

    // ---------- Summary ----------
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    console.log(`\nScreenshots saved to: ${OUT}`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-cinema-deep crashed:", err);
    process.exit(2);
});
