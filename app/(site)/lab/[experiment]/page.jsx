import { notFound } from "next/navigation";
import Link from "next/link";
import { BsArrowLeft } from "react-icons/bs";
import {
    getExperiment,
    getAllExperimentSlugs,
} from "../experiments/registry";
import ExperimentHost from "../experiment-host";
import { personalData } from "@/utils/data/personal-data";

export function generateStaticParams() {
    return getAllExperimentSlugs().map((experiment) => ({ experiment }));
}

export async function generateMetadata(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) return { title: "Experiment not found" };
    return {
        title: `${exp.title} · Lab · ${personalData.name}`,
        description: exp.blurb,
        openGraph: { title: `${exp.title} · Lab`, description: exp.blurb },
    };
}

export default async function ExperimentPage(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) notFound();

    return (
        <section className="relative py-24 lg:py-28">
            <Link
                href="/lab"
                className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-violet-400 transition-colors mb-8"
            >
                <BsArrowLeft />
                <span>All experiments</span>
            </Link>

            <header className="mb-6">
                <div
                    className="text-xs font-mono uppercase tracking-wider mb-2"
                    style={{ color: exp.accent }}
                >
                    {exp.tagline}
                </div>
                <h1 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
                    {exp.title}
                </h1>
                <p className="text-gray-400 max-w-2xl leading-relaxed mt-3">
                    {exp.blurb}
                </p>
            </header>

            {/* Canvas stage */}
            <div
                className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-[#03000f]"
                style={{ height: "min(70vh, 640px)" }}
                data-experiment={exp.slug}
            >
                <ExperimentHost slug={exp.slug} />
            </div>

            <p className="mt-4 text-xs text-gray-500 font-mono">
                {exp.tags.join(" · ")} · runs entirely client-side · respects
                prefers-reduced-motion
            </p>
        </section>
    );
}
