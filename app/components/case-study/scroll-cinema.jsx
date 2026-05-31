"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import AnimatedArchitecture from "./animated-architecture";
import { eventBus } from "@/app/lib/event-bus";

// ScrollCinema — chapter-driven scrollytelling.
//
// Props:
//   chapters       array of { id, eyebrow, title, body[], diagramState,
//                  code?, demoSlot? }
//   diagramStates  states map handed straight to <AnimatedArchitecture/>
//   accentColor    project accent (hex)
//   demos          { [slot]: ReactComponent } — mounted inside the
//                  matching chapter when its demoSlot is set
//
// Behaviour:
//   - lg+ viewports: two-column layout. The right column holds the
//     diagram inside `position: sticky` (no GSAP pinning, so we don't
//     fight the particle hero's scroll listener). Left column scrolls
//     chapters past the diagram.
//   - Each chapter is observed with IntersectionObserver tuned so the
//     "active" chapter is the one closest to the viewport centre. That
//     drives `activeStateId` and the diagram cross-fades.
//   - On smaller viewports OR `prefers-reduced-motion`, layout
//     collapses to a single column with each chapter's diagram
//     inlined above its prose. No sticky, no scroll-driven animation.

export default function ScrollCinema({
    chapters,
    diagramStates,
    accentColor = "#8b5cf6",
    demos = {},
}) {
    const reduced = useReducedMotion();
    const [activeIdx, setActiveIdx] = useState(0);

    // Hold chapter DOM nodes in a Map so we never read or assign to
    // refs during render (which the react-hooks/refs lint rule rightly
    // bans). Callback ref keys the Map by chapter index; the observer
    // is re-created when the set of indices changes.
    const chapterEls = useRef(new Map());
    const [nodeCount, setNodeCount] = useState(0);
    const setChapterEl = useCallback(
        (idx) => (el) => {
            if (el) chapterEls.current.set(idx, el);
            else chapterEls.current.delete(idx);
            setNodeCount(chapterEls.current.size);
        },
        [],
    );

    useEffect(() => {
        if (reduced) return undefined;
        if (typeof window === "undefined") return undefined;
        if (chapterEls.current.size === 0) return undefined;
        const ratios = new Map();
        const observer = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    const idx = Number(e.target.dataset.chapterIdx);
                    ratios.set(idx, e.isIntersecting ? e.intersectionRatio : 0);
                    // Also surface to the system-architecture overlay
                    // so its IO-scheduler edge pulses when chapters
                    // scroll into view.
                    if (e.isIntersecting) {
                        eventBus.emit("io:enter", {
                            target: "section",
                            id: e.target.dataset.chapterId || `chapter-${idx}`,
                        });
                    }
                }
                let bestIdx = 0;
                let bestRatio = -1;
                for (const [idx, r] of ratios) {
                    if (r > bestRatio) {
                        bestRatio = r;
                        bestIdx = idx;
                    }
                }
                setActiveIdx(bestIdx);
            },
            {
                rootMargin: "-30% 0px -50% 0px",
                threshold: [0, 0.25, 0.5, 0.75, 1],
            },
        );
        for (const el of chapterEls.current.values()) observer.observe(el);
        return () => observer.disconnect();
        // nodeCount is the trigger — when chapter li elements mount we
        // re-attach the observer to the freshly-keyed Map entries.
    }, [reduced, nodeCount]);

    const activeChapter = chapters[activeIdx] || chapters[0];
    const activeStateId = activeChapter?.diagramState;

    return (
        <div className="scroll-cinema relative">
            {reduced ? (
                <LinearChapterFlow
                    chapters={chapters}
                    diagramStates={diagramStates}
                    accentColor={accentColor}
                    demos={demos}
                />
            ) : (
                <>
                    {/* Mobile: same linear flow, but with the diagram
                        inlined inside each chapter (so users without a
                        sticky-capable viewport still see what each
                        chapter is describing). */}
                    <div className="lg:hidden" data-cinema-mode="mobile">
                        <LinearChapterFlow
                            chapters={chapters}
                            diagramStates={diagramStates}
                            accentColor={accentColor}
                            demos={demos}
                        />
                    </div>

                    {/* Desktop scrollytelling: two columns, sticky diagram. */}
                    <div
                        data-cinema-mode="desktop"
                        className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,560px)] lg:gap-12"
                    >
                        {/* Text column scrolls. */}
                        <ol className="space-y-32 pt-12">
                            {chapters.map((c, i) => (
                                <li
                                    key={c.id}
                                    ref={setChapterEl(i)}
                                    data-chapter-idx={i}
                                    data-chapter-id={c.id}
                                    className="min-h-[60vh] flex flex-col justify-center"
                                >
                                    <ChapterText
                                        chapter={c}
                                        accentColor={accentColor}
                                        DemoComponent={
                                            c.demoSlot
                                                ? demos[c.demoSlot]
                                                : null
                                        }
                                    />
                                </li>
                            ))}
                        </ol>

                        {/* Sticky diagram. CSS sticky inside the grid
                            column — no JS pinning, no scroll listeners. */}
                        <div className="relative">
                            <div className="sticky top-24 self-start">
                                <DiagramPanel
                                    diagramStates={diagramStates}
                                    activeStateId={activeStateId}
                                    chapters={chapters}
                                    activeIdx={activeIdx}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ---------- Sub-components ----------

function ChapterText({ chapter, accentColor, DemoComponent }) {
    return (
        <article className="max-w-prose">
            <header className="mb-5">
                <p
                    className="text-xs font-mono uppercase tracking-wider mb-2"
                    style={{ color: accentColor }}
                >
                    {chapter.eyebrow}
                </p>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                    {chapter.title}
                </h2>
            </header>
            <div className="space-y-4">
                {chapter.body.map((para, i) => (
                    <p
                        key={i}
                        className="text-gray-300 text-base md:text-[17px] leading-relaxed"
                    >
                        {para}
                    </p>
                ))}
            </div>
            {chapter.code && <CodeSnippet snippet={chapter.code} />}
            {DemoComponent && (
                <div className="mt-8">
                    <DemoComponent />
                </div>
            )}
        </article>
    );
}

function DiagramPanel({ diagramStates, activeStateId, chapters, activeIdx }) {
    return (
        <div className="glass-card overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-black/30 font-mono text-[11px] text-gray-500 uppercase tracking-wider">
                <span>architecture</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-300">
                    {chapters[activeIdx]?.eyebrow || "—"}
                </span>
            </div>
            <div className="p-4 bg-[#06061a]/80">
                <AnimatedArchitecture
                    states={diagramStates}
                    activeStateId={activeStateId}
                />
            </div>
            <ChapterDots chapters={chapters} activeIdx={activeIdx} />
        </div>
    );
}

function ChapterDots({ chapters, activeIdx }) {
    return (
        <div className="flex items-center justify-center gap-2 px-4 py-3 border-t border-white/5 bg-black/40">
            {chapters.map((c, i) => (
                <span
                    key={c.id}
                    aria-hidden="true"
                    className={
                        "h-1.5 rounded-full transition-all duration-300 " +
                        (i === activeIdx
                            ? "w-8 bg-violet-400"
                            : "w-1.5 bg-white/20")
                    }
                />
            ))}
        </div>
    );
}

function CodeSnippet({ snippet }) {
    const lines = useMemo(() => snippet.snippet.split("\n"), [snippet]);
    const highlightSet = useMemo(
        () => new Set(snippet.highlight || []),
        [snippet.highlight],
    );
    return (
        <figure className="mt-6 glass-card overflow-hidden">
            <figcaption className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-black/30 font-mono text-[11px] text-gray-500">
                <span className="text-violet-400">●</span>
                <span>{snippet.file || "snippet"}</span>
                <span className="ml-auto text-gray-600 uppercase tracking-wider">
                    {snippet.lang || "txt"}
                </span>
            </figcaption>
            <pre className="px-4 py-3 overflow-x-auto bg-[#06061a]/80 font-mono text-[12.5px] leading-relaxed">
                {lines.map((line, i) => (
                    <div
                        key={i}
                        className={
                            highlightSet.has(i + 1)
                                ? "bg-violet-500/15 -mx-4 px-4"
                                : ""
                        }
                    >
                        <span className="select-none text-gray-600 mr-3 w-6 inline-block text-right">
                            {i + 1}
                        </span>
                        <span className="text-gray-200">{line || " "}</span>
                    </div>
                ))}
            </pre>
        </figure>
    );
}

// ---------- Linear fallback (mobile + reduced-motion) ----------

function LinearChapterFlow({
    chapters,
    diagramStates,
    accentColor,
    demos,
}) {
    return (
        <ol className="space-y-16">
            {chapters.map((c) => (
                <li key={c.id} className="space-y-6">
                    <header>
                        <p
                            className="text-xs font-mono uppercase tracking-wider mb-2"
                            style={{ color: accentColor }}
                        >
                            {c.eyebrow}
                        </p>
                        <h2 className="text-2xl md:text-3xl font-display font-bold text-white leading-tight">
                            {c.title}
                        </h2>
                    </header>
                    <div className="glass-card overflow-hidden">
                        <div className="p-4 bg-[#06061a]/80">
                            <AnimatedArchitecture
                                states={diagramStates}
                                activeStateId={c.diagramState}
                            />
                        </div>
                    </div>
                    <div className="space-y-4 max-w-prose">
                        {c.body.map((para, i) => (
                            <p
                                key={i}
                                className="text-gray-300 leading-relaxed"
                            >
                                {para}
                            </p>
                        ))}
                    </div>
                    {c.code && <CodeSnippet snippet={c.code} />}
                    {c.demoSlot && demos[c.demoSlot]
                        ? (() => {
                              const Demo = demos[c.demoSlot];
                              return (
                                  <div className="mt-6">
                                      <Demo />
                                  </div>
                              );
                          })()
                        : null}
                </li>
            ))}
        </ol>
    );
}

