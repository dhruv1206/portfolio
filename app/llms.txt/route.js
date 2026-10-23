// llms.txt (llmstxt.org): the site in Markdown, for AI assistants and
// coding agents that read it instead of crawling the pages. Built from the
// same data the pages render, so it cannot say anything they do not; the
// writing section is read live from dev.to like the blog.

import { ABOUT, ROLES } from "@/app/room/data";
import { projectsData } from "@/utils/data/projects-data";
import { experiments } from "@/app/(site)/lab/experiments/registry";
import { personalData } from "@/utils/data/personal-data";
import { getArticles } from "@/app/lib/devto";
import { ORIGIN, SITE_DESCRIPTION } from "@/app/lib/seo";
import { BLOG_ROOT, articleUrl, fileResponse } from "@/app/lib/feeds";

export async function GET() {
    const feed = await getArticles();
    const lines = [
        `# ${ABOUT.name}`,
        "",
        `> ${SITE_DESCRIPTION}`,
        "",
        `${ABOUT.role}. ${ABOUT.lines.join(" ")}`,
        "",
        "## Numbers",
        "",
        ...ABOUT.stats.map(([value, what, where]) => `- ${value} ${what} (${where})`),
        "",
        "## Experience",
        "",
        ...ROLES.map((r) => `- ${r.when} · ${r.title}, ${r.org} (${r.where})${r.bullets.length ? `: ${r.bullets.join(" ")}` : ""}`),
        "",
        "## Case studies",
        "",
        ...projectsData.map((p) => `- [${p.name}](${ORIGIN}/projects/${p.slug}): ${p.description}`),
        "",
        "## Pages",
        "",
        `- [Home](${ORIGIN}/): who I am, the numbers, the stack, a contact form.`,
        `- [Recruiter mode](${ORIGIN}/r): the career numbers in a minute, and a job-description fit score.`,
        `- [Control room](${ORIGIN}/room): a live, breakable model of the production systems I run, with replayable incidents.`,
        `- [Lab](${ORIGIN}/lab): ${experiments.length} interactive simulations: ${experiments.map((e) => e.title).join(", ")}.`,
        `- [Blog](${BLOG_ROOT}/): notes on backend systems, also published on dev.to.`,
        "",
    ];
    if (feed.status === "ok" && feed.data.length) {
        lines.push("## Writing", "", ...feed.data.map((a) => `- [${a.title}](${articleUrl(a.slug)})${a.description && !/^A post by /i.test(a.description) ? `: ${a.description}` : ""}`), "");
    }
    lines.push(
        "## Contact",
        "",
        `- Email: ${ABOUT.email}`,
        ...ABOUT.links.map(([name, url]) => `- ${name}: ${url}`),
        `- dev.to: https://dev.to/${personalData.devUsername}`,
        "",
    );
    return fileResponse(lines.join("\n"), "text/plain");
}
