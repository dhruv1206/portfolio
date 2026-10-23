// llms.txt for the blog's host (served at /llms.txt on blog.dhruuv.me):
// the articles in Markdown, read live from dev.to, with a pointer to the
// main site's llms.txt for who wrote them.

import { getArticles } from "@/app/lib/devto";
import { BLOG_DESCRIPTION, BLOG_NAME, NAME, ORIGIN } from "@/app/lib/seo";
import { BLOG_ROOT, articleUrl, fileResponse } from "@/app/lib/feeds";

export async function GET() {
    const feed = await getArticles();
    const lines = [`# ${BLOG_NAME}`, "", `> ${BLOG_DESCRIPTION}`, "", `${NAME}'s blog, mirrored from dev.to within seconds of publishing. RSS: ${BLOG_ROOT}/feed.xml`, ""];
    if (feed.status === "ok") {
        lines.push("## Articles", "", ...(feed.data.length ? feed.data.map((a) => `- [${a.title}](${articleUrl(a.slug)}) (${a.published_at.slice(0, 10)})${a.description && !/^A post by /i.test(a.description) ? `: ${a.description}` : ""}`) : ["- Nothing published yet."]), "");
    } else {
        lines.push("## Articles", "", "- dev.to, where the articles live, did not answer just now; the list is back on the next request.", "");
    }
    lines.push("## About the author", "", `- [${NAME}](${ORIGIN}/): who wrote these. Everything else about him: ${ORIGIN}/llms.txt`, "");
    return fileResponse(lines.join("\n"), "text/plain");
}
