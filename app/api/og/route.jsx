import { ImageResponse } from "@vercel/og";

// Note: edge runtime would conflict with `cacheComponents: true` in
// next.config.js (Next 16). Vercel OG runs fine on the default Node
// runtime; cold-start is slightly higher but image quality is identical.

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);

        // Dynamic params from URL
        const title = searchParams.get("title") || "Dhruv Agrawal";
        const color = searchParams.get("color") || "#8b5cf6";

        return new ImageResponse(
            (
                <div
                    style={{
                        height: "100%",
                        width: "100%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#030014",
                        backgroundImage: `radial-gradient(ellipse 80% 50% at 50% 0%, ${color}20, transparent), radial-gradient(ellipse 60% 40% at 80% 100%, #06b6d420, transparent)`,
                    }}
                >
                    {/* Decorative shapes */}
                    <div
                        style={{
                            position: "absolute",
                            top: "20%",
                            left: "10%",
                            width: "200px",
                            height: "200px",
                            borderRadius: "50%",
                            background: `${color}20`,
                            filter: "blur(60px)",
                        }}
                    />
                    <div
                        style={{
                            position: "absolute",
                            bottom: "20%",
                            right: "10%",
                            width: "150px",
                            height: "150px",
                            borderRadius: "50%",
                            background: "#06b6d420",
                            filter: "blur(60px)",
                        }}
                    />

                    {/* Content */}
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            padding: "40px",
                        }}
                    >
                        {/* Title */}
                        <div
                            style={{
                                fontSize: "64px",
                                fontWeight: "bold",
                                color: "#ffffff",
                                marginBottom: "20px",
                                maxWidth: "900px",
                                lineHeight: 1.2,
                            }}
                        >
                            {title}
                        </div>

                        {/* Divider */}
                        <div
                            style={{
                                width: "100px",
                                height: "4px",
                                background: `linear-gradient(90deg, ${color}, #06b6d4)`,
                                borderRadius: "2px",
                                marginBottom: "20px",
                            }}
                        />

                        {/* Subtitle */}
                        <div
                            style={{
                                fontSize: "24px",
                                color: "#9ca3af",
                            }}
                        >
                            Dhruv Agrawal • Software Developer
                        </div>
                    </div>

                    {/* Logo/Brand */}
                    <div
                        style={{
                            position: "absolute",
                            bottom: "40px",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                        }}
                    >
                        <div
                            style={{
                                display: "flex",
                                fontSize: "28px",
                                fontWeight: "bold",
                            }}
                        >
                            <span style={{ color: color }}>D</span>
                            <span style={{ color: "#ffffff" }}>hruv</span>
                        </div>
                    </div>
                </div>
            ),
            {
                width: 1200,
                height: 630,
            }
        );
    } catch (error) {
        console.error("OG Image generation failed:", error);
        return new Response("Failed to generate image", { status: 500 });
    }
}
