// Server Component: the ledger at the foot of every page. Education,
// the lab index and the keyboard modes, then a colophon. The build
// year comes from next.config.js's env so the route stays static.
// `site="blog"`: on the blog subdomain the links back are absolute.

import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import { siteUrl } from "@/app/lib/origins";

const LAB = [
    ["Wave equation", "/lab/wave-equation"],
    ["Verlet cloth", "/lab/verlet-cloth"],
    ["N-body", "/lab/n-body"],
    ["Double pendulum", "/lab/double-pendulum"],
    ["Boids", "/lab/boids"],
    ["Lorenz", "/lab/attractor"],
    ["Fourier", "/lab/fourier"],
];

export default function Footer({ site = "main" }) {
    const year = process.env.BUILD_YEAR;
    const href = (path) => (site === "blog" ? siteUrl(path) : path);
    return (
        <footer className="ledger">
            <div>
                <h2>Education</h2>
                <ul>
                    <li><b>B.Tech Computer Science</b></li>
                    <li>Lakshmi Narain College of Technology, Bhopal</li>
                    <li className="mono">2021 → 2025 · 8.23 CGPA</li>
                </ul>
            </div>
            <div>
                <h2>Lab · live experiments</h2>
                <ul>
                    <li>{LAB.slice(0, 3).map((l, i) => <span key={l[1]}>{i > 0 && " · "}<Link href={href(l[1])}>{l[0]}</Link></span>)}</li>
                    <li>{LAB.slice(3).map((l, i) => <span key={l[1]}>{i > 0 && " · "}<Link href={href(l[1])}>{l[0]}</Link></span>)}</li>
                </ul>
            </div>
            <div>
                <h2>Keys</h2>
                <ul>
                    <li><kbd>⌘K</kbd> modes: director&apos;s cut, control room, recruiter, résumé, terminal</li>
                    <li><kbd>`</kbd> web-vitals readout</li>
                    <li><kbd>Esc</kbd><kbd>Esc</kbd> printable résumé</li>
                </ul>
            </div>
            <div className="colophon">
                <span>© {year} Dhruv Agrawal · <a href={personalData.linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn</a> · <a href={personalData.github} target="_blank" rel="noopener noreferrer">GitHub</a></span>
                <span>one particle system, five layers · <Link href={href("/room")}>the control room</Link> is one click away</span>
            </div>
        </footer>
    );
}
