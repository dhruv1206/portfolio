// /projects — the index of case studies. Each one ships a working demo,
// so the rows say what you can run, not just what was built.

import Link from "next/link";
import { projectsData } from "@/utils/data/projects-data";

export const metadata = {
    title: "Projects",
    description: "Three case studies, each with a working demo: DStarDB's REPL in a Web Worker, a real WebRTC room, and the press-release pipeline running in the browser.",
    alternates: { canonical: "/projects" },
};

const DEMO = {
    dstardb: ["Live REPL", "the C++ store compiled for the browser, timed in microseconds"],
    "realtime-collaboration": ["Live room", "a real RTCPeerConnection; share the link, join from any device"],
    "ai-press-release-generator": ["Live pipeline", "ingest → summarise → 10 languages → speech → video, in the tab"],
};
const SUMMARY = {
    dstardb: "A Redis-compatible in-memory store in C++20: reactor event loop, worker pool, reader-writer concurrency. 13 % more throughput and 50 % lower latency than Redis under concurrent reads.",
    "realtime-collaboration": "Seven Spring Boot services with one capability each. STOMP over WebSocket for signalling, WebRTC for media that never touches the servers, Eureka and a single public gateway.",
    "ai-press-release-generator": "PIB press releases in, narrated multilingual videos out. Selenium, GPT, ten languages of TTS and MoviePy; production time down 45 %.",
};
const EARLIER = {
    "college-attendance-app": "Flutter front end, Node.js back end on DigitalOcean. Web scraping for live attendance data, Firebase analytics and notifications, WorkManager for local reminders. 6,500+ downloads at 4.4 ★.",
    "amazon-clone": "Search, categories, cart and checkout with GPay and Apple Pay; an admin panel for products and sales. Flutter on a Node, Express and MongoDB back end.",
    "whatsapp-clone": "Phone-number auth, one-to-one and group chat, media types, status updates and video calling. Flutter, Firebase and Riverpod.",
};
const ALSO = [
    { title: "The control room", sub: "A live, breakable model of the systems I run: 24 services, real queues, real timeouts, seven replayable incidents.", k: "live", href: "/room" },
    { title: "Warehouse CCTV anomaly detection", sub: "MyRik · 35 cameras across 8 warehouses. Flags tampering, repositioning, blur and disconnection; per-zone person counting for live occupancy.", k: "2025" },
];

export default function ProjectsPage() {
    const featured = projectsData.filter((p) => DEMO[p.slug]);
    const earlier = projectsData.filter((p) => !DEMO[p.slug]);
    return (
        <div className="rp">
            <header className="rp-head">
                <p className="rp-eyebrow"><b>Projects</b> {projectsData.length} case studies <i>{featured.length} with live demos</i></p>
                <h1 className="rp-h1">Machines you <em>can run.</em></h1>
                <p className="rp-lede">Three systems, each with a working demo instead of a screenshot. The case studies walk through the architecture one decision at a time; the demo at the end is the real thing, running in your tab.</p>
            </header>

            <div className="rows">
                {featured.map((p, i) => {
                    const demo = DEMO[p.slug];
                    return (
                        <Link key={p.slug} href={`/projects/${p.slug}`} className="row">
                            <span className="n">{String(i + 1).padStart(2, "0")}</span>
                            <span className="t">
                                <b>{p.name}</b>
                                <span>{SUMMARY[p.slug] || p.description}</span>
                                <span className="tags">{p.tools.slice(0, 5).map((t) => <span key={t} className="tag">{t}</span>)}</span>
                            </span>
                            <span className="k">{demo && <i>▶ {demo[0]}</i>}Case study →</span>
                        </Link>
                    );
                })}
            </div>

            <section className="rp-section">
                <div className="rp-sh"><i>earlier</i><h2>Mobile, before the backend.</h2></div>
                <div className="rows">
                    {earlier.map((p) => (
                        <Link key={p.slug} href={`/projects/${p.slug}`} className="row">
                            <span className="n">{p.slug === "college-attendance-app" ? "2023" : "2022"}</span>
                            <span className="t"><b>{p.name}</b><span>{EARLIER[p.slug] || p.description}</span><span className="tags">{p.tools.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}</span></span>
                            <span className="k">Case study →</span>
                        </Link>
                    ))}
                </div>
            </section>

            <section className="rp-section">
                <div className="rp-sh"><i>also</i><h2>Shipped elsewhere.</h2></div>
                <div className="rows">
                    {ALSO.map((a) => a.href ? (
                        <Link key={a.title} href={a.href} className="row"><span className="n">{a.k}</span><span className="t"><b>{a.title}</b><span>{a.sub}</span></span><span className="k">Enter →</span></Link>
                    ) : (
                        <div key={a.title} className="row"><span className="n">{a.k}</span><span className="t"><b>{a.title}</b><span>{a.sub}</span></span><span className="k" /></div>
                    ))}
                </div>
            </section>

            <section className="rp-section">
                <div className="cell">
                    <div className="cell-h"><b>Reading for a role?</b><span className="r">60 seconds</span></div>
                    <div className="cell-b btns">
                        <p className="rp-p" style={{ margin: 0, flex: "1 1 320px" }}>Recruiter mode has the numbers behind these projects and a paste-a-JD fit score with a tailored PDF.</p>
                        <Link href="/r" className="mbtn">Recruiter mode</Link>
                        <Link href="/#s5" className="mbtn mbtn-ghost">Open a connection</Link>
                    </div>
                </div>
            </section>
        </div>
    );
}
