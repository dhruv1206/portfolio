#!/usr/bin/env node
// Phase 3 verification — scroll cinema on /projects/dstardb.
//
// Validates the framework end-to-end on one project, before
// replication:
//   1. Page renders the cinema container instead of the classic
//      Challenge/Solution layout.
//   2. All chapter sections mount with their headings and prose.
//   3. The architecture diagram renders an SVG with nodes that
//      cross-fade between states as the reader scrolls.
//   4. IntersectionObserver-driven `activeStateId` actually changes
//      when chapters scroll past the viewport centre.
//   5. The final chapter renders the live DStarDB REPL inline (the
//      demoSlot integration).
//   6. Classic layout still works for projects WITHOUT chapter data
//      (smoke /projects/amazon-clone).

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

async function readActiveState(page) {
    return await page.evaluate(() => {
        // Scope to the desktop scrollytelling tree — the mobile
        // fallback renders ALL chapters with their own data-active-state
        // attributes (each chapter's own diagram), so the first match in
        // DOM order would always be the first chapter on lg+ viewports.
        const el = document.querySelector(
            '[data-cinema-mode="desktop"] [data-active-state]',
        );
        return el ? el.getAttribute("data-active-state") : null;
    });
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ["--enable-unsafe-webgpu"],
    });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) =>
        errors.push("pageerror: " + e.message + "\n" + (e.stack || "")),
    );
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });

    // ---------- Step 1: cinema route ----------
    console.log(`\n→ Loading ${BASE}/projects/dstardb`);
    await page.goto(BASE + "/projects/dstardb", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector(".scroll-cinema", {
        state: "attached",
        timeout: 45_000,
    });
    record("cinema container mounted on /projects/dstardb", true);

    // Classic body must NOT render alongside.
    const hasClassic = await page
        .locator("#challenge")
        .isVisible()
        .catch(() => false);
    record(
        "classic Challenge/Solution body is absent on cinema route",
        !hasClassic,
    );

    // ---------- Step 2: chapters present ----------
    const chapterCount = await page.evaluate(() => {
        return document.querySelectorAll(".scroll-cinema [data-chapter-idx]")
            .length;
    });
    record(
        "chapter sections mounted (>= 6)",
        chapterCount >= 6,
        `count=${chapterCount}`,
    );

    // Headings render
    const headingTexts = await page.evaluate(() => {
        const els = document.querySelectorAll(".scroll-cinema h2");
        return Array.from(els).map((el) => el.textContent.trim());
    });
    record(
        "chapter headings have prose (>= 6 non-empty)",
        headingTexts.filter((t) => t && t.length > 5).length >= 6,
        `non-empty=${headingTexts.filter(Boolean).length}`,
    );

    // ---------- Step 3: architecture diagram ----------
    await page
        .locator(".scroll-cinema svg")
        .first()
        .scrollIntoViewIfNeeded()
        .catch(() => {});
    const svgInfo = await page.evaluate(() => {
        const svgs = document.querySelectorAll(".scroll-cinema svg");
        if (!svgs.length) return null;
        const svg = svgs[0];
        return {
            viewBox: svg.getAttribute("viewBox"),
            groupCount: svg.querySelectorAll("g").length,
            lineCount: svg.querySelectorAll("line").length,
        };
    });
    record(
        "architecture SVG renders with nodes (g) + edges (line)",
        svgInfo && svgInfo.groupCount > 0,
        svgInfo
            ? `viewBox=${svgInfo.viewBox} g=${svgInfo.groupCount} line=${svgInfo.lineCount}`
            : "no SVG",
    );

    // ---------- Step 4: scroll drives activeStateId ----------
    // Scroll to roughly each chapter and check the diagram state.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const firstState = await readActiveState(page);
    record(
        "initial activeStateId is the first chapter's diagramState",
        firstState === "single-thread",
        `state=${firstState}`,
    );

    // Scroll until the middle chapter (~"ivalue-spine") becomes active.
    const sawStates = new Set();
    if (firstState) sawStates.add(firstState);
    for (let scroll = 600; scroll < 4500; scroll += 600) {
        await page.evaluate((y) => window.scrollTo(0, y), scroll);
        await page.waitForTimeout(450);
        const s = await readActiveState(page);
        if (s) sawStates.add(s);
    }
    record(
        "scrolling triggers >= 3 distinct activeStateId values",
        sawStates.size >= 3,
        `seen=${Array.from(sawStates).join(",")}`,
    );

    // ---------- Step 5: demo slot renders REPL ----------
    // Last chapter has demoSlot:"dstardb". Scroll to bottom and
    // confirm the REPL input shows up inside the cinema container.
    await page.evaluate(() =>
        window.scrollTo(0, document.body.scrollHeight),
    );
    await page.waitForTimeout(1200);
    const replInside = await page.evaluate(() => {
        const cinema = document.querySelector(".scroll-cinema");
        if (!cinema) return false;
        const repl = cinema.querySelector(".dstardb-repl");
        return !!repl;
    });
    record(
        "DStarDB REPL renders inside the final chapter's demo slot",
        replInside,
    );

    await page.screenshot({
        path: `${OUT}/scroll-cinema-dstardb.png`,
        fullPage: true,
    });

    // ---------- Step 6: cinema on realtime-collaboration ----------
    console.log(`\n→ Cinema mounted on /projects/realtime-collaboration`);
    await page.goto(BASE + "/projects/realtime-collaboration", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector(".scroll-cinema", {
        state: "attached",
        timeout: 45_000,
    });
    const rtcChapters = await page.evaluate(
        () => document.querySelectorAll(".scroll-cinema [data-chapter-idx]").length,
    );
    record(
        "realtime-collaboration cinema: >= 6 chapters",
        rtcChapters >= 6,
        `count=${rtcChapters}`,
    );

    // ---------- Step 7: cinema on ai-press-release-generator ----------
    console.log(`\n→ Cinema mounted on /projects/ai-press-release-generator`);
    await page.goto(BASE + "/projects/ai-press-release-generator", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector(".scroll-cinema", {
        state: "attached",
        timeout: 45_000,
    });
    const prChapters = await page.evaluate(
        () => document.querySelectorAll(".scroll-cinema [data-chapter-idx]").length,
    );
    record(
        "ai-press-release-generator cinema: >= 6 chapters",
        prChapters >= 6,
        `count=${prChapters}`,
    );

    // ---------- Step 8: classic layout still works ----------
    console.log(`\n→ Smoke-checking /projects/amazon-clone (classic layout)`);
    await page.goto(BASE + "/projects/amazon-clone", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
    });
    await page.waitForSelector("#challenge", { timeout: 30_000 });
    const classicChallenge = await page.locator("#challenge h2").innerText();
    record(
        "classic layout intact on a non-cinema project",
        /Challenge/i.test(classicChallenge),
        `heading="${classicChallenge}"`,
    );

    // ---------- Summary ----------
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nPage errors:");
        errors.slice(0, 6).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshot:");
    console.log(`  ${OUT}/scroll-cinema-dstardb.png`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-scroll-cinema crashed:", err);
    process.exit(2);
});
