import Link from "next/link";
import RoomLoader from "@/app/components/room/room-loader";
import { ABOUT, ROLES, SCENARIOS } from "@/app/room/data";
import { ogImage, pageMetadata } from "@/app/lib/seo";
import { JsonLd, PERSON_ID, breadcrumbs, webPage } from "@/app/lib/structured-data";

const DESCRIPTION = "A live, breakable model of the production systems I run. Kill a worker, partition the cache, watch it heal, then replay the incidents I actually fixed.";

// The control room is a client-only application (canvas, simulation,
// Web Audio), so the server renders a crawlable summary plus the boot
// title, and hands the viewport to the room once JavaScript loads.
export const metadata = pageMetadata({
    title: "Control room",
    description: DESCRIPTION,
    url: "/room",
    image: ogImage({ title: "The control room", sub: "A live, breakable model of the systems I run: 24 services, real queues, real timeouts, seven replayable incidents.", path: "/room" }),
});

export default function RoomPage() {
    return (
        <main id="main-content" tabIndex={-1} className="outline-none">
            <JsonLd graph={[
                webPage({ url: "/room", name: "Control room", description: DESCRIPTION, about: { "@id": PERSON_ID } }),
                breadcrumbs([["Home", "/"], ["Control room", "/room"]]),
            ]} />
            <section className="sr-only" aria-label="Summary">
                <h1>{ABOUT.name}</h1>
                <p>{ABOUT.role}</p>
                {ABOUT.lines.map((line) => (
                    <p key={line}>{line}</p>
                ))}
                <h2>Experience</h2>
                <ul>
                    {ROLES.map((r) => (
                        <li key={r.org + r.when}>
                            {r.when} · {r.org} · {r.title} · {r.where}
                            {r.bullets.length > 0 && (
                                <ul>
                                    {r.bullets.map((b) => (
                                        <li key={b}>{b}</li>
                                    ))}
                                </ul>
                            )}
                        </li>
                    ))}
                </ul>
                <h2>Incidents you can replay on this page</h2>
                <ul>
                    {SCENARIOS.map((s) => (
                        <li key={s.id}>
                            {s.title}: {s.real}
                        </li>
                    ))}
                </ul>
                <p>
                    Plain-text version: <Link href="/r">dhruuv.me/r</Link>. Live experiments:{" "}
                    <Link href="/lab">dhruuv.me/lab</Link>.
                </p>
            </section>
            <RoomLoader />
        </main>
    );
}
