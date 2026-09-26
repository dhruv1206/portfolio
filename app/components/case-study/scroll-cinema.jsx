"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import AnimatedArchitecture from "./animated-architecture";
import { eventBus } from "@/app/lib/event-bus";

// ScrollCinema: chapter-driven scrollytelling.
//
//   chapters       [{ id, eyebrow, title, body[], diagramState, code?, demoSlot? }]
//   diagramStates  states map handed straight to <AnimatedArchitecture/>
//   accentColor    project accent (hex)
//   demos          { [slot]: ReactComponent }, mounted inside the chapter whose demoSlot matches
//
// Large viewports: two columns, the diagram sticky on the right, chapters
// scrolling past it; the chapter nearest the viewport centre drives the
// diagram state. Small viewports and reduced motion: one column with
// each chapter's diagram inlined above its prose.

export default function ScrollCinema({ chapters, diagramStates, accentColor = "#8b5cf6", demos = {} }) {
    const reduced = useReducedMotion();
    const [activeIdx, setActiveIdx] = useState(0);
    const chapterEls = useRef(new Map());
    const [nodeCount, setNodeCount] = useState(0);
    const setChapterEl = useCallback((idx) => (el) => { if (el) chapterEls.current.set(idx, el); else chapterEls.current.delete(idx); setNodeCount(chapterEls.current.size); }, []);

    useEffect(() => {
        if (reduced || typeof window === "undefined" || chapterEls.current.size === 0) return undefined;
        const ratios = new Map();
        const observer = new IntersectionObserver((entries) => {
            for (const e of entries) {
                const idx = Number(e.target.dataset.chapterIdx);
                ratios.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
                if (e.isIntersecting) eventBus.emit("io:enter", { target: "section", id: e.target.dataset.chapterId || `chapter-${idx}` });
            }
            let bestIdx = 0, bestRatio = -1;
            for (const [idx, r] of ratios) if (r > bestRatio) { bestRatio = r; bestIdx = idx; }
            setActiveIdx(bestIdx);
        }, { rootMargin: "-30% 0px -50% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] });
        for (const el of chapterEls.current.values()) observer.observe(el);
        return () => observer.disconnect();
    }, [reduced, nodeCount]);

    const activeChapter = chapters[activeIdx] || chapters[0];
    const activeStateId = activeChapter?.diagramState;

    if (reduced) return <div className="scroll-cinema relative"><LinearChapterFlow chapters={chapters} diagramStates={diagramStates} accentColor={accentColor} demos={demos} /></div>;
    return (
        <div className="scroll-cinema relative">
            <div className="lg:hidden" data-cinema-mode="mobile">
                <LinearChapterFlow chapters={chapters} diagramStates={diagramStates} accentColor={accentColor} demos={demos} />
            </div>
            <div data-cinema-mode="desktop" className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
                <ol className="space-y-28 pt-6 list-none m-0 p-0">
                    {chapters.map((c, i) => (
                        <li key={c.id} ref={setChapterEl(i)} data-chapter-idx={i} data-chapter-id={c.id} className="min-h-[56vh] flex flex-col justify-center">
                            <ChapterText chapter={c} index={i} accentColor={accentColor} DemoComponent={c.demoSlot ? demos[c.demoSlot] : null} />
                        </li>
                    ))}
                </ol>
                <div className="relative"><div className="sticky top-24 self-start"><DiagramPanel diagramStates={diagramStates} activeStateId={activeStateId} chapters={chapters} activeIdx={activeIdx} /></div></div>
            </div>
        </div>
    );
}

// Chapter prose carries inline `code` and *emphasis*; render them.
const INLINE = /(`[^`]+`|\*[^*]+\*)/g;
export function inline(text) {
    return String(text).split(INLINE).map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) return <code key={i} style={{ fontFamily: "var(--fm)", fontSize: ".9em", color: "var(--cyan)" }}>{part.slice(1, -1)}</code>;
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i} style={{ fontStyle: "normal", color: "var(--ink)" }}>{part.slice(1, -1)}</em>;
        return part;
    });
}

function ChapterHeader({ chapter, accentColor }) {
    return (
        <header style={{ marginBottom: 16 }}>
            <p className="rp-eyebrow" style={{ marginBottom: 14 }}><i style={{ color: accentColor }}>{chapter.eyebrow}</i></p>
            <h2 className="rp-h3" style={{ fontSize: "clamp(24px, 2.6vw, 34px)", lineHeight: 1.1, margin: 0 }}>{chapter.title}</h2>
        </header>
    );
}

function ChapterText({ chapter, accentColor, DemoComponent }) {
    return (
        <article style={{ maxWidth: "62ch" }}>
            <ChapterHeader chapter={chapter} accentColor={accentColor} />
            <div>{chapter.body.map((para, i) => <p key={i} className="rp-p" style={{ fontSize: 16.5, maxWidth: "none" }}>{inline(para)}</p>)}</div>
            {chapter.code && <CodeSnippet snippet={chapter.code} />}
            {DemoComponent && <div id="live-demo" style={{ marginTop: 28 }}><DemoComponent /></div>}
        </article>
    );
}

function DiagramPanel({ diagramStates, activeStateId, chapters, activeIdx }) {
    return (
        <div className="cell">
            <div className="cell-h"><b>architecture</b><span>{chapters[activeIdx]?.eyebrow || "—"}</span><span className="r">{String(activeIdx + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</span></div>
            <div style={{ padding: 14 }}><AnimatedArchitecture states={diagramStates} activeStateId={activeStateId} /></div>
            <div style={{ display: "flex", gap: 4, padding: "10px 14px", borderTop: "1px solid var(--line)" }} aria-hidden="true">
                {chapters.map((c, i) => <span key={c.id} style={{ flex: 1, height: 2, background: i === activeIdx ? "var(--cyan)" : i < activeIdx ? "var(--line2)" : "var(--line)", transition: "background .3s" }} />)}
            </div>
        </div>
    );
}

function CodeSnippet({ snippet }) {
    const lines = useMemo(() => snippet.snippet.split("\n"), [snippet]);
    const highlightSet = useMemo(() => new Set(snippet.highlight || []), [snippet.highlight]);
    return (
        <figure className="code">
            <figcaption><i>●</i><span>{snippet.file || "snippet"}</span><span className="r">{snippet.lang || "txt"}</span></figcaption>
            <pre>{lines.map((line, i) => <div key={i} className={highlightSet.has(i + 1) ? "hl" : ""}><span className="ln">{i + 1}</span>{line || " "}</div>)}</pre>
        </figure>
    );
}

function LinearChapterFlow({ chapters, diagramStates, accentColor, demos }) {
    return (
        <ol className="list-none m-0 p-0" style={{ display: "grid", gap: 56 }}>
            {chapters.map((c) => (
                <li key={c.id} style={{ display: "grid", gap: 18 }}>
                    <ChapterHeader chapter={c} accentColor={accentColor} />
                    <div className="cell"><div style={{ padding: 12 }}><AnimatedArchitecture states={diagramStates} activeStateId={c.diagramState} /></div></div>
                    <div style={{ maxWidth: "62ch" }}>{c.body.map((para, i) => <p key={i} className="rp-p" style={{ fontSize: 16, maxWidth: "none" }}>{inline(para)}</p>)}</div>
                    {c.code && <CodeSnippet snippet={c.code} />}
                    {c.demoSlot && demos[c.demoSlot] ? (() => { const Demo = demos[c.demoSlot]; return <div id="live-demo" style={{ marginTop: 8 }}><Demo /></div>; })() : null}
                </li>
            ))}
        </ol>
    );
}
