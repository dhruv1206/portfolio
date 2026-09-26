// Control room renderer: the schematic, packets, semantic zoom internals
// and cursors, drawn to one 2D canvas in screen space so hairlines stay
// one device pixel wide at every zoom level.

import { NODES, NODE_BY_ID, EDGES, CTL_EDGES, NodeDef } from "./data";
import type { Sim, NodeState } from "./sim";

const C = { bg: "#050508", ink: "#f2f2f7", mute: "#6c6c82", violet: "#8b5cf6", cyan: "#22d3ee", pink: "#f472b6", amber: "#f59e0b", ok: "#34d399" };
const KIND: Record<string, string> = { users: "rgba(242,242,247,0.35)", edge: "rgba(242,242,247,0.35)", svc: "rgba(242,242,247,0.42)", data: "rgba(34,211,238,0.5)", ext: "rgba(139,92,246,0.6)", ctl: "rgba(242,242,247,0.22)" };
const PKT: Record<string, string> = { ride: C.cyan, product: "#7ee8f7", checkout: C.violet, ws: "rgba(242,242,247,0.85)", job: C.amber, cron: C.amber, msg: C.ink };
const BOUNDS = { x0: 40, y0: 50, x1: 1560, y1: 810 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const FONT = '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

interface Route { pts: [number, number][]; seg: number[]; len: number }
const routeCache: Record<string, Route> = {};
export function route(a: string, b: string): Route {
    const k = a + ">" + b; if (routeCache[k]) return routeCache[k];
    const A = NODE_BY_ID[a], B = NODE_BY_ID[b]; let pts: [number, number][];
    if (Math.abs(A.y - B.y) < 30) { const dir = B.x > A.x ? 1 : -1; pts = [[A.x + (dir * A.w) / 2, A.y], [B.x - (dir * B.w) / 2, B.y]]; }
    else if (Math.abs(A.x - B.x) < 30) { const dir = B.y > A.y ? 1 : -1; pts = [[A.x, A.y + (dir * A.h) / 2], [B.x, B.y - (dir * B.h) / 2]]; }
    else { const dir = B.x > A.x ? 1 : -1; const x0 = A.x + (dir * A.w) / 2, x1 = B.x - (dir * B.w) / 2; const mx = (x0 + x1) / 2; pts = [[x0, A.y], [mx, A.y], [mx, B.y], [x1, B.y]]; }
    let len = 0; const seg: number[] = [];
    for (let i = 1; i < pts.length; i++) { const d = Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]); seg.push(d); len += d; }
    return (routeCache[k] = { pts, seg, len });
}
export function posOn(r: Route, t: number): [number, number] {
    t = clamp(t, 0, 1); let d = t * r.len;
    for (let i = 0; i < r.seg.length; i++) { if (d <= r.seg[i] || i === r.seg.length - 1) { const f = r.seg[i] ? d / r.seg[i] : 1; const p = r.pts[i], q = r.pts[i + 1]; return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]; } d -= r.seg[i]; }
    return r.pts[r.pts.length - 1];
}

export interface Cursor { x: number; y: number; label: string; me?: boolean; ghost?: boolean }
export interface Insets { top: number; right: number; bottom: number; left: number }

export class World {
    cv: HTMLCanvasElement; ctx: CanvasRenderingContext2D; sim: Sim;
    dpr = 1; W = 0; H = 0;
    cam = { x: 800, y: 440, s: 0.8 }; tgt = { x: 800, y: 440, s: 0.8 };
    inset: Insets = { top: 48, right: 0, bottom: 0, left: 0 };
    hover: string | null = null; selected: string | null = null;
    peers: Cursor[] = []; ghosts: Cursor[] = []; time = 0; reduced: boolean;
    highlight: Set<string> | null = null; flash: Record<string, number> = {}; nodeIndex: string[] = NODES.map((n) => n.id);
    /** nodes on the path of the request being traced: their edges light up, everything else dims */
    tracePath: Set<string> | null = null;
    /** phones never fit the whole world; below this scale labels overlap */
    minScale = 0;

    constructor(canvas: HTMLCanvasElement, sim: Sim) {
        this.cv = canvas; const ctx = canvas.getContext("2d", { alpha: false }); if (!ctx) throw new Error("2d context unavailable"); this.ctx = ctx; this.sim = sim;
        this.reduced = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    /* The schematic itself (grid, edges, node boxes and labels) only changes with the camera, so it is
       drawn once into an offscreen canvas and blitted each frame; packets and live state draw on top. */
    private staticCv: HTMLCanvasElement | null = null; private staticCtx: CanvasRenderingContext2D | null = null; private staticKey = "";
    resize() { this.dpr = Math.min(1.5, window.devicePixelRatio || 1); const r = this.cv.getBoundingClientRect(); this.W = r.width; this.H = r.height; this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr); this.staticKey = ""; }
    /** The visible area is the viewport minus the UI insets; the camera centre is offset so the world centres inside it. */
    fit() { this.fitBox(BOUNDS.x0, BOUNDS.y0, BOUNDS.x1, BOUNDS.y1, 0.95, 5); }
    /** Frames a set of nodes (a traced request's path) with some air around it. */
    fitNodes(ids: string[], pad = 70) { const ns = ids.map((id) => NODE_BY_ID[id]).filter(Boolean); if (!ns.length) { this.fit(); return; } const x0 = Math.min(...ns.map((n) => n.x - n.w / 2)) - pad, x1 = Math.max(...ns.map((n) => n.x + n.w / 2)) + pad, y0 = Math.min(...ns.map((n) => n.y - n.h / 2)) - pad, y1 = Math.max(...ns.map((n) => n.y + n.h / 2)) + pad; this.fitBox(x0, y0, x1, y1, 0.92, 1.6); }
    private fitBox(x0: number, y0: number, x1: number, y1: number, k: number, maxS: number) { const w = this.W - this.inset.left - this.inset.right, h = this.H - this.inset.top - this.inset.bottom; const s = clamp(Math.min(w / (x1 - x0), h / (y1 - y0)) * k, this.minScale || 0.2, maxS); this.tgt = { x: (x0 + x1) / 2 + (this.inset.right - this.inset.left) / 2 / s, y: (y0 + y1) / 2 + (this.inset.bottom - this.inset.top) / 2 / s, s }; if (this.reduced) this.cam = { ...this.tgt }; }
    focus(id: string, scale = 2.4) { const n = NODE_BY_ID[id]; if (!n) return; const s = scale; this.tgt = { x: n.x + (this.inset.right - this.inset.left) / 2 / s, y: n.y + n.h * 0.4 + (this.inset.bottom - this.inset.top) / 2 / s, s }; this.selected = id; if (this.reduced) this.cam = { ...this.tgt }; }
    w2s(x: number, y: number): [number, number] { return [(x - this.cam.x) * this.cam.s + this.W / 2, (y - this.cam.y) * this.cam.s + this.H / 2]; }
    s2w(sx: number, sy: number): [number, number] { return [(sx - this.W / 2) / this.cam.s + this.cam.x, (sy - this.H / 2) / this.cam.s + this.cam.y]; }
    zoomAt(factor: number, sx: number, sy: number) { const [wx, wy] = this.s2w(sx, sy); const s = clamp(this.tgt.s * factor, 0.35, 5); this.tgt.s = s; this.tgt.x = wx - (sx - this.W / 2) / s; this.tgt.y = wy - (sy - this.H / 2) / s; }
    pan(dx: number, dy: number) { this.tgt.x -= dx / this.cam.s; this.tgt.y -= dy / this.cam.s; this.cam.x = this.tgt.x; this.cam.y = this.tgt.y; }
    nodeAt(sx: number, sy: number): NodeDef | null { const [x, y] = this.s2w(sx, sy); for (const n of NODES) { if (Math.abs(x - n.x) <= n.w / 2 + 6 && Math.abs(y - n.y) <= n.h / 2 + 6) return n; } return null; }

    frame(realDt: number) { this.time += realDt; const k = this.reduced ? 1 : Math.min(1, (realDt / 1000) * 7); this.cam.x += (this.tgt.x - this.cam.x) * k; this.cam.y += (this.tgt.y - this.cam.y) * k; this.cam.s += (this.tgt.s - this.cam.s) * k; this.draw(); }

    private drawStatic() {
        const d = this.dpr, sim = this.sim, booted = (id: string) => this.nodeIndex.indexOf(id) < sim.bootIndex;
        const key = [this.cam.x.toFixed(1), this.cam.y.toFixed(1), this.cam.s.toFixed(3), this.W, this.H, d, sim.bootIndex, this.highlight ? [...this.highlight].join(",") : "", this.tracePath ? [...this.tracePath].join(",") : ""].join("|");
        if (key === this.staticKey && this.staticCv) return;
        if (!this.staticCv) { this.staticCv = document.createElement("canvas"); this.staticCtx = this.staticCv.getContext("2d", { alpha: false }); }
        const cv = this.staticCv, ctx = this.staticCtx as CanvasRenderingContext2D; if (cv.width !== this.cv.width || cv.height !== this.cv.height) { cv.width = this.cv.width; cv.height = this.cv.height; }
        this.staticKey = key;
        ctx.setTransform(d, 0, 0, d, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, this.W, this.H);
        this.drawGrid(ctx); ctx.lineWidth = 1;
        for (const [a, b] of EDGES) {
            if (!booted(a) || !booted(b)) continue; const r = route(a, b); const ctl = CTL_EDGES.has(a + ">" + b); const hl = !!this.highlight && (this.highlight.has(a) || this.highlight.has(b));
            const tp = this.tracePath; const onPath = !!tp && tp.has(a) && tp.has(b) && !ctl; const dim = !!tp && !onPath;
            ctx.strokeStyle = onPath ? "rgba(34,211,238,0.7)" : dim ? (ctl ? "rgba(139,92,246,0.08)" : "rgba(242,242,247,0.06)") : ctl ? "rgba(139,92,246,0.22)" : hl ? "rgba(34,211,238,0.55)" : "rgba(242,242,247,0.16)"; ctx.setLineDash(ctl ? [2, 5] : []); ctx.beginPath();
            r.pts.forEach((p, i) => { const [x, y] = this.w2s(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); ctx.setLineDash([]);
            const end = r.pts[r.pts.length - 1], prev = r.pts[r.pts.length - 2]; const [ex, ey] = this.w2s(end[0], end[1]); const ang = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
            ctx.fillStyle = onPath ? "rgba(34,211,238,0.8)" : dim ? "rgba(242,242,247,0.1)" : ctl ? "rgba(139,92,246,0.35)" : "rgba(242,242,247,0.35)"; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - 6 * Math.cos(ang - 0.5), ey - 6 * Math.sin(ang - 0.5)); ctx.lineTo(ex - 6 * Math.cos(ang + 0.5), ey - 6 * Math.sin(ang + 0.5)); ctx.closePath(); ctx.fill();
        }
        for (const n of NODES) { if (booted(n.id)) this.drawNodeStatic(ctx, n); }
    }
    draw() {
        const ctx = this.ctx, d = this.dpr, s = this.cam.s, sim = this.sim;
        this.drawStatic();
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(this.staticCv as HTMLCanvasElement, 0, 0); ctx.setTransform(d, 0, 0, d, 0, 0);
        const booted = (id: string) => this.nodeIndex.indexOf(id) < sim.bootIndex;
        const now = sim.now;
        const dot = (x: number, y: number, r: number, col: string, alpha: number) => { const [sx, sy] = this.w2s(x, y); if (sx < -10 || sy < -10 || sx > this.W + 10 || sy > this.H + 10) return; ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fillRect(sx - r, sy - r, r * 2, r * 2); ctx.globalAlpha = 1; };
        const psz = clamp(1.6 * s, 1.5, 4); const quiet = this.tracePath ? 0.3 : 1;
        for (const e of sim.extras) { const r = route(e.path[e.idx], e.path[e.idx + 1]); const p = posOn(r, (now - e.tStart) / (e.tEnd - e.tStart)); dot(p[0], p[1], e.kind === "event" ? psz : psz * 0.7, e.kind === "hb" ? "rgba(242,242,247,0.6)" : C.violet, (e.kind === "tele" ? 0.55 : 0.9) * quiet); }
        for (const e of sim.responses) { const r = route(e.path[e.idx], e.path[e.idx + 1]); const p = posOn(r, (now - e.tStart) / (e.tEnd - e.tStart)); dot(p[0], p[1], e.you ? psz * 1.6 : psz * 0.8, e.you ? C.ink : "rgba(242,242,247,0.7)", e.you ? 1 : 0.45 * quiet); }
        let youPos: [number, number] | null = null;
        for (const r of sim.active) {
            if (r.state === "travel" && r.tFrom && r.tTo) { const rt = route(r.tFrom, r.tTo); const p = posOn(rt, (now - (r.tStart || 0)) / ((r.tEnd || 1) - (r.tStart || 0))); if (r.you) { youPos = p; dot(p[0], p[1], psz * 2.2, C.ink, 1); } else dot(p[0], p[1], r.retries ? psz * 1.2 : psz, r.retries ? C.pink : PKT[r.type] || C.cyan, 0.95 * quiet); }
            else if (r.state === "serving") { const n = NODE_BY_ID[r.cur]; const px = n.x - n.w / 2 + 8 + ((r.id * 37) % (n.w - 16)), py = n.y - n.h / 2 + 10 + ((r.id * 53) % (n.h - 20)); if (r.you) { youPos = [px, py]; dot(px, py, psz * 2.2, C.ink, 1); } else if (s > 0.9) dot(px, py, psz * 0.8, PKT[r.type] || C.cyan, 0.55 * quiet); }
        }
        for (const n of NODES) { if (!booted(n.id)) continue; this.drawNode(n); }
        if (youPos) { const [sx, sy] = this.w2s(youPos[0], youPos[1]); if (this.tracePath) { const pulse = 7 + 3 * Math.sin(this.time / 160); ctx.strokeStyle = C.cyan; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx, sy, pulse, 0, 6.283); ctx.stroke(); } ctx.font = "500 10px " + FONT; ctx.fillStyle = C.ink; ctx.fillText("you", sx + 10, sy - 8); }
        this.drawCursors();
    }
    private drawGrid(ctx: CanvasRenderingContext2D) { const s = this.cam.s; const step = 40 * s; if (step < 12) return; const [ox, oy] = this.w2s(0, 0); ctx.fillStyle = "rgba(242,242,247,0.10)"; const x0 = ((ox % step) + step) % step, y0 = ((oy % step) + step) % step; for (let x = x0; x < this.W; x += step) for (let y = y0; y < this.H; y += step) ctx.fillRect(x, y, 1, 1); }
    /** Box, label and subtitle: part of the cached static layer. */
    private drawNodeStatic(ctx: CanvasRenderingContext2D, n: NodeDef) {
        const s = this.cam.s; const [cx, cy] = this.w2s(n.x, n.y); const w = n.w * s, h = n.h * s; const x = cx - w / 2, y = cy - h / 2;
        if (x > this.W + 20 || y > this.H + 20 || x + w < -20 || y + h < -20) return;
        const hl = !!this.highlight && this.highlight.has(n.id); const dim = !!this.tracePath && !this.tracePath.has(n.id);
        ctx.globalAlpha = dim ? 0.4 : 1;
        ctx.fillStyle = "rgba(5,5,8,0.92)"; ctx.fillRect(x, y, w, h); ctx.lineWidth = 1; ctx.strokeStyle = hl ? "rgba(34,211,238,0.9)" : KIND[n.kind] || KIND.svc; ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
        const fs = clamp(10 * s, 9.5, 20); ctx.font = "500 " + fs + "px " + FONT; ctx.textBaseline = "alphabetic"; ctx.fillStyle = C.ink;
        const label = (s < 0.62 && n.short ? n.short : n.label).toUpperCase(); ctx.fillText(label, x + (n.kind === "users" ? 8 : 12) * s, y + 11 * s + fs * 0.35);
        if (s > 0.55 && n.id !== "pg" && n.id !== "workers" && n.id !== "ride") { const ss = clamp(8.5 * s, 8, 16); ctx.font = "400 " + ss + "px " + FONT; ctx.fillStyle = C.mute; ctx.fillText(n.sub, x + (n.kind === "users" ? 8 : 12) * s, y + h - 8 * s); }
        ctx.globalAlpha = 1;
    }
    /** Live state on top of the static box: status, utilisation, sparkline, queue, internals, hover and flash. */
    private drawNode(n: NodeDef) {
        const ctx = this.ctx, s = this.cam.s, sim = this.sim, st = sim.nodes[n.id]; const [cx, cy] = this.w2s(n.x, n.y); const w = n.w * s, h = n.h * s; const x = cx - w / 2, y = cy - h / 2;
        if (x > this.W + 20 || y > this.H + 20 || x + w < -20 || y + h < -20) return;
        const hover = this.hover === n.id, sel = this.selected === n.id;
        const down = !st.alive || (n.id === "cache" && !sim.cacheAlive) || st.replicas === 0; const util = st.util;
        const warn = util > 0.75 || st.queue.length > 3 || (n.id === "razorpay" && sim.now < sim.flags.slowUntil) || (n.id === "ride" && !sim.flags.rtdbMumbai) || (n.id === "pg" && !sim.flags.index);
        if (down || hover || sel) { ctx.lineWidth = hover || sel ? 1.5 : 1; ctx.strokeStyle = down ? "rgba(244,114,182,0.9)" : "rgba(242,242,247,0.85)"; ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h)); }
        if (this.flash[n.id] && this.time < this.flash[n.id]) { ctx.lineWidth = 1; ctx.strokeStyle = "rgba(244,114,182,0.6)"; ctx.strokeRect(x - 4, y - 4, w + 8, h + 8); }
        const fs = clamp(10 * s, 9.5, 20); ctx.textBaseline = "alphabetic";
        if (n.kind !== "users") { ctx.fillStyle = down ? C.pink : n.kind === "ctl" ? "rgba(242,242,247,0.35)" : warn ? C.amber : C.ok; ctx.fillRect(x + 6 * s, y + 7 * s, Math.max(2, 3 * s), Math.max(2, 3 * s)); }
        if (down) { ctx.font = "500 " + fs + "px " + FONT; ctx.fillStyle = C.pink; ctx.fillText(n.label.toUpperCase(), x + 12 * s, y + 11 * s + fs * 0.35); }
        if (s > 0.55 && (n.id === "pg" || n.id === "workers" || n.id === "ride")) { const ss = clamp(8.5 * s, 8, 16); ctx.font = "400 " + ss + "px " + FONT; ctx.fillStyle = C.mute; let sub = n.sub; if (n.id === "pg" && st.promoted) sub = "promoted replica"; if (n.id === "workers" || n.id === "ride") sub = n.sub + " · ×" + st.replicas + (st.provisioningUntil ? " +1…" : ""); ctx.fillText(sub, x + 12 * s, y + h - 8 * s); }
        if (n.kind !== "users" && n.kind !== "ctl") {
            const bw = (w - 16 * s) * clamp(util, 0, 1); ctx.fillStyle = util > 0.9 ? C.pink : util > 0.7 ? C.amber : "rgba(34,211,238,0.7)"; ctx.fillRect(x + 8 * s, y + h - 4 * s, bw, Math.max(1, 1.5 * s)); ctx.fillStyle = "rgba(242,242,247,0.08)"; ctx.fillRect(x + 8 * s + bw, y + h - 4 * s, w - 16 * s - bw, Math.max(1, 1.5 * s));
            if (s > 0.7) { const sw = 34 * s, sh = 9 * s, sx0 = x + w - sw - 8 * s, sy0 = y + 6 * s; ctx.strokeStyle = "rgba(242,242,247,0.45)"; ctx.lineWidth = 1; ctx.beginPath(); st.sparks.forEach((v, i) => { const px = sx0 + (i / (st.sparks.length - 1)) * sw, py = sy0 + sh - v * sh; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke(); }
        }
        const q = st.queue.length;
        if (q > 0) { const left = n.x - n.w / 2; const cols = Math.min(q, 60); ctx.fillStyle = q > 20 ? C.pink : C.amber; for (let i = 0; i < cols; i++) { const row = i % 12, col = Math.floor(i / 12); const [qx, qy] = this.w2s(left - 6 - col * 5, n.y - n.h / 2 + 6 + row * 4.2); ctx.fillRect(qx - 1.4 * s, qy - 1.4 * s, Math.max(2, 2.8 * s), Math.max(2, 2.8 * s)); } if (q > 60 || s > 1.2) { ctx.font = "500 " + clamp(9 * s, 8, 14) + "px " + FONT; ctx.fillStyle = C.amber; const [tx, ty] = this.w2s(left - 8, n.y + n.h / 2 + 10); ctx.textAlign = "right"; ctx.fillText("+" + q + " queued", tx, ty); ctx.textAlign = "left"; } }
        if (s > 1.5 && n.internals) this.drawInternals(n, st, x, y, w, h);
    }
    private drawInternals(n: NodeDef, st: NodeState, x: number, y: number, w: number, h: number) {
        const ctx = this.ctx, s = this.cam.s, sim = this.sim; const ix = x + 12 * s, iy = y + 23 * s, iw = w - 24 * s, ih = h - 46 * s; ctx.font = "400 " + clamp(6.5 * s, 8, 13) + "px " + FONT; const footY = y + h - 19.5 * s;
        if (n.internals === "gateway") { const slots = sim.slots(st); const cols = 30, rows = Math.ceil(slots / cols); const cw = iw / cols, ch = Math.min(ih / rows, cw); const payHeld = sim.active.filter((r) => r.type === "checkout" && r.held.includes("gateway")).length; for (let i = 0; i < slots; i++) { const c = i % cols, r = Math.floor(i / cols); const busy = i < st.busy; const pay = busy && i >= st.busy - payHeld; ctx.fillStyle = busy ? (pay ? C.amber : C.cyan) : "rgba(242,242,247,0.12)"; ctx.fillRect(ix + c * cw + 1, iy + r * ch + 1, Math.max(1, cw - 2), Math.max(1, ch - 2)); } ctx.fillStyle = C.mute; ctx.fillText(st.busy + " / " + slots + " threads busy" + (payHeld ? " · " + payHeld + " waiting on Razorpay" : ""), ix, footY); }
        else if (n.internals === "cache") { const lanes = 8, lh = ih / lanes; for (let l = 0; l < lanes; l++) { const ly = iy + l * lh + lh / 2; ctx.fillStyle = "rgba(242,242,247,0.12)"; ctx.fillRect(ix, ly, iw, 1); for (let k = 0; k < 5; k++) { const t = ((this.time / 900) * (0.6 + l * 0.11) + k / 5 + l * 0.13) % 1; ctx.fillStyle = sim.cacheAlive ? C.cyan : C.pink; ctx.globalAlpha = sim.cacheAlive ? 0.9 : 0.3; ctx.fillRect(ix + t * iw - 1, ly - 1.5, 3, 3); ctx.globalAlpha = 1; } } const m = sim.metrics; ctx.fillStyle = C.mute; ctx.fillText("8 threads · " + sim.cache.size + " keys · hit " + Math.round(m.cacheHit * 100) + " %" + (sim.cacheAlive ? "" : " · UNREACHABLE"), ix, footY); }
        else if (n.internals === "db") { const rows = 6, cols = 8, cw = (iw * 0.78) / cols, ch = ih / rows; const scan = !sim.flags.index; const sweep = (this.time / 700) % 1; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const lit = scan ? Math.abs(r / rows - sweep) < 0.12 : r === 2 && c < 3; ctx.fillStyle = lit ? (scan ? C.amber : C.cyan) : "rgba(242,242,247,0.14)"; ctx.fillRect(ix + c * cw + 1, iy + r * ch + 1, cw - 2, Math.max(1, ch - 2)); } ctx.fillStyle = scan ? C.amber : C.ok; ctx.fillText(scan ? "seq scan" : "idx seek", ix + iw * 0.8, iy + ch); ctx.fillStyle = C.mute; ctx.fillText(st.busy + " / " + sim.slots(st) + " conns" + (st.alive ? "" : " · DOWN"), ix, footY); }
        else if (n.internals === "queue") { const depth = sim.nodes.workers.queue.length; const parts = 4; const pw = iw / parts; for (let p = 0; p < parts; p++) { const d = Math.floor(depth / parts) + (p < depth % parts ? 1 : 0); const bh = Math.min(ih, (d / 12) * ih); ctx.fillStyle = "rgba(242,242,247,0.12)"; ctx.fillRect(ix + p * pw + 2, iy, pw - 4, ih); ctx.fillStyle = d > 15 ? C.pink : d > 5 ? C.amber : C.cyan; ctx.fillRect(ix + p * pw + 2, iy + ih - bh, pw - 4, bh); } ctx.fillStyle = C.mute; ctx.fillText("backlog " + depth + " jobs · 4 partitions", ix, footY); }
        else if (n.internals === "workers") { const threads = n.threads || 1; const bw = iw / 6; for (let r = 0; r < 6; r++) { const alive = r < st.replicas; ctx.strokeStyle = alive ? "rgba(242,242,247,0.35)" : "rgba(242,242,247,0.1)"; ctx.strokeRect(ix + r * bw + 2, iy, bw - 4, ih); if (alive) for (let t = 0; t < threads; t++) { const busy = r * threads + t < st.busy; ctx.fillStyle = busy ? C.amber : "rgba(242,242,247,0.15)"; ctx.fillRect(ix + r * bw + 5 + (t % 5) * ((bw - 10) / 5), iy + 4 + Math.floor(t / 5) * 6, Math.max(2, (bw - 10) / 5 - 2), 4); } } ctx.fillStyle = C.mute; ctx.fillText(st.replicas + " replicas × " + threads + " threads" + (st.provisioningUntil ? " · provisioning…" : ""), ix, footY); }
    }
    private drawCursors() {
        const ctx = this.ctx; const all: Cursor[] = [...this.ghosts.map((g) => ({ ...g, ghost: true })), ...this.peers];
        for (const p of all) {
            const [sx, sy] = this.w2s(p.x, p.y); if (sx < -40 || sy < -40 || sx > this.W + 40 || sy > this.H + 40) continue;
            ctx.strokeStyle = p.ghost ? "rgba(242,242,247,0.28)" : p.me ? C.cyan : C.violet; ctx.lineWidth = 1; if (p.ghost) ctx.setLineDash([2, 3]);
            ctx.beginPath(); ctx.arc(sx, sy, 6, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(sx - 10, sy); ctx.lineTo(sx + 10, sy); ctx.moveTo(sx, sy - 10); ctx.lineTo(sx, sy + 10); ctx.stroke();
            ctx.font = (p.ghost ? "400 9px " : "500 10px ") + FONT; ctx.fillStyle = p.ghost ? "rgba(242,242,247,0.38)" : C.ink; ctx.fillText(p.label, sx + 10, sy - 8);
        }
    }
}
