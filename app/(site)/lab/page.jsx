// /lab — index of live experiments. Server-rendered grid; each card
// links to /lab/[experiment]. Add an experiment by appending to
// experiments/registry.js (data) and experiment-host.jsx (the loader).

import Link from "next/link";
import { experiments } from "./experiments/registry";

export const metadata = {
    title: "Lab",
    description: "Seven live, interactive experiments: a finite-difference wave solver, a Verlet cloth, n-body gravity, a double pendulum, boids, the Lorenz attractor and Fourier epicycles, all running in your browser.",
    alternates: { canonical: "/lab" },
    openGraph: { images: [{ url: "/api/og?title=Live%20experiments&sub=Seven%20physics%20and%20numerical-methods%20simulations%2C%20integrated%20frame%20by%20frame%20in%20your%20browser.&path=/lab", width: 1200, height: 630 }] },
};

const TAG = { "#06b6d4": "tag-c", "#8b5cf6": "tag-v", "#f472b6": "tag-p" };

export default function LabPage() {
    return (
        <div className="rp">
            <header className="rp-head">
                <p className="rp-eyebrow"><b>/lab</b> {experiments.length} experiments <i>all client-side</i></p>
                <h1 className="rp-h1">Live <em>experiments.</em></h1>
                <p className="rp-lede">Small, self-contained simulations: real numerical methods and physics, integrated frame by frame in your browser. Each one is interactive. Updated occasionally.</p>
            </header>
            <div className="g3">
                {experiments.map((exp, i) => (
                    <Link key={exp.slug} href={`/lab/${exp.slug}`} className="cell" style={{ display: "flex", flexDirection: "column", minHeight: 250 }}>
                        <div className="cell-h"><span>{String(i + 1).padStart(2, "0")}</span><span className={"tag " + (TAG[exp.accent] || "")} style={{ marginLeft: "auto" }}>{exp.tagline}</span></div>
                        <div className="cell-b" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                            <h2 className="rp-h3" style={{ margin: 0 }}>{exp.title}</h2>
                            <p className="rp-p" style={{ margin: 0, fontSize: 14, flex: 1 }}>{exp.blurb}</p>
                            <div className="btns" style={{ marginTop: 6 }}>
                                <span className="tags">{exp.tags.map((t) => <span key={t} className="tag">{t}</span>)}</span>
                                <span className="rp-note" style={{ marginLeft: "auto", color: "var(--ink)" }}>Open ↗</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
