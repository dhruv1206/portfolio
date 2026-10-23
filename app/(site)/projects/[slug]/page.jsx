import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs } from "@/utils/data/projects-data";
import { abs, ogImage, pageMetadata, summary } from "@/app/lib/seo";
import { JsonLd, PERSON_ID, breadcrumbs, webPage } from "@/app/lib/structured-data";
import CaseStudyPage from "./case-study-page";

// Generate static params for all project slugs
export async function generateStaticParams() {
    const slugs = getAllProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata(props) {
    const params = await props.params;
    const project = getProjectBySlug(params.slug);
    if (!project) return { title: "Project not found" };
    return pageMetadata({
        title: project.name,
        description: summary(project.description),
        url: `/projects/${project.slug}`,
        image: ogImage({ title: project.name, sub: `${project.description.split(". ")[0]}.`, path: `/projects/${project.slug}`, color: project.accentColor || "#22d3ee" }),
        type: "article",
    });
}

export default async function ProjectPage(props) {
    const params = await props.params;
    const project = getProjectBySlug(params.slug);

    if (!project) {
        notFound();
    }

    const url = `/projects/${project.slug}`;
    const source = project.code || (project.url && project.url.includes("github") ? project.url : "");
    return (
        <>
            <JsonLd graph={[
                webPage({ url, name: project.name, description: project.description, mainEntity: { "@id": `${abs(url)}#work` } }),
                {
                    // Source on GitHub makes it code; the mobile apps without a public repo are works.
                    "@type": source ? "SoftwareSourceCode" : "CreativeWork",
                    "@id": `${abs(url)}#work`,
                    name: project.name,
                    description: project.description,
                    url: abs(url),
                    author: { "@id": PERSON_ID },
                    keywords: project.tools.join(", "),
                    ...(source ? { codeRepository: source } : {}),
                },
                breadcrumbs([["Home", "/"], ["Projects", "/projects"], [project.name, url]]),
            ]} />
            <CaseStudyPage project={project} />
        </>
    );
}
