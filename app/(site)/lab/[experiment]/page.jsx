import { notFound } from "next/navigation";
import Link from "next/link";
import { getExperiment, getAllExperimentSlugs } from "../experiments/registry";
import ExperimentHost from "../experiment-host";
import { abs, ogImage, pageMetadata } from "@/app/lib/seo";
import { JsonLd, PERSON_ID, breadcrumbs, webPage } from "@/app/lib/structured-data";

export function generateStaticParams() {
    return getAllExperimentSlugs().map((experiment) => ({ experiment }));
}

export async function generateMetadata(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) return { title: "Experiment not found" };
    return pageMetadata({
        title: `${exp.title} · Lab`,
        description: exp.blurb,
        url: `/lab/${exp.slug}`,
        image: ogImage({ title: exp.title, sub: exp.tagline, path: `/lab/${exp.slug}`, color: exp.accent }),
    });
}

export default async function ExperimentPage(props) {
    const params = await props.params;
    const exp = getExperiment(params.experiment);
    if (!exp) notFound();
    const url = `/lab/${exp.slug}`;
    return (
        <div className="rp">
            <JsonLd graph={[
                webPage({ url, name: exp.title, description: exp.blurb, mainEntity: { "@id": `${abs(url)}#work` } }),
                { "@type": "CreativeWork", "@id": `${abs(url)}#work`, name: exp.title, alternativeHeadline: exp.tagline, description: exp.blurb, url: abs(url), author: { "@id": PERSON_ID }, keywords: exp.tags.join(", "), isAccessibleForFree: true },
                breadcrumbs([["Home", "/"], ["Lab", "/lab"], [exp.title, url]]),
            ]} />
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
