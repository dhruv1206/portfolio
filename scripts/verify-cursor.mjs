#!/usr/bin/env node
// Cursor responsiveness + fluid-glow cost verification.
//
// The complaint this proves fixed: the custom cursor felt "genuinely
// laggy" (frame-delayed, not slow) and made the whole site feel laggy.
// Root causes were (1) the cursor dot was bound to a useSpring, so it
// eased toward the pointer over several frames, and (2) FluidCursor ran
// an unconditional rAF loop that re-blurred a full-viewport canvas
// (filter: blur(30px)) every frame, even at idle.
//
// Checks:
//  1. The cursor dot tracks the pointer 1:1 — after a teleport, its
//     committed transform equals the pointer within 2px (a spring would
//     still be mid-ease). THIS is the direct proof the lag is gone.
//  2. No <canvas> carries a `blur(...)` filter (the full-screen per-frame
//     blur is gone).
//  3. The fluid glow still PAINTS when the pointer moves (effect kept).
//  4. The fluid loop goes idle + clears once the pointer is still (zero
//     idle cost): the canvas is blank ~2.5s after the last movement.
//  5. Active-glow frame-rate stays healthy (soft, reported).
//  6. No console / page errors.
//  7. reduced-motion: the fluid glow is disabled, the cursor still tracks.

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

// Committed (computed) transform translation of the cursor dot.
async function dotXY(page) {
    return page.evaluate(() => {
        const el = document.querySelector('[data-custom-cursor="dot"]');
        if (!el) return null;
        const t = getComputedStyle(el).transform;
        if (!t || t === "none") return { tx: 0, ty: 0, raw: t };
        const m = new DOMMatrixReadOnly(t);
        return { tx: m.m41, ty: m.m42, raw: t };
    });
}

// Rendered width of the cursor RING's inner circle — expands on hover.
// (The dot is a constant small point now; the hover signal is the ring.)
async function ringInnerWidth(page) {
    return page.evaluate(() => {
        const ring = document.querySelector('[data-custom-cursor="ring"]');
        const inner = ring?.firstElementChild;
        return inner ? inner.getBoundingClientRect().width : null;
    });
}

// Variance of the screen-blend (fluid) canvas's pixel buffer, plus its
// CSS filter so we can assert no blur.
async function fluidStats(page) {
    return page.evaluate(() => {
        const fluid = [...document.querySelectorAll("canvas")].find(
            (c) => getComputedStyle(c).mixBlendMode === "screen",
        );
        if (!fluid) return null;
        const off = new OffscreenCanvas(fluid.width, fluid.height);
        const cx = off.getContext("2d");
        cx.drawImage(fluid, 0, 0);
        const d = cx.getImageData(0, 0, fluid.width, fluid.height).data;
        let sum = 0,
            sumSq = 0,
            n = 0;
        for (let i = 0; i < d.length; i += 64) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            sum += lum;
            sumSq += lum * lum;
            n++;
        }
        const mean = sum / n;
        return {
            stdev: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
            filter: getComputedStyle(fluid).filter,
            w: fluid.width,
            h: fluid.height,
        };
    });
}

async function anyCanvasHasBlur(page) {
    return page.evaluate(() =>
        [...document.querySelectorAll("canvas")].some((c) =>
            (getComputedStyle(c).filter || "").includes("blur"),
        ),
    );
}

// Drive a back-and-forth sweep that spawns fluid particles.
async function sweep(page) {
    await page.mouse.move(220, 240);
    await page.mouse.move(1180, 760, { steps: 50 });
    await page.mouse.move(300, 700, { steps: 50 });
    await page.mouse.move(1100, 220, { steps: 50 });
}

async function trackTest(page, label) {
    await page.mouse.move(320, 320);
    await page.waitForTimeout(150);
    const targets = [
        [1120, 700],
        [240, 200],
        [820, 460],
        [600, 800],
    ];
    let maxErr = 0;
    for (const [x, y] of targets) {
        await page.mouse.move(x, y); // single-step teleport
        await page.waitForTimeout(130); // >> a few frames; raw value commits
        const d = await dotXY(page);
        if (!d) {
            record(`${label}: cursor dot present`, false, "no dot element");
            return;
        }
        maxErr = Math.max(maxErr, Math.abs(d.tx - x), Math.abs(d.ty - y));
    }
    record(
        `${label}: cursor tracks pointer 1:1 (no spring lag)`,
        maxErr <= 2,
        `max error ${maxErr.toFixed(1)}px across ${targets.length} teleports`,
    );
}

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

    console.log(`→ Loading ${BASE}/`);
    await page.goto(BASE + "/", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector('[data-custom-cursor="dot"]', {
        timeout: 30_000,
    });

    // 1. The lag fix: dot tracks the pointer exactly.
    await trackTest(page, "default");

    // 1b. Hover signal: the rewritten `pointerover` delegation (which
    //     replaced the MutationObserver + per-element listeners) must
    //     expand the RING over interactive elements, then contract it
    //     off them. This is the exact path the rewrite changed.
    {
        const btn = await page
            .getByText("VIEW MY WORK", { exact: false })
            .first()
            .boundingBox();
        await page.mouse.move(btn.x + btn.width / 2, btn.y + btn.height / 2);
        await page.waitForTimeout(480);
        const grown = await ringInnerWidth(page);
        await page.mouse.move(760, 200); // blank hero area, nothing interactive
        await page.waitForTimeout(480);
        const shrunk = await ringInnerWidth(page);
        record(
            "cursor ring expands over interactive elements, contracts off them (hover delegation)",
            grown != null && shrunk != null && grown > 48 && shrunk < 44,
            `hover=${grown == null ? "?" : grown.toFixed(0)}px rest=${shrunk == null ? "?" : shrunk.toFixed(0)}px`,
        );
    }

    // 2. No full-screen blur anywhere.
    record(
        "no <canvas> carries a blur() filter",
        (await anyCanvasHasBlur(page)) === false,
        "blur filter removed from fluid cursor",
    );

    // 3. Fluid glow still paints on movement.
    await sweep(page);
    await page.waitForTimeout(120);
    const moving = await fluidStats(page);
    record(
        "fluid glow paints while the pointer moves",
        moving && moving.stdev > 0.5,
        moving
            ? `stdev=${moving.stdev.toFixed(2)} filter=${moving.filter}`
            : "no screen-blend canvas",
    );
    await page.screenshot({ path: `${OUT}/cursor-fluid-active.png` });

    // 5. Active-glow frame-rate (soft). Count rAF ticks across repeated
    //    sweeps; report fps. Only fails if catastrophically low.
    await page.evaluate(() => {
        window.__f = 0;
        window.__t0 = performance.now();
        const c = () => {
            window.__f++;
            window.__raf = requestAnimationFrame(c);
        };
        window.__raf = requestAnimationFrame(c);
    });
    for (let i = 0; i < 3; i++) {
        await sweep(page);
        await page.waitForTimeout(120);
    }
    const fr = await page.evaluate(() => {
        cancelAnimationFrame(window.__raf);
        return { frames: window.__f, ms: performance.now() - window.__t0 };
    });
    const fps = (fr.frames / fr.ms) * 1000;
    record(
        "active-glow frame-rate is healthy (soft)",
        fps >= 15,
        `${fps.toFixed(0)} fps over ${fr.ms.toFixed(0)}ms`,
    );

    // 4. Loop idles + clears once the pointer is still.
    await page.mouse.move(700, 450);
    await page.waitForTimeout(2600); // > trail lifetime; loop should stop
    const idle = await fluidStats(page);
    record(
        "fluid loop idles + clears when pointer is still (no idle cost)",
        idle && idle.stdev < 0.8,
        idle ? `stdev=${idle.stdev.toFixed(2)} (≈blank)` : "no canvas",
    );

    // 6. No errors.
    record(
        "no console / page errors",
        errors.length === 0,
        errors[0] || "clean",
    );
    await ctx.close();

    // 7. reduced-motion: fluid disabled, cursor still tracks.
    const rmCtx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        reducedMotion: "reduce",
    });
    const rmPage = await rmCtx.newPage();
    const rmErrors = [];
    rmPage.on("pageerror", (e) => rmErrors.push(e.message));
    rmPage.on("console", (m) => {
        if (m.type() === "error") rmErrors.push(m.text());
    });
    await rmPage.goto(BASE + "/", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await rmPage.waitForSelector('[data-custom-cursor="dot"]', {
        timeout: 30_000,
    });
    await rmPage.mouse.move(300, 300);
    await sweep(rmPage);
    await rmPage.waitForTimeout(150);
    const rmFluidExists = await rmPage.evaluate(
        () =>
            ![...document.querySelectorAll("canvas")].some(
                (c) => getComputedStyle(c).mixBlendMode === "screen",
            ),
    );
    record(
        "reduced-motion: fluid glow disabled (no screen-blend canvas)",
        rmFluidExists,
        "FluidCursor renders null under reduced motion",
    );
    await trackTest(rmPage, "reduced-motion");
    record(
        "reduced-motion: no errors",
        rmErrors.length === 0,
        rmErrors[0] || "clean",
    );
    await rmCtx.close();

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nPrimary-context errors:");
        errors.slice(0, 6).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-cursor crashed:", err);
    process.exit(2);
});
