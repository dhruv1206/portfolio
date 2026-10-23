import { ORIGIN } from "./lib/seo";
import { getAllProjectSlugs } from "@/utils/data/projects-data";
import { getAllExperimentSlugs } from "./(site)/lab/experiments/registry";

// Every page on dhruuv.me. No lastmod: the only dates available would be
// build times, and Google ignores lastmod that is not accurate. The blog's
// articles are in its own sitemap (app/(blog)/blog/sitemap.xml), on the
// host they live on.
export default function sitemap() {
    const paths = ["/", "/projects", ...getAllProjectSlugs().map((s) => `/projects/${s}`), "/lab", ...getAllExperimentSlugs().map((s) => `/lab/${s}`), "/room", "/r"];
    return paths.map((path) => ({ url: `${ORIGIN}${path}` }));
}
