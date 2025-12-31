import { notFound } from "next/navigation";
import { getProjectBySlug, getAllProjectSlugs } from "@/utils/data/projects-data";
import CaseStudyPage from "./case-study-page";

// Generate static params for all project slugs
export async function generateStaticParams() {
    const slugs = getAllProjectSlugs();
    return slugs.map((slug) => ({ slug }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }) {
    const project = getProjectBySlug(params.slug);

    if (!project) {
        return {
            title: "Project Not Found",
        };
    }

    return {
        title: `${project.name} | Dhruv Agrawal`,
        description: project.description.substring(0, 160),
        openGraph: {
            title: project.name,
            description: project.description.substring(0, 160),
            images: [
                {
                    url: `/api/og?title=${encodeURIComponent(project.name)}&color=${encodeURIComponent(project.accentColor || "#8b5cf6")}`,
                    width: 1200,
                    height: 630,
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: project.name,
            description: project.description.substring(0, 160),
        },
    };
}

export default function ProjectPage({ params }) {
    const project = getProjectBySlug(params.slug);

    if (!project) {
        notFound();
    }

    return <CaseStudyPage project={project} />;
}
