// dev.to syndication. The public API sits behind a CDN that keeps a
// cached copy of a user's article list for days and varies it by
// Accept-Encoding, so a server fetch could see an empty list long after
// an article was published. Every call therefore uses a URL that
// changes every 15 minutes (a cache-buster the CDN has never seen) and
// asks for the uncompressed variant, and the result is cached here
// with the same cadence.

import { cacheLife } from "next/cache";
import { personalData } from "@/utils/data/personal-data";

const BUCKET_MS = 15 * 60 * 1000;
const HEADERS = { "User-Agent": "dhruuv.me (+https://dhruuv.me)", "Accept-Encoding": "identity", Accept: "application/json" };

export async function getArticles() {
    "use cache";
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    const bucket = Math.floor(Date.now() / BUCKET_MS);
    try {
        const res = await fetch(`https://dev.to/api/articles?username=${personalData.devUsername}&per_page=100&v=${bucket}`, { headers: HEADERS, cache: "no-store" });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

export async function getArticle(slug) {
    "use cache";
    cacheLife({ stale: 300, revalidate: 900, expire: 86400 });
    const bucket = Math.floor(Date.now() / BUCKET_MS);
    try {
        const res = await fetch(`https://dev.to/api/articles/${personalData.devUsername}/${encodeURIComponent(slug)}?v=${bucket}`, { headers: HEADERS, cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}
