"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { VideoEmbed } from "@/app/components/case-study/case-study-components";
import { projectsData } from "@/utils/data/projects-data";

// Per-project live demos. Mounted client-side only because each one
// owns a Web Worker or a peer connection.
const DStarDBREPL = dynamic(() => import("@/app/components/case-study/dstardb-repl"), { ssr: false });
const WebRTCDemo = dynamic(() => import("@/app/components/case-study/webrtc-demo"), { ssr: false });
const PressReleasePipeline = dynamic(() => import("@/app/components/case-study/press-release-pipeline"), { ssr: false });
const ScrollCinema = dynamic(() => import("@/app/components/case-study/scroll-cinema"), { ssr: false, loading: () => <div className="spin-wrap" style={{ minHeight: 240 }}><span className="spin" />loading the chapters</div> });

const LIVE_DEMOS = {
    dstardb: { title: "Try DStarDB", subtitle: "The real Redis-style command set, running entirely in this tab in a Web Worker. Every reply is timed in microseconds.", Component: DStarDBREPL },
    "realtime-collaboration": { title: "Open a real-time room", subtitle: "A real RTCPeerConnection negotiated in your browser. Create a room, share the link, and the other peer can join from anywhere. Loopback mode pairs you with a synthetic peer when you are alone; either way the video, RTT and bitrate below come from the real WebRTC stack.", Component: WebRTCDemo },
    "ai-press-release-generator": { title: "Run the press-release pipeline", subtitle: "The shape of the production Flask service: ingest → summarise → translate across 10 Indian languages → text-to-speech → compose a slide video with zoom, blur and fade. Translation goes through MyMemory here (Google Translate in production), speech uses Web Speech (gTTS in production), and the MP4 timeline is painted live on Canvas (MoviePy in production).", Component: PressReleasePipeline },
};

// Slug → dynamic loader for the chapter data. Each module exports
// `{ chapters, diagramStates }`; the import keeps the prose out of the
// initial route bundle.
const CHAPTER_LOADERS = {
    dstardb: () => import("@/utils/data/case-studies/dstardb"),
    "realtime-collaboration": () => import("@/utils/data/case-studies/realtime-collaboration"),
    "ai-press-release-generator": () => import("@/utils/data/case-studies/ai-press-release-generator"),
};

function useChapterData(slug) {
    const [data, setData] = useState(null);
    useEffect(() => {
        const loader = CHAPTER_LOADERS[slug];
        if (!loader) return undefined;
        let cancelled = false;
        loader().then((mod) => { if (!cancelled) setData({ slug, chapters: mod.chapters, diagramStates: mod.diagramStates }); });
        return () => { cancelled = true; };
    }, [slug]);
    return data && data.slug === slug ? data : null;
}

export default function CaseStudyPage({ project }) {
    const chapterData = useChapterData(project.slug);
    const demo = LIVE_DEMOS[project.slug];
    const hasChapters = !!CHAPTER_LOADERS[project.slug];
    const idx = projectsData.findIndex((p) => p.slug === project.slug);
    const next = projectsData[(idx + 1) % projectsData.length];
    const source = project.code || (project.url && project.url.includes("github") ? project.url : "");
    const site = project.url && !project.url.includes("github") ? project.url : "";

    return (
        <article className="rp" style={{ overflowX: "clip" }}>
            <Link href="/projects" className="rp-back">← All projects</Link>
            <header className="rp-head">
                <p className="rp-eyebrow"><b>{String(idx + 1).padStart(2, "0")} / {String(projectsData.length).padStart(2, "0")}</b> {project.role} {demo && <i>live demo below</i>}</p>
                <h1 className="rp-h1" style={{ fontSize: "clamp(36px, 5.6vw, 78px)" }}>{project.name}</h1>
                <p className="rp-lede">{project.description}</p>
                <div className="btns" style={{ marginTop: 26 }}>
                    {site && <a href={site} target="_blank" rel="noopener noreferrer" className="mbtn mbtn-primary">View project ↗</a>}
                    {source && <a href={source} target="_blank" rel="noopener noreferrer" className={"mbtn" + (site ? "" : " mbtn-primary")}>Source on GitHub ↗</a>}
                    {demo && <a href="#live-demo" className="mbtn mbtn-ghost">Jump to the demo ↓</a>}
                </div>
            </header>

            {hasChapters ? (
                chapterData ? (
                    <section id="scroll-cinema">
                        <ScrollCinema chapters={chapterData.chapters} diagramStates={chapterData.diagramStates} accentColor={project.accentColor} demos={demo ? { [project.slug]: demo.Component } : {}} />
                    </section>
                ) : <div className="spin-wrap" style={{ minHeight: 240 }}><span className="spin" />loading the chapters</div>
            ) : (
                <ClassicBody project={project} demo={demo} />
            )}

            <section className="rp-section">
                <div className="rp-sh"><i>stack</i><h2>Built with.</h2></div>
                <div className="tags">{project.tools.map((tool) => <span key={tool} className="tag">{tool}</span>)}</div>
            </section>

            {project.gallery && project.gallery.length > 0 && (
                <section className="rp-section" id="gallery">
                    <div className="rp-sh"><i>gallery</i><h2>Screens.</h2></div>
                    <div className="g2">{project.gallery.map((image, i) => <div key={i} className="cell" style={{ position: "relative", aspectRatio: "16 / 9", overflow: "hidden" }}><Image src={image} alt={`${project.name} screenshot ${i + 1}`} fill sizes="(min-width: 768px) 50vw, 100vw" style={{ objectFit: "cover" }} /></div>)}</div>
                </section>
            )}
            {project.video && (
                <section className="rp-section">
                    <div className="rp-sh"><i>video</i><h2>Demo.</h2></div>
                    <VideoEmbed url={project.video} title={`${project.name} demo`} />
                </section>
            )}

            <section className="rp-section">
                <div className="rows">
                    <Link href={`/projects/${next.slug}`} className="row"><span className="n">next</span><span className="t"><b>{next.name}</b><span>{next.description.split(". ")[0]}.</span></span><span className="k">Case study →</span></Link>
                </div>
            </section>
            <section className="rp-section">
                <div className="cell">
                    <div className="cell-h"><b>Want the story behind it?</b><span className="r">I answer email</span></div>
                    <div className="cell-b btns">
                        <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>Senior backend and platform roles, hard systems problems, or an argument about thread pools.</p>
                        <Link href="/#s5" className="mbtn mbtn-primary">Open a connection</Link>
                        <Link href="/r" className="mbtn mbtn-ghost">Recruiter mode</Link>
                    </div>
                </div>
            </section>
        </article>
    );
}

// Challenge / solution / demo, for a project that ships no chapter data.
function ClassicBody({ project, demo }) {
    return (
        <div style={{ display: "grid", gap: 18 }}>
            <section className="cell" id="challenge"><div className="cell-h"><i>01</i><b>The challenge</b></div><div className="cell-b"><p className="rp-p" style={{ margin: 0, fontSize: 16 }}>{project.challenge || "This project addressed key technical and user-experience challenges in its domain."}</p></div></section>
            <section className="cell" id="solution"><div className="cell-h"><i>02</i><b>The solution</b></div><div className="cell-b"><p className="rp-p" style={{ margin: 0, fontSize: 16 }}>{project.solution || "The solution involved careful architecture and modern best practices."}</p></div></section>
            {demo && (
                <section id="live-demo" className="rp-section" style={{ marginTop: 20 }}>
                    <div className="rp-sh"><i>▶</i><h2>{demo.title}</h2></div>
                    <p className="rp-p">{demo.subtitle}</p>
                    {(() => { const Comp = demo.Component; return <Comp />; })()}
                </section>
            )}
        </div>
    );
}
