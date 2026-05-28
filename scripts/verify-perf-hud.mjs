#!/usr/bin/env node
// P6 Perf HUD verification.
//
// 1. HUD is off by default — no `[data-perf-hud="open"]` element on
//    a freshly-loaded page.
// 2. Footer carries the discoverable hint with the backtick key.
// 3. Pressing backtick toggles the HUD open; pressing it again
//    toggles it closed.
// 4. While open: LCP / FCP / CLS / TTFB row labels are rendered.
//    (LCP / FCP / TTFB may not have a value yet on a freshly-loaded
//    page in headless mode, but the rows themselves must exist.)
// 5. FPS row reads a live number after a short delay (rAF loop is
//    running).
// 6. Pressing backtick while focus is inside an <input> does NOT
//    toggle (so typing a backtick in a form field works normally).

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

async function main() {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();

    console.log(`→ Loading ${BASE}/`);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2200);

    // 1. HUD is off by default.
    const initial = await page.locator('[data-perf-hud="open"]').count();
    record("HUD is closed on initial load", initial === 0, `count=${initial}`);

    // 2. Footer hint present.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    const footerText = await page.locator("footer").innerText();
    record(
        "footer carries the discoverable backtick hint",
        /press\s*`\s*to see how fast/i.test(footerText),
        `match=${/press/i.test(footerText)}`,
    );

    // 3. Press backtick → HUD opens.
    await page.keyboard.press("Backquote");
    await page.waitForTimeout(400);
    const open1 = await page.locator('[data-perf-hud="open"]').count();
    record("backtick opens the HUD", open1 === 1, `count=${open1}`);

    // 4. Vital row labels render.
    const hudText = await page.locator('[data-perf-hud="open"]').innerText();
    const labels = ["LCP", "INP", "CLS", "FCP", "TTFB", "FPS"];
    const missing = labels.filter((l) => !new RegExp(`\\b${l}\\b`).test(hudText));
    record(
        "all 6 metric rows render (LCP/INP/CLS/FCP/TTFB/FPS)",
        missing.length === 0,
        missing.length ? `missing=${missing.join(",")}` : "all present",
    );

    // 5. FPS reads a live number after the rAF loop runs for a bit.
    await page.waitForTimeout(1400);
    const fpsValue = await page.evaluate(() => {
        const hud = document.querySelector('[data-perf-hud="open"]');
        if (!hud) return null;
        // Find the FPS row — the row whose left label is "FPS".
        const rows = Array.from(hud.querySelectorAll("div.flex"));
        const fpsRow = rows.find((r) =>
            /^FPS$/i.test(r.querySelector("span")?.textContent?.trim() || ""),
        );
        if (!fpsRow) return null;
        const valueSpan = fpsRow.querySelectorAll("span")[1];
        const txt = valueSpan?.textContent?.trim();
        const n = parseInt(txt, 10);
        return Number.isFinite(n) ? n : null;
    });
    record(
        "FPS row reports a numeric value within 2 s of opening",
        fpsValue != null && fpsValue > 0 && fpsValue <= 240,
        `fps=${fpsValue}`,
    );

    await page.screenshot({ path: `${OUT}/perf-hud-open.png`, fullPage: false });

    // 6. Press backtick again → HUD closes.
    await page.keyboard.press("Backquote");
    await page.waitForTimeout(300);
    const open2 = await page.locator('[data-perf-hud="open"]').count();
    record("backtick toggles the HUD closed", open2 === 0, `count=${open2}`);

    // 7. Backtick while focused in an <input> doesn't toggle. Use a
    // throwaway input injected into the page so we don't depend on
    // any specific route's form mounting timing.
    await page.evaluate(() => {
        const i = document.createElement("input");
        i.id = "perf-hud-probe-input";
        i.style.cssText = "position:fixed;top:0;left:0;z-index:9999;";
        document.body.appendChild(i);
        i.focus();
    });
    await page.keyboard.press("Backquote");
    await page.waitForTimeout(300);
    const open3 = await page.locator('[data-perf-hud="open"]').count();
    const inputValue = await page
        .locator("#perf-hud-probe-input")
        .inputValue();
    record(
        "backtick inside an <input> does NOT open the HUD",
        open3 === 0,
        `count=${open3}, inputValue="${inputValue}"`,
    );

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-perf-hud crashed:", err);
    process.exit(2);
});
