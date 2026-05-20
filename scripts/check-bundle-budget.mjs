#!/usr/bin/env node
// Enforce JS first-load budgets from `next build` stdout.
// Usage: node scripts/check-bundle-budget.mjs <path-to-build.log>
//
// Budgets (per the portfolio revamp plan):
//   - `/` first-load JS:    < 150 KB
//   - any other route:      < 250 KB
//   - shared chunk total:   < 200 KB

import { readFileSync } from "node:fs";
import { argv, exit } from "node:process";

const BUDGETS = {
    home: { route: "/", maxKb: 150 },
    other: { maxKb: 250 },
    shared: { maxKb: 200 },
};

function parseKb(token) {
    if (!token) return null;
    const m = token.match(/^([\d.]+)\s*(B|kB|KB|MB)?$/i);
    if (!m) return null;
    const value = parseFloat(m[1]);
    const unit = (m[2] || "B").toLowerCase();
    if (unit === "mb") return value * 1024;
    if (unit === "kb") return value;
    return value / 1024;
}

const logPath = argv[2];
if (!logPath) {
    console.error("usage: check-bundle-budget.mjs <build.log>");
    exit(2);
}

const text = readFileSync(logPath, "utf8");
const lines = text.split(/\r?\n/);

const violations = [];
let inRouteTable = false;
let sawSharedHeader = false;

for (const line of lines) {
    if (/^Route\s*\(app\)/.test(line)) {
        inRouteTable = true;
        continue;
    }
    if (/^\+\s*First Load JS shared by all/.test(line)) {
        sawSharedHeader = true;
        const parts = line.trim().split(/\s+/);
        const sizeToken = parts[parts.length - 1];
        const kb = parseKb(sizeToken);
        if (kb !== null && kb > BUDGETS.shared.maxKb) {
            violations.push(`shared chunk ${kb.toFixed(1)} kB > budget ${BUDGETS.shared.maxKb} kB`);
        }
        continue;
    }
    if (!inRouteTable) continue;

    // Sample format:  ┌ ○ /                          5.4 kB         142 kB
    const m = line.match(/[│┌├└]\s*[○●ƒ]\s+(\/[^\s]*)\s+\S+\s+(\S+)/);
    if (!m) continue;
    const [, route, firstLoadToken] = m;
    const kb = parseKb(firstLoadToken);
    if (kb === null) continue;

    const budget = route === BUDGETS.home.route ? BUDGETS.home.maxKb : BUDGETS.other.maxKb;
    if (kb > budget) {
        violations.push(`${route}: ${kb.toFixed(1)} kB first-load > budget ${budget} kB`);
    }
}

if (!sawSharedHeader) {
    console.warn("warn: shared chunk size not found in log; skipping shared budget check");
}

if (violations.length === 0) {
    console.log("bundle budgets OK");
    exit(0);
}

console.error("bundle budget violations:");
for (const v of violations) console.error(`  - ${v}`);
exit(1);
