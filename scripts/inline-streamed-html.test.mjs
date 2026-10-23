// Unit tests for app/lib/inline-streamed-html.mjs (what proxy.js serves
// crawlers that do not run JavaScript).
// Run: node --test scripts/inline-streamed-html.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { inlineStreamedHtml } from "../app/lib/inline-streamed-html.mjs";

// React's streaming markup, as Next 16 / React 19 write it.
const pending = (id, fallback) => `<!--$?--><template id="B:${id}"></template>${fallback}<!--/$-->`;
const part = (id, content) => `<div hidden id="S:${id}">${content}</div><script>$RC("B:${id}","S:${id}")</script>`;
const page = (body, tail) => `<!DOCTYPE html><html><head><title>t</title></head><body>${body}${tail}</body></html>`;

test("a finished part replaces its boundary's fallback, and the hidden copy is gone", () => {
    const src = page(`<header>h</header>${pending(0, '<div class="spin">loading the article</div>')}<footer>f</footer>`, part(0, "<article><h1>Title</h1><p>Body</p></article>"));
    const { html, inlined } = inlineStreamedHtml(src);
    assert.equal(inlined, 1);
    assert.ok(html.includes("<header>h</header><!--$--><article><h1>Title</h1><p>Body</p></article><!--/$--><footer>f</footer>"), html);
    assert.ok(!html.includes("loading the article"));
    assert.ok(!html.includes('<div hidden id="S:0">'));
});

test("nested divs inside a part are kept whole", () => {
    const content = '<div class="a"><div class="b"><div>deep</div></div><div>side</div></div><p>after</p>';
    const { html } = inlineStreamedHtml(page(pending(3, "<i>…</i>"), part(3, content)));
    assert.ok(html.includes(`<!--$-->${content}<!--/$-->`), html);
});

test("a part can carry the placeholder of a part nested in it", () => {
    const src = page(pending(0, "<i>outer…</i>"), part(0, `<section>${pending(1, "<i>inner…</i>")}</section>`) + part(1, "<p>inner done</p>"));
    const { html, inlined } = inlineStreamedHtml(src);
    assert.equal(inlined, 2);
    assert.ok(html.includes("<!--$--><section><!--$--><p>inner done</p><!--/$--></section><!--/$-->"), html);
    assert.ok(!html.includes("…"));
});

test("a boundary's fallback may itself hold boundaries; its end is found past them", () => {
    const fallback = "<i>wait</i><!--$--><b>nested, already done</b><!--/$--><!--$?--><template id=\"B:9\"></template><u>never</u><!--/$-->";
    const { html } = inlineStreamedHtml(page(`${pending(0, fallback)}<footer>f</footer>`, part(0, "<p>done</p>")));
    assert.ok(html.includes("<!--$--><p>done</p><!--/$--><footer>f</footer>"), html);
});

test("a postponed hole (P:) takes its part", () => {
    const { html, inlined } = inlineStreamedHtml(page('<main><template id="P:2"></template></main>', '<div hidden id="S:2"><p>resumed</p></div><script>$RS("S:2","P:2")</script>'));
    assert.equal(inlined, 1);
    assert.ok(html.includes("<main><p>resumed</p></main>"), html);
});

test("markup-looking text inside scripts and styles does not unbalance the divs", () => {
    const content = '<script type="application/ld+json">{"x":"<div>"}</script><style>.a::after{content:"</div>"}</style><p>ok</p>';
    const { html } = inlineStreamedHtml(page(pending(0, "<i>…</i>"), part(0, content)));
    assert.ok(html.includes(`<!--$-->${content}<!--/$-->`), html);
});

test("pages it cannot read whole are left exactly as they came", () => {
    const noParts = page("<p>static</p>", "");
    assert.deepEqual(inlineStreamedHtml(noParts), { html: noParts, inlined: 0 });
    const unclosed = page(pending(0, "<i>…</i>"), '<div hidden id="S:0"><p>cut off');
    assert.deepEqual(inlineStreamedHtml(unclosed), { html: unclosed, inlined: 0 });
    const orphan = page("<p>no placeholder</p>", part(4, "<p>lost?</p>"));
    assert.deepEqual(inlineStreamedHtml(orphan), { html: orphan, inlined: 0 }, "a part with nowhere to go is not dropped");
});

test("a boundary still pending (no part arrived) keeps its fallback", () => {
    const src = page(`${pending(0, "<i>a…</i>")}${pending(1, "<i>b…</i>")}`, part(1, "<p>b done</p>"));
    const { html, inlined } = inlineStreamedHtml(src);
    assert.equal(inlined, 1);
    assert.ok(html.includes("<i>a…</i>") && html.includes("<!--$--><p>b done</p><!--/$-->"), html);
});
