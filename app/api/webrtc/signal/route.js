// Signaling endpoint for the WebRTC demo on /projects/realtime-collaboration.
//
//   POST /api/webrtc/signal       — { action: 'join' | 'leave' | 'send', ... }
//   GET  /api/webrtc/signal?...   — long-poll for messages addressed to the
//                                   caller's peerId since the given cursor.
//
// Backed by `app/lib/signaling-store` which picks Upstash Redis when
// UPSTASH_REDIS_REST_URL + _TOKEN are set, else in-memory (dev / single-
// instance). Vercel function timeout pinned slightly above the inner
// long-poll budget so the loop always returns before the platform
// kills the request.

import { getStore } from "@/app/lib/signaling-store";

// Vercel Hobby allows up to 60s; we don't need that much. 25s window
// gives the 20s inner long-poll plenty of headroom. Default Node
// runtime — the Edge runtime can't poll Upstash with reasonable
// timing primitives.
export const maxDuration = 25;
const POLL_TIMEOUT_MS = 20_000;

function statusForError(error) {
    switch (error) {
        case "wrong-password":
        case "not-in-room":
            return 403;
        case "room-full":
            return 409;
        case "room-not-found":
            return 404;
        default:
            return 400;
    }
}

export async function POST(req) {
    let body;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: "bad-json" }, { status: 400 });
    }
    const { action, roomId, peerId, password, message } = body || {};
    if (!action || !roomId || !peerId) {
        return Response.json({ error: "missing-fields" }, { status: 400 });
    }
    const store = getStore();
    let result;
    if (action === "join") {
        result = await store.join(roomId, peerId, password);
    } else if (action === "leave") {
        result = await store.leave(roomId, peerId);
    } else if (action === "send") {
        if (!message) {
            return Response.json({ error: "missing-message" }, { status: 400 });
        }
        result = await store.send(roomId, peerId, password, message);
    } else {
        return Response.json({ error: "unknown-action" }, { status: 400 });
    }
    if (!result.ok) {
        return Response.json(result, { status: statusForError(result.error) });
    }
    return Response.json(result);
}

export async function GET(req) {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get("room");
    const peerId = searchParams.get("peer");
    const password = searchParams.get("pw") || "";
    const cursor = Number(searchParams.get("cursor") || 0);
    if (!roomId || !peerId) {
        return Response.json(
            { error: "missing-room-or-peer" },
            { status: 400 },
        );
    }
    const store = getStore();
    const result = await store.poll(
        roomId,
        peerId,
        password,
        Number.isFinite(cursor) ? cursor : 0,
        POLL_TIMEOUT_MS,
    );
    if (!result.ok) {
        return Response.json(result, { status: statusForError(result.error) });
    }
    return Response.json(result);
}
