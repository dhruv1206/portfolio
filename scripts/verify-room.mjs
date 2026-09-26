#!/usr/bin/env node
// Headless verification of the control room homepage. Boots the page,
// injects faults, replays a scenario, opens every panel, checks phone
// and reduced-motion layouts, and fails on any page error.
// Usage: node scripts/verify-room.mjs   (dev server on :3000)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = resolve(process.cwd(), ".claude/logs/screenshots"); mkdirSync(OUT, { recursive: true });
const results = []; const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); process.stdout.write(`${ok ? "✓" : "✗"} ${name}${detail ? "  (" + detail + ")" : ""}\n`); };
const state = (page) => page.evaluate(() => { const c = window.__cr; if (!c) return null; const s = c.getSnapshot(); return { booted: s.booted, health: s.health, rps: s.metrics.rps, p99: Math.round(s.metrics.p99), err: +(s.metrics.errRate * 100).toFixed(1), q: s.metrics.queueDepth, hit: Math.round(s.metrics.cacheHit * 100), fps: Math.round(s.fps), workers: s.replicas.workers, panel: s.panel && s.panel.name, scenario: s.scenario && s.scenario.step, log: s.log.length, peers: s.peersText }; });
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || "chrome", headless: true, args: ["--ignore-gpu-blocklist"] });
const errors = [];
async function open(name, vp, opts = {}) { const ctx = await browser.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`)); page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] console: ${m.text().slice(0, 160)}`); }); await page.goto(BASE + "/", { waitUntil: "load" }); return { ctx, page }; }
{
    const { ctx, page } = await open("desk", { width: 1440, height: 900 });
    const html = await page.content(); check("server HTML carries the name and summary", html.includes("Dhruv Agrawal") && html.includes("Incidents you can replay"));
    await page.waitForTimeout(4500); let s = await state(page); check("boots to a running model", s && s.booted, JSON.stringify(s));
    await page.waitForTimeout(6000); s = await state(page); check("baseline is nominal", s && s.health === "nominal" && s.rps > 150, `rps ${s && s.rps} p99 ${s && s.p99} fps ${s && s.fps}`);
    await page.screenshot({ path: `${OUT}/room-idle.png` });
    await page.keyboard.press("k"); let sawKill = null; for (let i = 0; i < 12 && !sawKill; i++) { await page.waitForTimeout(300); const st = await state(page); if (st && st.workers <= 1) sawKill = st; } check("kill worker removes a replica", !!sawKill, sawKill ? `workers ${sawKill.workers} q ${sawKill.q}` : "never dropped");
    let recovered = null; for (let i = 0; i < 40 && !recovered; i++) { await page.waitForTimeout(400); const st = await state(page); if (st && st.workers >= 2) recovered = st; } check("autoscaler recovers", !!recovered, recovered ? `workers ${recovered.workers}` : "still short after 16 s");
    await page.evaluate(() => window.__cr.selectNode("cache")); await page.waitForTimeout(600); await page.focus("input[aria-label='DStarDB command']"); const before = (await state(page)).workers; await page.keyboard.press("k"); await page.waitForTimeout(300); s = await state(page); check("typing in the REPL does not trigger chaos keys", s && s.workers === before, `workers ${before} → ${s && s.workers}`); await page.keyboard.press("Escape");
    const beforeStealth = (await state(page)).log; await page.evaluate(() => window.dispatchEvent(new CustomEvent("cr:stealth"))); await page.waitForTimeout(900); const stealth = await page.evaluate(() => document.body.textContent); check("Esc-Esc stealth résumé shows the current résumé", stealth.includes("MyRik, Bengaluru") && stealth.includes("Esc twice"), "");
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("cr:stealth"))); await page.waitForTimeout(1500); s = await state(page); check("room returns after stealth mode without rebooting", s && s.booted && s.log >= beforeStealth && !!(await page.evaluate(() => document.querySelector("canvas[role=img]"))), JSON.stringify(s));
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("cr:terminal"))); await page.waitForTimeout(800); const term = await page.evaluate(() => document.body.textContent.toLowerCase().includes("terminal") || !!document.querySelector("[class*=terminal]")); check("⌘K terminal entry opens the Konami terminal", term); await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    await page.evaluate(() => window.__cr.doAction("slowPayments")); await page.waitForTimeout(7000); s = await state(page); check("slow Razorpay degrades p99", s && s.p99 > 480, `p99 ${s && s.p99} health ${s && s.health}`);
    await page.evaluate(() => { window.__cr.focus("gateway", 2.6); }); await page.waitForTimeout(1200); await page.screenshot({ path: `${OUT}/room-gateway.png` });
    await page.evaluate(() => window.__cr.doAction("heal")); await page.waitForTimeout(2500);
    await page.evaluate(() => window.__cr.startScenario("p99")); await page.waitForTimeout(6000); const p0 = (await state(page)).p99;
    for (let i = 0; i < 5; i++) { await page.click("text=Next:"); await page.waitForTimeout(4000); } s = await state(page); check("p99 scenario improves latency", s && s.p99 < p0, `${p0} → ${s && s.p99}`);
    await page.click("text=Done"); await page.waitForTimeout(300);
    for (const p of ["about", "projects", "stack", "contact", "records", "notes"]) { await page.evaluate((n) => window.__cr.openPanel(n), p); await page.waitForTimeout(250); const txt = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent.length); check(`panel ${p} renders`, txt > 80, `${txt} chars`); }
    await page.evaluate(() => window.__cr.selectNode("cache")); await page.waitForTimeout(1300); const repl = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent); check("cache inspector runs the REPL", repl.includes("hit_rate") && repl.includes("ride:1"), "");
    await page.fill("input[aria-label='DStarDB command']", "GET ride:12"); await page.keyboard.press("Enter"); await page.waitForTimeout(200); const got = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent); check("REPL GET returns a live key", got.includes('"id":12'), "");
    await page.screenshot({ path: `${OUT}/room-inspector.png` });
    await page.keyboard.press("Meta+k"); await page.waitForTimeout(300); const pal = await page.evaluate(() => !!document.querySelector("[role=dialog][aria-label='Command palette']")); check("⌘K opens the palette", pal);
    await page.keyboard.type("ambient"); await page.keyboard.press("Enter"); await page.waitForTimeout(600); check("ambient sound toggles from the palette without errors", errors.length === 0, errors.slice(-1).join(""));
    await page.evaluate(() => window.__cr.openPanel("contact")); await page.waitForTimeout(300); await page.fill("input[name=name]", "Verify"); await page.fill("input[name=email]", "v@example.com"); await page.fill("textarea[name=message]", "hello from the verifier"); await page.click("text=Enqueue"); await page.waitForTimeout(9000); const toast = await page.evaluate(() => document.querySelector("[role=status]:last-of-type") && document.body.textContent); check("contact job is delivered", toast.includes("delivered") || toast.includes("Delivered"), "");
    await page.evaluate(() => { window.__cr.setLoad(1500); }); await page.waitForTimeout(6000); s = await state(page); check("1,500 rps stays above 45 fps", s && s.fps >= 45, `fps ${s && s.fps} rps ${s && s.rps}`);
    await ctx.close();
}
{
    const { ctx, page } = await open("phone", { width: 400, height: 800 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await page.waitForTimeout(9000); const s = await state(page); check("phone boots and runs", s && s.booted && s.health !== "booting", JSON.stringify(s));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); check("phone has no horizontal overflow", wide);
    await page.screenshot({ path: `${OUT}/room-phone.png` }); await ctx.close();
}
{
    const { ctx, page } = await open("reduced", { width: 1280, height: 720 }, { reducedMotion: "reduce" });
    await page.waitForTimeout(4000); const s = await state(page); check("reduced motion boots instantly", s && s.booted, JSON.stringify(s)); await ctx.close();
}
for (const path of ["/r", "/lab", "/projects/dstardb", "/blog"]) { const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${path}] ${e.message}`)); const res = await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(1500); const nav = await page.evaluate(() => !!document.querySelector("nav")); check(`${path} renders with site chrome`, res.ok() && nav, `status ${res.status()}`); await ctx.close(); }
await browser.close();
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} checks passed`); process.exit(failed ? 1 : 0);
