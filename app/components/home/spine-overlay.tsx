"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./home.module.scss";
import { Spine } from "@/app/spine/engine";
import { useAudio } from "@/app/providers/audio-provider";

// Everything on the homepage that needs the browser: the particle canvas
// and its labels, scroll → layer mapping, the stage rail, the live
// readout, ⌘K modes, the director's cut and toasts. The stages
// themselves are server-rendered markup in app/(home)/page.tsx.

const NAMES = ["name", "people", "systems", "machines", "stack", "contact"];
const fmt = (n: number) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
interface Cmd { t: string; d: string; k: string; run?: () => void; href?: string }

export default function SpineOverlay() {
    const canvasRef = useRef<HTMLCanvasElement>(null); const labelsRef = useRef<HTMLDivElement>(null); const spineRef = useRef<Spine | null>(null);
    const [stage, setStage] = useState(0); const [frac, setFrac] = useState(0); const [prog, setProg] = useState(0);
    const [stats, setStats] = useState({ fps: 0, ms: 0, gpu: "—", pts: 0, nogl: false, dom: 0 });
    const [hudOn, setHudOn] = useState(true); const [toast, setToast] = useState<string | null>(null); const [dc, setDc] = useState(false); const [pal, setPal] = useState(false);
    const dcTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const audio = useAudio();

    const say = (msg: string, ms = 3400) => { setToast(msg); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), ms); };
    const sections = () => Array.from(document.querySelectorAll<HTMLElement>("[data-stage]"));
    const stopDC = () => { if (dcTimer.current) clearTimeout(dcTimer.current); dcTimer.current = null; setDc(false); };
    const startDC = () => { stopDC(); setDc(true); const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches; const secs = sections(); let i = 0; const step = () => { if (i >= secs.length) { stopDC(); say("End of tour."); return; } secs[i].scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" }); i++; dcTimer.current = setTimeout(step, 3600); }; step(); };

    // engine
    useEffect(() => {
        const cv = canvasRef.current, lr = labelsRef.current; if (!cv || !lr) return;
        const page = cv.closest("[data-home]") as HTMLElement | null;
        const spine = new Spine({ canvas: cv, labelsRoot: lr, nameLines: () => [document.getElementById("name-l1"), document.getElementById("name-l2")], labelClass: (c) => cx(styles.lbl, c === "c" && styles.lblC, c === "l" && styles.lblL, c === "r" && styles.lblR), onAssembled: () => page?.setAttribute("data-assembled", "1") });
        spineRef.current = spine; (window as unknown as { __spine?: Spine }).__spine = spine;
        if (spine.nogl) page?.setAttribute("data-nogl", "1");
        const onBand = (e: Event) => { spine.band = (e as CustomEvent<number>).detail; }; window.addEventListener("spine:band", onBand);
        const nav = performance.getEntriesByType && (performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined);
        const iv = setInterval(() => setStats({ fps: spine.stats.fps, ms: spine.stats.ms, gpu: spine.stats.gpu, pts: spine.N, nogl: spine.nogl, dom: nav && nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : 0 }), 500);
        const resample = () => spine.resampleName(); const fontsTimer = setTimeout(resample, 1200);
        return () => { clearInterval(iv); clearTimeout(fontsTimer); window.removeEventListener("spine:band", onBand); spine.destroy(); spineRef.current = null; delete (window as unknown as { __spine?: Spine }).__spine; };
    }, []);

    // scroll → layer
    useEffect(() => {
        let C: number[] = []; const centers = () => { C = sections().map((s) => s.offsetTop + Math.min(s.offsetHeight, innerHeight) * 0.5); };
        let lastDim = 1; const gl = canvasRef.current;
        const onScroll = () => {
            if (!C.length) centers(); const y = scrollY + innerHeight * 0.5; let f = 0;
            if (y <= C[0]) f = 0; else if (y >= C[C.length - 1]) f = C.length - 1; else for (let i = 0; i < C.length - 1; i++) { if (y >= C[i] && y < C[i + 1]) { const r = (y - C[i]) / (C[i + 1] - C[i]); const p = Math.max(0, Math.min(1, (r - 0.22) / 0.56)); f = i + p * p * (3 - 2 * p); break; } }
            const sp = spineRef.current; if (sp) sp.target = 1 + f;
            setStage(Math.round(f)); setFrac(f); const doc = document.documentElement; setProg(scrollY / Math.max(1, doc.scrollHeight - innerHeight));
            const footer = document.querySelector("footer"); if (footer && gl) { const dim = footer.getBoundingClientRect().top < innerHeight * 0.92 ? 0.22 : 1; if (dim !== lastDim) { lastDim = dim; gl.style.opacity = String(dim); } }
        };
        const onResize = () => { centers(); onScroll(); };
        addEventListener("scroll", onScroll, { passive: true }); addEventListener("resize", onResize); onScroll(); const t1 = setTimeout(onResize, 600); const t2 = setTimeout(onResize, 2000);
        return () => { removeEventListener("scroll", onScroll); removeEventListener("resize", onResize); clearTimeout(t1); clearTimeout(t2); };
    }, []);

    // keys
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = /INPUT|TEXTAREA/.test((document.activeElement && document.activeElement.tagName) || "");
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPal((p) => !p); return; }
            if (e.key === "Escape") { if (dcTimer.current) stopDC(); setPal(false); return; }
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key.toLowerCase() === "d") startDC();
        };
        const onPal = () => setPal((p) => !p);
        addEventListener("keydown", onKey); window.addEventListener("cr:palette", onPal); addEventListener("wheel", stopDCIfRunning, { passive: true }); addEventListener("touchstart", stopDCIfRunning, { passive: true });
        function stopDCIfRunning() { if (dcTimer.current) stopDC(); }
        return () => { removeEventListener("keydown", onKey); window.removeEventListener("cr:palette", onPal); removeEventListener("wheel", stopDCIfRunning); removeEventListener("touchstart", stopDCIfRunning); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const go = (i: number) => { const s = sections()[i]; if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
    const cmds = useMemo<Cmd[]>(() => [
        { t: "Director's cut", d: "Auto-descend through all five layers", k: "D", run: startDC },
        { t: "Control room", d: "Break my production systems and watch them heal", k: "/room", href: "/room" },
        { t: hudOn ? "Hide the live readout" : "Show the live readout", d: "fps · frame time · GPU · dom-ready", k: "", run: () => setHudOn((h) => !h) },
        { t: "Recruiter mode", d: "TL;DR stats, paste-a-JD fit score, tailored PDF", k: "/r", href: "/r" },
        { t: "Printable résumé", d: "Plain text, safe to read at work", k: "Esc Esc", run: () => window.dispatchEvent(new CustomEvent("cr:stealth")) },
        { t: "Terminal", d: "Retro shell over the same data (also ↑↑↓↓←→←→BA)", k: "", run: () => window.dispatchEvent(new CustomEvent("cr:terminal")) },
        { t: audio.isAmbientEnabled && !audio.isMuted ? "Ambient sound off" : "Ambient sound on", d: "A low rumble under the page", k: "", run: () => { if (audio.isMuted) audio.toggleMute(); audio.toggleAmbient(); } },
        { t: "Lab", d: "Seven live physics experiments", k: "/lab", href: "/lab" },
        { t: "Case studies", d: "DStarDB REPL, WebRTC rooms, the press-release pipeline", k: "", href: "/projects/dstardb" },
    ], [hudOn, audio]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <>
            <canvas ref={canvasRef} className={styles.gl} aria-hidden="true" />
            <div className={styles.guides} aria-hidden="true"><i style={{ left: "calc(var(--gutter) + var(--rail))" }} /><i style={{ left: "50%" }} /><i style={{ right: "var(--gutter)" }} /></div>
            <div ref={labelsRef} className={styles.labels} aria-hidden="true" />
            <div className={styles.mprog} style={{ width: prog * 100 + "%" }} aria-hidden="true" />
            <nav className={styles.rail} aria-label="Stages"><i style={{ height: (frac / 5) * 264 + "px" }} />
                {NAMES.map((n, i) => <a key={n} href={"#s" + i} className={cx(styles.railItem, stage === i && styles.railActive)} onClick={(e) => { e.preventDefault(); go(i); }}><em>{String(i).padStart(2, "0")}</em><span>{n}</span></a>)}
            </nav>
            {dc && <div className={styles.dc} aria-live="polite"><i />Director&apos;s cut · Esc to stop</div>}
            <div className={cx(styles.hud, !hudOn && styles.hudHidden)} aria-label="Live readout">
                <span>fps</span><b className={stats.fps >= 55 ? styles.ok : ""}>{stats.fps ? Math.round(stats.fps) : "—"}</b>
                <span>frame</span><b>{stats.ms ? stats.ms.toFixed(1) + " ms" : "—"}</b>
                <span>points</span><b>{stats.nogl ? "no webgl2" : fmt(stats.pts)}</b>
                <span>gpu</span><b>{stats.gpu}</b>
                <span>dom ready</span><b>{stats.dom ? stats.dom + " ms" : "—"}</b>
                <span>stage</span><b>{String(stage).padStart(2, "0")} {NAMES[stage]}</b>
            </div>
            <div className={cx(styles.toast, toast && styles.toastShow)} role="status">{toast}</div>
            {pal && <Palette cmds={cmds} onClose={() => setPal(false)} />}
        </>
    );
}

function Palette({ cmds, onClose }: { cmds: Cmd[]; onClose: () => void }) {
    const [q, setQ] = useState(""); const [sel, setSel] = useState(0);
    const items = useMemo(() => { const t = q.trim().toLowerCase(); return cmds.filter((c) => !t || (c.t + " " + c.d).toLowerCase().includes(t)); }, [cmds, q]);
    const run = (c: Cmd) => { onClose(); if (c.run) c.run(); else if (c.href) window.location.assign(c.href); };
    const onKey = (e: React.KeyboardEvent) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => (i + 1) % Math.max(1, items.length)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => (i - 1 + items.length) % Math.max(1, items.length)); } else if (e.key === "Enter") { e.preventDefault(); const c = items[sel]; if (c) run(c); } };
    return (
        <div className={styles.overlay} role="dialog" aria-label="Modes" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={styles.sheet}>
                <header><span>⌘K</span><input autoFocus type="text" placeholder="Type a mode…" autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} aria-label="Mode" /><button type="button" onClick={onClose}>esc</button></header>
                <div>{items.map((c, i) => c.href
                    ? <a key={c.t} href={c.href} className={cx(styles.cmd, i === sel && styles.cmdSel)} onPointerEnter={() => setSel(i)}><b>{c.t}</b><span>{c.d}</span><kbd>{c.k}</kbd></a>
                    : <div key={c.t} className={cx(styles.cmd, i === sel && styles.cmdSel)} onPointerEnter={() => setSel(i)} onClick={() => run(c)}><b>{c.t}</b><span>{c.d}</span><kbd>{c.k}</kbd></div>)}</div>
            </div>
        </div>
    );
}
