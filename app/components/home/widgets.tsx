"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import styles from "./home.module.scss";

// Small interactive pieces embedded in the server-rendered stages.

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
const DStarDBREPL = dynamic(() => import("@/app/components/case-study/dstardb-repl"), { ssr: false, loading: () => <p className={styles.also}>loading the worker build…</p> });

/** The real DStarDB REPL (Web Worker build), loaded on demand. */
export function MachineRepl() {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" className={styles.run} onClick={() => setOpen((o) => !o)}><i>▶</i>{open ? "Hide" : "Run"}</button>
            {open && <div className={styles.embed} data-repl><DStarDBREPL /></div>}
        </>
    );
}
export function MachineReplBody({ children }: { children: React.ReactNode }) { return <>{children}</>; }

const STEPS = [["1 ingest", "Selenium walker"], ["2 summarise", "GPT · slide chunks"], ["3 translate", "10 languages"], ["4 speak", "gTTS per language"], ["5 compose", "MoviePy · 1080p"], ["6 publish", "Firebase + FCM"]];
const DUR = [420, 900, 700, 800, 1100, 380];
/** Six-stage stepper for the press-release pipeline; the real pipeline runs on the case-study page. */
export function Pipeline() {
    const [state, setState] = useState<("off" | "on" | "done")[]>(STEPS.map(() => "off")); const [done, setDone] = useState(false); const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    useEffect(() => () => timers.current.forEach(clearTimeout), []);
    const run = () => { timers.current.forEach(clearTimeout); timers.current = []; setState(STEPS.map(() => "off")); setDone(false); let t = 0; STEPS.forEach((_, i) => { timers.current.push(setTimeout(() => setState((s) => s.map((v, j) => (j === i ? "on" : v))), t)); t += DUR[i]; timers.current.push(setTimeout(() => setState((s) => s.map((v, j) => (j === i ? "done" : v))), t)); }); timers.current.push(setTimeout(() => setDone(true), t + 50)); };
    return (
        <>
            <button type="button" className={styles.run} onClick={run}><i>▶</i>Run</button>
            <div className={styles.pipe} style={{ marginTop: 10 }}>{STEPS.map((s, i) => <div key={s[0]} className={cx(styles.step, state[i] === "on" && styles.stepOn, state[i] === "done" && styles.stepDone)}>{s[0]}<small>{state[i] === "done" ? DUR[i] + " ms · ok" : s[1]}</small></div>)}</div>
            {done && <p className={styles.also}>Done: 1 MP4 + 10 MP3s. In production this is Selenium → GPT → googletrans/gTTS → MoviePy → Firebase. <Link href="/projects/ai-press-release-generator">Run the real pipeline →</Link></p>}
        </>
    );
}

export function CopyEmail({ email }: { email: string }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => { try { await navigator.clipboard.writeText(email); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { const r = document.createRange(); const el = document.getElementById("email-text"); if (el) { r.selectNodeContents(el); const s = getSelection(); s?.removeAllRanges(); s?.addRange(r); } } };
    return <div className={styles.email}><span id="email-text">{email}</span><button type="button" onClick={copy}>{copied ? "copied" : "copy"}</button></div>;
}

/** Posts to /api/contact (Telegram). Falls back to a mailto hint when the route is not configured. */
export function ContactForm({ email }: { email: string }) {
    const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
    const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
        e.preventDefault(); const f = new FormData(e.currentTarget); const payload = { name: String(f.get("name") || ""), email: String(f.get("email") || ""), message: String(f.get("message") || "") };
        if (!payload.message.trim()) return; setState("sending");
        try { const res = await fetch("/api/contact", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); setState(res.ok && data.success ? "sent" : "failed"); } catch { setState("failed"); }
    };
    if (state === "sent") return <p className={styles.sent}><b>Delivered to my phone.</b> Thanks, I will reply by email.</p>;
    return (
        <form className={styles.msg} onSubmit={submit}>
            <label>Name<input name="name" type="text" autoComplete="name" required /></label>
            <label>Email<input name="email" type="email" autoComplete="email" required /></label>
            <label className={styles.full}>Message<textarea name="message" rows={3} required /></label>
            <button className={styles.btn} type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send →"}</button>
            {state === "failed" && <p className={cx(styles.also, styles.full)}>That did not go through. Email me directly: <b>{email}</b></p>}
        </form>
    );
}

/** Stack rows; hovering one lights the matching band of the particle strata. */
export function StackLayers({ layers }: { layers: { k: string; name: string; tools: string[]; bold: number }[] }) {
    const set = (b: number) => window.dispatchEvent(new CustomEvent("spine:band", { detail: b }));
    return (
        <div className={styles.layers}>
            {layers.map((l, i) => (
                <div key={l.k} className={styles.layer} tabIndex={0} onPointerEnter={() => set(i)} onPointerLeave={() => set(-1)} onFocus={() => set(i)} onBlur={() => set(-1)}>
                    <div className={styles.k}><em>{l.k}</em>{l.name}</div>
                    <div className={styles.v}>{l.tools.map((t, j) => <span key={t}>{j > 0 && " · "}{j < l.bold ? <b>{t}</b> : t}</span>)}</div>
                </div>
            ))}
        </div>
    );
}
