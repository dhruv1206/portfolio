// Google-TTS proxy — same upstream the production synth-ai-envoys
// service hit via the Python `gtts` library. We do it server-side so
// the visitor's IP isn't exposed and so we can set the browser-like
// headers Google's endpoint requires.
//
//   GET /api/tts?q=<text>&tl=<lang>&idx=<i>&total=<n>&textlen=<n>
//
// Google's translate_tts endpoint enforces a ~200 character soft
// limit per call; the caller is responsible for splitting longer text
// at word boundaries and requesting one chunk at a time (idx/total
// give the upstream the context it needs to flow prosody across
// chunks).

export const maxDuration = 15;

const UPSTREAM = "https://translate.google.com/translate_tts";
const MAX_CHUNK_CHARS = 200;

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q");
    const tl = searchParams.get("tl");
    const idx = searchParams.get("idx") || "0";
    const total = searchParams.get("total") || "1";
    const textlen = searchParams.get("textlen") || String(q?.length || 0);

    if (!q || !tl) {
        return Response.json(
            { error: "missing-q-or-tl" },
            { status: 400 },
        );
    }
    if (q.length > MAX_CHUNK_CHARS) {
        return Response.json(
            { error: "chunk-too-long", maxChars: MAX_CHUNK_CHARS },
            { status: 400 },
        );
    }

    const url =
        `${UPSTREAM}?ie=UTF-8&q=${encodeURIComponent(q)}` +
        `&tl=${encodeURIComponent(tl)}` +
        `&client=tw-ob&total=${total}&idx=${idx}&textlen=${textlen}`;

    try {
        const upstream = await fetch(url, {
            headers: {
                // Google rejects requests without a browser-like UA.
                "user-agent":
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                accept: "audio/mpeg, audio/*",
                referer: "https://translate.google.com/",
            },
        });
        if (!upstream.ok) {
            return Response.json(
                { error: `upstream-${upstream.status}` },
                { status: 502 },
            );
        }
        const buf = await upstream.arrayBuffer();
        return new Response(buf, {
            status: 200,
            headers: {
                "content-type": "audio/mpeg",
                // Same chunk for the same (text, lang) will be requested
                // again on re-runs; 1 hour cache is plenty for a portfolio
                // demo and gives us free immediate replay.
                "cache-control": "public, max-age=3600",
                // `max-age` alone only reaches the browser — the CDN needs
                // its own directive or every visitor pays a fresh round
                // trip to Google. Set only on the success path: a cached
                // 502 would pin the failure at the edge until next deploy.
                "Vercel-CDN-Cache-Control": "public, s-maxage=31536000",
            },
        });
    } catch (err) {
        return Response.json(
            { error: String(err?.message || err) },
            { status: 502 },
        );
    }
}
