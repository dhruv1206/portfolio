"use client";

import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import styles from "./room.module.scss";
import { RoomController, type RoomSnapshot } from "@/app/room/controller";
import { ACTIONS } from "@/app/room/data";
import Panel from "./panel";
import Palette from "./palette";

// One controller per page lifetime: it survives the stealth-résumé toggle
// (which unmounts this subtree) and client-side navigation back to `/`,
// so the model keeps running instead of rebooting.
let shared: RoomController | null = null;
function getSharedController() { if (!shared) shared = new RoomController(); return shared; }

const Ctx = createContext<RoomController | null>(null);
export function useRoom(): RoomController { const c = useContext(Ctx); if (!c) throw new Error("useRoom outside ControlRoom"); return c; }
export function useSnapshot(): RoomSnapshot { const c = useRoom(); return useSyncExternalStore(c.subscribe, c.getSnapshot, c.getSnapshot); }
const fmt = (n: number, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export default function ControlRoom() {
    const [ctl] = useState(() => getSharedController());
    const canvasRef = useRef<HTMLCanvasElement>(null);
    useEffect(() => { const cv = canvasRef.current; if (!cv) return; ctl.attach(cv); (window as unknown as { __cr?: RoomController }).__cr = ctl; return () => { ctl.detach(); delete (window as unknown as { __cr?: RoomController }).__cr; }; }, [ctl]);
    return (
        <Ctx.Provider value={ctl}>
            <Root>
                <canvas ref={canvasRef} className={styles.world} role="img" aria-label="Live model of a production system. Use the console to inject faults." />
                <Boot />
                <Strip />
                <TourChip />
                <Rail />
                <SheetTabs />
                <Console />
                <Overlays />
                <Panel />
                <Palette />
            </Root>
        </Ctx.Provider>
    );
}

function Root({ children }: { children: ReactNode }) { const s = useSnapshot(); return <div className={styles.root} data-sheet={s.sheet}>{children}</div>; }

function Boot() {
    const s = useSnapshot(); const ctl = useRoom(); if (s.bootHidden) return null;
    return (
        <div className={cx(styles.boot, s.bootReady && styles.bootDone)} aria-live="polite">
            <div className={styles.bootTitle} onClick={() => ctl.skipBoot()}>
                <p className={styles.eyebrow}>Dhruv Agrawal · Software Engineer · MyRik</p>
                <h1>The systems I build,<br />running in front of you.</h1>
                <p className={styles.sub}>A live model of a production platform: 24 services, real queues, real timeouts. Break it. Watch it heal. Then replay the incidents I actually fixed.</p>
            </div>
            <div className={styles.bootLog} aria-label="boot log">
                {s.bootLines.slice(-9).map((l, k) => l.i < 0 ? <div key={k} className={styles.ready}>{l.text}</div> : <div key={k}><span>{String(l.i).padStart(2, "0")}</span>{l.text}<b>ok</b></div>)}
            </div>
            <button type="button" className={styles.bootSkip} onClick={() => ctl.skipBoot()}>skip boot →</button>
        </div>
    );
}

const HEALTH_TXT: Record<string, string> = { nominal: "all systems nominal", degraded: "degraded", outage: "outage", booting: "booting" };
function Strip() {
    const s = useSnapshot(); const ctl = useRoom();
    const nav: { name: "about" | "work" | "projects" | "stack" | "contact" | "records"; label: string; opt?: boolean }[] = [{ name: "about", label: "About" }, { name: "work", label: "Work" }, { name: "projects", label: "Projects" }, { name: "stack", label: "Stack" }, { name: "contact", label: "Contact" }, { name: "records", label: "Records", opt: true }];
    return (
        <header className={styles.strip}>
            <div className={styles.brand}><b>DA</b><span className={styles.name}>Dhruv Agrawal</span><span className={styles.role}>backend engineer · control room</span></div>
            <div className={styles.health} data-h={s.health}><i /><span>{HEALTH_TXT[s.health]}</span></div>
            <nav className={styles.nav} aria-label="Sections">
                {nav.map((n) => <button key={n.name} type="button" className={cx(s.panel?.name === n.name && "on", n.opt && "opt")} onClick={() => (s.panel?.name === n.name ? ctl.closePanel() : ctl.openPanel(n.name))}>{n.label}</button>)}
                <button type="button" className="opt" onClick={() => (s.tour ? ctl.stopTour() : ctl.startTour())}>Tour</button>
                <button type="button" className="opt" aria-pressed={s.sound} onClick={() => ctl.setSound(!s.sound)}>{s.sound ? "sound on" : "sound off"}</button>
                <button type="button" className="k" onClick={() => window.dispatchEvent(new CustomEvent("cr:palette"))}><kbd>⌘K</kbd></button>
                <a href="/r" className="opt" title="Plain document version">Read mode</a>
            </nav>
        </header>
    );
}

function TourChip() { const s = useSnapshot(); if (!s.tour) return null; return <div className={styles.tourchip}><i />tour running · Esc to stop</div>; }

function Spark({ data, color, min }: { data: number[]; color: string; min: number }) {
    const ref = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        const c = ref.current; if (!c) return; const dpr = Math.min(2, devicePixelRatio || 1); const w = c.clientWidth, h = c.clientHeight; if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr; }
        const ctx = c.getContext("2d"); if (!ctx) return; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h); if (data.length < 2) return;
        const m = Math.max(min, ...data); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
        data.forEach((v, i) => { const x = (i / (data.length - 1)) * w, y = h - 1 - (v / m) * (h - 2); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
        ctx.fillStyle = color; ctx.fillRect(w - 2, h - 1 - (data[data.length - 1] / m) * (h - 2) - 1.5, 3, 3);
    }, [data, color, min]);
    return <canvas ref={ref} />;
}

function Rail() {
    const s = useSnapshot(); const ctl = useRoom(); const m = s.metrics; const f = s.flags;
    const flags = [f.breaker && "breaker", f.jitter && "jitter", !f.index && "no index", !f.rtdbMumbai && "rtdb SG", !f.tokens && "no tokens", f.retries && !f.jitter && "naive retries"].filter(Boolean).join(" · ") || "baseline";
    const cls = (v: number, warn: number, bad: number) => (v > bad ? "bad" : v > warn ? "warn" : "");
    const t = s.trace; const tot = Math.max(1, t?.latency || 1);
    return (
        <aside className={cx(styles.rail, s.railHidden && styles.railHidden)} aria-label="Live metrics from the model">
            <div className={styles.rh}><span>model · live · <i>{Math.round(s.fps)} fps</i></span><button type="button" onClick={() => ctl.toggleRail()}>hide</button></div>
            <div className={cx(styles.mrow, styles.big)}><span>requests / s</span><b>{fmt(m.rps)}</b><Spark data={s.hist.rps} color="#22d3ee" min={100} /></div>
            <div className={cx(styles.mrow, styles.big)}><span>p99 latency</span><b className={cls(m.p99, 480, 700)}>{fmt(m.p99)} ms</b><Spark data={s.hist.p99} color="#f2f2f7" min={300} /></div>
            <div className={styles.mrow}><span>p50</span><b>{fmt(m.p50)} ms</b></div>
            <div className={cx(styles.mrow, styles.big)}><span>errors</span><b className={cls(m.errRate, 0.01, 0.05)}>{(m.errRate * 100).toFixed(1)} %</b><Spark data={s.hist.err} color="#f472b6" min={5} /></div>
            <div className={styles.mrow}><span>shed (503)</span><b className={cls(m.shedRate, 0.02, 0.2)}>{(m.shedRate * 100).toFixed(1)} %</b></div>
            <div className={cx(styles.mrow, styles.big)}><span>queued</span><b className={cls(m.queueDepth, 20, 60)}>{fmt(m.queueDepth)}</b><Spark data={s.hist.q} color="#f59e0b" min={10} /></div>
            <div className={styles.mrow}><span>cache hit</span><b>{Math.round(m.cacheHit * 100)} %</b></div>
            <div className={styles.mrow}><span>infra</span><b>₹{fmt(m.costHr)} / h</b></div>
            <div className={styles.mrow}><span>maps</span><b>₹{fmt(m.costPerRide)} / ride</b></div>
            <div className={styles.mrow}><span>state</span><b>{flags}</b></div>
            <div className={styles.trace}>
                <div className={styles.trh}><span>your request · <i>{s.city}</i></span><b className={t?.error ? "bad" : ""}>{t ? (t.error ? "failed" : fmt(t.latency) + " ms") : "—"}</b></div>
                {t?.hops.map((h, i) => <div key={i} className={styles.tr}><i>{h.label}</i><b style={{ width: Math.max(2, ((h.wait + h.svc) / tot) * 100) + "%" }} className={h.wait > h.svc ? "w" : ""} /><em>{h.wait ? h.wait + "+" : ""}{h.svc}</em></div>)}
                {t?.error && <div className={styles.trx}>{t.error}</div>}
            </div>
            <button type="button" className={styles.btnTrace} disabled={s.traceBusy} onClick={() => { ctl.trace(); ctl.caption("tracing one request end to end", 2500); }}>trace another request</button>
            <div className={styles.peers}><span>{s.peersText}</span><i>dashed cursor = ghost replay</i></div>
        </aside>
    );
}

function SheetTabs() {
    const s = useSnapshot(); const ctl = useRoom();
    return (
        <div className={styles.sheetTabs} role="tablist" aria-label="Panels">
            {(["console", "rail", "panel"] as const).map((k) => <button key={k} type="button" role="tab" className={s.sheet === k ? "on" : ""} aria-selected={s.sheet === k} onClick={() => ctl.setSheet(k)}>{k === "rail" ? "Live" : k === "panel" ? "Panel" : "Console"}</button>)}
        </div>
    );
}

function Console() {
    const s = useSnapshot(); const ctl = useRoom();
    const btn = (a: (typeof ACTIONS)[number]) => { const on = a.toggle ? !!(s.flags as unknown as Record<string, boolean>)[a.toggle] : false; return <button key={a.id} type="button" className={cx(styles.act, a.kind === "chaos" ? styles.chaos : styles.fix, on && "on")} aria-pressed={a.toggle ? on : undefined} title={a.explain} onClick={() => ctl.doAction(a.id)}><kbd>{a.key}</kbd><span>{a.label}</span></button>; };
    return (
        <section className={styles.console} aria-label="Console">
            <div className={styles.group}><h5>Chaos</h5><div className={styles.acts}>{ACTIONS.filter((a) => a.kind === "chaos").map(btn)}</div></div>
            <div className={styles.group}><h5>Fix</h5><div className={styles.acts}>{ACTIONS.filter((a) => a.kind === "fix").map(btn)}</div></div>
            <div className={styles.group}><h5>Load</h5><label htmlFor="cr-load" className={styles.loadVal}>{fmt(s.load)} rps</label><input id="cr-load" className={styles.range} type="range" min={60} max={1500} step={20} value={s.load} aria-label="Arrival rate" onChange={(e) => ctl.setLoad(+e.target.value)} /></div>
            <div className={styles.group}><h5>Log</h5><div className={styles.log} aria-live="polite">{s.log.slice(-8).map((e, i) => <div key={i} className={e.kind}><span>{("+" + e.rel.toFixed(0) + "s").padStart(6)}</span>{e.text}</div>)}</div></div>
        </section>
    );
}

function Overlays() {
    const s = useSnapshot();
    const tip = s.tip; const tw = 280, th = 200;
    return (
        <>
            <div className={cx(styles.caption, s.caption && styles.captionShow)} role="status">{s.caption?.text}</div>
            {tip && <div className={styles.tip} style={{ left: Math.min(innerWidth - tw - 12, tip.x + 16), top: Math.min(innerHeight - th - 12, tip.y + 16) }}><b>{tip.node.label}</b><span className={styles.tsub}>{tip.node.sub}</span>{tip.rows.map((r) => <span key={r[0]} style={{ display: "contents" }}><i>{r[0]}</i><em>{r[1]}</em></span>)}<u>click · inspect  ·  double-click · zoom</u></div>}
            <div className={cx(styles.toast, s.toast && styles.toastShow)} role="status">{s.toast?.text}</div>
        </>
    );
}
