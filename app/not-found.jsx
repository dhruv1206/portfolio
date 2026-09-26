import Link from "next/link";
import { projectsData } from "@/utils/data/projects-data";

export const metadata = { title: "Not found" };

const ROUTES = [
    { k: "/room", title: "The control room", sub: "A live, breakable model of the systems I run." },
    { k: "/lab", title: "The lab", sub: "Seven physics experiments, running in the browser." },
    { k: "/r", title: "Recruiter mode", sub: "Defendable numbers and a paste-a-JD fit score." },
];

export default function NotFound() {
    return (
        <main id="main-content" className="rp" style={{ minHeight: "100vh", padding: "calc(56px + 10vh) clamp(16px, 4vw, 56px) 80px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <header className="rp-head">
                    <p className="rp-eyebrow"><b>404</b> ENOENT <i>no such file or route</i></p>
                    <h1 className="rp-h1">This page was <em>garbage collected.</em></h1>
                    <p className="rp-lede">Or never allocated. Nothing here answers to that address, but these routes do.</p>
                </header>
                <div className="rows">
                    {projectsData.slice(0, 3).map((p, i) => (
                        <Link key={p.slug} href={`/projects/${p.slug}`} className="row"><span className="n">{String(i + 1).padStart(2, "0")}</span><span className="t"><b>{p.name}</b><span>{p.role} · case study with a live demo</span></span><span className="k">Open →</span></Link>
                    ))}
                    {ROUTES.map((r) => (
                        <Link key={r.k} href={r.k} className="row"><span className="n">{r.k}</span><span className="t"><b>{r.title}</b><span>{r.sub}</span></span><span className="k">Open →</span></Link>
                    ))}
                </div>
                <div className="btns" style={{ marginTop: 32 }}>
                    <Link href="/" className="mbtn mbtn-primary">Go home</Link>
                    <Link href="/#s5" className="mbtn">Open a connection</Link>
                </div>
            </div>
        </main>
    );
}
