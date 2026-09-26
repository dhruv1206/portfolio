// Server Component: the ledger at the foot of every page. Education,
// the lab index and the keyboard modes, then a colophon. The build
// year comes from next.config.js's env so the route stays static.

import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";

const LAB = [
    ["Wave equation", "/lab/wave-equation"],
    ["Verlet cloth", "/lab/verlet-cloth"],
    ["N-body", "/lab/n-body"],
    ["Double pendulum", "/lab/double-pendulum"],
    ["Boids", "/lab/boids"],
    ["Lorenz", "/lab/attractor"],
    ["Fourier", "/lab/fourier"],
];

export default function Footer() {
    const year = process.env.BUILD_YEAR;
    return (
        <footer className="ledger">
            <div>
                <h4>Education</h4>
                <ul>
                    <li><b>B.Tech Computer Science</b></li>
                    <li>Lakshmi Narain College of Technology, Bhopal</li>
                    <li className="mono">2021 → 2025 · 8.23 CGPA</li>
                </ul>
            </div>
            <div>
                <h4>Lab · live experiments</h4>
                <ul>
                    <li>{LAB.slice(0, 3).map((l, i) => <span key={l[1]}>{i > 0 && " · "}<Link href={l[1]}>{l[0]}</Link></span>)}</li>
                    <li>{LAB.slice(3).map((l, i) => <span key={l[1]}>{i > 0 && " · "}<Link href={l[1]}>{l[0]}</Link></span>)}</li>
                </ul>
            </div>
            <div>
                <h4>Keys</h4>
                <ul>
                    <li><kbd>⌘K</kbd> modes: director&apos;s cut, control room, recruiter, résumé, terminal</li>
                    <li><kbd>`</kbd> web-vitals readout</li>
                    <li><kbd>Esc</kbd><kbd>Esc</kbd> printable résumé</li>
                </ul>
            </div>
            <div className="colophon">
                <span>© {year} Dhruv Agrawal · <a href={personalData.linkedIn} target="_blank" rel="noopener noreferrer">LinkedIn</a> · <a href={personalData.github} target="_blank" rel="noopener noreferrer">GitHub</a></span>
                <span>one particle system, five layers · <Link href="/room">the control room</Link> is one click away</span>
            </div>
        </footer>
    );
}
