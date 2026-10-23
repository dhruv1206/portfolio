// A streamed page, as it reads once its scripts have run. React sends the
// shell first, with a fallback where each unfinished part goes
// (`<!--$?--><template id="B:N"></template>…<!--/$-->`, or
// `<template id="P:N"></template>` for a postponed one), then each part
// as it finishes, hidden at the end of the body (`<div hidden id="S:N">`)
// with a script that moves it into place. Crawlers that do not run
// JavaScript are left with the fallbacks, and text extractors that skip
// hidden elements (Readability) find no article at all. This moves each
// finished part where the browser would. Anything it cannot match stays
// as it was. No Next.js imports: proxy.js uses it, and
// scripts/inline-streamed-html.test.mjs tests it in plain Node.

const SEGMENT = /<div hidden id="S:(\d+)">/g;
// Elements whose contents are not markup, so a `<div` inside them is text.
const RAW_TEXT = ["script", "style", "textarea", "title"];

/** Index just past the `</div>` that closes the div whose content starts at `from`, or -1. */
function closeOfDiv(html, from) {
    let depth = 1;
    let i = from;
    while (i < html.length) {
        const lt = html.indexOf("<", i);
        if (lt === -1) return -1;
        if (html.startsWith("<!--", lt)) {
            const end = html.indexOf("-->", lt + 4);
            if (end === -1) return -1;
            i = end + 3;
            continue;
        }
        const tag = /^<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/.exec(html.slice(lt, lt + 40));
        if (!tag) { i = lt + 1; continue; }
        const [, closing, rawName] = tag;
        const name = rawName.toLowerCase();
        const gt = html.indexOf(">", lt);
        if (gt === -1) return -1;
        if (!closing && RAW_TEXT.includes(name)) {
            const end = html.toLowerCase().indexOf(`</${name}`, gt + 1);
            if (end === -1) return -1;
            i = end;
            continue;
        }
        if (name === "div") {
            if (closing) { depth -= 1; if (depth === 0) return gt + 1; }
            else if (html[gt - 1] !== "/") depth += 1;
        }
        i = gt + 1;
    }
    return -1;
}

/** Index just past the `<!--/$-->` closing the boundary whose contents start at `from`, or -1. */
function closeOfBoundary(html, from) {
    let depth = 1;
    let i = from;
    while (i < html.length) {
        const start = html.indexOf("<!--", i);
        if (start === -1) return -1;
        const end = html.indexOf("-->", start + 4);
        if (end === -1) return -1;
        const body = html.slice(start + 4, end);
        if (body === "/$") { depth -= 1; if (depth === 0) return end + 3; }
        else if (body === "$" || body === "$?" || body === "$!") depth += 1;
        i = end + 3;
    }
    return -1;
}

/**
 * @param {string} html a complete streamed document
 * @returns {{ html: string, inlined: number }} the document with every finished part in place
 */
export function inlineStreamedHtml(html) {
    // 1. Take the finished parts out of the end of the body.
    const segments = new Map();
    const spans = [];
    for (const m of html.matchAll(SEGMENT)) {
        const contentStart = m.index + m[0].length;
        const end = closeOfDiv(html, contentStart);
        if (end === -1) return { html, inlined: 0 }; // malformed: leave the page as it is
        segments.set(m[1], html.slice(contentStart, end - "</div>".length));
        spans.push([m.index, end]);
    }
    if (segments.size === 0) return { html, inlined: 0 };
    let out = "";
    let at = 0;
    for (const [start, end] of spans) { out += html.slice(at, start); at = end; }
    out += html.slice(at);

    // 2. Put each one where its placeholder is, one at a time: a part can
    // carry the placeholders of parts nested in it, and a fallback can hold
    // other boundaries, so each boundary's end is found on the page as it
    // stands. Stop when nothing moves.
    let inlined = 0;
    for (;;) {
        const next = nextPlaceholder(out, segments);
        // A finished part with no placeholder would be lost: keep the page as it came.
        if (!next) return segments.size ? { html, inlined: 0 } : { html: out, inlined };
        out = `${out.slice(0, next.start)}${next.boundary ? `<!--$-->${segments.get(next.id)}<!--/$-->` : segments.get(next.id)}${out.slice(next.end)}`;
        segments.delete(next.id);
        inlined += 1;
    }
}

// The first placeholder whose finished part is known, with the span it
// replaces: a pending boundary through its fallback and closing comment,
// or a postponed hole.
function nextPlaceholder(html, segments) {
    for (const m of html.matchAll(/<!--\$\?--><template id="B:(\d+)"><\/template>|<template id="P:(\d+)"><\/template>/g)) {
        const id = m[1] ?? m[2];
        if (!segments.has(id)) continue;
        if (m[2] !== undefined) return { id, start: m.index, end: m.index + m[0].length, boundary: false };
        const end = closeOfBoundary(html, m.index + m[0].length);
        if (end !== -1) return { id, start: m.index, end, boundary: true };
    }
    return null;
}
