"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./room.module.scss";
import { useRoom, useSnapshot } from "./control-room";
import { ABOUT, ACTION_BY_ID, EXAMPLE_RECORDS, NODE_BY_ID, PROJECTS, ROLES, SCENARIOS, STACK, type ScenarioMetric } from "@/app/room/data";

const TITLES: Record<string, string> = { about: "About", work: "Work · replay my incidents", projects: "Projects · live in this system", stack: "Stack · by layer", contact: "Contact · open a socket", records: "Records", notes: "How this page works", node: "Inspector" };
const fmt = (n: number) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export default function Panel() {
    const s = useSnapshot(); const ctl = useRoom(); const p = s.panel;
    return (
        <aside className={cx(styles.panel, p && styles.panelShow)} aria-label="Panel" aria-hidden={!p}>
            <div className={styles.ph}><b>{p ? TITLES[p.name] : ""}</b><button type="button" onClick={() => ctl.closePanel()}>esc</button></div>
            <div className={styles.body}>
                {p?.name === "about" && <About />}
                {p?.name === "work" && (s.scenario ? <ScenarioView /> : <Work />)}
                {p?.name === "projects" && <Projects />}
                {p?.name === "stack" && <Stack />}
                {p?.name === "contact" && <Contact />}
                {p?.name === "records" && <Records />}
                {p?.name === "notes" && <Notes />}
                {p?.name === "node" && p.arg && <NodeInspector id={p.arg} />}
            </div>
        </aside>
    );
}

function About() {
    return (
        <>
            <div className={styles.who}><b>{ABOUT.name}</b><span>{ABOUT.role}</span></div>
            {ABOUT.lines.map((l) => <p key={l}>{l}</p>)}
            <div className={styles.stats}>{ABOUT.stats.map((st) => <div key={st[1]}><b>{st[0]}</b><span>{st[1]}</span><em>{st[2]}</em></div>)}</div>
            <p className={styles.dim}>Every number above is from my résumé. Every number in the rail on the right is from the model running on this page. They are kept apart on purpose.</p>
            <div className={styles.links}>{ABOUT.links.map((l) => <a key={l[0]} href={l[1]} target="_blank" rel="noopener noreferrer">{l[0]}</a>)}</div>
        </>
    );
}

function Work() {
    const ctl = useRoom();
    return (
        <>
            <p className={styles.dim}>Seven incidents you can replay against the live model: three I actually shipped fixes for, four failure patterns every distributed system meets. Each one resets the system into the broken state, then walks through the fix one step at a time.</p>
            {SCENARIOS.map((sc) => <div key={sc.id} className={styles.card}><div className={styles.ch}><span>{sc.org}{sc.year ? " · " + sc.year : ""}{sc.real ? " · on the résumé" : " · pattern"}</span><b>{sc.title}</b></div><p>{sc.intro}</p><button type="button" className={styles.btn} onClick={() => ctl.startScenario(sc.id)}>Replay · {sc.steps.length} steps</button></div>)}
            <h4>Roles</h4>
            {ROLES.map((r) => <div key={r.org + r.when} className={styles.jobrow}><i>{r.when}</i><div><b>{r.org}</b><span>{r.title} · {r.where}</span>{r.bullets.length > 0 && <ul>{r.bullets.map((b) => <li key={b}>{b}</li>)}</ul>}</div></div>)}
        </>
    );
}

const LIVE: Record<ScenarioMetric, (m: { p99: number; errRate: number; shedRate: number; queueDepth: number; cacheHit: number; costPerRide: number }, workers: number) => [string, string]> = {
    p99: (m) => ["p99 now", fmt(m.p99) + " ms"], err: (m) => ["errors", (m.errRate * 100).toFixed(1) + " %"], shed: (m) => ["shed (503)", (m.shedRate * 100).toFixed(1) + " %"],
    queue: (m) => ["queued", fmt(m.queueDepth)], cacheHit: (m) => ["cache hit", Math.round(m.cacheHit * 100) + " %"], replicas: (_m, w) => ["worker replicas", String(w)], cost: (m) => ["maps cost / ride", "₹" + m.costPerRide],
};
function ScenarioView() {
    const s = useSnapshot(); const ctl = useRoom(); const sc = SCENARIOS.find((x) => x.id === s.scenario?.id); const st = s.scenario; if (!sc || !st) return null; const m = s.metrics; const done = st.step >= sc.steps.length;
    return (
        <div className={cx(styles.card, styles.cardOn)}>
            <div className={styles.ch}><span>{sc.org}{sc.year ? " · " + sc.year : ""} · replaying</span><b>{sc.title}</b></div>
            <p>{sc.intro}</p>
            <ol className={styles.steps}>{sc.steps.map((step, i) => <li key={step.label} className={i < st.step ? styles.done : i === st.step ? styles.cur : ""}><b>{step.label}</b><span>{step.caption}</span></li>)}</ol>
            <div className={styles.row}><button type="button" className={styles.btn} onClick={() => ctl.nextStep()}>{done ? "Done" : "Next: " + sc.steps[st.step].label}</button><button type="button" className={cx(styles.btn, styles.ghost)} onClick={() => ctl.stopScenario()}>Stop</button></div>
            <div className={styles.live}>
                {sc.metrics.includes("p99") && <div><span>p99 at start</span><b>{st.p99Start != null ? fmt(st.p99Start) + " ms" : "measuring…"}</b></div>}
                {sc.metrics.map((k) => { const v = LIVE[k](m, s.replicas.workers); return <div key={k}><span>{v[0]}</span><b>{v[1]}</b></div>; })}
            </div>
            {done && <p className={styles.real}><b>What actually happened.</b> {sc.real}</p>}
        </div>
    );
}

function Projects() {
    const ctl = useRoom();
    return (
        <>
            {PROJECTS.map((p) => <div key={p.id} className={styles.card}><div className={styles.ch}><span>{p.sub}</span><b>{p.title}</b></div><p>{p.text}</p><div className={styles.row}><button type="button" className={styles.btn} onClick={() => { ctl.focus(p.node, 2.6); ctl.openPanel("node", p.node); }}>{p.cta}</button>{p.link && <a className={cx(styles.btn, styles.ghost)} href={p.link} target={p.link.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">{p.link.startsWith("http") ? "Source ↗" : "Case study →"}</a>}</div></div>)}
        </>
    );
}

function Stack() {
    const ctl = useRoom();
    return (
        <>
            <p className={styles.dim}>Hover a layer: the nodes built with it light up in the diagram.</p>
            {STACK.map((l, i) => <div key={l.layer} className={styles.layer} onPointerEnter={() => ctl.setHighlight(l.nodes)} onPointerLeave={() => ctl.setHighlight(null)}><i>L{i} {l.layer}</i><span>{l.tools.join(" · ")}</span></div>)}
        </>
    );
}

function Contact() {
    const ctl = useRoom(); const [sent, setSent] = useState(false); const [copied, setCopied] = useState(false);
    const copy = async () => { try { await navigator.clipboard.writeText(ABOUT.email); setCopied(true); ctl.toast("copied " + ABOUT.email); setTimeout(() => setCopied(false), 1500); } catch { ctl.toast("select and copy the address"); } };
    const submit = (e: React.FormEvent<HTMLFormElement>) => { e.preventDefault(); const f = new FormData(e.currentTarget); const payload = { name: String(f.get("name") || ""), email: String(f.get("email") || ""), message: String(f.get("message") || "") }; if (!payload.message.trim()) return; ctl.sendMessage(payload, () => setSent(true)); };
    return (
        <>
            <p>Senior backend and platform roles, hard systems problems, or an argument about thread pools. I answer email.</p>
            <div className={styles.email}><span>{ABOUT.email}</span><button type="button" onClick={copy}>{copied ? "copied" : "copy"}</button></div>
            <div className={styles.links}>{ABOUT.links.slice(0, 4).map((l) => <a key={l[0]} href={l[1]} target="_blank" rel="noopener noreferrer">{l[0]}</a>)}</div>
            <h4>Or send it through the system</h4>
            <p className={styles.dim}>Your message becomes a job: it enters at the edge, rides the queue, a worker picks it up and it lands in storage. Then it is delivered to my phone.</p>
            {sent ? <p className={styles.real}><b>Delivered.</b> Thanks, I will reply by email.</p> : (
                <form className={styles.msgform} onSubmit={submit}>
                    <label>Name<input name="name" type="text" autoComplete="name" required /></label>
                    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
                    <label>Message<textarea name="message" rows={3} required /></label>
                    <button className={styles.btn} type="submit">Enqueue →</button>
                </form>
            )}
        </>
    );
}

function Records() {
    const s = useSnapshot(); const r = s.records; const sh = s.shared;
    const mine: [string, string][] = [["Highest load survived", r.maxRps ? fmt(r.maxRps) + " rps" : "—"], ["Longest outage caused", r.longestOutage ? r.longestOutage.toFixed(1) + " s" : "—"], ["Fastest recovery", r.fastestRecovery ? r.fastestRecovery.toFixed(1) + " s" : "—"], ["Visits from this browser", fmt(r.visits || 1)]];
    const board = [["Highest load survived", sh.maxRps ? fmt(sh.maxRps.value) + " rps" : null, sh.maxRps?.city], ["Longest outage caused", sh.longestOutage ? sh.longestOutage.value.toFixed(1) + " s" : null, sh.longestOutage?.city], ["Fastest recovery", sh.fastestRecovery ? sh.fastestRecovery.value.toFixed(1) + " s" : null, sh.fastestRecovery?.city]] as [string, string | null, string | undefined][];
    const hasBoard = board.some((b) => b[1]);
    return (
        <>
            <h4>Yours · this browser</h4>
            <div className={styles.recs}>{mine.map((x) => <div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
            <h4>{hasBoard ? "Board · everyone" : "Board · examples"}</h4>
            <div className={styles.recs}>{hasBoard ? board.filter((b) => b[1]).map((b) => <div key={b[0]}><span>{b[0]}<i>{b[2] || "somewhere"}</i></span><b>{b[1]}</b></div>) : EXAMPLE_RECORDS.map((x) => <div key={x.metric}><span>{x.metric}<i>{x.who}</i></span><b>{x.value}</b></div>)}</div>
            <p className={styles.dim}>Your records persist in this browser. The board is shared by every visitor and only keeps a best value per metric, never who you are beyond a city name.</p>
        </>
    );
}

function Notes() {
    return (
        <>
            <h4>The idea</h4><p>The old site described systems. This one <b>is</b> one. A model of the platforms I run, live, breakable, self-healing. You are the request; the console lets you hurt it; the incidents let you replay what I fixed.</p>
            <h4>Real</h4><ul><li>Discrete-event model: queues, thread pools, timeouts, retries, circuit breakers, failover, autoscaling, a cache with real keys.</li><li>Clock: 1 real second = 200 model ms. Latencies are model milliseconds; hops are slowed so you can see them.</li><li>Presence: other people with this page open appear as cursors, and their chaos hits your model too.</li><li>DStarDB REPL in the cache node reads the same keys the traffic uses.</li><li>The contact form is a job through the queue, then a real message to my phone.</li></ul>
            <h4>Trace</h4><p>Pick a request in the Trace dock and the model drops into slow motion while that one packet crosses it: the path lights up, everything else dims, and each hop reports what it did (which thread it took, whether the cache was warm, how long Postgres held it). Six kinds of request, three speeds.</p>
            <h4>Keys</h4><ul><li><kbd>K</kbd> <kbd>D</kbd> <kbd>C</kbd> <kbd>P</kbd> <kbd>S</kbd> <kbd>R</kbd> <kbd>I</kbd> <kbd>G</kbd> chaos · <kbd>B</kbd> <kbd>J</kbd> <kbd>+</kbd> <kbd>X</kbd> <kbd>M</kbd> <kbd>T</kbd> <kbd>W</kbd> <kbd>H</kbd> fixes</li><li><kbd>⌘K</kbd> palette · <kbd>F</kbd> fit · <kbd>Esc</kbd> back · scroll to zoom · drag to pan · double-click a node · <kbd>`</kbd> perf HUD · <kbd>Esc</kbd><kbd>Esc</kbd> printable résumé</li></ul>
        </>
    );
}

function NodeInspector({ id }: { id: string }) {
    const ctl = useRoom(); const s = useSnapshot(); const n = NODE_BY_ID[id]; if (!n) return null;
    const acts: Record<string, string[]> = { workers: ["killWorker", "scaleOut"], pg: ["killDb", "dropIndex", "addIndex"], cache: ["partitionCache", "warmCache"], razorpay: ["slowPayments", "breaker"], gateway: ["retryStorm", "jitter", "breaker", "spike"], ride: ["singapore", "moveRtdb", "scaleOut"], maps: ["tokens"], users: ["spike"] };
    void s.version; const live = ctl.nodeLive(id);
    return (
        <>
            <div className={styles.who}><b>{n.label}</b><span>{n.sub}</span></div>
            {n.stack && <p className={styles.dim}>{n.stack.join(" · ")}</p>}
            <div className={styles.live}>{live.map((x) => <div key={x[0]}><span>{x[0]}</span><b>{x[1]}</b></div>)}</div>
            {(acts[id] || []).length > 0 && <div className={styles.row}>{(acts[id] || []).map((a) => { const A = ACTION_BY_ID[a]; return <button key={a} type="button" className={cx(styles.btn, A.kind === "chaos" && styles.danger)} onClick={() => ctl.doAction(a)}>{A.label}</button>; })}</div>}
            {id === "cache" && <Repl />}
        </>
    );
}

function Repl() {
    const ctl = useRoom(); const [lines, setLines] = useState<{ cls: string; text: string; us?: number }[]>([]); const [cmd, setCmd] = useState(""); const out = useRef<HTMLDivElement>(null);
    const run = (c: string) => { const t = performance.now(); let o = "", err = ""; try { o = ctl.exec(c); } catch (e) { err = (e as Error).message; } const us = (performance.now() - t) * 1000; setLines((L) => [...L, { cls: "in", text: c }, ...(err ? [{ cls: "err", text: "(error) " + err, us }] : o ? [{ cls: "out", text: o, us }] : [])].slice(-60)); };
    useEffect(() => { const ids = ["INFO", "KEYS ride:1*", "GET ride:12"].map((c, i) => setTimeout(() => run(c), 300 + i * 260)); return () => ids.forEach(clearTimeout); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (out.current) out.current.scrollTop = out.current.scrollHeight; }, [lines]);
    return (
        <>
            <h4>REPL · the live cache</h4>
            <div className={styles.repl} ref={out}>{lines.map((l, i) => <div key={i} className={l.cls}>{l.text}{l.us != null && <span className="t">{l.us.toFixed(1)} µs</span>}</div>)}</div>
            <form className={styles.replform} onSubmit={(e) => { e.preventDefault(); if (cmd.trim()) { run(cmd); setCmd(""); } }}><span>dstar&gt;</span><input type="text" value={cmd} onChange={(e) => setCmd(e.target.value)} autoComplete="off" spellCheck={false} placeholder="KEYS ride:1* · GET ride:12 · INFO · HELP" aria-label="DStarDB command" /></form>
        </>
    );
}
