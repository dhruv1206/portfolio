#!/usr/bin/env node
// P5 polish verification: a11y skip-link/focus, audio first-visit
// prompt, voice onboarding bubble, footer discoverability hints.
//
// Each scenario uses a FRESH context so localStorage "seen" flags
// start clean.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

const checks = [];
function record(name, pass, detail = "") {
    checks.push({ name, pass });
    process.stdout.write(
        `${pass ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`,
    );
}

async function freshPage(browser, opts = {}) {
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        ...opts,
    });
    const page = await ctx.newPage();
    return { ctx, page };
}

async function main() {
    const browser = await chromium.launch({ headless: true });

    // ---------- A11y: skip-link + main target ----------
    console.log("→ a11y: skip-link + main target");
    {
        const { ctx, page } = await freshPage(browser);
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        const skip = page.locator("a.skip-to-content");
        const skipHref = await skip.getAttribute("href").catch(() => null);
        record(
            "skip-to-content link exists and targets #main-content",
            skipHref === "#main-content",
            `href=${skipHref}`,
        );
        const mainHasId = await page.evaluate(
            () => !!document.querySelector("main#main-content"),
        );
        record("main has id=main-content", mainHasId);

        // Focus the skip link → it should translate into view
        // (transform Y ~0 instead of -120%). Wait out the 0.18s
        // CSS transition before sampling the computed transform.
        await skip.focus();
        await page.waitForTimeout(350);
        const visibleOnFocus = await page.evaluate(() => {
            const el = document.querySelector("a.skip-to-content");
            if (!el) return false;
            const t = getComputedStyle(el).transform;
            // translateY(0) → matrix(1,0,0,1,0,0); hidden state has a
            // large negative Y. Treat "no large negative translate" as
            // visible.
            if (t === "none") return true;
            const m = t.match(/matrix\(.*,\s*(-?\d+\.?\d*)\)$/);
            const ty = m ? parseFloat(m[1]) : 0;
            return ty > -10;
        });
        record("skip link becomes visible on keyboard focus", visibleOnFocus);
        await ctx.close();
    }

    // ---------- Audio first-visit prompt ----------
    console.log("\n→ audio first-visit prompt");
    {
        const { ctx, page } = await freshPage(browser);
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(1200);
        const promptVisible = await page
            .locator("[data-audio-prompt]")
            .isVisible()
            .catch(() => false);
        record("audio prompt shows on first visit", promptVisible);

        if (promptVisible) {
            await page.locator("[data-audio-prompt-enable]").click();
            // Wait out the AnimatePresence exit spring before checking
            // the node is gone.
            await page.waitForTimeout(1100);
            const state = await page.evaluate(() => ({
                muted: window.localStorage.getItem("audio-muted"),
                seen: window.localStorage.getItem("audio-prompt-seen"),
                stillThere: !!document.querySelector("[data-audio-prompt]"),
            }));
            record(
                "enabling sets audio-muted=false + marks seen + dismisses",
                state.muted === "false" &&
                    state.seen === "true" &&
                    !state.stillThere,
                JSON.stringify(state),
            );
        }
        await ctx.close();
    }

    // ---------- Audio prompt does NOT reshow once seen ----------
    console.log("\n→ audio prompt respects the seen flag");
    {
        const { ctx, page } = await freshPage(browser);
        await page.addInitScript(() => {
            window.localStorage.setItem("audio-prompt-seen", "true");
        });
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(1000);
        const shown = await page
            .locator("[data-audio-prompt]")
            .count();
        record("audio prompt hidden when already seen", shown === 0, `count=${shown}`);
        await ctx.close();
    }

    // ---------- Audio prompt skipped under reduced-motion ----------
    console.log("\n→ audio prompt skipped under reduced-motion");
    {
        const { ctx, page } = await freshPage(browser, { reducedMotion: "reduce" });
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(1000);
        const shown = await page.locator("[data-audio-prompt]").count();
        record(
            "audio prompt suppressed under prefers-reduced-motion",
            shown === 0,
            `count=${shown}`,
        );
        await ctx.close();
    }

    // ---------- Voice onboarding bubble (conditional) ----------
    console.log("\n→ voice onboarding bubble");
    {
        const { ctx, page } = await freshPage(browser);
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.waitForTimeout(1500);
        // The voice button only renders if SpeechRecognition exists in
        // this browser. Headless Chromium often lacks it — in that case
        // the onboarding can't show and we skip rather than fail.
        const voiceButtonPresent = await page
            .locator('[aria-label="Voice Control"]')
            .count();
        if (voiceButtonPresent === 0) {
            console.log(
                "  ↷ SpeechRecognition unsupported in this browser — skipping (button + onboarding not rendered).",
            );
        } else {
            const onboard = await page.locator("[data-voice-onboarding]").count();
            record("voice onboarding bubble shows on first visit", onboard >= 1, `count=${onboard}`);
        }
        await ctx.close();
    }

    // ---------- Footer discoverability hints ----------
    console.log("\n→ footer hints");
    {
        const { ctx, page } = await freshPage(browser);
        await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 90_000 });
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(500);
        const footerText = await page.locator("footer").innerText();
        record(
            "footer: perf-HUD hint present",
            /to see how fast this is/i.test(footerText),
        );
        record(
            "footer: stealth-mode hint present",
            /printable resume/i.test(footerText),
        );
        const labLink = await page
            .locator('footer a[href="/lab"]')
            .count();
        record("footer: /lab link present", labLink >= 1, `count=${labLink}`);
        await ctx.close();
    }

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-polish crashed:", err);
    process.exit(2);
});
