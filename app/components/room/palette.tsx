"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./room.module.scss";
import { useRoom, useSnapshot } from "./control-room";
import { ACTIONS, SCENARIOS } from "@/app/room/data";
import { useAudio } from "@/app/providers/audio-provider";

interface Cmd { t: string; d: string; k: string; kind?: "chaos" | "fix"; run?: () => void; href?: string }
const PANEL_TITLES: Record<string, string> = { about: "About", work: "Work · replay my incidents", projects: "Projects", stack: "Stack", contact: "Contact", records: "Records", notes: "Prototype notes" };

export default function Palette() {
    const ctl = useRoom(); const s = useSnapshot(); const audio = useAudio();
    const [open, setOpen] = useState(false); const [q, setQ] = useState(""); const [sel, setSel] = useState(0); const input = useRef<HTMLInputElement>(null);
    useEffect(() => { const toggle = () => { setOpen((o) => !o); setQ(""); setSel(0); }; window.addEventListener("cr:palette", toggle); return () => window.removeEventListener("cr:palette", toggle); }, []);
    const cmds = useMemo<Cmd[]>(() => [
        { t: "Start the tour", d: "60 seconds, narrated", k: "T", run: () => ctl.startTour() },
        ...ACTIONS.map((a) => ({ t: a.label, d: a.explain, k: a.key, kind: a.kind, run: () => ctl.doAction(a.id) })),
        ...SCENARIOS.map((sc) => ({ t: "Replay · " + sc.title, d: sc.org, k: "", run: () => ctl.startScenario(sc.id) })),
        ...(["about", "work", "projects", "stack", "contact", "records", "notes"] as const).map((p) => ({ t: "Open · " + PANEL_TITLES[p], d: "panel", k: "", run: () => ctl.openPanel(p) })),
        { t: "Fit the whole system", d: "reset the camera", k: "F", run: () => ctl.fit() },
        { t: s.sound ? "Sound off" : "Sound on", d: "synthesised ticks and thuds", k: "", run: () => ctl.setSound(!s.sound) },
        { t: audio.isAmbientEnabled && !audio.isMuted ? "Ambient sound off" : "Ambient sound on", d: "low generative rumble under the room", k: "", run: () => { if (audio.isMuted) audio.toggleMute(); audio.toggleAmbient(); } },
        { t: "Terminal", d: "retro shell over the same data (also ↑↑↓↓←→←→BA)", k: "", run: () => window.dispatchEvent(new CustomEvent("cr:terminal")) },
        { t: "Printable résumé", d: "plain text, safe to read at work", k: "Esc Esc", run: () => window.dispatchEvent(new CustomEvent("cr:stealth")) },
        { t: "Read mode · recruiter version", d: "plain document with a paste-a-JD fit score", k: "/r", href: "/r" },
        { t: "Lab · live experiments", d: "seven physics toys", k: "/lab", href: "/lab" },
        { t: "Case studies", d: "DStarDB REPL, WebRTC rooms, the press-release pipeline", k: "", href: "/projects/dstardb" },
    ], [ctl, s.sound, audio]);
    const items = useMemo(() => { const t = q.trim().toLowerCase(); return cmds.filter((c) => !t || (c.t + " " + c.d).toLowerCase().includes(t)); }, [cmds, q]);
    if (!open) return null;
    const run = (c: Cmd) => { setOpen(false); if (c.run) c.run(); else if (c.href) window.location.assign(c.href); };
    const onKey = (e: React.KeyboardEvent) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => (i + 1) % Math.max(1, items.length)); } else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => (i - 1 + items.length) % Math.max(1, items.length)); } else if (e.key === "Enter") { e.preventDefault(); const c = items[sel]; if (c) run(c); } else if (e.key === "Escape") { e.preventDefault(); setOpen(false); } };
    return (
        <div className={styles.overlay} role="dialog" aria-label="Command palette" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <div className={styles.sheet}>
                <header><span>⌘K</span><input ref={input} autoFocus type="text" placeholder="kill, breaker, replay, about…" autoComplete="off" value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} aria-label="Command" /><button type="button" onClick={() => setOpen(false)}>esc</button></header>
                <div>
                    {items.map((c, i) => {
                        const cls = [styles.cmd, i === sel && styles.cmdSel, c.kind === "chaos" && styles.cmdChaos, c.kind === "fix" && styles.cmdFix].filter(Boolean).join(" ");
                        return c.href
                            ? <a key={c.t} href={c.href} className={cls} onPointerEnter={() => setSel(i)}><b>{c.t}</b><span>{c.d}</span><kbd>{c.k}</kbd></a>
                            : <div key={c.t} className={cls} onPointerEnter={() => setSel(i)} onClick={() => run(c)}><b>{c.t}</b><span>{c.d}</span><kbd>{c.k}</kbd></div>;
                    })}
                </div>
            </div>
        </div>
    );
}
