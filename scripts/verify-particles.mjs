#!/usr/bin/env node
// Particle-hero focused Playwright check.
// Launches Chromium with WebGPU flags + headful so the WebGPU code path
// actually executes locally, then exercises pointer interaction.
// Captures screenshots at: initial, mouse-over-text, mouse-away.

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
const HEADED = process.env.HEADED !== "false";
mkdirSync(OUT, { recursive: true });

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass, detail });
    process.stdout.write(`${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`);
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    const errors = [];
    const logs = [];
    page.on("console", (msg) => {
        const t = msg.text();
        if (msg.type() === "error") errors.push(t);
        if (/\[particles\]/.test(t)) logs.push(t);
    });
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

    console.log(`\n→ Loading ${BASE}/   (headed=${HEADED})`);
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    // Give the worker time to init + first frame to render.
    await page.waitForTimeout(2500);

    // ---- renderer + text sample diagnostics ----
    const state = await page.evaluate(() => {
        const containers = Array.from(document.querySelectorAll("[data-renderer]"));
        return {
            containerCount: containers.length,
            renderers: containers.map((c) => ({
                attr: c.getAttribute("data-renderer"),
                w: c.clientWidth,
                h: c.clientHeight,
                canvases: c.querySelectorAll("canvas").length,
                bounds: c.getBoundingClientRect().toJSON(),
            })),
            canvases: Array.from(document.querySelectorAll("canvas")).map((cv) => ({
                w: cv.width,
                h: cv.height,
                cssW: cv.clientWidth,
                cssH: cv.clientHeight,
                style: cv.getAttribute("style"),
                parentRenderer: cv.closest("[data-renderer]")?.getAttribute("data-renderer"),
            })),
            webgpuAvailable: !!navigator.gpu,
        };
    });
    console.log("state =", JSON.stringify(state, null, 2));
    const liveRenderer = state.renderers.find((r) => r.attr === "webgpu" || r.attr === "canvas2d");
    record("a live renderer (webgpu|canvas2d) exists", !!liveRenderer);
    const liveCanvas = state.canvases.find(
        (c) => c.parentRenderer === "webgpu" || c.parentRenderer === "canvas2d",
    );
    record(
        "live canvas has non-default backing store",
        liveCanvas && liveCanvas.w > 300 && liveCanvas.h > 150,
        liveCanvas ? `${liveCanvas.w}×${liveCanvas.h}` : "none",
    );

    await page.screenshot({ path: `${OUT}/particles-01-initial.png`, fullPage: false });

    // ---- text-formation luminance check ----
    // If particles really form letters, the avg luminance inside the
    // text rectangle should be much higher than outside it.
    const luminance = await page.evaluate(() => {
        const c = document.querySelector("[data-renderer] canvas");
        if (!c) return null;
        const off = new OffscreenCanvas(c.width, c.height);
        const ctx = off.getContext("2d");
        ctx.drawImage(c, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        function box(x0, y0, w, h) {
            let s = 0, n = 0;
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
        const th = Math.floor(c.height * 0.35);
        const ty = Math.floor(c.height * 0.32);
        return {
            text: box(0, ty, tw, th),
            outsideRight: box(Math.floor(c.width * 0.6), ty, Math.floor(c.width * 0.4), th),
            outsideTop: box(0, 0, c.width, Math.floor(c.height * 0.2)),
        };
    });
    console.log("luminance =", luminance);
    if (luminance) {
        record(
            "text region brighter than non-text regions",
            luminance.text > luminance.outsideRight * 1.5 && luminance.text > luminance.outsideTop * 1.5,
            `text=${luminance.text.toFixed(2)}, right=${luminance.outsideRight.toFixed(2)}, top=${luminance.outsideTop.toFixed(2)}`,
        );
    }

    // ---- mouse interaction ----
    console.log("\n→ Moving cursor across the hero text area");

    // Hero text on lg sits in the upper-left quadrant. Pick a coord
    // inside it.
    const heroBox = await page.locator('[data-renderer]').first().boundingBox();
    const target = {
        x: heroBox.x + heroBox.width * 0.25,
        y: heroBox.y + heroBox.height * 0.45,
    };
    const away = {
        x: heroBox.x + heroBox.width * 0.95,
        y: heroBox.y + heroBox.height * 0.05,
    };

    // Move cursor onto particles, wait, screenshot.
    await page.mouse.move(target.x, target.y, { steps: 8 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/particles-02-mouse-on.png`, fullPage: false });

    // Compare canvas pixels between initial vs mouse-on. If the layer is
    // alive AND mouse interaction is wired, the pixels in a window
    // around the cursor should differ.
    const pixelDiff = await page.evaluate(
        async ({ tx, ty }) => {
            const c = document.querySelector("[data-renderer] canvas");
            if (!c) return null;
            // Pull a 200x200 device-px window around the cursor position.
            const rect = c.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const cx = Math.floor((tx - rect.left) * dpr);
            const cy = Math.floor((ty - rect.top) * dpr);
            const off = new OffscreenCanvas(200, 200);
            const ctx = off.getContext("2d");
            ctx.drawImage(c, cx - 100, cy - 100, 200, 200, 0, 0, 200, 200);
            const data = ctx.getImageData(0, 0, 200, 200).data;
            // Reduce to a small fingerprint (mean R/G/B over the patch).
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i + 1]; b += data[i + 2];
            }
            const n = data.length / 4;
            return { r: r / n, g: g / n, b: b / n };
        },
        { tx: target.x, ty: target.y },
    );
    console.log("patch around cursor (mouse-on):", pixelDiff);

    // Move mouse away.
    console.log("\n→ Moving cursor away");
    await page.mouse.move(away.x, away.y, { steps: 8 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/particles-03-mouse-away.png`, fullPage: false });

    const pixelAway = await page.evaluate(
        async ({ tx, ty }) => {
            const c = document.querySelector("[data-renderer] canvas");
            if (!c) return null;
            const rect = c.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const cx = Math.floor((tx - rect.left) * dpr);
            const cy = Math.floor((ty - rect.top) * dpr);
            const off = new OffscreenCanvas(200, 200);
            const ctx = off.getContext("2d");
            ctx.drawImage(c, cx - 100, cy - 100, 200, 200, 0, 0, 200, 200);
            const data = ctx.getImageData(0, 0, 200, 200).data;
            let r = 0, g = 0, b = 0;
            for (let i = 0; i < data.length; i += 4) {
                r += data[i]; g += data[i + 1]; b += data[i + 2];
            }
            const n = data.length / 4;
            return { r: r / n, g: g / n, b: b / n };
        },
        { tx: target.x, ty: target.y }, // same patch coords as before
    );
    console.log("same patch (cursor moved away):", pixelAway);

    // If mouse interaction worked, the patch should be DARKER when the
    // cursor was over it (particles dispersed → less coverage) than
    // when the cursor is at the other corner (particles reformed).
    if (pixelDiff && pixelAway) {
        const lumOn = (pixelDiff.r + pixelDiff.g + pixelDiff.b) / 3;
        const lumAway = (pixelDiff.r === pixelAway.r ? lumOn : (pixelAway.r + pixelAway.g + pixelAway.b) / 3);
        record(
            "patch luminance changed between mouse-on and mouse-away",
            Math.abs(lumOn - lumAway) > 1.0,
            `Δ=${(lumAway - lumOn).toFixed(2)} (on=${lumOn.toFixed(2)}, away=${lumAway.toFixed(2)})`,
        );
    }

    // ---- summary ----
    console.log("\n--- particle logs from page ---");
    logs.forEach((l) => console.log("  " + l));
    if (errors.length) {
        console.log("\n--- console errors ---");
        errors.slice(0, 8).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshots:");
    console.log("  01-initial:  " + OUT + "/particles-01-initial.png");
    console.log("  02-mouse-on: " + OUT + "/particles-02-mouse-on.png");
    console.log("  03-mouse-away: " + OUT + "/particles-03-mouse-away.png");

    await browser.close();
    const failed = checks.filter((c) => !c.pass).length;
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-particles crashed:", err);
    process.exit(2);
});
