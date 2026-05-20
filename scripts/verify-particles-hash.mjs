#!/usr/bin/env node
// Hash-load regression for the particle hero. Verifies three cases:
//   1. Plain `/` load — letters form in the hero text region.
//   2. `/#projects` load — page is scrolled past the hero at mount,
//      so the spring sampler must use document coords. After scrolling
//      back to the top, letters must form (the goal track scroll).
//   3. Mid-scroll (e.g. ~scrollY=200) — `effective_goal = goal - scroll`
//      should pull the formation up by ~200 device px, so the letter
//      band shifts to the upper part of the visible canvas.
//
// All three cases must pass for the scroll-uniform fix to be correct.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
const HEADED = process.env.HEADED === "true";
mkdirSync(OUT, { recursive: true });

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

// Sum the (R+G+B)/3 across a box of pixels on the live canvas.
async function boxLuminance(page, x0Pct, y0Pct, wPct, hPct) {
    return await page.evaluate(
        ({ x0Pct, y0Pct, wPct, hPct }) => {
            const c = document.querySelector("[data-renderer] canvas");
            if (!c) return null;
            const off = new OffscreenCanvas(c.width, c.height);
            const ctx = off.getContext("2d");
            ctx.drawImage(c, 0, 0);
            const d = ctx.getImageData(0, 0, c.width, c.height).data;
            const x0 = Math.floor(c.width * x0Pct);
            const y0 = Math.floor(c.height * y0Pct);
            const w = Math.floor(c.width * wPct);
            const h = Math.floor(c.height * hPct);
            let sum = 0;
            let count = 0;
            for (let y = y0; y < y0 + h; y += 4) {
                for (let x = x0; x < x0 + w; x += 4) {
                    const i = (y * c.width + x) * 4;
                    sum += d[i] + d[i + 1] + d[i + 2];
                    count++;
                }
            }
            return sum / (count * 3);
        },
        { x0Pct, y0Pct, wPct, hPct },
    );
}

async function diag(page) {
    return await page.evaluate(() => {
        const el = document.querySelector("[data-renderer]");
        const c = document.querySelector("[data-renderer] canvas");
        return {
            scrollY: window.scrollY,
            innerHeight: window.innerHeight,
            renderer: el?.getAttribute("data-renderer"),
            opacity: el ? getComputedStyle(el).opacity : null,
            position: el ? getComputedStyle(el).position : null,
            canvasSize: c ? { w: c.width, h: c.height } : null,
        };
    });
}

async function main() {
    const browser = await chromium.launch({
        headless: !HEADED,
        args: [
            "--enable-unsafe-webgpu",
            "--enable-features=Vulkan,WebGPU",
            "--use-angle=metal",
        ],
    });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });

    // -------------- Case 1: plain `/` load --------------
    console.log("\n[Case 1] Loading /  (expect formation at hero)");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500);
    const d1 = await diag(page);
    console.log("diag:", d1);
    record(
        "Case 1: container is fixed (viewport-spanning)",
        d1.position === "fixed",
        `position=${d1.position}`,
    );
    record(
        "Case 1: scrolled to top",
        d1.scrollY < 50,
        `scrollY=${d1.scrollY}`,
    );

    // Hero text sits in the upper-left quadrant — measure luminance.
    const text1 = await boxLuminance(page, 0, 0.25, 0.48, 0.45);
    const right1 = await boxLuminance(page, 0.55, 0.25, 0.4, 0.45);
    record(
        "Case 1: letters form in hero text region",
        text1 > right1 * 1.4,
        `text=${text1.toFixed(2)} vs right=${right1.toFixed(2)}`,
    );
    await page.screenshot({
        path: `${OUT}/particles-hash-01-home.png`,
        fullPage: false,
    });

    // -------------- Case 2: /#projects, then scroll back --------------
    console.log("\n[Case 2] Loading /#projects  (page scrolls past hero)");
    await page.goto(BASE + "/#projects", { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    const d2a = await diag(page);
    console.log("diag at hash-load:", d2a);
    record(
        "Case 2: page actually scrolled past hero",
        d2a.scrollY > 500,
        `scrollY=${d2a.scrollY}`,
    );

    // Now scroll back to top — letters should form when we land.
    console.log("Scrolling back to top");
    await page.evaluate(() =>
        window.scrollTo({ top: 0, behavior: "instant" }),
    );
    // Let the springs settle (per-particle k variance gives a long
    // "stragglers" tail).
    await page.waitForTimeout(2500);
    const d2b = await diag(page);
    console.log("diag after scroll-back:", d2b);
    record(
        "Case 2: scrolled back to top",
        d2b.scrollY < 50,
        `scrollY=${d2b.scrollY}`,
    );
    record(
        "Case 2: opacity restored",
        parseFloat(d2b.opacity || "0") > 0.9,
        `opacity=${d2b.opacity}`,
    );

    const text2 = await boxLuminance(page, 0, 0.25, 0.48, 0.45);
    const right2 = await boxLuminance(page, 0.55, 0.25, 0.4, 0.45);
    record(
        "Case 2: letters form after scroll-back from #projects",
        text2 > right2 * 1.4,
        `text=${text2.toFixed(2)} vs right=${right2.toFixed(2)}`,
    );
    await page.screenshot({
        path: `${OUT}/particles-hash-02-back-to-top.png`,
        fullPage: false,
    });

    // -------------- Case 3: mid-scroll formation shift --------------
    console.log("\n[Case 3] Scrolling to ~scrollY=200 (mid-fade)");
    await page.evaluate(() => window.scrollTo({ top: 200, behavior: "instant" }));
    await page.waitForTimeout(900);
    const d3 = await diag(page);
    console.log("diag mid-scroll:", d3);
    record(
        "Case 3: scrolled to ~200",
        d3.scrollY >= 180 && d3.scrollY <= 240,
        `scrollY=${d3.scrollY}`,
    );

    // At scrollY=200 CSS, dpr=1, effective_goal_y shifts up by ~200
    // device-px. The hero h1 originally sits in the middle band of the
    // canvas (~y_pct 0.45..0.65). After scroll, it should shift up by
    // ~200/900 = 0.22 → land in roughly the upper-middle band
    // (~y_pct 0.23..0.43).
    const shifted = await boxLuminance(page, 0, 0.20, 0.48, 0.25);
    const original = await boxLuminance(page, 0, 0.55, 0.48, 0.2);
    record(
        "Case 3: formation shifted upward (matches scroll offset)",
        shifted > original * 1.2,
        `shifted=${shifted.toFixed(2)} vs original=${original.toFixed(2)}`,
    );
    await page.screenshot({
        path: `${OUT}/particles-hash-03-mid-scroll.png`,
        fullPage: false,
    });

    // -------------- Summary --------------
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) {
        for (const c of checks.filter((c) => !c.pass)) {
            console.log("  - " + c.name);
        }
    }
    if (errors.length) {
        console.log("\nConsole errors:");
        errors.slice(0, 5).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshots:");
    console.log(`  01-home:          ${OUT}/particles-hash-01-home.png`);
    console.log(`  02-back-to-top:   ${OUT}/particles-hash-02-back-to-top.png`);
    console.log(`  03-mid-scroll:    ${OUT}/particles-hash-03-mid-scroll.png`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-particles-hash crashed:", err);
    process.exit(2);
});
