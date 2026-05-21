#!/usr/bin/env node
// Playwright check for the press-release pipeline embedded on
// /projects/ai-press-release-generator. Validates:
//   1. The page mounts and the demo card renders.
//   2. Run pipeline → ingest, summarize, translate, tts, compose,
//      distribute all reach their final state.
//   3. Multiple translations land in the 10-language grid (one per
//      PIB language). Some upstream failures are OK — they should
//      surface as a "fallback" / "error" source label, NOT crash.
//   4. The Canvas slideshow has drawn pixels by the end of compose
//      (non-trivial pixel variance in the slide region).
//   5. The "distribute" stage shows the simulated upload URLs.
//
// TTS in headless Chromium often falls back to "skipped" because no
// system voices are available — that's expected and the test does
// not treat skipped TTS as a failure.

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

async function waitForStageState(page, stageLabel, targetClassFragment, timeoutMs = 90_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const matched = await page.evaluate(
            ({ stageLabel, frag }) => {
                const items = Array.from(
                    document.querySelectorAll(
                        ".press-release-pipeline ol li",
                    ),
                );
                for (const li of items) {
                    const head = li.querySelector("div.font-semibold");
                    if (!head) continue;
                    if (head.textContent && head.textContent.includes(stageLabel)) {
                        return head.className.includes(frag);
                    }
                }
                return false;
            },
            { stageLabel, frag: targetClassFragment },
        );
        if (matched) return true;
        await page.waitForTimeout(400);
    }
    return false;
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: ["--enable-features=SpeechSynthesisDisabled=0"],
    });
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message + "\n" + (e.stack || "")));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });

    console.log(`\n→ Loading ${BASE}/projects/ai-press-release-generator`);
    // Dev-mode cold-compile of the Cache-Components route + the
    // dynamic ssr:false component can take 30-60s on first hit;
    // subsequent runs are sub-2s. Long timeouts here just absorb
    // that — in prod the whole load is <1s.
    await page.goto(BASE + "/projects/ai-press-release-generator", {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
    });
    await page.waitForSelector(".press-release-pipeline", {
        state: "attached",
        timeout: 60_000,
    });
    await page
        .locator(".press-release-pipeline")
        .scrollIntoViewIfNeeded()
        .catch(() => {});
    await page.waitForSelector(".press-release-pipeline", { timeout: 20_000 });
    await page
        .locator(".press-release-pipeline")
        .scrollIntoViewIfNeeded()
        .catch(() => {});

    record(
        "pipeline card mounted",
        await page.locator(".press-release-pipeline").isVisible(),
    );
    record(
        "stage list shows all 6 stages",
        (await page
            .locator(".press-release-pipeline ol li")
            .count()) === 6,
        `count=${await page.locator(".press-release-pipeline ol li").count()}`,
    );

    console.log("\n→ Clicking Run pipeline");
    await page
        .locator(".press-release-pipeline button", { hasText: /Run pipeline/i })
        .click();

    // Ingest + summarize should land quickly (sync).
    const ingestDone = await waitForStageState(
        page,
        "Ingest",
        "text-emerald-300",
        10_000,
    );
    record("ingest reached DONE", ingestDone);
    const summarizeDone = await waitForStageState(
        page,
        "Summarize",
        "text-emerald-300",
        10_000,
    );
    record("summarize reached DONE", summarizeDone);

    // Translate fans out to 10 languages. MyMemory can be slow + flaky,
    // so give it a generous window — the fallback path also counts.
    const translateDone = await waitForStageState(
        page,
        "Translate",
        "text-emerald-300",
        90_000,
    );
    record("translate reached DONE (10 langs)", translateDone);

    const translationCount = await page.evaluate(() => {
        return document.querySelectorAll(
            ".press-release-pipeline .grid > div",
        ).length;
    });
    record(
        "10-language grid rendered",
        translationCount >= 10,
        `cards=${translationCount}`,
    );

    // Compose & distribute. TTS may be "skipped" in headless — both
    // emerald-300 (done) and rose-300 (error) are acceptable for tts.
    const composeDone = await waitForStageState(
        page,
        "Compose",
        "text-emerald-300",
        60_000,
    );
    record("compose reached DONE", composeDone);
    const distributeDone = await waitForStageState(
        page,
        "Distribute",
        "text-emerald-300",
        15_000,
    );
    record("distribute reached DONE", distributeDone);

    // Canvas has non-trivial pixel variance (something was drawn).
    const pixelVariance = await page.evaluate(() => {
        const c = document.querySelector(".press-release-pipeline canvas");
        if (!c) return null;
        const off = new OffscreenCanvas(c.width, c.height);
        const cx = off.getContext("2d");
        cx.drawImage(c, 0, 0);
        const d = cx.getImageData(0, 0, c.width, c.height).data;
        // Mean luminance + stdev as a "did we paint anything" proxy.
        let sum = 0;
        let sumSq = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 16) {
            const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
            sum += lum;
            sumSq += lum * lum;
            n++;
        }
        const mean = sum / n;
        const variance = sumSq / n - mean * mean;
        return { mean, stdev: Math.sqrt(variance) };
    });
    record(
        "canvas has rendered slides (non-trivial pixel variance)",
        pixelVariance && pixelVariance.stdev > 5,
        pixelVariance
            ? `mean=${pixelVariance.mean.toFixed(1)} stdev=${pixelVariance.stdev.toFixed(1)}`
            : "no canvas",
    );

    // Distribute output panel surfaced.
    const distributeText = await page
        .locator(".press-release-pipeline")
        .innerText();
    record(
        "distribute panel shows simulated upload URLs",
        /uploaded · prId=\d+/.test(distributeText) &&
            /gs:\/\/.*\.mp4/.test(distributeText),
    );

    await page.screenshot({
        path: `${OUT}/press-release-pipeline.png`,
        fullPage: false,
    });

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed)
        for (const c of checks.filter((c) => !c.pass))
            console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nPage errors:");
        errors.slice(0, 6).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshot:");
    console.log(`  ${OUT}/press-release-pipeline.png`);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-press-release crashed:", err);
    process.exit(2);
});
