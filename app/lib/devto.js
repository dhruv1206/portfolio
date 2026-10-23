// The blog's view of dev.to, read at request time so the page is never
// more than 10 seconds behind what is published there. The reading,
// memoising and failure handling live in ./devto-feed.mjs; this file only
// knows the URLs and the shape of the answers.
//
// Both functions start with `connection()`: they must run per request,
// never at build time, and callers render them inside <Suspense> (Cache
// Components turns them into dynamic holes).

import { connection } from "next/server";
import { personalData } from "@/utils/data/personal-data";
import { createFeed, looksLikeDevtoSlug } from "./devto-feed.mjs";

// One feed per server instance, shared by the index, every article page
// and their metadata.
const feed = createFeed();

// DEVTO_API_ORIGIN exists for scripts/verify-blog.mjs, which points the
// app at a local fake dev.to. Production never sets it.
const api = () => `${process.env.DEVTO_API_ORIGIN || "https://dev.to"}/api`;
// The feed sends every read with per_page set to a new number above 1000
// (its cache-buster), which dev.to clamps to the 1000 asked for here.
const listUrl = () => `${api()}/articles?username=${personalData.devUsername}&per_page=1000`;
const articleUrl = (slug) => `${api()}/articles/${personalData.devUsername}/${encodeURIComponent(slug)}`;

/**
 * Every published article, newest first.
 * @returns {Promise<{ status: "ok", data: object[], live: boolean } | { status: "unavailable" }>}
 */
export async function getArticles() {
    await connection();
    const res = await feed.read("list", listUrl(), { priority: "high" });
    // An unknown username would 404; that is a misconfiguration, not "no articles".
    if (res.status !== "ok" || !Array.isArray(res.data)) return { status: "unavailable" };
    return res;
}

/**
 * One article with its rendered body.
 * @returns {Promise<{ status: "ok", data: object, live: boolean } | { status: "missing" } | { status: "unavailable" }>}
 */
export async function getArticle(slug) {
    await connection();
    // Only articles the list knows are read upstream, so made-up paths
    // (scanners, or a flood of slug-shaped guesses) cost dev.to nothing.
    // A post published in the last few seconds joins the list on its next
    // read, at most 10 seconds later.
    const list = await getArticles();
    const known = list.status === "ok" && list.data.some((a) => a.slug === slug);
    if (!known) {
        // A live list is authoritative. A stale or missing one is not: the
        // article may have been published since, unless the path cannot be
        // a dev.to slug at all.
        if (list.status === "ok" && list.live) return { status: "missing" };
        return looksLikeDevtoSlug(slug) ? { status: "unavailable" } : { status: "missing" };
    }
    const res = await feed.read(`article:${slug}`, articleUrl(slug));
    if (res.status === "ok" && (!res.data || typeof res.data !== "object")) return { status: "unavailable" };
    return res;
}
