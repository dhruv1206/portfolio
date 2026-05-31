// Scroll-cinema chapter data for the Real-Time Collaboration Platform
// (github.com/dhruv1206/MEET-MICROSERVICES).
//
// Same shape as the dstardb case study: chapters[] + diagramStates{}.

const COLORS = {
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    rose: "#f43f5e",
    amber: "#f59e0b",
    emerald: "#10b981",
    slate: "#64748b",
};

export const diagramStates = {
    "monolith-bottleneck": {
        caption:
            "A monolithic meeting server tries to do everything — auth, presence, chat, audio relay. Every new feature redeploys the world; one slow path stalls everyone.",
        nodes: {
            user1: { x: 0.06, y: 0.25, label: "user", kind: "small", color: COLORS.slate },
            user2: { x: 0.06, y: 0.5, label: "user", kind: "small", color: COLORS.slate },
            user3: { x: 0.06, y: 0.75, label: "user", kind: "small", color: COLORS.slate },
            mono: {
                x: 0.52,
                y: 0.5,
                label: "Meeting Monolith",
                kind: "rect",
                color: COLORS.rose,
                w: 0.32,
                h: 0.6,
            },
            db: { x: 0.9, y: 0.5, label: "Postgres", kind: "rect", color: COLORS.slate, w: 0.14, h: 0.3 },
        },
        edges: [
            { from: "user1", to: "mono" },
            { from: "user2", to: "mono", strong: true },
            { from: "user3", to: "mono" },
            { from: "mono", to: "db" },
        ],
    },

    "service-constellation": {
        caption:
            "Split by capability — config, discovery, gateway, frontend, users, products, meeting signaling — each independently deployable.",
        nodes: {
            config: { x: 0.18, y: 0.18, label: "Config", kind: "small", color: COLORS.amber },
            discovery: { x: 0.5, y: 0.12, label: "Eureka Discovery", kind: "small", color: COLORS.amber },
            gateway: {
                x: 0.5,
                y: 0.5,
                label: "Gateway",
                kind: "rect",
                color: COLORS.violet,
                w: 0.18,
                h: 0.22,
            },
            frontend: { x: 0.18, y: 0.5, label: "Frontend", kind: "small", color: COLORS.cyan },
            user: { x: 0.82, y: 0.32, label: "User Service", kind: "small", color: COLORS.cyan },
            product: { x: 0.82, y: 0.5, label: "Product Service", kind: "small", color: COLORS.cyan },
            signaling: { x: 0.82, y: 0.68, label: "Signaling", kind: "small", color: COLORS.cyan },
            client: { x: 0.18, y: 0.82, label: "browser", kind: "small", color: COLORS.slate },
        },
        edges: [
            { from: "client", to: "gateway", animated: true },
            { from: "gateway", to: "frontend" },
            { from: "gateway", to: "user" },
            { from: "gateway", to: "product" },
            { from: "gateway", to: "signaling" },
            { from: "config", to: "gateway" },
            { from: "discovery", to: "gateway" },
        ],
    },

    "discovery-config": {
        caption:
            "Eureka holds the live address book — every service register on boot, every other service looks them up by name instead of host:port. Config Server hands out env-specific properties so deploys don't bake them in.",
        nodes: {
            config: {
                x: 0.22,
                y: 0.5,
                label: "Config Server",
                kind: "rect",
                color: COLORS.amber,
                w: 0.18,
                h: 0.32,
            },
            discovery: {
                x: 0.52,
                y: 0.5,
                label: "Eureka",
                kind: "rect",
                color: COLORS.violet,
                w: 0.16,
                h: 0.32,
            },
            s1: { x: 0.82, y: 0.22, label: "Gateway", kind: "small", color: COLORS.cyan },
            s2: { x: 0.82, y: 0.4, label: "Signaling", kind: "small", color: COLORS.cyan },
            s3: { x: 0.82, y: 0.58, label: "User Service", kind: "small", color: COLORS.cyan },
            s4: { x: 0.82, y: 0.76, label: "Product Service", kind: "small", color: COLORS.cyan },
        },
        edges: [
            { from: "config", to: "discovery", animated: true },
            { from: "discovery", to: "s1" },
            { from: "discovery", to: "s2" },
            { from: "discovery", to: "s3" },
            { from: "discovery", to: "s4" },
        ],
    },

    "gateway-routing": {
        caption:
            "The Gateway is the only public surface. Spring Cloud Gateway predicate routes — `/api/v1/users/**` → User Service, `/meet/**` → Frontend, `/ws/**` → Signaling.",
        nodes: {
            client: { x: 0.08, y: 0.5, label: "client", kind: "small", color: COLORS.slate },
            gateway: {
                x: 0.34,
                y: 0.5,
                label: "Gateway · :8222",
                kind: "rect",
                color: COLORS.violet,
                w: 0.22,
                h: 0.3,
            },
            rUser: { x: 0.74, y: 0.22, label: "/api/v1/users/** → User", kind: "small", color: COLORS.cyan },
            rFrontend: { x: 0.74, y: 0.42, label: "/meet/** → Frontend", kind: "small", color: COLORS.cyan },
            rSignal: { x: 0.74, y: 0.62, label: "/ws/** → Signaling", kind: "small", color: COLORS.cyan },
            rProduct: { x: 0.74, y: 0.82, label: "/products/** → Product", kind: "small", color: COLORS.cyan },
        },
        edges: [
            { from: "client", to: "gateway", animated: true },
            { from: "gateway", to: "rUser" },
            { from: "gateway", to: "rFrontend" },
            { from: "gateway", to: "rSignal" },
            { from: "gateway", to: "rProduct" },
        ],
    },

    "signaling-broker": {
        caption:
            "Signaling runs STOMP over WebSocket. Clients publish to `/app/sendSignal`; the controller dispatches the message into `/topic/room/{roomId}` and every subscriber in the room hears it.",
        nodes: {
            peerA: { x: 0.1, y: 0.3, label: "peer A", kind: "small", color: COLORS.emerald },
            peerB: { x: 0.1, y: 0.7, label: "peer B", kind: "small", color: COLORS.emerald },
            controller: {
                x: 0.42,
                y: 0.5,
                label: "@MessageMapping(/sendSignal)",
                kind: "rect",
                color: COLORS.violet,
                w: 0.3,
                h: 0.2,
            },
            topic: {
                x: 0.78,
                y: 0.5,
                label: "/topic/room/{roomId}",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.24,
                h: 0.32,
            },
            sJoin: { x: 0.92, y: 0.16, label: "JOIN", kind: "small", color: COLORS.amber },
            sChat: { x: 0.92, y: 0.32, label: "CHAT", kind: "small", color: COLORS.amber },
            sMic: { x: 0.92, y: 0.5, label: "MIC", kind: "small", color: COLORS.amber },
            sVideo: { x: 0.92, y: 0.68, label: "VIDEO", kind: "small", color: COLORS.amber },
            sHand: { x: 0.92, y: 0.84, label: "HAND_RAISE", kind: "small", color: COLORS.amber },
        },
        edges: [
            { from: "peerA", to: "controller", animated: true },
            { from: "peerB", to: "controller" },
            { from: "controller", to: "topic", animated: true, color: COLORS.violet },
            { from: "topic", to: "sJoin" },
            { from: "topic", to: "sChat" },
            { from: "topic", to: "sMic" },
            { from: "topic", to: "sVideo" },
            { from: "topic", to: "sHand" },
        ],
    },

    "webrtc-media": {
        caption:
            "Once the signaling broker pairs two peers, ICE / SDP exchange happens over STOMP. Media bytes go peer-to-peer — they never touch the server. Server-side scale is just topic fan-out, not video relay.",
        nodes: {
            peerA: {
                x: 0.18,
                y: 0.5,
                label: "Peer A",
                kind: "rect",
                color: COLORS.violet,
                w: 0.16,
                h: 0.3,
            },
            peerB: {
                x: 0.78,
                y: 0.5,
                label: "Peer B",
                kind: "rect",
                color: COLORS.violet,
                w: 0.16,
                h: 0.3,
            },
            signal: {
                x: 0.48,
                y: 0.22,
                label: "Signaling (SDP · ICE)",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.28,
                h: 0.16,
            },
        },
        edges: [
            { from: "peerA", to: "signal", animated: true, color: COLORS.cyan },
            { from: "peerB", to: "signal", animated: true, color: COLORS.cyan },
            { from: "peerA", to: "peerB", animated: true, strong: true, color: COLORS.emerald },
        ],
    },

    "try-it": {
        caption: "Open a real RTCPeerConnection in your browser — share the URL, your colleague joins from any device.",
        nodes: {},
        edges: [],
    },
};

export const chapters = [
    {
        id: "the-bottleneck",
        eyebrow: "01 · The constraint",
        title: "Real-time meetings break monoliths",
        diagramState: "monolith-bottleneck",
        body: [
            "A monolith looks fine for the first sprint — auth, chat, presence, and a stubbed audio relay all in one Spring Boot app. The trouble is that 'real-time' has a latency budget the monolith can't share. A slow product-catalog query on the same JVM shows up as a 200 ms hitch in someone's hand-raise.",
            "The deeper issue is operational. Every feature touches the same WAR. Every deploy is a meeting interruption. Scaling the audio relay separately from the user-profile service is impossible while they share a thread pool.",
        ],
    },
    {
        id: "service-constellation",
        eyebrow: "02 · The split",
        title: "Seven services, one capability each",
        diagramState: "service-constellation",
        body: [
            "The platform is seven small Spring Boot apps. Frontend, Gateway, User Service, Product Service, MeetingSignaling, Config Server, Eureka Discovery. Each one boots in seconds, can be rebuilt independently, and uses Eureka to find its neighbours.",
            "The hard part isn't writing seven apps — it's making them coordinate. The next three chapters are the supporting cast: how they discover each other, how external traffic enters, and how the signaling fan-out actually works.",
        ],
    },
    {
        id: "discovery-and-config",
        eyebrow: "03 · Cross-cutting plumbing",
        title: "Eureka holds the address book. Config Server holds the secrets.",
        diagramState: "discovery-config",
        body: [
            "Every service boots, reads `optional:configserver:http://localhost:8888` from its `application.yml`, and pulls its environment from the Config Server. No hard-coded hostnames, no per-environment WARs.",
            "After config, each service registers with Eureka at `:8761`. From that point the Gateway can route to `signaling` by name instead of by host:port, and replacing the signaling service's machine is just a restart away from the rest of the cluster knowing about it.",
        ],
        code: {
            file: "MeetingSignalingService/src/main/resources/application.yml",
            lang: "yaml",
            highlight: [2, 4],
            snippet: `spring:
  application:
    name: signaling
  config:
    import: optional:configserver:http://localhost:8888
eureka:
  client:
    service-url:
      defaultZone: http://localhost:8761/eureka
server:
  port: 8091`,
        },
    },
    {
        id: "gateway-routing",
        eyebrow: "04 · The edge",
        title: "Spring Cloud Gateway · the only public port",
        diagramState: "gateway-routing",
        body: [
            "Everything outside the cluster talks to one place: `:8222`, the Gateway. The Gateway uses Spring Cloud's predicate-route DSL — match a path prefix, forward to a service. No service besides the Gateway has its port exposed.",
            "This also makes auth one-shot. The Gateway runs the token check; the downstream services trust the gateway to have done so and read the user out of forwarded headers.",
        ],
        code: {
            file: "Gateway/src/main/resources/application.yml",
            lang: "yaml",
            highlight: [6, 9],
            snippet: `cloud:
  gateway:
    routes:
      - id: user
        uri: http://localhost:8090
        predicates:
          - Path=/api/v1/users/**
      - id: frontend
        uri: http://localhost:8092
        predicates:
          - Path=/meet/**`,
        },
    },
    {
        id: "signaling-broker",
        eyebrow: "05 · The hot loop",
        title: "STOMP over WebSocket · six signal types, one topic per room",
        diagramState: "signaling-broker",
        body: [
            "The signaling service is where every meeting lives. Each browser opens a STOMP subscription to `/topic/room/{roomId}` and publishes to `/app/sendSignal`. The controller dispatches by `SignalType` — `JOIN`, `LEAVE`, `CHAT`, `MIC`, `VIDEO`, `HAND_RAISE` — and re-emits onto the topic so every other peer in the room gets the update.",
            "The fan-out is the broker's job, not Spring's. The service stays stateless: any instance can serve any room, the broker handles the rest.",
        ],
        code: {
            file: "MeetingSignalingService/.../SignalingController.java",
            lang: "java",
            highlight: [3, 9],
            snippet: `@MessageMapping("/sendSignal")
@SendTo("/topic/room/roomId")
public SignalingMessage handle(SignalingMessage m,
                               SimpMessageHeaderAccessor h) {
    switch (m.getSignalType()) {
        case JOIN  -> signalingService.addUserToRoom(m, h);
        case LEAVE -> signalingService.removeUserFromRoom(m, h);
        case CHAT  -> signalingService.broadcastChatMessage(m, h);
        case MIC   -> signalingService.broadcastMicStatusUpdate(m, h);
        case VIDEO -> signalingService.broadcastVideoStatusUpdate(m, h);
        case HAND_RAISE -> signalingService.broadcastHandRaise(m, h);
    }
    return m;
}`,
        },
    },
    {
        id: "webrtc-media",
        eyebrow: "06 · Why this scales",
        title: "Media bytes never touch our servers",
        diagramState: "webrtc-media",
        body: [
            "Audio and video go peer-to-peer via WebRTC. The signaling service helps two browsers find each other — `JOIN` tells the other peers about a newcomer, the signaling channel carries the SDP offer/answer plus ICE candidates — and then steps out of the way.",
            "Server-side cost per meeting is just the WebSocket fan-out for the six signal types above. The bandwidth-heavy part of a call (video) is bilateral between peers. Doubling meeting count doubles socket count, not bandwidth.",
        ],
    },
    {
        id: "try-it",
        eyebrow: "07 · Try it",
        title: "Open a room. Share the link. Anyone joins.",
        diagramState: "try-it",
        demoSlot: "realtime-collaboration",
        body: [
            "The widget below is a real `RTCPeerConnection` negotiated in your browser. The signaling backend is `/api/webrtc/signal` — Upstash Redis if configured, in-memory otherwise — running the same hello → offer → answer → ICE dance the production service runs over STOMP. Open the share URL on another device and the two browsers pair directly; media never touches our server.",
        ],
    },
];
