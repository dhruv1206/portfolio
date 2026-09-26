#!/usr/bin/env node
// Headless verification of the homepage (particle spine + stages).
// Usage: node scripts/verify-home.mjs   (dev server on :3000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots"); mkdirSync(OUT, { recursive: true });
const results = []; const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); process.stdout.write(`${ok ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`); };
const errors = [];
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true, args: ["--ignore-gpu-blocklist"] });
async function open(name, vp, opts = {}) { const ctx = await browser.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`)); page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] console: ${m.text().slice(0, 160)}`); }); const res = await page.goto(BASE + "/", { waitUntil: "load" }); await page.addStyleTag({ content: "html{scroll-behavior:auto !important}" }); return { ctx, page, res }; }
const st = (page) => page.evaluate(() => { const s = window.__spine; return s ? { ready: s.ready, nogl: s.nogl, cur: +s.cur.toFixed(2), target: +s.target.toFixed(2), fps: Math.round(s.stats.fps), N: s.N, assembled: document.querySelector("[data-home]").getAttribute("data-assembled") === "1" } : null; });
{
    const { ctx, page, res } = await open("desk", { width: 1440, height: 900 });
    const html = await page.content(); check("server HTML carries name, stages and roles", res.ok() && html.includes("Dhruv") && html.includes("Machines you can run") && html.includes("MyRik"));
    await page.waitForTimeout(3500); let s = await st(page); check("particle engine ready and assembled the name", s && s.ready && s.assembled && !s.nogl, JSON.stringify(s));
    await page.screenshot({ path: `${OUT}/home-hero.png` });
    for (const [i, id] of [[1, "s1"], [2, "s2"], [3, "s3"], [4, "s4"], [5, "s5"]]) { await page.evaluate((id) => document.getElementById(id).scrollIntoView({ behavior: "instant" }), id); await page.waitForTimeout(1800); s = await st(page); check(`scrolling to ${id} morphs to layer ${i}`, s && Math.abs(s.cur - (1 + i)) < 0.15, `cur ${s && s.cur}`); if (i === 1 || i === 3) await page.screenshot({ path: `${OUT}/home-${id}.png` }); }
    check("60 fps while morphing", s && s.fps >= 50, `fps ${s && s.fps}`);
    await page.evaluate(() => document.getElementById("s3").scrollIntoView({ behavior: "instant" })); await page.waitForTimeout(400);
    await page.locator("#s3 button", { hasText: "Run" }).first().click(); await page.waitForTimeout(3500); const repl = await page.evaluate(() => !!document.querySelector("[data-repl]") && document.querySelector("[data-repl]").textContent.includes("DStarDB")); check("DStarDB REPL (worker build) embeds on Run", repl);
    await page.locator("#s3 button", { hasText: "Run" }).last().click(); await page.waitForTimeout(4800); const pipe = await page.evaluate(() => document.body.textContent.includes("1 MP4 + 10 MP3s")); check("pipeline stepper completes", pipe);
    await page.evaluate(() => document.getElementById("s4").scrollIntoView({ behavior: "instant" })); await page.waitForTimeout(600); await page.hover("#s4 >> text=Runtime"); await page.waitForTimeout(200); const band = await page.evaluate(() => window.__spine.band); check("hovering a stack layer lights its band", band === 1, `band ${band}`);
    await page.keyboard.press("Meta+k"); await page.waitForTimeout(300); const pal = await page.evaluate(() => !!document.querySelector("[role=dialog][aria-label='Command palette']")); check("⌘K opens modes", pal); await page.keyboard.press("Escape");
    await page.evaluate(() => document.getElementById("s5").scrollIntoView({ behavior: "instant" })); await page.waitForTimeout(500); await page.fill("input[name=name]", "Verify"); await page.fill("input[name=email]", "v@example.com"); await page.fill("textarea[name=message]", "hello from the verifier"); await page.locator("#s5 button[type=submit]").click(); await page.waitForTimeout(2500); const contact = await page.evaluate(() => document.body.textContent); check("contact form reports its outcome", contact.includes("Delivered") || contact.includes("did not go through"));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(700); const dim = await page.evaluate(() => document.querySelector("[data-home] canvas").style.opacity); check("canvas dims under the ledger", dim === "0.22", `opacity ${dim}`);
    await page.screenshot({ path: `${OUT}/home-end.png` });
    await ctx.close();
}
{
    const { ctx, page } = await open("phone", { width: 400, height: 800 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await page.waitForTimeout(3500); const s = await st(page); check("phone assembles the name", s && s.assembled, JSON.stringify(s));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); check("phone has no horizontal overflow", overflow);
    await page.screenshot({ path: `${OUT}/home-phone.png` }); await ctx.close();
}
for (const path of ["/r", "/lab", "/projects/dstardb", "/room"]) { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${path}] ${e.message}`)); const res = await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(1500); check(`${path} renders`, res.ok(), `status ${res.status()}`); if (path === "/r") await page.screenshot({ path: `${OUT}/page-r.png` }); await ctx.close(); }
await browser.close();
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} checks passed`); process.exit(failed ? 1 : 0);
