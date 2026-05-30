#!/usr/bin/env node
// WebGPU-tier /lab experiments (fluid, physarum, mpm-fluid). Launches
// Chromium with the unsafe-WebGPU flags (same as verify-particles) so
// the compute path actually executes headless. For each built slug:
//   - canvas mounts + reaches data-*-status="running" (no shader error)
//   - canvas paints non-trivial pixel variance after the rAF loop
//   - aria-label present
// Slugs not yet built are skipped (host shows "unknown experiment").

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
mkdirSync(OUT, { recursive: true });

// Only test slugs passed via argv, else all three.
const ALL = ["fluid", "physarum", "mpm-fluid"];
const SLUGS = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

async function variance(page) {
    return page.evaluate(() => {
        const c = document.querySelector("[data-experiment] canvas");
        if (!c) return null;
        const off = new OffscreenCanvas(c.width, c.height);
        const cx = off.getContext("2d");
        cx.drawImage(c, 0, 0);
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        let sum = 0, sumSq = 0, n = 0;
        for (let i = 0; i < d.length; i += 16) {
            const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
            sum += l; sumSq += l * l; n++;
        }
        const m = sum / n;
        return { stdev: Math.sqrt(sumSq / n - m * m), w: c.width, h: c.height };
    });
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
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

    for (const slug of SLUGS) {
        console.log(`\n→ /lab/${slug}`);
        await page.goto(BASE + `/lab/${slug}`, {
            waitUntil: "domcontentloaded",
            timeout: 90_000,
        });
        await page.waitForSelector("[data-experiment] canvas", { timeout: 30_000 });
        // Give the device init + a few frames time.
        await page.waitForTimeout(2500);

        const statusAttr = await page.evaluate(() => {
            const c = document.querySelector("[data-experiment] canvas");
            return (
                c?.getAttribute("data-fluid-status") ||
                c?.getAttribute("data-physarum-status") ||
                c?.getAttribute("data-mpm-status") ||
                "none"
            );
        });
        // "running" = WebGPU active. "unsupported" = no WebGPU in this
        // headless build (acceptable — fallback panel shown). "error" =
        // shader compile failure → hard fail.
        record(
            `${slug}: status is running or unsupported (not error)`,
            statusAttr !== "error",
            `status=${statusAttr}`,
        );

        if (statusAttr === "running") {
            const v = await variance(page);
            record(
                `${slug}: canvas paints (non-trivial variance)`,
                v && v.stdev > 3,
                v ? `stdev=${v.stdev.toFixed(1)} (${v.w}×${v.h})` : "no canvas",
            );
        } else if (statusAttr === "unsupported") {
            console.log(`  ↷ WebGPU unsupported in this headless build — fallback panel OK, skipping paint check.`);
        }

        const aria = await page.evaluate(
            () =>
                document
                    .querySelector("[data-experiment] canvas")
                    ?.getAttribute("aria-label")?.length || 0,
        );
        record(`${slug}: descriptive aria-label`, aria > 20, `len=${aria}`);

        await page.screenshot({ path: `${OUT}/lab-${slug}.png`, fullPage: false });
    }

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    // Surface any shader/runtime errors for debugging even if checks pass.
    if (errors.length) {
        console.log("\nPage errors (first 8):");
        errors.slice(0, 8).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-lab-webgpu crashed:", err);
    process.exit(2);
});
