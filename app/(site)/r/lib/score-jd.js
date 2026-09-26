// Pure scoring logic for the Recruiter Mode role-fitter.
//
// Input  : the raw JD text + the optional caller-supplied skills list.
// Output : { score, matchedSkills, items, tokens, missingHighlight }
//
// No DOM, no fetch, no React — keeps it testable and reusable in
// the PDF API route (where the same tailored summary feeds the
// keyword-highlight render).

import { jdKeywordMap, tokenAliases } from "@/utils/data/jd-keyword-map";
import { skillsData } from "@/utils/data/skills";

const STOP = new Set([
    "the","a","an","and","or","but","of","to","in","on","at","for","with",
    "by","from","is","are","be","being","been","as","it","this","that",
    "we","you","your","our","their","they","i","me","my","he","she","his",
    "her","them","its","its","we'll","we'd","will","would","should","can",
    "could","may","might","must","do","does","did","done","have","has",
    "had","not","no","yes","if","then","else","when","while","than","also",
    "very","more","most","some","any","each","every","one","two","new",
    "us","etc","about","into","over","under","across","through","between",
    "year","years","experience","ability","strong","good","great",
    "excellent","passionate","work","working","team","teams","role",
    "position","opportunity","environment","candidate","minimum","plus",
    "responsibilities","required","preferred","bonus","nice",
]);

// Compose a normalised token list from the JD. Lowercases, strips
// punctuation, drops stop-words.
export function tokeniseJd(text) {
    if (!text || typeof text !== "string") return [];
    const lower = text.toLowerCase();
    const raw = lower
        .replace(/[^a-z0-9+#./ \-]/g, " ")
        .split(/\s+/)
        .map((t) => t.trim())
        .filter(Boolean);
    return raw.filter((t) => t.length > 1 && !STOP.has(t));
}

// Extract multi-word phrases up to N grams from a JD string. Lets the
// keyword map match phrases like "spring boot" or "low latency".
function ngrams(text, maxN = 3) {
    const lower = text.toLowerCase();
    const tokens = lower
        .replace(/[^a-z0-9+#./ \-]/g, " ")
        .split(/\s+/)
        .filter(Boolean);
    const out = new Set();
    for (let n = 1; n <= maxN; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
            out.add(tokens.slice(i, i + n).join(" "));
        }
    }
    return out;
}

function resolveAlias(token) {
    return tokenAliases[token] || token;
}

// Score a JD. Returns:
//   matchedSkills : Set<string>   — exact skills from skillsData
//   items         : Item[]        — deduped curated items, sorted
//                                   by frequency
//   tokens        : string[]      — raw token list
//   score         : number 0-100  — coverage of recognised JD signals
//   missing       : string[]      — top-frequency JD tokens with no
//                                   coverage (for an honest "gaps" hint)
export function scoreJd(jdText) {
    const tokens = tokeniseJd(jdText);
    const phrases = ngrams(jdText, 3);

    // Skill matches: lowercase compare against skillsData.
    const matchedSkills = new Set();
    const skillsLower = new Map(
        skillsData.map((s) => [s.toLowerCase(), s]),
    );
    for (const phrase of phrases) {
        const hit = skillsLower.get(phrase);
        if (hit) matchedSkills.add(hit);
        const aliased = resolveAlias(phrase);
        if (aliased !== phrase) {
            const aliasHit = skillsLower.get(aliased);
            if (aliasHit) matchedSkills.add(aliasHit);
        }
    }

    // Curated map matches: walk every key in jdKeywordMap and check
    // whether any of its tokens appear in the JD's phrase set.
    const itemsByDedupeKey = new Map();
    let hits = 0;
    for (const [keyword, items] of Object.entries(jdKeywordMap)) {
        const variants = [keyword, resolveAlias(keyword)];
        if (variants.some((v) => phrases.has(v))) {
            hits++;
            for (const item of items) {
                const dedupe = `${item.kind}:${item.id}`;
                if (!itemsByDedupeKey.has(dedupe)) {
                    itemsByDedupeKey.set(dedupe, { ...item, score: 1 });
                } else {
                    itemsByDedupeKey.get(dedupe).score += 1;
                }
            }
        }
    }

    const items = Array.from(itemsByDedupeKey.values()).sort(
        (a, b) => b.score - a.score,
    );

    // Score = clamp(0..100) of `matched signals / total recognised slots`.
    // We define the denominator as the number of "groups" in
    // jdKeywordMap whose key appeared in the JD plus the matched
    // skills count, capped against a soft floor of 8 so a short JD
    // doesn't trivially get 100 %.
    const denom = Math.max(8, hits + matchedSkills.size);
    const numer = hits + matchedSkills.size;
    const score = Math.min(100, Math.round((numer / denom) * 100));

    // Top JD tokens that weren't recognised at all — a small honest
    // "gaps" hint surfaced under the matched list.
    const recognised = new Set([
        ...Array.from(matchedSkills).map((s) => s.toLowerCase()),
    ]);
    for (const k of Object.keys(jdKeywordMap)) recognised.add(k);
    const freq = new Map();
    for (const t of tokens) {
        if (t.length < 3) continue;
        if (recognised.has(t)) continue;
        // ignore numeric-only and unique candidate identifiers
        if (/^[\d.+#]+$/.test(t)) continue;
        freq.set(t, (freq.get(t) || 0) + 1);
    }
    const missing = Array.from(freq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([t]) => t);

    return {
        score,
        matchedSkills: Array.from(matchedSkills),
        items,
        tokens,
        missing,
    };
}

export default scoreJd;
