import { ImageResponse } from "next/og";

// Social card for every route, drawn in the site's language: a hairline
// frame on near-black, the DA mark and the path, the title in Archivo,
// three résumé numbers along the bottom. Query: title, sub, path, color.
//
// Runs on the Node runtime (edge would conflict with cacheComponents).
// Archivo is fetched once from Google Fonts as TTF and kept in module
// scope; if that fetch fails the default sans is used instead.

let archivoPromise = null;
function loadArchivo() {
    if (!archivoPromise) {
        archivoPromise = (async () => {
            try {
                const css = await fetch("https://fonts.googleapis.com/css2?family=Archivo:wght@800", { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:1.0)" } }).then((r) => r.text());
                const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1];
                return url ? await fetch(url).then((r) => r.arrayBuffer()) : null;
            } catch {
                return null;
            }
        })();
    }
    return archivoPromise;
}

const INK = "#f2f2f7", INK2 = "#a9a9bd", MUTE = "#6c6c82", LINE = "rgba(242,242,247,0.22)", LINE2 = "rgba(242,242,247,0.12)";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const title = (searchParams.get("title") || "Dhruv Agrawal").slice(0, 80);
        const sub = (searchParams.get("sub") || "Backend engineer · MyRik · Bengaluru").slice(0, 120);
        const path = (searchParams.get("path") || "/").slice(0, 60);
        const color = /^#[0-9a-f]{6}$/i.test(searchParams.get("color") || "") ? searchParams.get("color") : "#22d3ee";
        const font = await loadArchivo();
        const long = title.length > 26;
        return new ImageResponse(
            (
                <div style={{ width: "100%", height: "100%", display: "flex", background: "#050508", color: INK, padding: 40, fontFamily: font ? "Archivo, sans-serif" : "sans-serif" }}>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", border: `1px solid ${LINE}`, position: "relative", backgroundImage: "radial-gradient(circle, rgba(242,242,247,0.16) 1px, transparent 1.6px)", backgroundSize: "40px 40px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 18, padding: "20px 28px", borderBottom: `1px solid ${LINE2}`, fontSize: 20, letterSpacing: 3, color: INK2 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, border: `1px solid ${LINE}`, fontSize: 17, fontWeight: 800, color: INK, letterSpacing: 1 }}>DA</div>
                            <div style={{ display: "flex" }}>DHRUUV.ME</div>
                            {path !== "/" && <div style={{ display: "flex", color: MUTE, whiteSpace: "nowrap" }}>/ {path.replace(/^\//, "").split("/")[0].toUpperCase()}</div>}
                            <div style={{ display: "flex", marginLeft: "auto", color, fontSize: 18 }}>{path === "/" ? "ONE PARTICLE SYSTEM · SIX STAGES" : "EVERY CLAIM RUNS"}</div>
                        </div>
                        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "0 28px 28px" }}>
                            <div style={{ display: "flex", fontSize: long ? 62 : 100, fontWeight: 800, lineHeight: 0.95, letterSpacing: long ? -2 : -4, maxWidth: 1040 }}>{title}</div>
                            <div style={{ display: "flex", marginTop: 22, fontSize: 27, color: INK2, maxWidth: 1000 }}>{sub}</div>
                        </div>
                        <div style={{ display: "flex", gap: 34, padding: "18px 28px", borderTop: `1px solid ${LINE2}`, fontSize: 18, letterSpacing: 2.5, color: MUTE }}>
                            <div style={{ display: "flex" }}>150K MAU</div>
                            <div style={{ display: "flex" }}>P99 &gt;1 S → &lt;300 MS</div>
                            <div style={{ display: "flex" }}>₹200 → ₹3 PER RIDE</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto", color: "#34d399" }}><div style={{ display: "flex", width: 8, height: 8, background: "#34d399" }} />ALL SYSTEMS NOMINAL</div>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
                fonts: font ? [{ name: "Archivo", data: font, weight: 800, style: "normal" }] : undefined,
                headers: {
                    // The PNG is a pure function of the query string: the CDN
                    // may keep it until the next deploy; browsers get a day.
                    "Vercel-CDN-Cache-Control": "public, s-maxage=31536000",
                    "Cache-Control": "public, max-age=86400, no-transform",
                },
            },
        );
    } catch (error) {
        console.error("OG image generation failed:", error);
        return new Response("Failed to generate image", { status: 500 });
    }
}
