"use client";

import { useMemo, useState } from "react";
import { scoreJd } from "@/app/(site)/r/lib/score-jd";
import { personalData } from "@/utils/data/personal-data";

const KIND_LABEL = {
    project: "Project",
    experience: "Experience",
    skill: "Skill",
    note: "Note",
};
const KIND_COLOR = {
    project: "text-violet-300 border-violet-500/40 bg-violet-500/10",
    experience: "text-cyan-300 border-cyan-500/40 bg-cyan-500/10",
    skill: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    note: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
};

const SAMPLE_JD =
    "We're hiring a backend engineer to own our real-time collaboration platform. You'll design event-driven microservices in Java/Spring Boot, scale WebSocket signaling for thousands of concurrent meetings, and partner with the ML team on LLM-driven content features. Strong Redis, PostgreSQL, and AWS experience required. Bonus: WebRTC, low-latency systems, prior P99 work.";

function buildMailto({ jd, score, matchedSkills, items }) {
    const subject = encodeURIComponent(
        `Role fit: ${score}% · ${matchedSkills.slice(0, 4).join(" · ") || "see body"}`,
    );
    const lines = [
        `Hi Dhruv,`,
        ``,
        `I ran the role-fitter on /r against the JD below — match score ${score}%.`,
        ``,
        `Top signals:`,
        ...items
            .slice(0, 6)
            .map((it) => `  · [${it.kind}] ${it.id}: ${it.reason || ""}`),
        ``,
        `Matched skills: ${matchedSkills.join(", ") || "(none)"}`,
        ``,
        `JD:`,
        jd,
    ];
    return `mailto:${personalData.email}?subject=${subject}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export default function RoleFitter() {
    const [jd, setJd] = useState("");
    const [submitted, setSubmitted] = useState(false);

    const result = useMemo(() => {
        if (!submitted || !jd.trim()) return null;
        return scoreJd(jd);
    }, [jd, submitted]);

    const grouped = useMemo(() => {
        if (!result) return {};
        const out = { project: [], experience: [], skill: [], note: [] };
        for (const it of result.items) {
            (out[it.kind] || (out[it.kind] = [])).push(it);
        }
        return out;
    }, [result]);

    return (
        <section
            aria-label="Role fitter — paste a JD"
            data-role-fitter
            className="glass-card overflow-hidden"
        >
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-black/30 font-mono text-xs">
                <span className="text-cyan-400">▶</span>
                <span className="text-gray-400">role-fitter · paste a JD</span>
                <span className="ml-auto text-gray-500">token-frequency + curated map</span>
            </div>

            <div className="p-5 bg-[#06061a]/80 space-y-4">
                <label className="block">
                    <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                        Job description
                    </span>
                    <textarea
                        value={jd}
                        onChange={(e) => setJd(e.target.value)}
                        rows={6}
                        placeholder={SAMPLE_JD}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 font-mono text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/60"
                    />
                </label>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setSubmitted(true)}
                        disabled={!jd.trim()}
                        data-role-fitter-submit
                        className="px-4 py-2 text-sm font-semibold rounded-md bg-cyan-500/20 border border-cyan-500/50 text-cyan-100 hover:bg-cyan-500/40 hover:border-cyan-500/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Analyze JD
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setJd(SAMPLE_JD);
                            setSubmitted(false);
                        }}
                        className="text-xs text-violet-300 hover:text-violet-200 underline-offset-4 hover:underline"
                    >
                        try a sample JD
                    </button>
                    {result && (
                        <span className="ml-auto text-[12px] text-gray-500 font-mono">
                            {result.tokens.length} tokens · {result.items.length}{" "}
                            items matched
                        </span>
                    )}
                </div>

                {result && (
                    <div className="space-y-4">
                        <FitScore score={result.score} matchedSkills={result.matchedSkills} />
                        <WhyIFit grouped={grouped} />
                        {result.missing.length > 0 && (
                            <GapHint missing={result.missing} />
                        )}
                        <ActionRow jd={jd} result={result} />
                    </div>
                )}
            </div>
        </section>
    );
}

// ---------- Sub-components ----------

function FitScore({ score, matchedSkills }) {
    const ringColor =
        score >= 75
            ? "stroke-emerald-400"
            : score >= 50
              ? "stroke-amber-400"
              : "stroke-rose-400";
    return (
        <div className="flex items-center gap-4 p-4 rounded-md bg-black/30 border border-white/10">
            <div className="relative w-20 h-20 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="8"
                    />
                    <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        className={ringColor}
                        strokeWidth="8"
                        strokeDasharray={Math.PI * 2 * 42}
                        strokeDashoffset={(Math.PI * 2 * 42) * (1 - score / 100)}
                        strokeLinecap="round"
                    />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-white text-xl">
                    {score}%
                </div>
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-300 mb-2">
                    {score >= 75
                        ? "Strong fit — direct project hits across the stack."
                        : score >= 50
                          ? "Workable fit — meaningful overlap, gaps below."
                          : score >= 25
                            ? "Partial fit — some skills overlap; review the items below."
                            : "Limited match — JD-keyword coverage is low."}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {matchedSkills.length > 0 ? (
                        matchedSkills.map((s) => (
                            <span
                                key={s}
                                data-matched-skill={s}
                                className="px-2 py-0.5 text-[11px] font-mono rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-200"
                            >
                                {s}
                            </span>
                        ))
                    ) : (
                        <span className="text-[11px] text-gray-500 italic">
                            no direct skill matches
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function WhyIFit({ grouped }) {
    const order = ["project", "experience", "skill", "note"];
    return (
        <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-gray-500">
                Why I might fit
            </div>
            {order.map((kind) => {
                const items = grouped[kind];
                if (!items || items.length === 0) return null;
                return (
                    <div key={kind} className="space-y-1.5">
                        <div
                            className={
                                "inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded border " +
                                KIND_COLOR[kind]
                            }
                        >
                            {KIND_LABEL[kind]}{" "}
                            <span className="opacity-70">({items.length})</span>
                        </div>
                        <ul className="space-y-1">
                            {items.map((it, i) => (
                                <li
                                    key={`${it.kind}-${it.id}-${i}`}
                                    data-item-kind={it.kind}
                                    data-item-id={it.id}
                                    className="text-sm text-gray-200 leading-relaxed"
                                >
                                    <span className="text-gray-500 mr-2">▸</span>
                                    <span className="text-gray-100 font-semibold mr-2">
                                        {it.id}
                                    </span>
                                    <span className="text-gray-400">
                                        {it.reason || ""}
                                    </span>
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
        <div className="p-3 rounded-md bg-amber-500/5 border border-amber-500/20 text-[12px]">
            <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-1">
                JD tokens with no coverage
            </div>
            <div className="flex flex-wrap gap-1.5">
                {missing.map((m) => (
                    <span
                        key={m}
                        className="px-1.5 py-0.5 rounded font-mono text-amber-200/80 bg-amber-500/10 border border-amber-500/20"
                    >
                        {m}
                    </span>
                ))}
            </div>
            <div className="text-[11px] text-gray-500 mt-2 leading-snug">
                These are the words that appear most in the JD but
                aren&apos;t in the curated map. If they&apos;re
                must-haves, surface them in the follow-up email so
                Dhruv can answer honestly.
            </div>
        </div>
    );
}

function ActionRow({ jd, result }) {
    const mailto = buildMailto({
        jd,
        score: result.score,
        matchedSkills: result.matchedSkills,
        items: result.items,
    });
    const pdfUrl = `/api/resume?jd=${encodeURIComponent(jd)}`;
    return (
        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-white/5">
            <a
                href={mailto}
                data-action="mailto"
                className="px-4 py-2 text-sm font-semibold rounded-md bg-violet-500/20 border border-violet-500/50 text-violet-100 hover:bg-violet-500/40 hover:border-violet-500/80 transition-colors"
            >
                Send Dhruv a tailored intro →
            </a>
            <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-action="download-pdf"
                className="px-4 py-2 text-sm font-semibold rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/30 hover:border-cyan-500/70 transition-colors"
            >
                Download tailored resume (PDF) ↓
            </a>
            <span className="text-[11px] text-gray-500 ml-auto">
                Both buttons include the matched-keyword summary.
            </span>
        </div>
    );
}
