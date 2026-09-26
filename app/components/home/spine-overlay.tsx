"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./home.module.scss";
import { Spine } from "@/app/spine/engine";
import { registerCommands } from "@/app/lib/commands";

// Everything on the homepage that needs the browser: the particle canvas
// and its labels, scroll → layer mapping, the stage rail, the live
// readout, the director's cut and toasts; its ⌘K commands are registered
// with the global palette. The stages themselves are server-rendered
// markup in app/(home)/page.tsx.

const NAMES = ["name", "people", "systems", "machines", "stack", "contact"];
const fmt = (n: number) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export default function SpineOverlay() {
    const canvasRef = useRef<HTMLCanvasElement>(null); const labelsRef = useRef<HTMLDivElement>(null); const spineRef = useRef<Spine | null>(null);
    const [stage, setStage] = useState(0); const [frac, setFrac] = useState(0); const [prog, setProg] = useState(0);
    const [stats, setStats] = useState({ fps: 0, ms: 0, gpu: "—", pts: 0, nogl: false, dom: 0 });
    const [hudOn, setHudOn] = useState(true); const [toast, setToast] = useState<string | null>(null); const [dc, setDc] = useState(false);
    const dcTimer = useRef<ReturnType<typeof setTimeout> | null>(null); const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // keys: D starts the director's cut, Esc stops it; ⌘K belongs to the global palette
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const typing = /INPUT|TEXTAREA/.test((document.activeElement && document.activeElement.tagName) || "");
            if (e.key === "Escape") { if (dcTimer.current) stopDC(); return; }
            if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
            if (e.key.toLowerCase() === "d") startDC();
        };
        function stopDCIfRunning() { if (dcTimer.current) stopDC(); }
        addEventListener("keydown", onKey); addEventListener("wheel", stopDCIfRunning, { passive: true }); addEventListener("touchstart", stopDCIfRunning, { passive: true });
        return () => { removeEventListener("keydown", onKey); removeEventListener("wheel", stopDCIfRunning); removeEventListener("touchstart", stopDCIfRunning); };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ⌘K: this page's own commands
    useEffect(() => registerCommands("home", [
        { id: "home-dc", title: "Director's cut", detail: "auto-descend through all six stages", keys: "D", group: "Homepage", run: startDC },
        { id: "home-hud", title: hudOn ? "Hide the live readout" : "Show the live readout", detail: "fps · frame time · GPU · dom-ready", keys: "", group: "Homepage", run: () => setHudOn((h) => !h) },
    ]), [hudOn]); // eslint-disable-line react-hooks/exhaustive-deps

    const go = (i: number) => { const s = sections()[i]; if (s) s.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); };
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
        </>
    );
}
