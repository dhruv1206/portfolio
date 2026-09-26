"use client";

// The ⌘K palette, mounted once for every route. It owns the ⌘K / Ctrl+K
// shortcut and the `cr:palette` event the site bar dispatches. Commands
// come from three places: whatever the current page registered
// (app/lib/commands.ts), the site's pages, and the site-wide modes.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./palette.module.scss";
import { getCommands, getServerCommands, subscribeCommands, type Command } from "@/app/lib/commands";
import { useAudio } from "@/app/providers/audio-provider";
import { personalData } from "@/utils/data/personal-data";

const VoiceControlButton = dynamic(() => import("./ui/voice-control-button"), { ssr: false });

const PAGES: Command[] = [
    { id: "go-home", title: "Home", detail: "one particle system, six stages", keys: "/", href: "/", group: "Go to" },
    { id: "go-room", title: "Control room", detail: "break my production systems and watch them heal", keys: "/room", href: "/room", group: "Go to" },
    { id: "go-projects", title: "Projects", detail: "three machines you can run", keys: "/projects", href: "/projects", group: "Go to" },
    { id: "go-lab", title: "Lab", detail: "seven live physics experiments", keys: "/lab", href: "/lab", group: "Go to" },
    { id: "go-r", title: "Recruiter mode", detail: "TL;DR, paste-a-JD fit score, tailored PDF", keys: "/r", href: "/r", group: "Go to" },
    { id: "go-blog", title: "Blog", detail: "articles, syndicated from dev.to", keys: "/blog", href: "/blog", group: "Go to" },
];
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export default function Palette() {
    const router = useRouter();
    const audio = useAudio();
    const registered = useSyncExternalStore(subscribeCommands, getCommands, getServerCommands);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const [sel, setSel] = useState(0);
    const [voice, setVoice] = useState(false);
    const returnTo = useRef<Element | null>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const toggle = () => setOpen((o) => { if (!o) returnTo.current = document.activeElement; return !o; });
        const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); toggle(); } };
        const onVoice = () => setVoice((v) => !v);
        window.addEventListener("cr:palette", toggle); window.addEventListener("keydown", onKey); window.addEventListener("cr:voice", onVoice);
        return () => { window.removeEventListener("cr:palette", toggle); window.removeEventListener("keydown", onKey); window.removeEventListener("cr:voice", onVoice); };
    }, []);

    const modes = useMemo<Command[]>(() => [
        { id: "mode-resume", title: "Résumé (PDF)", detail: "the generic one; /r builds a tailored one", keys: "↗", href: personalData.resume, group: "Modes" },
        { id: "mode-stealth", title: "Printable résumé", detail: "plain text, safe to read at work", keys: "Esc Esc", group: "Modes", run: () => window.dispatchEvent(new CustomEvent("cr:stealth")) },
        { id: "mode-terminal", title: "Terminal", detail: "a shell over the same data (also ↑↑↓↓←→←→BA)", keys: "", group: "Modes", run: () => window.dispatchEvent(new CustomEvent("cr:terminal")) },
        { id: "mode-sound", title: audio.isMuted ? "Sound on" : "Sound off", detail: "clicks, ticks and the room's synthesised thuds", keys: "", group: "Modes", run: audio.toggleMute },
        { id: "mode-ambient", title: audio.isAmbientEnabled && !audio.isMuted ? "Ambient soundscape off" : "Ambient soundscape on", detail: "a low generative rumble under the page", keys: "", group: "Modes", run: () => { if (audio.isMuted) audio.toggleMute(); if (!(audio.isAmbientEnabled && !audio.isMuted)) { if (!audio.isAmbientEnabled) audio.toggleAmbient(); } else audio.toggleAmbient(); } },
        { id: "mode-voice", title: voice ? "Voice navigation off" : "Voice navigation", detail: "say “show me backend projects” or “go to contact”", keys: "", group: "Modes", run: () => setVoice((v) => !v) },
    ], [audio, voice]);

    const all = useMemo(() => [...registered.map((c) => ({ ...c, group: c.group || "This page" })), ...PAGES, ...modes], [registered, modes]);
    const items = useMemo(() => { const t = q.trim().toLowerCase(); return t ? all.filter((c) => (c.title + " " + (c.detail || "") + " " + (c.keys || "")).toLowerCase().includes(t)) : all; }, [all, q]);

    const close = () => { setOpen(false); const el = returnTo.current as HTMLElement | null; if (el && typeof el.focus === "function") el.focus(); };
    const run = (c: Command) => {
        close();
        if (c.run) { c.run(); return; }
        if (!c.href) return;
        if (/^https?:/.test(c.href)) window.open(c.href, "_blank", "noopener,noreferrer"); else router.push(c.href);
    };
    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") { e.preventDefault(); setSel((i) => (i + 1) % Math.max(1, items.length)); }
        else if (e.key === "ArrowUp") { e.preventDefault(); setSel((i) => (i - 1 + items.length) % Math.max(1, items.length)); }
        else if (e.key === "Enter") { e.preventDefault(); const c = items[sel]; if (c) run(c); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    };
    useEffect(() => { const el = listRef.current?.querySelector<HTMLElement>("[data-sel='1']"); el?.scrollIntoView({ block: "nearest" }); }, [sel, items]);

    const groups: { name: string; items: { c: Command; i: number }[] }[] = [];
    items.forEach((c, i) => { const g = c.group || "This page"; let grp = groups.find((x) => x.name === g); if (!grp) { grp = { name: g, items: [] }; groups.push(grp); } grp.items.push({ c, i }); });

    return (
        <>
            {voice && <VoiceControlButton autoStart onExit={() => setVoice(false)} />}
            {open && (
                <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Command palette" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
                    <div className={styles.sheet}>
                        <div className={styles.head}>
                            <span>⌘K</span>
                            <input
                                autoFocus type="text" autoComplete="off" spellCheck={false} placeholder="Where to, or what to do…" aria-label="Command" value={q}
                                onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey}
                            />
                            <button type="button" onClick={close}>esc</button>
                        </div>
                        <div className={styles.list} ref={listRef}>
                            {items.length === 0 && <div className={styles.empty}>nothing matches “{q}”</div>}
                            {groups.map((g) => (
                                <div key={g.name}>
                                    <div className={styles.group}>{g.name}</div>
                                    {g.items.map(({ c, i }) => (
                                        <button key={c.id} type="button" data-sel={i === sel ? "1" : "0"} className={cx(styles.cmd, i === sel && styles.sel, c.kind === "chaos" && styles.chaos, c.kind === "fix" && styles.fix)} onPointerEnter={() => setSel(i)} onClick={() => run(c)}>
                                            <b>{c.title}</b>{c.detail && <span>{c.detail}</span>}{c.keys ? <kbd>{c.keys}</kbd> : null}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className={styles.foot}><span><kbd>↑↓</kbd> move</span><span><kbd>↵</kbd> run</span><span><kbd>esc</kbd> close</span></div>
                    </div>
                </div>
            )}
        </>
    );
}
