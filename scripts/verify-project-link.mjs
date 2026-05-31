#!/usr/bin/env node
// Quick check: from the homepage, clicking the DStarDB project card
// must land on /projects/dstardb (the case-study page that hosts the
// live REPL). The GitHub button on the same card must keep opening
// the external repo, not hijack the card click.

import { chromium } from "playwright";

const BASE = process.env.BASE_URL || "http://localhost:3000";

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
    await page.goto(BASE + "/", { waitUntil: "networkidle" });

    // Scroll to projects section
    await page.evaluate(() => {
        document.getElementById("projects")?.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForTimeout(800);

    // Find the DStarDB card by heading
    const card = page.locator(
        '#projects article:has(h3:has-text("DStarDB"))',
    );
    await card.first().waitFor({ state: "visible", timeout: 5000 });

    // Diagnostic: list every anchor inside the DStarDB card.
    const linksInCard = await card.first().evaluate((el) =>
        Array.from(el.querySelectorAll("a")).map((a) => ({
            href: a.getAttribute("href"),
            aria: a.getAttribute("aria-label"),
            target: a.getAttribute("target"),
            rect: a.getBoundingClientRect().toJSON(),
        })),
    );
    console.log("links in DStarDB card:", JSON.stringify(linksInCard, null, 2));

    console.log("→ Clicking the case-study Link on the card");
    const caseLink = card.locator(`a[href="/projects/dstardb"]`);
    // Watch URL changes so we see redirects
    const navTrace = [];
    page.on("framenavigated", (f) => {
        if (f === page.mainFrame()) navTrace.push(f.url());
    });
    await Promise.all([
        page.waitForURL(/projects\/dstardb/, { timeout: 5000 }).catch(() => {}),
        caseLink.click(),
    ]);
    await page.waitForTimeout(800);
    console.log("nav trace:", navTrace);

    const finalUrl = page.url();
    console.log("landed at:", finalUrl);
    const arrived = finalUrl.endsWith("/projects/dstardb");
    console.log(
        arrived
            ? "✓ card click navigates to /projects/dstardb"
            : `✗ expected /projects/dstardb, got ${finalUrl}`,
    );

    // Confirm REPL is present
    const replPresent = await page
        .locator(".dstardb-repl")
        .isVisible()
        .catch(() => false);
    console.log(
        replPresent
            ? "✓ case-study page renders DStarDB REPL"
            : "✗ REPL not visible on case-study page",
    );

    // Back out and confirm the Code button on the same card opens
    // GitHub (target=_blank → new tab in headless launches a popup).
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    await page.evaluate(() => {
        document.getElementById("projects")?.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForTimeout(400);
    const codeLink = page.locator(
        '#projects article:has(h3:has-text("DStarDB")) a[href*="github"]',
    );
    const codeHref = await codeLink.first().getAttribute("href").catch(() => null);
    console.log("Code button href:", codeHref);
    const codeOk = !!codeHref && codeHref.includes("DStar-DB");
    console.log(
        codeOk
            ? "✓ GitHub Code button points at the right repo"
            : "✗ GitHub Code button missing / wrong href",
    );

    if (errors.length) {
        console.log("\n--- console errors ---");
        errors.slice(0, 5).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    const failed = !(arrived && replPresent && codeOk);
    process.exit(failed ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-project-link crashed:", err);
    process.exit(2);
});
