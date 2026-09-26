"use client";

import { useMemo, useState } from "react";
import { scoreJd } from "@/app/(site)/r/lib/score-jd";
import { personalData } from "@/utils/data/personal-data";

const KIND_LABEL = { project: "Project", experience: "Experience", skill: "Skill", note: "Note" };
const KIND_TAG = { project: "tag-v", experience: "tag-c", skill: "tag-a", note: "tag-ok" };

const SAMPLE_JD =
    "We're hiring a backend engineer to own our real-time collaboration platform. You'll design event-driven microservices in Java/Spring Boot, scale WebSocket signaling for thousands of concurrent meetings, and partner with the ML team on LLM-driven content features. Strong Redis, PostgreSQL, and AWS experience required. Bonus: WebRTC, low-latency systems, prior p99 work.";

function buildMailto({ jd, score, matchedSkills, items }) {
    const subject = encodeURIComponent(`Role fit: ${score}% · ${matchedSkills.slice(0, 4).join(" · ") || "see body"}`);
    const lines = [
        "Hi Dhruv,", "", `I ran the role-fitter on /r against the JD below — match score ${score}%.`, "", "Top signals:",
        ...items.slice(0, 6).map((it) => `  · [${it.kind}] ${it.id}: ${it.reason || ""}`),
        "", `Matched skills: ${matchedSkills.join(", ") || "(none)"}`, "", "JD:", jd,
    ];
    return `mailto:${personalData.email}?subject=${subject}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export default function RoleFitter() {
    const [jd, setJd] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const result = useMemo(() => (submitted && jd.trim() ? scoreJd(jd) : null), [jd, submitted]);
    const grouped = useMemo(() => {
        if (!result) return {};
        const out = { project: [], experience: [], skill: [], note: [] };
        for (const it of result.items) (out[it.kind] || (out[it.kind] = [])).push(it);
        return out;
    }, [result]);

    return (
        <section aria-label="Role fitter — paste a JD" data-role-fitter className="cell">
            <div className="cell-h"><i>▶</i><b>role-fitter</b><span>paste a JD</span><span className="r">token frequency + a curated map · nothing leaves your browser</span></div>
            <div className="cell-b" style={{ display: "grid", gap: 16 }}>
                <label className="field">
                    Job description
                    <textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={6} placeholder={SAMPLE_JD} />
                </label>
                <div className="btns">
                    <button type="button" className="mbtn mbtn-primary" onClick={() => setSubmitted(true)} disabled={!jd.trim()} data-role-fitter-submit>Analyze the JD</button>
                    <button type="button" className="mbtn mbtn-ghost" onClick={() => { setJd(SAMPLE_JD); setSubmitted(false); }}>Try a sample JD</button>
                    {result && <span className="rp-note" style={{ marginLeft: "auto" }}>{result.tokens.length} tokens · {result.items.length} items matched</span>}
                </div>
                {result && (
                    <div style={{ display: "grid", gap: 16 }}>
                        <FitScore score={result.score} matchedSkills={result.matchedSkills} />
                        <WhyIFit grouped={grouped} />
                        {result.missing.length > 0 && <GapHint missing={result.missing} />}
                        <ActionRow jd={jd} result={result} />
                    </div>
                )}
            </div>
        </section>
    );
}

function FitScore({ score, matchedSkills }) {
    const color = score >= 75 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f472b6";
    const verdict = score >= 75 ? "Strong fit: direct project hits across the stack." : score >= 50 ? "Workable fit: meaningful overlap, gaps below." : score >= 25 ? "Partial fit: some skills overlap; review the items below." : "Limited match: JD-keyword coverage is low.";
    return (
        <div className="cell" style={{ display: "flex", gap: 18, alignItems: "center", padding: 16 }}>
            <div style={{ position: "relative", width: 84, height: 84, flex: "none" }}>
                <svg viewBox="0 0 100 100" style={{ width: "100%", height: "100%", transform: "rotate(-90deg)" }} aria-hidden="true">
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(242,242,247,0.1)" strokeWidth="4" />
                    <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeWidth="4" strokeDasharray={Math.PI * 2 * 44} strokeDashoffset={Math.PI * 2 * 44 * (1 - score / 100)} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontFamily: "var(--fd)", fontWeight: 700, fontSize: 22, letterSpacing: "-.02em" }}>{score}%</div>
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <p className="rp-p" style={{ margin: "0 0 10px" }}>{verdict}</p>
                <div className="tags">{matchedSkills.length > 0 ? matchedSkills.map((s) => <span key={s} data-matched-skill={s} className="tag tag-v">{s}</span>) : <span className="rp-note">no direct skill matches</span>}</div>
            </div>
        </div>
    );
}

function WhyIFit({ grouped }) {
    const order = ["project", "experience", "skill", "note"];
    return (
        <div style={{ display: "grid", gap: 14 }}>
            <div className="rp-eyebrow" style={{ margin: 0 }}><b>Why I might fit</b></div>
            {order.map((kind) => {
                const items = grouped[kind];
                if (!items || items.length === 0) return null;
                return (
                    <div key={kind} style={{ display: "grid", gap: 8 }}>
                        <span className={"tag " + KIND_TAG[kind]} style={{ justifySelf: "start" }}>{KIND_LABEL[kind]} · {items.length}</span>
                        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                            {items.map((it, i) => (
                                <li key={`${it.kind}-${it.id}-${i}`} data-item-kind={it.kind} data-item-id={it.id} style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink2)", paddingLeft: 14, borderLeft: "1px solid var(--line2)" }}>
                                    <b style={{ color: "var(--ink)", fontWeight: 500, marginRight: 8 }}>{it.id}</b>{it.reason || ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
}

function GapHint({ missing }) {
    return (
        <div className="cell" style={{ padding: 14, borderColor: "rgba(245,158,11,.35)" }}>
            <div className="rp-eyebrow" style={{ margin: "0 0 10px" }}><i style={{ color: "var(--amber)" }}>JD tokens with no coverage</i></div>
            <div className="tags">{missing.map((m) => <span key={m} className="tag tag-a">{m}</span>)}</div>
            <p className="rp-note" style={{ marginTop: 10 }}>The words that appear most in the JD but are not in the curated map. If they are must-haves, put them in the follow-up email and I will answer honestly.</p>
        </div>
    );
}

function ActionRow({ jd, result }) {
    const mailto = buildMailto({ jd, score: result.score, matchedSkills: result.matchedSkills, items: result.items });
    const pdfUrl = `/api/resume?jd=${encodeURIComponent(jd)}`;
    return (
        <div className="btns" style={{ paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <a href={mailto} data-action="mailto" className="mbtn mbtn-primary">Send a tailored intro →</a>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer" data-action="download-pdf" className="mbtn">Tailored résumé (PDF) ↓</a>
            <span className="rp-note" style={{ marginLeft: "auto" }}>Both carry the matched-keyword summary.</span>
        </div>
    );
}
