// /lab — index of live experiments. Server-rendered card grid; each
// card links to /lab/[experiment]. New experiments are added by
// appending to experiments/registry.js (data) + experiment-host.jsx
// (the dynamic loader).

import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";
import { MdArrowOutward } from "react-icons/md";
import { experiments } from "./experiments/registry";
import { personalData } from "@/utils/data/personal-data";

export const metadata = {
    title: `Lab · ${personalData.name}`,
    description:
        "Live, interactive engineering experiments — a finite-difference wave solver, a Verlet cloth, and an n-body gravity simulator. All running in your browser.",
    openGraph: {
        title: `Lab · ${personalData.name}`,
        description:
            "Interactive physics + numerical-methods experiments running live in the browser.",
    },
};

export default function LabPage() {
    return (
        <section className="relative py-24 lg:py-32">
            <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-violet-400 transition-colors mb-8"
            >
                <BsArrowLeft />
                <span>Back home</span>
            </Link>

            <header className="mb-12">
                <div className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-3">
                    /lab
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-4">
                    Live experiments
                </h1>
                <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
                    Small, self-contained simulations — real numerical methods
                    and physics, integrated frame-by-frame in your browser.
                    Each one is interactive. Updated occasionally.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {experiments.map((exp, i) => (
                    <Link
                        key={exp.slug}
                        href={`/lab/${exp.slug}`}
                        className="group relative glass-card overflow-hidden p-6 flex flex-col min-h-[220px] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60"
                        style={{ "--exp-accent": exp.accent }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs font-mono text-gray-500">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                                className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border"
                                style={{
                                    color: exp.accent,
                                    borderColor: `${exp.accent}55`,
                                    backgroundColor: `${exp.accent}11`,
                                }}
                            >
                                {exp.tagline}
                            </span>
                        </div>
                        <h2
                            className="text-2xl font-display font-bold text-white mb-2 transition-colors"
                            style={{ color: undefined }}
                        >
                            {exp.title}
                        </h2>
                        <p className="text-sm text-gray-400 leading-relaxed flex-1">
                            {exp.blurb}
                        </p>
                        <div className="flex items-center justify-between mt-4">
                            <div className="flex flex-wrap gap-1.5">
                                {exp.tags.map((t) => (
                                    <span
                                        key={t}
                                        className="text-[10px] font-mono text-gray-500 px-1.5 py-0.5 rounded bg-white/5"
                                    >
                                        {t}
                                    </span>
                                ))}
                            </div>
                            <span
                                className="inline-flex items-center gap-1 text-sm font-medium"
                                style={{ color: exp.accent }}
                            >
                                Open
                                <MdArrowOutward
                                    size={16}
                                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                                />
                            </span>
                        </div>
                        <span
                            className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                            style={{ backgroundColor: exp.accent }}
                        />
                    </Link>
                ))}
            </div>
        </section>
    );
}
