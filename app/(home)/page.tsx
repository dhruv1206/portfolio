import Link from "next/link";
import styles from "@/app/components/home/home.module.scss";
import SpineOverlay from "@/app/components/home/spine-overlay";
import { ContactForm, CopyEmail, MachineRepl, Pipeline, StackLayers } from "@/app/components/home/widgets";
import { ABOUT, ROLES } from "@/app/room/data";

// The homepage: six stages that one particle system descends through.
// Text is server-rendered; the canvas, rail and readout mount on the
// client (SpineOverlay) and read these stages by their data-stage ids.

const STATS: { v: React.ReactNode; k: string; sub: string; sm?: boolean }[] = [
    { v: <>150K<small>+</small></>, k: "Monthly active users", sub: "MyRik · CQRS product service" },
    { v: <>&gt;1 s → &lt;300 ms</>, k: "p99 API latency", sub: "MyRik · OpenTelemetry-traced hot paths", sm: true },
    { v: <>₹200 → ₹3</>, k: "Maps API cost per ride", sub: "MyRik · session tokens, debounce", sm: true },
    { v: <>1M<small>+</small></>, k: "Monthly users reached", sub: "CarWale · Short Videos + AI chat" },
    { v: <>5M<small>/day</small></>, k: "Events at 99.9 %", sub: "JioHotstar · Kafka → Pub/Sub" },
    { v: <>6.5K<small>+</small></>, k: "App downloads · 4.4 ★", sub: "College attendance app" },
];
const LAYERS = [
    { k: "L0", name: "Transport", tools: ["WebSockets", "WebRTC", "GraphQL", "REST", "STOMP"], bold: 2 },
    { k: "L1", name: "Runtime", tools: ["Spring Boot", "Node.js", "Go", "Flask", "Next.js", "React", "Flutter"], bold: 2 },
    { k: "L2", name: "Data", tools: ["PostgreSQL", "Redis", "MongoDB", "MySQL", "Elasticsearch", "Kafka", "Pub/Sub"], bold: 2 },
    { k: "L3", name: "Infra", tools: ["AWS", "GCP", "Kubernetes", "Docker", "Terraform", "Nginx", "Firebase", "CI/CD"], bold: 2 },
    { k: "L4", name: "Observability", tools: ["OpenTelemetry", "Grafana", "Loki", "Tempo", "TDD"], bold: 1 },
    { k: "L5", name: "Languages", tools: ["C++", "Java", "Go", "Python", "TypeScript", "Kotlin", "SQL"], bold: 2 },
];
const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");

export default function HomePage() {
    const lead = ROLES.slice(0, 3), rest = ROLES.slice(3);
    return (
        <main id="main-content" tabIndex={-1} className={cx(styles.page, "outline-none")} data-home>
            <SpineOverlay />
            <div className={styles.content}>
                <section className={cx(styles.stage, styles.s0)} id="s0" data-stage="0">
                    <div className={styles.copy}>
                        <p className={cx(styles.eyebrow, styles.heroEyebrow)}><b>Dhruv Agrawal</b> Software Engineer <i>MyRik · Bengaluru</i></p>
                        <h1 className={styles.heroName}><span id="name-l1">Dhruv</span><span id="name-l2">Agrawal</span></h1>
                        <div className={styles.heroSub}>
                            <div>
                                <p className={styles.thesis}>I build the systems <em>under the surface.</em></p>
                                <p className={styles.lede}>Backend engineer. The platforms I run serve <b>150,000 people a month</b>; their latency, cost and uptime are my job. Every claim on this page is backed by something you can run. Scroll to go one layer down at a time.</p>
                            </div>
                            <div className={styles.cta}>
                                <a className={cx(styles.btn, styles.primary)} href="#s1">Descend ↓</a>
                                <Link className={cx(styles.btn, styles.ghost)} href="/room">Open the control room</Link>
                                <Link className={cx(styles.btn, styles.ghost)} href="/r">Recruiter mode</Link>
                            </div>
                        </div>
                    </div>
                </section>

                <section className={cx(styles.stage, styles.s1)} id="s1" data-stage="1">
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}><b>01</b> People <i>150,000 / month</i></p>
                        <h2 className={styles.h2}>The people on the other end of the API.</h2>
                        <p className={styles.lede}>Users never see a backend. They feel it as a ride that books instantly, a page that loads under 300 ms, a video that plays. These are the numbers behind that feeling, each one from a system I owned.</p>
                        <div className={styles.stats}>{STATS.map((s) => <div key={s.k} className={styles.stat}><b className={s.sm ? styles.sm : undefined}>{s.v}</b><span>{s.k}<em>{s.sub}</em></span></div>)}</div>
                        <p className={styles.note}>{ABOUT.lines[1]}</p>
                    </div>
                </section>

                <section className={cx(styles.stage, styles.s2)} id="s2" data-stage="2">
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}><b>02</b> Systems <i>7 services</i></p>
                        <h2 className={styles.h2}>Systems I&apos;ve run in production.</h2>
                        <p className={styles.lede}>On the right: the real topology of the real-time collaboration platform, Spring Cloud Gateway as the only public port, Eureka holding the address book, packets moving the way they do in the code. On the left: where I&apos;ve done this for a living.</p>
                        <div className={styles.roles}>
                            {lead.map((r) => <div key={r.org + r.when} className={styles.role}><div className={styles.when}>{r.when}</div><div className={styles.who}><b>{r.org}</b><span>{r.title}</span></div><div className={styles.where}>{r.where}</div><ul>{r.bullets.slice(0, 3).map((b) => <li key={b}>{b}</li>)}</ul></div>)}
                            {rest.map((r) => <div key={r.org + r.when} className={cx(styles.role, styles.compact)}><div className={styles.when}>{r.when}</div><div className={styles.who}><b>{r.org}</b><span>{r.title}</span></div><div className={styles.where}>{r.where}</div></div>)}
                        </div>
                    </div>
                </section>

                <section className={cx(styles.stage, styles.s3)} id="s3" data-stage="3">
                    <div className={cx(styles.copy, styles.wide)}>
                        <p className={styles.eyebrow}><b>03</b> Machines <i>3 runnable</i></p>
                        <h2 className={styles.h2}>Machines you can run.</h2>
                        <p className={styles.lede}>Three projects, each with a working demo instead of a screenshot. On the right: DStarDB&apos;s reactor loop feeding a worker pool, the shape that beats single-threaded Redis under concurrent reads.</p>
                        <div className={styles.machines}>
                            <div className={styles.machine}>
                                <div className={styles.mhead}><b>DStarDB</b><span>C++20 · reactor + thread pool · 40+ commands</span><MachineRepl /></div>
                                <div className={styles.mbody}><p>Redis-compatible in-memory store. Event loop reads bytes, N workers execute, reader-writer concurrency; 10,000+ concurrent connections; YCSB: <b>13 % more throughput, 50 % lower latency than Redis</b> under concurrent reads. The REPL runs the browser build in a Web Worker; every reply is timed in microseconds. <Link href="/projects/dstardb">Case study →</Link></p></div>
                            </div>
                            <div className={styles.machine}>
                                <div className={styles.mhead}><b>Real-time rooms</b><span>Spring Boot · STOMP over WebSocket · WebRTC</span><Link className={styles.run} href="/projects/realtime-collaboration"><i>▶</i>Open a room</Link></div>
                                <div className={styles.mbody}><p>Seven services, one capability each. Signalling carries SDP and ICE over one topic per room; media goes peer to peer and never touches the servers. The case study opens a real RTCPeerConnection: create a room, share the link, join from any device.</p></div>
                            </div>
                            <div className={styles.machine}>
                                <div className={styles.mhead}><b>Press-release pipeline</b><span>Flask · GPT · 10 languages · MoviePy</span></div>
                                <div className={styles.mbody}><p>PIB press releases in, narrated multilingual videos out. Cut production time by 45 %.</p><Pipeline /></div>
                            </div>
                            <div className={styles.machine}>
                                <div className={styles.mhead}><b>Control room</b><span>a live, breakable model of the systems I run</span><Link className={styles.run} href="/room"><i>▶</i>Enter</Link></div>
                                <div className={styles.mbody}><p>Twenty-four services, real queues, real timeouts. Kill a worker, partition the cache, slow a dependency, then watch circuit breakers, failover and the autoscaler put it back. Replay the incidents I actually fixed, step by step.</p></div>
                            </div>
                        </div>
                        <p className={styles.also}>Also shipped: <b>Warehouse CCTV anomaly detection</b> (35 cameras, 8 warehouses, MyRik) · <b>College attendance app</b> (Flutter + Node, 6.5K downloads) · Amazon and WhatsApp clones (Flutter, Firebase, Riverpod).</p>
                    </div>
                </section>

                <section className={cx(styles.stage, styles.s4)} id="s4" data-stage="4">
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}><b>04</b> Stack <i>6 layers · 36 tools</i></p>
                        <h2 className={styles.h2}>The stack, <em>by layer.</em></h2>
                        <p className={styles.lede}>Not a wall of logos. A cross-section of the tools I reach for, ordered the way a request passes through them. Hover a layer to light it up.</p>
                        <StackLayers layers={LAYERS} />
                    </div>
                </section>

                <section className={cx(styles.stage, styles.s5)} id="s5" data-stage="5">
                    <div className={styles.copy}>
                        <p className={styles.eyebrow}><b>05</b> Contact <i>1 open socket</i></p>
                        <h2 className={styles.h2}>Open a connection.</h2>
                        <p className={styles.lede}>Senior backend and platform roles, hard systems problems, or just an argument about thread pools. I answer email.</p>
                        <CopyEmail email={ABOUT.email} />
                        <div className={styles.links}>{ABOUT.links.slice(0, 4).map((l) => <a key={l[0]} href={l[1]} target="_blank" rel="noopener noreferrer">{l[0]}</a>)}</div>
                        <ContactForm email={ABOUT.email} />
                    </div>
                </section>
            </div>
        </main>
    );
}
