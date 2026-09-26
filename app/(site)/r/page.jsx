// Recruiter Mode landing route.
//
// LinkedIn-friendly URL (`dhruvagrawal.dev/r?from=linkedin`) that
// gets a recruiter from a cold link to a decision in under a minute:
//   1. TL;DR career stats above the fold.
//   2. Paste-a-JD role-fitter with curated map scoring.
//   3. Mailto CTA + tailored-resume PDF download.
//
// Server-rendered shell + dynamic-imported client components for the
// role-fitter (which uses state + textarea).

import Link from "next/link";
import TlDr from "./components/tl-dr";
import RoleFitter from "./components/role-fitter";
import { personalData } from "@/utils/data/personal-data";

// Both TlDr and RoleFitter are "use client" components; importing
// them directly keeps the page a Server Component so the static
// header + TL;DR shell prerenders, then the role-fitter hydrates
// on demand.

export const metadata = {
    title: `${personalData.name} · Recruiter Mode`,
    description:
        "TL;DR career stats + a paste-a-JD role-fitter that tells you in 30 seconds whether I'm the right hire.",
    robots: {
        // The /r entry is a marketing surface; let it be indexed.
        index: true,
        follow: true,
    },
};

export default function RecruiterModePage() {
    return (
        <main className="relative py-24 lg:py-32 px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] mx-auto">
            <header className="mb-10">
                <div className="text-xs font-mono text-violet-400 uppercase tracking-wider mb-3">
                    /r · recruiter mode
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-4">
                    {personalData.name.split(" ").map((part, i) => (
                        <span
                            key={part}
                            className={i === 0 ? "gradient-text" : "text-white"}
                        >
                            {part}{" "}
                        </span>
                    ))}
                </h1>
                <p className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed">
                    Backend engineer · 3+ years building scalable systems · open
                    to senior backend / staff roles.{" "}
                    <Link
                        href="/"
                        className="text-violet-400 hover:text-violet-300 underline-offset-4 hover:underline"
                    >
                        Full portfolio →
                    </Link>
                </p>
            </header>

            <div className="space-y-8">
                <TlDr />
                <RoleFitter />
                <section
                    aria-label="Direct contact"
                    className="glass-card overflow-hidden"
                >
                    <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-black/30 font-mono text-xs">
                        <span className="text-emerald-400">▶</span>
                        <span className="text-gray-400">
                            direct contact · skip the form
                        </span>
                    </div>
                    <div className="p-5 bg-[#06061a]/80 flex flex-wrap gap-3 items-center">
                        <a
                            href={`mailto:${personalData.email}`}
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-violet-500/20 border border-violet-500/50 text-violet-100 hover:bg-violet-500/40 transition-colors"
                        >
                            Email me
                        </a>
                        <a
                            href={personalData.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 hover:bg-cyan-500/30 transition-colors"
                        >
                            LinkedIn DM
                        </a>
                        <a
                            href={personalData.resume}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 text-sm font-semibold rounded-md bg-white/5 border border-white/15 text-gray-200 hover:bg-white/10 transition-colors"
                        >
                            Generic resume (PDF)
                        </a>
                        <span className="text-[11px] text-gray-500 ml-auto">
                            Run the role-fitter above for a tailored PDF.
                        </span>
                    </div>
                </section>
            </div>
        </main>
    );
}
