import { notFound } from "next/navigation";
import Link from "next/link";
import { getExperiment, getAllExperimentSlugs } from "../experiments/registry";
import ExperimentHost from "../experiment-host";

export function generateStaticParams() {
    return getAllExperimentSlugs().map((experiment) => ({ experiment }));
}

export async function generateMetadata(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) return { title: "Experiment not found" };
    return { title: `${exp.title} · Lab`, description: exp.blurb, alternates: { canonical: `/lab/${exp.slug}` }, openGraph: { title: `${exp.title} · Lab`, description: exp.blurb } };
}

export default async function ExperimentPage(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) notFound();
    return (
        <div className="rp">
            <Link href="/lab" className="rp-back">← All experiments</Link>
            <header className="rp-head" style={{ marginBottom: 28 }}>
                <p className="rp-eyebrow"><b>/lab</b> <i>{exp.tagline}</i></p>
                <h1 className="rp-h1" style={{ fontSize: "clamp(34px, 5vw, 64px)" }}>{exp.title}</h1>
                <p className="rp-lede">{exp.blurb}</p>
            </header>
            <div className="lab-stage" style={{ height: "min(70vh, 640px)" }} data-experiment={exp.slug}>
                <ExperimentHost slug={exp.slug} />
            </div>
            <p className="rp-note" style={{ marginTop: 14 }}>{exp.tags.join(" · ")} · runs entirely client-side · respects prefers-reduced-motion</p>
        </div>
    );
}
