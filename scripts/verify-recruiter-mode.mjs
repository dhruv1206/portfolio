#!/usr/bin/env node
// P5 Recruiter Mode verification.
//
// 1. /r returns 200 with TL;DR + role-fitter visible.
// 2. TL;DR card renders the 6 career stats.
// 3. Role-fitter analyses a JD and produces:
//    - a numeric fit score
//    - matched-skill chips
//    - "Why I fit" items grouped by kind
//    - an action row with mailto + PDF download.
// 4. Submitting an EMPTY JD does not score.
// 5. Sample-JD button populates the textarea.
// 6. The PDF API returns a real `application/pdf` blob for a JD.
// 7. The PDF route handles missing/empty JD gracefully (still returns
//    a PDF — just without the "fit %" block).

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
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));

    console.log(`→ Loading ${BASE}/r`);
    await page.goto(BASE + "/r", { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForSelector("[data-role-fitter]", { timeout: 30_000 });
    record("/r mounts the role-fitter", true);

    // 2. TL;DR shows 6 stats
    const tldrCount = await page.evaluate(
        () => document.querySelectorAll("[data-recruiter-tldr] .grid > div").length,
    );
    record("TL;DR renders 6 stat cards", tldrCount === 6, `count=${tldrCount}`);

    // 3. Click the sample-JD link.
    await page.locator("[data-role-fitter] button", { hasText: /try a sample/i }).click();
    await page.waitForTimeout(200);
    const sampleFilled = await page.locator("[data-role-fitter] textarea").inputValue();
    record(
        "sample-JD button populates the textarea",
        sampleFilled.length > 80,
        `chars=${sampleFilled.length}`,
    );

    // 4. Empty JD — analyze button is disabled.
    await page.locator("[data-role-fitter] textarea").fill("");
    await page.waitForTimeout(100);
    const submitDisabled = await page
        .locator("[data-role-fitter-submit]")
        .isDisabled();
    record("Analyze JD is disabled when textarea is empty", submitDisabled);

    // 5. Submit a real JD and verify the result shape.
    const realJd =
        "We're hiring a backend engineer to own our real-time collaboration platform. Strong Java, Spring Boot, Redis, WebRTC, microservices, AWS experience required. Bonus: low-latency systems, P99 work, prior multiplayer experience.";
    await page.locator("[data-role-fitter] textarea").fill(realJd);
    await page.locator("[data-role-fitter-submit]").click();
    await page.waitForTimeout(400);

    const matchedSkills = await page.evaluate(
        () => document.querySelectorAll("[data-matched-skill]").length,
    );
    record(
        "role-fitter renders >= 3 matched-skill chips",
        matchedSkills >= 3,
        `chips=${matchedSkills}`,
    );

    const items = await page.evaluate(
        () => document.querySelectorAll("[data-item-kind]").length,
    );
    record(
        "role-fitter renders >= 3 'why I fit' items",
        items >= 3,
        `items=${items}`,
    );

    const score = await page.evaluate(() => {
        const m = document.body.innerText.match(/(\d+)%/);
        return m ? Number(m[1]) : null;
    });
    record(
        "fit score renders as a percent between 0 and 100",
        score != null && score >= 0 && score <= 100,
        `score=${score}`,
    );

    // mailto link present + has matched-skill summary in subject
    const mailtoHref = await page
        .locator('a[data-action="mailto"]')
        .getAttribute("href");
    record(
        "mailto link present + carries the matched summary",
        /^mailto:/.test(mailtoHref || "") &&
            /Role%20fit/i.test(mailtoHref || ""),
    );

    const pdfHref = await page
        .locator('a[data-action="download-pdf"]')
        .getAttribute("href");
    record(
        "PDF download link present + carries the JD as query",
        (pdfHref || "").startsWith("/api/resume?jd="),
    );

    await page.screenshot({ path: `${OUT}/recruiter-r.png`, fullPage: true });

    // 6. Fetch the PDF via the API directly.
    const buf = await page.evaluate(async (url) => {
        const r = await fetch(url);
        const ct = r.headers.get("content-type");
        const b = await r.arrayBuffer();
        return { ok: r.ok, status: r.status, contentType: ct, size: b.byteLength };
    }, `/api/resume?jd=${encodeURIComponent(realJd)}`);
    record(
        "GET /api/resume?jd=... returns application/pdf",
        buf.ok &&
            /^application\/pdf/.test(buf.contentType || "") &&
            buf.size > 3000,
        `status=${buf.status} ct=${buf.contentType} bytes=${buf.size}`,
    );

    // 7. Empty JD still produces a PDF (generic resume).
    const emptyBuf = await page.evaluate(async (url) => {
        const r = await fetch(url);
        const b = await r.arrayBuffer();
        return { ok: r.ok, status: r.status, size: b.byteLength };
    }, "/api/resume");
    record(
        "GET /api/resume (no JD) still returns a PDF",
        emptyBuf.ok && emptyBuf.size > 3000,
        `status=${emptyBuf.status} bytes=${emptyBuf.size}`,
    );

    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (errors.length) {
        console.log("\nPage errors:");
        errors.slice(0, 6).forEach((e) => console.log("  " + e));
    }

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-recruiter-mode crashed:", err);
    process.exit(2);
});
