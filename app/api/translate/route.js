// Translation proxy for the press-release pipeline demo. Backs the
// "Translate" stage in `app/components/case-study/press-release-pipeline`.
// Sits in front of MyMemory's public translation endpoint so we
//   - keep the visitor's IP out of MyMemory's per-IP quota (theirs is
//     ours instead),
//   - chunk long input into <=480-char slices, MyMemory's free-tier cap,
//   - normalise the response shape so the client sees just
//     `{ translatedText, durationMs, chunks }`,
//   - degrade gracefully to identity translation if the upstream
//     returns an error or 429.

export const maxDuration = 15;

const MAX_INPUT_CHARS = 1500;
const MAX_CHUNK_CHARS = 480;
const UPSTREAM = "https://api.mymemory.translated.net/get";

function splitForUpstream(text, max) {
    if (text.length <= max) return [text];
    const out = [];
    // Split on sentence boundary first, then word, then hard.
    const sentences = text.split(/(?<=[.!?])\s+/);
    let buf = "";
    for (const s of sentences) {
        if ((buf + " " + s).length > max) {
            if (buf) out.push(buf.trim());
            if (s.length > max) {
                // single huge sentence — hard-split
                for (let i = 0; i < s.length; i += max) {
                    out.push(s.slice(i, i + max));
                }
                buf = "";
            } else {
                buf = s;
            }
        } else {
            buf = buf ? buf + " " + s : s;
        }
    }
    if (buf) out.push(buf.trim());
    return out;
}

async function translateOne(text, langpair, signal) {
    const url = `${UPSTREAM}?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const res = await fetch(url, {
        signal,
        // Identify ourselves so MyMemory can rate-limit reasonably.
        headers: { "user-agent": "dhruvagrawal.dev press-release-demo" },
    });
    if (!res.ok) {
        throw new Error(`upstream ${res.status}`);
    }
    const data = await res.json();
    const translated = data?.responseData?.translatedText;
    if (typeof translated !== "string" || !translated) {
        throw new Error("upstream-empty-translation");
    }
    return translated;
}

export async function POST(req) {
    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "bad-json" }, { status: 400 });
    }
    const { text, from = "en", to } = body || {};
    if (!text || !to) {
        return Response.json({ error: "missing-fields" }, { status: 400 });
    }
    if (typeof text !== "string" || text.length > MAX_INPUT_CHARS) {
        return Response.json(
            { error: "input-too-long", maxChars: MAX_INPUT_CHARS },
            { status: 400 },
        );
    }
    const langpair = `${from}|${to}`;
    const chunks = splitForUpstream(text, MAX_CHUNK_CHARS);
    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
        const results = [];
        for (const chunk of chunks) {
            results.push(await translateOne(chunk, langpair, controller.signal));
        }
        return Response.json({
            ok: true,
            translatedText: results.join(" "),
            durationMs: Date.now() - start,
            chunks: chunks.length,
            from,
            to,
            source: "mymemory",
        });
    } catch (err) {
        // Degrade to identity translation rather than blocking the
        // pipeline — the demo still demonstrates the rest of the
        // stages, and we surface the error so the visitor sees what
        // happened.
        return Response.json(
            {
                ok: true,
                translatedText: text,
                durationMs: Date.now() - start,
                chunks: chunks.length,
                from,
                to,
                source: "identity-fallback",
                warning: String(err?.message || err),
            },
            { status: 200 },
        );
    } finally {
        clearTimeout(timeout);
    }
}
