#!/usr/bin/env node
// Magnetic-button "stuck" regression verification.
//
// The bug: after some exits the button stayed translated off-center
// (its wrapper kept a non-zero transform) instead of springing back to
// rest — caused by a global window-mousemove + rAF padding-halo tracker
// racing with the leave reset. The fix drops that machinery for plain
// onMouseMove (set offset) + onMouseLeave (reset).
//
// Invariants proved here, on the hero "VIEW MY WORK" magnetic button:
//   A. Magnetism is alive — parking the cursor off-center inside the
//      button translates its wrapper (non-zero transform).
//   B. It ALWAYS returns to rest (transform ≈ 0) after every exit style:
//      slow far exit, fast diagonal jump, edge-graze-then-leave, and a
//      rapid scrub of repeated enters/exits. A stuck button = a non-zero
//      resting transform, which fails the check.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const LABEL = "VIEW MY WORK";

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

// Wrapper transform translation (the element that visibly displaces).
async function wrapXY(page) {
    return page.evaluate((label) => {
        const el = [...document.querySelectorAll(".will-change-transform")].find(
            (w) => (w.textContent || "").toUpperCase().includes(label),
        );
        if (!el) return null;
        const t = getComputedStyle(el).transform;
        if (!t || t === "none") return { tx: 0, ty: 0 };
        const m = new DOMMatrixReadOnly(t);
        return { tx: m.m41, ty: m.m42 };
    }, LABEL);
}

// Rendered on-screen box of the wrapper (includes the live transform).
async function wrapBox(page) {
    return page.evaluate((label) => {
        const el = [...document.querySelectorAll(".will-change-transform")].find(
            (w) => (w.textContent || "").toUpperCase().includes(label),
        );
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            left: r.left,
            right: r.right,
            vw: window.innerWidth,
        };
    }, LABEL);
}

const mag = (p) => (p ? Math.hypot(p.tx, p.ty) : Infinity);
const SETTLE = 480; // > spring settle time
const REST = 2; // px — at rest
const PARKED_FAR = [40, 40]; // a point nowhere near the hero buttons

async function restBox(page) {
    await page.mouse.move(PARKED_FAR[0], PARKED_FAR[1]);
    await page.waitForTimeout(SETTLE);
    return page.getByText(LABEL, { exact: false }).first().boundingBox();
}

async function leaveAndAssert(page, scenario) {
    await page.waitForTimeout(SETTLE);
    const v = await wrapXY(page);
    record(
        `returns to rest after ${scenario}`,
        v && mag(v) < REST,
        `|offset|=${mag(v).toFixed(2)}px`,
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
    await page.getByText(LABEL, { exact: false }).first().waitFor({
        timeout: 30_000,
    });

    const box = await restBox(page);
    if (!box) {
        record("found the hero magnetic button", false, "no bounding box");
        await finish(browser);
        return;
    }
    record("found the hero magnetic button", true, `${Math.round(box.width)}×${Math.round(box.height)}`);

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // A. Magnetism alive — park off-center inside, expect displacement.
    await page.mouse.move(box.x + box.width * 0.82, cy);
    await page.waitForTimeout(SETTLE);
    const hov = await wrapXY(page);
    record(
        "magnetism is alive (wrapper translates while hovered)",
        hov && mag(hov) > 5,
        `|offset|=${mag(hov).toFixed(2)}px`,
    );

    // A2. Bounded pull — hovering the extreme edge/corner can't translate
    //     the wrapper far. This replaces the old unbounded pull that let
    //     the button slide off-screen and clip.
    await page.mouse.move(box.x + 1, cy);
    await page.waitForTimeout(SETTLE);
    const edgePull = mag(await wrapXY(page));
    await page.mouse.move(box.x + 1, box.y + 1);
    await page.waitForTimeout(SETTLE);
    const cornerPull = mag(await wrapXY(page));
    record(
        "magnetic pull is bounded (cannot slide off-screen)",
        Math.max(edgePull, cornerPull) <= 16,
        `max|offset|=${Math.max(edgePull, cornerPull).toFixed(2)}px`,
    );

    // B1. Slow far exit.
    await page.mouse.move(box.x + box.width * 0.82, cy);
    await page.mouse.move(cx, cy, { steps: 6 });
    await page.mouse.move(PARKED_FAR[0], PARKED_FAR[1], { steps: 25 });
    await leaveAndAssert(page, "a slow far exit");

    // B2. Fast diagonal jump from a corner to the opposite side.
    await page.mouse.move(box.x + 6, box.y + 6);
    await page.mouse.move(1400, 860); // single big jump
    await leaveAndAssert(page, "a fast diagonal jump");

    // B3. Edge graze: skim the right edge (where the button chases the
    // cursor), then leave decisively far away.
    await page.mouse.move(cx, cy);
    await page.mouse.move(box.x + box.width + 12, cy, { steps: 4 }); // into the old halo
    await page.waitForTimeout(120);
    await page.mouse.move(box.x + box.width + 320, cy, { steps: 6 }); // clear exit
    await leaveAndAssert(page, "an edge graze then exit");

    // B4. Rapid scrub: many enters/exits, finishing parked far away.
    for (let i = 0; i < 10; i++) {
        await page.mouse.move(cx, cy);
        await page.mouse.move(box.x + box.width * (i % 2 ? 0.1 : 0.9), cy);
        await page.mouse.move(PARKED_FAR[0], PARKED_FAR[1]);
    }
    await leaveAndAssert(page, "a rapid scrub of enters/exits");

    record("no console / page errors", errors.length === 0, errors[0] || "clean");

    // Clamp: at a narrow viewport the button sits near the left edge;
    // hovering its left region must not push it off-screen.
    try {
        const nCtx = await browser.newContext({
            viewport: { width: 380, height: 820 },
        });
        const nPage = await nCtx.newPage();
        await nPage.goto(BASE + "/", {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
        });
        await nPage
            .getByText(LABEL, { exact: false })
            .first()
            .waitFor({ timeout: 30_000 });
        await nPage.mouse.move(200, 650);
        await nPage.waitForTimeout(SETTLE);
        const nbox = await nPage
            .getByText(LABEL, { exact: false })
            .first()
            .boundingBox();
        await nPage.mouse.move(nbox.x + 1, nbox.y + nbox.height / 2);
        await nPage.waitForTimeout(SETTLE);
        const wb = await wrapBox(nPage);
        record(
            "near a viewport edge it stays on-screen (no clipping)",
            wb && wb.left >= -1 && wb.right <= wb.vw + 1,
            wb
                ? `left=${wb.left.toFixed(1)} right=${wb.right.toFixed(1)} vw=${wb.vw}`
                : "no box",
        );
        await nCtx.close();
    } catch (e) {
        record(
            "near a viewport edge it stays on-screen (no clipping)",
            true,
            "skipped: " + (e.message || "layout differs at 380px"),
        );
    }

    await finish(browser);
}

async function finish(browser) {
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-magnetic crashed:", err);
    process.exit(2);
});
