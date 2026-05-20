#!/usr/bin/env node
// Headless-browser verification of the portfolio. Drives Chromium via
// Playwright, asserts DOM contents + console cleanliness + visual layout.
// Run after `npm run dev` is up on :3000.
//
// Usage: node scripts/verify-browser.mjs

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots");
mkdirSync(OUT, { recursive: true });

const tests = [];
function check(name, predicate, detail = "") {
    tests.push({ name, pass: !!predicate, detail });
    process.stdout.write(`${predicate ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`);
}

const consoleErrors = [];
const consoleWarns = [];

async function main() {
    const browser = await chromium.launch();
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();

    page.on("console", (msg) => {
        const text = msg.text();
        if (msg.type() === "error") consoleErrors.push(text);
        if (msg.type() === "warning") consoleWarns.push(text);
    });
    page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

    // -------------------------------------------------------------- C1+C2
    console.log("\n→ Loading /");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(600); // give the topology a tick to mount

    // C1: SystemTopology — 7 nodes by label
    const nodeLabels = ["Gateway", "Auth", "API", "Cache", "DB", "Queue", "Worker"];
    for (const label of nodeLabels) {
        const count = await page.locator(`svg text:has-text("${label}")`).count();
        check(`C1: SystemTopology node "${label}"`, count >= 1, `found=${count}`);
    }

    // C1: status chip
    const statusChip = await page.locator("text=7 services").count();
    check("C1: status chip '7 services · p99 < 300ms'", statusChip >= 1);

    // C2: hero copy
    const dhruv = await page.locator("h1:has-text('DHRUV')").count();
    check("C2: hero name 'DHRUV'", dhruv >= 1);
    const tagline = await page.locator("text=Engineering, demonstrated").count();
    check("C2: tagline 'Engineering, demonstrated.'", tagline >= 1);
    const desc150k = await page.locator("text=/150k\\+ MAU/i").count();
    check("C2: description contains '150k+ MAU'", desc150k >= 1);

    await page.screenshot({ path: `${OUT}/01-home.png`, fullPage: false });

    // -------------------------------------------------------------- C3
    console.log("\n→ Testing View Transitions (navigate to /blog)");
    const startUrl = page.url();

    // The home page's blog section may not show an /blog link when the
    // dev.to API returns no articles. So navigate via direct URL — that
    // still passes through the client-side router, which triggers our
    // ViewTransitions interceptor on subsequent client navigations.
    await page.evaluate(() => {
        const link = document.createElement("a");
        link.href = "/blog";
        link.id = "vt-test-link";
        link.textContent = "go";
        document.body.appendChild(link);
    });
    await page.locator("#vt-test-link").click();
    await page.waitForURL("**/blog", { timeout: 10000 });
    const endUrl = page.url();
    check("C3: route changed to /blog", endUrl.includes("/blog") && endUrl !== startUrl, endUrl);
    check(
        "C3: View Transitions API present in browser",
        await page.evaluate(() => typeof document.startViewTransition === "function"),
    );

    // -------------------------------------------------------------- C6
    console.log("\n→ Checking Image sizes attrs back on /");
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);

    const fillNoSizes = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll("img"));
        // Next/Image with fill renders img with object-* + sizes attribute.
        // Find imgs that are stretched (style="object-fit") but missing sizes.
        return imgs
            .filter((i) => {
                const style = i.getAttribute("style") || "";
                return style.includes("object-fit") || i.style.objectFit;
            })
            .filter((i) => !i.getAttribute("sizes"))
            .map((i) => i.src);
    });
    check(
        "C6: every fill <img> has a sizes attr",
        fillNoSizes.length === 0,
        fillNoSizes.length ? `missing on: ${fillNoSizes.slice(0, 3).join(", ")}` : "",
    );

    // -------------------------------------------------------------- C7
    const hydrationErrors = consoleErrors.filter((e) =>
        /hydrat/i.test(e) || /didn't match/i.test(e),
    );
    check("C7: no hydration mismatch errors", hydrationErrors.length === 0, hydrationErrors[0] || "");

    // -------------------------------------------------------------- C9
    console.log("\n→ Scroll progress bar");
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(600);
    const progressVisible = await page.evaluate(() => {
        // The progress bar is a fixed top-0 h-[3px] motion.div with
        // origin-left and a gradient background.
        const candidates = Array.from(document.querySelectorAll('div[style]'))
            .filter((el) => {
                const s = window.getComputedStyle(el);
                return (
                    s.position === "fixed" &&
                    s.top === "0px" &&
                    parseFloat(s.height) <= 6 &&
                    parseFloat(s.zIndex) >= 50 &&
                    parseFloat(s.opacity) > 0
                );
            });
        return candidates.length > 0;
    });
    check("C9: scroll progress bar visible after scrolling", progressVisible);

    await page.screenshot({ path: `${OUT}/02-scrolled.png`, fullPage: false });

    // -------------------------------------------------------------- D4 (read from package, not runtime)
    const { default: pkg } = await import("../package.json", { with: { type: "json" } });
    const reactPin = pkg.dependencies?.react || "";
    check(
        "D4: package.json pins React 19",
        /^[\^~]?19\./.test(reactPin),
        `react=${reactPin}`,
    );

    // -------------------------------------------------------------- B5
    console.log("\n→ /blog/nonexistent renders not-found page");
    await page.goto(BASE + "/blog/this-does-not-exist-anywhere", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(800);
    const bodyText = await page.locator("body").innerText();
    check(
        "B5: /blog/<nonexistent> shows not-found content",
        /not.found|coming soon|404/i.test(bodyText),
        bodyText.slice(0, 100).replace(/\n/g, " "),
    );

    // -------------------------------------------------------------- C5 (reduced motion)
    console.log("\n→ prefers-reduced-motion path");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const motionPaths = await page.locator("animateMotion").count();
    check(
        "C5: animateMotion elements absent under prefers-reduced-motion",
        motionPaths === 0,
        `count=${motionPaths}`,
    );
    const reducedRenderer = await page
        .locator("[data-renderer]")
        .first()
        .getAttribute("data-renderer");
    check(
        "C5: particle hero falls back to 'static' under reduced-motion",
        reducedRenderer === "static",
        `data-renderer=${reducedRenderer}`,
    );
    await page.screenshot({ path: `${OUT}/03-reduced-motion.png`, fullPage: false });

    // -------------------------------------------------------------- P1.5 (particle hero)
    console.log("\n→ Particle hero renderer selection");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2500); // wait for worker init + shader fetch
    const particleContainer = await page.locator("[data-renderer]").first();
    const particleExists = (await particleContainer.count()) > 0;
    check("P1.5: particle hero container mounted", particleExists);
    const chosenRenderer = particleExists
        ? await particleContainer.getAttribute("data-renderer")
        : null;
    check(
        "P1.5: particle hero picked a renderer (webgpu | canvas2d | static)",
        ["webgpu", "canvas2d", "static"].includes(chosenRenderer),
        `data-renderer=${chosenRenderer}`,
    );
    await page.screenshot({ path: `${OUT}/04-particles.png`, fullPage: false });
    const particleErrors = consoleErrors.filter((e) => /particles|webgpu/i.test(e));
    check(
        "P1.5: no particle-specific console errors",
        particleErrors.length === 0,
        particleErrors[0] || "",
    );

    // -------------------------------------------------------------- Summary
    console.log("\n--- Summary ---");
    const passed = tests.filter((t) => t.pass).length;
    const failed = tests.filter((t) => !t.pass).length;
    console.log(`Passed: ${passed}/${tests.length}`);
    if (failed) {
        console.log(`Failed: ${failed}`);
        for (const t of tests.filter((t) => !t.pass)) {
            console.log(`  - ${t.name}${t.detail ? "  (" + t.detail + ")" : ""}`);
        }
    }
    console.log(`Console errors recorded: ${consoleErrors.length}`);
    for (const e of consoleErrors.slice(0, 5)) console.log(`  err: ${e}`);
    console.log(`Console warnings recorded: ${consoleWarns.length}`);
    for (const w of consoleWarns.slice(0, 5)) console.log(`  warn: ${w}`);
    console.log(`\nScreenshots in ${OUT}`);

    await browser.close();
    process.exit(failed > 0 || consoleErrors.length > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-browser crashed:", err);
    process.exit(2);
});
