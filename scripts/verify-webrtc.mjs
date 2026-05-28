#!/usr/bin/env node
// Playwright verification for the WebRTC demo on
// /projects/realtime-collaboration. Three scenarios:
//
//   1. Loopback — single tab, click Join, confirm synthetic peer connects
//      and DataChannel chat round-trips ("echo: ...").
//
//   2. Room pairing across browser CONTEXTS — two completely separate
//      contexts (no shared origin/storage/BroadcastChannel) join the
//      same room via the /api/webrtc/signal endpoint. Both must reach
//      connectionState='connected'. This is the real cross-device
//      proxy and the regression case that broke "join from anywhere".
//
//   3. Wrong password is rejected — second context tries to join an
//      existing password-protected room with the wrong password and
//      sees an error in the UI.
//
// Chromium is launched with --use-fake-device-for-media-stream so
// getUserMedia resolves without a real camera/mic.

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

async function waitForConnectionState(page, target, timeoutMs = 25_000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const state = await page.evaluate(() => {
            const candidates = [
                "connected",
                "connecting",
                "new",
                "failed",
                "disconnected",
                "closed",
            ];
            for (const span of document.querySelectorAll("[data-cinema-mode=\"desktop\"] .webrtc-demo span")) {
                const t = span.textContent?.trim() || "";
                if (candidates.includes(t)) return t;
            }
            return null;
        });
        if (state === target) return state;
        if (state === "failed") return state;
        await page.waitForTimeout(250);
    }
    return null;
}

async function openTab(browser, queryString = "") {
    const ctx = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        permissions: ["camera", "microphone"],
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
    });
    const url = BASE + "/projects/realtime-collaboration" + queryString;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-cinema-mode=\"desktop\"] .webrtc-demo", { timeout: 20_000 });
    await page.locator("[data-cinema-mode=\"desktop\"] .webrtc-demo").scrollIntoViewIfNeeded();
    return { ctx, page, errors };
}

async function clickJoin(page) {
    // The "Join" button lives inside [data-cinema-mode="desktop"] .webrtc-demo (pre-join form footer).
    await page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo button", { hasText: /^Join$/ })
        .click();
}

async function main() {
    const browser = await chromium.launch({
        headless: true,
        args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
        ],
    });

    // ---------- Scenario 1: Loopback (default = synthetic local stream) ----------
    console.log("\n[Scenario 1] Loopback (synthetic by default)");
    const tabA = await openTab(browser);
    await clickJoin(tabA.page);
    const state1 = await waitForConnectionState(tabA.page, "connected", 15_000);
    record(
        "loopback: connection reached 'connected'",
        state1 === "connected",
        `state=${state1}`,
    );

    // The "Use my camera" toggle should be visible — synthetic is the
    // default, NOT camera. (Previous behavior auto-grabbed the camera
    // and broke same-laptop dual-tab demos with frozen frames.)
    const cameraButtonText = await tabA.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo button", { hasText: /camera/i })
        .first()
        .innerText();
    record(
        "loopback: defaults to synthetic, exposes 'Use my camera' opt-in",
        /Use my camera/i.test(cameraButtonText),
        `button="${cameraButtonText}"`,
    );

    await tabA.page.locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input").last().fill("hello loop");
    await tabA.page.locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input").last().press("Enter");
    await tabA.page.waitForTimeout(600);
    const sawEcho = await tabA.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo")
        .innerText()
        .then((t) => /echo: hello loop/.test(t))
        .catch(() => false);
    record("loopback: DataChannel chat round-trips via echo", sawEcho);

    // Chat panel layout — confirm it lives below the videos (not in a
    // squeezed sidebar). The chat scroll area should be at LEAST as
    // wide as the parent [data-cinema-mode="desktop"] .webrtc-demo content, no longer clipped.
    const chatGeometry = await tabA.page.evaluate(() => {
        const demo = document.querySelector("[data-cinema-mode=\"desktop\"] .webrtc-demo");
        const chat = demo?.querySelector(
            "div.max-h-\\[220px\\], div[class*='max-h-[220px]']",
        );
        if (!demo || !chat) return null;
        const dRect = demo.getBoundingClientRect();
        const cRect = chat.getBoundingClientRect();
        return {
            demoWidth: dRect.width,
            chatWidth: cRect.width,
            ratio: cRect.width / dRect.width,
        };
    });
    record(
        "chat panel takes ~full demo width (single-column stack)",
        chatGeometry && chatGeometry.ratio > 0.9,
        chatGeometry
            ? `demo=${Math.round(chatGeometry.demoWidth)}px chat=${Math.round(chatGeometry.chatWidth)}px ratio=${chatGeometry.ratio.toFixed(2)}`
            : "no chat element found",
    );

    await tabA.page.screenshot({
        path: `${OUT}/webrtc-loopback.png`,
        fullPage: false,
    });

    // ---------- Scenario 2: Cross-context room pairing ----------
    console.log("\n[Scenario 2] Cross-CONTEXT room pairing via signaling API");
    // Pick a unique room id so we don't collide with leftover state
    // from previous test runs.
    const roomId = `qa-${Date.now().toString(36)}`;
    const password = "secret-7";
    // Use TWO ISOLATED browser contexts — no shared storage,
    // no shared BroadcastChannel.
    const ctxA = await openTab(browser, `?room=${roomId}&pw=${password}`);
    const ctxB = await openTab(browser, `?room=${roomId}&pw=${password}`);

    // Each tab's form should be pre-filled from the URL — confirm:
    const aFilled = await ctxA.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input")
        .first()
        .inputValue();
    const bFilled = await ctxB.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input")
        .first()
        .inputValue();
    record(
        "URL pre-fills room ID on both contexts",
        aFilled === roomId && bFilled === roomId,
        `A="${aFilled}", B="${bFilled}"`,
    );

    // Both click Join. A first, then B ~150ms later — natural ordering.
    await clickJoin(ctxA.page);
    await ctxA.page.waitForTimeout(150);
    await clickJoin(ctxB.page);

    const [stateA, stateB] = await Promise.all([
        waitForConnectionState(ctxA.page, "connected", 25_000),
        waitForConnectionState(ctxB.page, "connected", 25_000),
    ]);
    record(
        "cross-context: A reached 'connected'",
        stateA === "connected",
        `A=${stateA}`,
    );
    record(
        "cross-context: B reached 'connected'",
        stateB === "connected",
        `B=${stateB}`,
    );

    // Confirm chat goes through the established DataChannel.
    await ctxA.page.locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input").last().fill("ping from A");
    await ctxA.page.locator("[data-cinema-mode=\"desktop\"] .webrtc-demo input").last().press("Enter");
    await ctxB.page.waitForTimeout(900);
    const bSawA = await ctxB.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo")
        .innerText()
        .then((t) => /ping from A/.test(t))
        .catch(() => false);
    record("cross-context: DataChannel message A→B delivered", bSawA);

    await ctxA.page.screenshot({
        path: `${OUT}/webrtc-room-A.png`,
        fullPage: false,
    });
    await ctxB.page.screenshot({
        path: `${OUT}/webrtc-room-B.png`,
        fullPage: false,
    });

    await ctxA.ctx.close();
    await ctxB.ctx.close();

    // ---------- Scenario 3: Wrong password rejected ----------
    console.log("\n[Scenario 3] Wrong password rejected");
    const lockedRoom = `qa-pw-${Date.now().toString(36)}`;
    const ctxOwner = await openTab(
        browser,
        `?room=${lockedRoom}&pw=correct-horse`,
    );
    await clickJoin(ctxOwner.page);
    // Give the owner time to register the password with the room.
    await ctxOwner.page.waitForTimeout(800);

    const ctxIntruder = await openTab(
        browser,
        `?room=${lockedRoom}&pw=wrong-password`,
    );
    await clickJoin(ctxIntruder.page);
    await ctxIntruder.page.waitForTimeout(1500);
    const intruderError = await ctxIntruder.page
        .locator("[data-cinema-mode=\"desktop\"] .webrtc-demo")
        .innerText()
        .then((t) => /Wrong password/i.test(t))
        .catch(() => false);
    record("password: wrong password is rejected at join", intruderError);

    await ctxOwner.ctx.close();
    await ctxIntruder.ctx.close();

    // ---------- Summary ----------
    const allErrors = [...tabA.errors, ...ctxA.errors, ...ctxB.errors];
    console.log("\n--- Summary ---");
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`Passed: ${checks.length - failed}/${checks.length}`);
    if (failed) for (const c of checks.filter((c) => !c.pass)) console.log("  - " + c.name);
    if (allErrors.length) {
        console.log("\nPage errors:");
        allErrors.slice(0, 8).forEach((e) => console.log("  " + e));
    }
    console.log("\nScreenshots:");
    console.log(`  loopback:  ${OUT}/webrtc-loopback.png`);
    console.log(`  room A:    ${OUT}/webrtc-room-A.png`);
    console.log(`  room B:    ${OUT}/webrtc-room-B.png`);

    await tabA.ctx.close();
    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("verify-webrtc crashed:", err);
    process.exit(2);
});
