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
async function open(name, vp, opts = {}) { const ctx = await browser.newContext({ viewport: vp, ...opts }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${name}] ${e.message}`)); page.on("console", (m) => { if (m.type() === "error") errors.push(`[${name}] console: ${m.text().slice(0, 160)}`); }); await page.goto(BASE + "/room", { waitUntil: "load" }); return { ctx, page }; }
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
    for (let i = 0; i < 8; i++) { const done = await page.evaluate(() => !!document.querySelector("aside[aria-label=Panel] button") && Array.from(document.querySelectorAll("aside[aria-label=Panel] button")).some((b) => b.textContent === "Done")); if (done) break; await page.click("text=Next:"); await page.waitForTimeout(4000); } s = await state(page); check("p99 scenario improves latency", s && s.p99 < p0, `${p0} → ${s && s.p99}`);
    await page.click("text=Done"); await page.waitForTimeout(300);
    // a pattern scenario with a slow-motion trace step runs through
    await page.evaluate(() => window.__cr.startScenario("herd")); await page.waitForTimeout(1500);
    for (let i = 0; i < 8; i++) { const done = await page.evaluate(() => Array.from(document.querySelectorAll("aside[aria-label=Panel] button")).some((b) => b.textContent === "Done")); if (done) break; await page.click("text=Next:"); await page.waitForTimeout(2500); }
    const herd = await page.evaluate(() => { const sn = window.__cr.getSnapshot(); return { done: Array.from(document.querySelectorAll("aside[aria-label=Panel] button")).some((b) => b.textContent === "Done"), speed: window.__cr.sim.speed, traced: !!(sn.trace && sn.trace.hops.length) }; });
    check("cache-partition scenario walks to the end and restores real time", herd.done && herd.speed === 1 && herd.traced, JSON.stringify(herd)); await page.click("text=Done"); await page.waitForTimeout(300); await page.evaluate(() => window.__cr.doAction("heal")); await page.waitForTimeout(1500);
    for (const p of ["about", "projects", "stack", "contact", "records", "notes"]) { await page.evaluate((n) => window.__cr.openPanel(n), p); await page.waitForTimeout(250); const txt = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent.length); check(`panel ${p} renders`, txt > 80, `${txt} chars`); }
    await page.evaluate(() => window.__cr.selectNode("cache")); await page.waitForTimeout(1300); const repl = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent); check("cache inspector runs the REPL", repl.includes("hit_rate") && repl.includes("ride:1"), "");
    await page.fill("input[aria-label='DStarDB command']", "GET ride:12"); await page.keyboard.press("Enter"); await page.waitForTimeout(200); const got = await page.evaluate(() => document.querySelector("aside[aria-label=Panel]").textContent); check("REPL GET returns a live key", got.includes('"id":12'), "");
    await page.screenshot({ path: `${OUT}/room-inspector.png` });
    await page.keyboard.press("Meta+k"); await page.waitForTimeout(300); const pal = await page.evaluate(() => !!document.querySelector("[role=dialog][aria-label='Command palette']")); check("⌘K opens the palette", pal);
    await page.keyboard.type("ambient"); await page.keyboard.press("Enter"); await page.waitForTimeout(600); check("ambient sound toggles from the palette without errors", errors.length === 0, errors.slice(-1).join(""));
    await page.evaluate(() => window.__cr.openPanel("contact")); await page.waitForTimeout(300); await page.fill("input[name=name]", "Verify"); await page.fill("input[name=email]", "v@example.com"); await page.fill("textarea[name=message]", "hello from the verifier"); await page.click("text=Enqueue"); await page.waitForTimeout(9000); const toast = await page.evaluate(() => document.querySelector("[role=status]:last-of-type") && document.body.textContent); check("contact job is delivered", toast.includes("delivered") || toast.includes("Delivered"), "");
    const traceState = () => page.evaluate(() => { const t = window.__cr.getSnapshot().trace; const y = window.__cr.sim.you; return t ? { running: t.running, lines: t.lines.length, hops: t.hops.length, latency: t.latency, error: t.error || null, you: y ? y.type + "#" + y.id + " " + y.state + " @" + y.cur + " active=" + window.__cr.sim.active.includes(y) + " t0=" + Math.round(y.t0) + " now=" + Math.round(window.__cr.sim.now) : null } : null; });
    await page.evaluate(() => window.__cr.setTraceSpeed(1));
    for (const kind of ["ride", "ride-cold", "product", "checkout", "ws", "job"]) {
        await page.evaluate((k) => window.__cr.trace(k), kind); let t = null; for (let i = 0; i < 60; i++) { await page.waitForTimeout(250); t = await traceState(); if (t && !t.running) break; }
        check(`trace · ${kind} completes with narration`, t && !t.running && t.lines >= 3 && t.hops >= 1 && t.latency > 0, JSON.stringify(t)); await page.waitForTimeout(400);
    }
    await page.evaluate(() => window.__cr.setTraceSpeed(0.25)); await page.evaluate(() => window.__cr.trace("ride-cold")); await page.waitForTimeout(1200);
    const slow = await page.evaluate(() => ({ speed: window.__cr.sim.speed, dock: !!document.querySelector("section[aria-label='Trace a request']"), running: !!window.__cr.getSnapshot().trace?.running, fps: Math.round(window.__cr.getSnapshot().fps) }));
    check("slow-motion trace dilates the clock and shows the dock", slow.speed === 0.25 && slow.dock && slow.running, JSON.stringify(slow));
    let st2 = null; for (let i = 0; i < 80; i++) { await page.waitForTimeout(250); st2 = await traceState(); if (st2 && !st2.running) break; } await page.waitForTimeout(1800);
    const after = await page.evaluate(() => ({ speed: window.__cr.sim.speed, fps: Math.round(window.__cr.getSnapshot().fps) }));
    check("real time returns after the trace", after.speed === 1 && st2 && !st2.running, JSON.stringify({ ...after, trace: st2 }));
    await page.screenshot({ path: `${OUT}/room-trace.png` }); await page.evaluate(() => window.__cr.closeTrace()); await page.waitForTimeout(300);
    const barOf = (root) => Array.from(root.querySelectorAll(".site-links a, .site-links button")).map((e) => e.textContent.trim().replace(/^sound (on|off)$/, "sound")).join("|");
    const bar = await page.evaluate(barOf, await page.evaluateHandle(() => document));
    const homeCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const homePage = await homeCtx.newPage(); await homePage.goto(BASE + "/", { waitUntil: "load" }); await homePage.waitForTimeout(800);
    const homeBar = await homePage.evaluate(barOf, await homePage.evaluateHandle(() => document)); await homeCtx.close();
    check("the site bar is identical on / and /room", bar === homeBar && bar.includes("Projects"), `${homeBar} vs ${bar}`);
    await page.evaluate(() => window.__cr.startTour()); await page.waitForTimeout(6500);
    const mid = await page.evaluate(() => ({ tour: window.__cr.getSnapshot().tour, traceOpen: window.__cr.getSnapshot().traceOpen, speed: window.__cr.sim.speed }));
    await page.waitForTimeout(6000);
    const later = await page.evaluate(() => ({ tour: window.__cr.getSnapshot().tour, traceOpen: window.__cr.getSnapshot().traceOpen, speed: window.__cr.sim.speed, left: window.__cr.world.inset.left }));
    await page.evaluate(() => window.__cr.stopTour()); await page.waitForTimeout(300); const stopped = await page.evaluate(() => ({ tour: window.__cr.getSnapshot().tour, traceOpen: window.__cr.getSnapshot().traceOpen, speed: window.__cr.sim.speed }));
    check("the tour traces, then closes the dock and restores real time", mid.tour && mid.traceOpen && later.tour && !later.traceOpen && later.speed === 1 && later.left === 0 && !stopped.tour && !stopped.traceOpen && stopped.speed === 1, JSON.stringify({ mid, later, stopped }));
    await page.evaluate(() => window.__cr.doAction("heal")); await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__cr.setLoad(1500); }); await page.waitForTimeout(6000); s = await state(page); check("1,500 rps stays above 45 fps", s && s.fps >= 45, `fps ${s && s.fps} rps ${s && s.rps}`);
    await ctx.close();
}
{
    const { ctx, page } = await open("phone", { width: 400, height: 800 }, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await page.waitForTimeout(9000); const s = await state(page); check("phone boots and runs", s && s.booted && s.health !== "booting", JSON.stringify(s));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); check("phone has no horizontal overflow", wide);
    const phoneVerbs = await page.evaluate(() => { const b = Array.from(document.querySelectorAll("section[aria-label=Console] button")).find((x) => /tour/i.test(x.textContent)); if (!b) return false; const r = b.getBoundingClientRect(); return r.width > 40 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight; }); check("phone console carries Tour and Fit", phoneVerbs);
    await page.evaluate(() => window.__cr.openTrace()); await page.waitForTimeout(400); const dockOk = await page.evaluate(() => { const d = document.querySelector("section[aria-label='Trace a request']"); if (!d) return false; const r = d.getBoundingClientRect(); return r.width > 300 && r.height > 100 && r.right <= innerWidth + 1; }); check("phone shows the trace sheet", dockOk);
    await page.screenshot({ path: `${OUT}/room-phone.png` }); await ctx.close();
}
{
    const { ctx, page } = await open("reduced", { width: 1280, height: 720 }, { reducedMotion: "reduce" });
    await page.waitForTimeout(4000); const s = await state(page); check("reduced motion boots instantly", s && s.booted, JSON.stringify(s)); await ctx.close();
}
const TITLES = { "/r": "Recruiter mode · Dhruv Agrawal", "/lab": "Lab · Dhruv Agrawal", "/projects": "Projects · Dhruv Agrawal", "/projects/dstardb": "DStarDB · Dhruv Agrawal", "/blog": "Blog · Dhruv Agrawal", "/definitely-missing": "Not found · Dhruv Agrawal" };
for (const path of Object.keys(TITLES)) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const page = await ctx.newPage(); page.on("pageerror", (e) => errors.push(`[${path}] ${e.message}`)); const res = await page.goto(BASE + path, { waitUntil: "load" }); await page.waitForTimeout(1500);
    const info = await page.evaluate(() => ({ nav: !!document.querySelector("nav.site-links"), title: document.title, dead: Array.from(document.querySelectorAll("a[href^='/#']")).map((a) => a.getAttribute("href")).filter((h) => !/^\/#s[0-5]$/.test(h)), rp: !!document.querySelector(".rp") }));
    const okStatus = path === "/definitely-missing" ? res.status() === 404 : res.ok();
    check(`${path} renders in the site language with the right title`, okStatus && info.rp && info.title === TITLES[path] && info.dead.length === 0 && (path === "/definitely-missing" || info.nav), `status ${res.status()} title "${info.title}" dead ${JSON.stringify(info.dead)}`);
    if (path === "/r") { await page.keyboard.press("Meta+k"); await page.waitForTimeout(300); const pal = await page.evaluate(() => !!document.querySelector("[role=dialog][aria-label='Command palette']")); check("⌘K opens the palette on a reading page", pal); await page.keyboard.press("Escape"); }
    await ctx.close();
}
await browser.close();
check("no page errors", errors.length === 0, errors.slice(0, 5).join(" | "));
const failed = results.filter((r) => !r.ok).length; console.log(`\n${results.length - failed}/${results.length} checks passed`); process.exit(failed ? 1 : 0);
