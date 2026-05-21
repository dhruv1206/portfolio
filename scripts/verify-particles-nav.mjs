#!/usr/bin/env node
// Regression check for the navigation cycle that broke particles:
//   / → /projects/dstardb → back to / → letters should re-form.
//
// Root cause (fixed): `transferControlToOffscreen` is one-shot per
// HTMLCanvasElement. When the canvas was rendered via JSX, React's
// reconciler (combined with View Transitions keeping the old DOM
// alive during the back-nav animation) could re-adopt the already-
// transferred canvas on remount, so the second WebGPU init threw
// `InvalidStateError`. Fix: create the canvas imperatively in the
// effect; remove it in cleanup. Each mount gets a virgin canvas.

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

async function readState(page) {
    return await page.evaluate(() => {
        const el = document.querySelector("[data-renderer]");
        const c = document.querySelector("[data-renderer] canvas");
        if (!c) {
            return {
                renderer: el?.getAttribute("data-renderer") || null,
                canvasCount: document.querySelectorAll("[data-renderer] canvas").length,
                hasCanvas: false,
            };
        }
        // Quick luminance check in the hero text region.
        const off = new OffscreenCanvas(c.width, c.height);
        const ctx = off.getContext("2d");
        ctx.drawImage(c, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        function box(x0, y0, w, h) {
            let s = 0,
                n = 0;
            for (let y = y0; y < y0 + h; y += 4) {
                for (let x = x0; x < x0 + w; x += 4) {
                    const i = (y * c.width + x) * 4;
                    s += d[i] + d[i + 1] + d[i + 2];
                    n++;
                }
            }
            return s / (n * 3);
        }
        const tw = Math.floor(c.width * 0.48);
        const th = Math.floor(c.height * 0.45);
        const ty = Math.floor(c.height * 0.25);
        return {
            renderer: el?.getAttribute("data-renderer") || null,
            canvasCount: document.querySelectorAll("[data-renderer] canvas").length,
            hasCanvas: true,
            canvasSize: { w: c.width, h: c.height },
            textLum: box(0, ty, tw, th),
            rightLum: box(Math.floor(c.width * 0.55), ty, Math.floor(c.width * 0.4), th),
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
        const t = m.text();
        if (m.type() === "error") errors.push(t);
    });

    // ----- Step 1: Land on / and confirm letters form -----
    console.log(`\n[Step 1] Loading ${BASE}/`);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2800);
    const s1 = await readState(page);
    console.log("state:", s1);
    record("step 1: renderer is webgpu or canvas2d", s1.renderer === "webgpu" || s1.renderer === "canvas2d");
    record("step 1: exactly one canvas in the container", s1.canvasCount === 1, `got ${s1.canvasCount}`);
    record(
        "step 1: letters form on first load",
        s1.hasCanvas && s1.textLum > s1.rightLum * 1.4,
        s1.hasCanvas ? `text=${s1.textLum.toFixed(2)} vs right=${s1.rightLum.toFixed(2)}` : "no canvas",
    );
    await page.screenshot({ path: `${OUT}/particles-nav-01-first.png` });

    // ----- Step 2: Navigate to /projects/dstardb -----
    console.log(`\n[Step 2] Navigating to /projects/dstardb via card click`);
    await page.evaluate(() =>
        document.getElementById("projects")?.scrollIntoView({ behavior: "instant" }),
    );
    await page.waitForTimeout(500);
    const cardLink = page.locator(
        '#projects article:has(h3:has-text("DStarDB")) a[href="/projects/dstardb"]',
    );
    await Promise.all([
        page.waitForURL(/\/projects\/dstardb$/, { timeout: 30000 }),
        cardLink.click(),
    ]);
    await page.waitForTimeout(1200);
    console.log("now at:", page.url());
    record("step 2: navigated to /projects/dstardb", page.url().endsWith("/projects/dstardb"));

    // ----- Step 3: Navigate back to / via browser back -----
    // Diagnostic: count containers + canvases on /projects/dstardb
    const onProjectPage = await page.evaluate(() => ({
        containers: document.querySelectorAll("[data-renderer]").length,
        canvasesInContainers: document.querySelectorAll("[data-renderer] canvas").length,
    }));
    console.log("on project page:", onProjectPage);

    console.log(`\n[Step 3] Going back to / via history.back()`);
    await Promise.all([
        page.waitForURL((url) => url.toString().endsWith("/") && !url.toString().endsWith("/projects/dstardb"), {
            timeout: 30000,
        }),
        page.goBack(),
    ]);
    await page.waitForTimeout(3000); // let particles settle
    const s3 = await readState(page);
    console.log("state:", s3);
    record("step 3: back on /", page.url().endsWith("/"));
    record("step 3: renderer still active", s3.renderer === "webgpu" || s3.renderer === "canvas2d");
    record(
        "step 3: exactly one canvas in the container (no leftover)",
        s3.canvasCount === 1,
        `got ${s3.canvasCount}`,
    );
    record(
        "step 3: letters re-form after navigation cycle",
        s3.hasCanvas && s3.textLum > s3.rightLum * 1.4,
        s3.hasCanvas ? `text=${s3.textLum.toFixed(2)} vs right=${s3.rightLum.toFixed(2)}` : "no canvas",
    );
    await page.screenshot({ path: `${OUT}/particles-nav-02-back.png` });

    // ----- Step 4: do the cycle once more (catches state leaks) -----
    console.log(`\n[Step 4] Repeat the cycle to make sure it stays clean`);
    await page.evaluate(() =>
        document.getElementById("projects")?.scrollIntoView({ behavior: "instant" }),
    );
    await page.waitForTimeout(500);
    await Promise.all([
        page.waitForURL(/\/projects\/dstardb$/, { timeout: 30000 }),
        cardLink.click(),
    ]);
    await page.waitForTimeout(1000);
    await Promise.all([
        page.waitForURL((url) => url.toString().endsWith("/") && !url.toString().endsWith("/projects/dstardb"), {
            timeout: 30000,
        }),
        page.goBack(),
    ]);
    await page.waitForTimeout(3000);
    const s4 = await readState(page);
    console.log("state:", s4);
    record(
        "step 4: still one canvas after second cycle",
        s4.canvasCount === 1,
        `got ${s4.canvasCount}`,
    );
    record(
        "step 4: letters still form after second cycle",
        s4.hasCanvas && s4.textLum > s4.rightLum * 1.4,
        s4.hasCanvas ? `text=${s4.textLum.toFixed(2)} vs right=${s4.rightLum.toFixed(2)}` : "no canvas",
    );
    await page.screenshot({ path: `${OUT}/particles-nav-03-after-2nd-cycle.png` });

    // ----- Summary -----
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nConsole / page errors:");
        errors.slice(0, 8).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshots:");
    console.log(`  01-first:            ${OUT}/particles-nav-01-first.png`);
    console.log(`  02-back:             ${OUT}/particles-nav-02-back.png`);
    console.log(`  03-after-2nd-cycle:  ${OUT}/particles-nav-03-after-2nd-cycle.png`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-particles-nav crashed:", err);
    process.exit(2);
});
