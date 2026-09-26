"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useSearchParams } from "next/navigation";

// ---------- WebRTC config ----------
// Cloudflare's free STUN does NAT discovery without TURN auth. For
// peer-to-peer over symmetric NATs a TURN server would be required;
// for the demo we mark that as a documented limitation and rely on
// STUN-only direct connections, which work for the vast majority of
// real-world networks.
const ICE_CONFIG = {
    iceServers: [
        { urls: "stun:stun.cloudflare.com:3478" },
        { urls: "stun:stun.l.google.com:19302" },
    ],
};
const POLL_BACKOFF_MS = 600;
const SIGNAL_ENDPOINT = "/api/webrtc/signal";

const MODE = {
    IDLE: "idle",
    LOOPBACK: "loopback",
    ROOM_CONNECTING: "room-connecting",
    ROOM_WAITING: "room-waiting",
    ROOM_PAIRED: "room-paired",
};

// ---------- ID generation ----------
// Friendly room IDs ("blue-falcon-742") read better than UUIDs when a
// recruiter has to read one over a call. The keyspace is still ~10^7
// distinct values which is plenty for a portfolio demo.
const ADJECTIVES = [
    "amber", "azure", "bold", "brave", "calm", "cyan", "dawn", "fast",
    "gold", "hush", "indigo", "jade", "keen", "lyric", "mint", "noble",
    "onyx", "pearl", "quiet", "rust", "swift", "tidal", "umber", "vivid",
];
const NOUNS = [
    "falcon", "river", "comet", "atlas", "harbor", "delta", "orbit",
    "summit", "ember", "raven", "tempo", "lattice", "prism", "crest",
    "vector", "borealis", "horizon", "compass", "shard", "echo",
];

function generateRoomId() {
    const a = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const n = NOUNS[Math.floor(Math.random() * NOUNS.length)];
    const num = Math.floor(100 + Math.random() * 900);
    return `${a}-${n}-${num}`;
}

function generatePassword() {
    // 6-char alphanumeric — short enough to dictate, large enough to
    // make casual room squatting impractical.
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    let out = "";
    for (let i = 0; i < 6; i++) {
        out += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return out;
}

function generatePeerId() {
    return (
        (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2)) +
        ":" +
        Date.now()
    );
}

// ---------- Synthetic stream ----------
// Canvas + AudioContext → MediaStream. Animates a gradient hexagon
// clock so the visitor sees the stream is alive on the wire (vs a
// still image). Used as the DEFAULT local stream — the demo doesn't
// request camera permission unless the visitor opts in. That avoids
// the same-laptop-two-tabs pitfall where the OS only gives one tab
// working camera frames and the other tab sends empty black tracks.
function createSyntheticStream(label = "synthetic peer", width = 640, height = 480) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    let raf = 0;
    const start = performance.now();
    // Stable hue offset per stream so two tabs visually differ.
    const hueSeed = Math.floor(Math.random() * 360);

    function draw(now) {
        const t = (now - start) / 1000;
        const grd = ctx.createLinearGradient(0, 0, width, height);
        grd.addColorStop(0, `hsl(${(hueSeed + t * 30) % 360}, 70%, 18%)`);
        grd.addColorStop(1, `hsl(${(hueSeed + t * 30 + 90) % 360}, 70%, 8%)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(t * 0.6);
        ctx.strokeStyle = "rgba(139,92,246,0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        const r = 120 + Math.sin(t * 1.4) * 30;
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        ctx.font = "bold 48px ui-monospace, monospace";
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "center";
        ctx.fillText(t.toFixed(1) + "s", width / 2, height - 40);

        ctx.font = "14px ui-monospace, monospace";
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fillText(label, width / 2, 32);

        raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);

    const stream = canvas.captureStream(30);
    try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        gain.gain.value = 0.00001;
        osc.connect(gain);
        const dest = ac.createMediaStreamDestination();
        gain.connect(dest);
        osc.start();
        stream.addTrack(dest.stream.getAudioTracks()[0]);
    } catch {
        /* audio is non-essential */
    }
    stream._dispose = () => cancelAnimationFrame(raf);
    stream._isSynthetic = true;
    return stream;
}

// ---------- Stats sampler ----------
async function readStats(pc) {
    if (!pc) return null;
    const stats = await pc.getStats();
    let inboundVideo = null,
        outboundVideo = null,
        candidatePair = null;
    stats.forEach((report) => {
        if (
            report.type === "inbound-rtp" &&
            (report.kind === "video" || report.mediaType === "video")
        ) {
            inboundVideo = report;
        }
        if (
            report.type === "outbound-rtp" &&
            (report.kind === "video" || report.mediaType === "video")
        ) {
            outboundVideo = report;
        }
        if (report.type === "candidate-pair" && report.state === "succeeded") {
            candidatePair = report;
        }
    });
    return { inboundVideo, outboundVideo, candidatePair };
}

// ---------- Main component ----------
export default function WebRTCDemo() {
    const searchParams = useSearchParams();

    const [mode, setMode] = useState(MODE.IDLE);
    const [connectionState, setConnectionState] = useState("new");
    const [error, setError] = useState(null);
    const [messages, setMessages] = useState([
        {
            who: "system",
            text:
                "Real peer-to-peer over WebRTC. Pick a mode below — loopback " +
                "always works; multi-user rooms pair you with anyone who " +
                "opens the share link.",
        },
    ]);
    const [draftMsg, setDraftMsg] = useState("");
    const [stats, setStats] = useState(null);

    // Room form state — pre-filled from URL if present.
    const [roomConnectionMode, setRoomConnectionMode] = useState(() =>
        searchParams?.get("room") ? "room" : "loopback",
    );
    const [roomIdInput, setRoomIdInput] = useState(
        () => searchParams?.get("room") || "",
    );
    const [passwordInput, setPasswordInput] = useState(
        () => searchParams?.get("pw") || "",
    );
    const [shareCopied, setShareCopied] = useState(false);

    // Refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const localPcRef = useRef(null);
    const remotePcRef = useRef(null); // loopback only
    const dataChannelRef = useRef(null);
    const localStreamRef = useRef(null);
    const syntheticStreamRef = useRef(null);
    const statsTimerRef = useRef(null);
    const messageQueueRef = useRef([]);

    // Room signaling refs
    const peerIdRef = useRef(null);
    const remotePeerIdRef = useRef(null);
    const roomRef = useRef(null); // current room id (or null)
    const passwordRef = useRef("");
    const cursorRef = useRef(0);
    const pollAbortRef = useRef(null);
    const pollLoopActiveRef = useRef(false);
    const pendingIceRef = useRef([]); // candidates received before remote desc

    const log = useCallback((who, text) => {
        setMessages((prev) => [...prev, { who, text, ts: Date.now() }]);
    }, []);

    // ---------- Derived share URL ----------
    // Pure derivation from the form inputs — no effect, no state.
    // The empty-string case (loopback mode or no room id) is what the
    // PreJoinForm checks before rendering the share panel.
    const shareUrl = useMemo(() => {
        if (roomConnectionMode !== "room" || !roomIdInput) return "";
        const base =
            typeof window !== "undefined"
                ? `${window.location.origin}/projects/realtime-collaboration`
                : "/projects/realtime-collaboration";
        const params = new URLSearchParams();
        params.set("room", roomIdInput);
        if (passwordInput) params.set("pw", passwordInput);
        return `${base}?${params.toString()}`;
    }, [roomIdInput, passwordInput, roomConnectionMode]);

    // ---------- Cleanup ----------
    const fullCleanup = useCallback(async () => {
        // Tell the room we're leaving so the other peer learns
        // immediately (don't wait for the TTL).
        if (roomRef.current && peerIdRef.current) {
            try {
                await fetch(SIGNAL_ENDPOINT, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        action: "leave",
                        roomId: roomRef.current,
                        peerId: peerIdRef.current,
                    }),
                    keepalive: true,
                });
            } catch {
                /* best-effort */
            }
        }
        pollLoopActiveRef.current = false;
        if (pollAbortRef.current) {
            try {
                pollAbortRef.current.abort();
            } catch {}
        }
        try {
            dataChannelRef.current?.close();
        } catch {}
        try {
            localPcRef.current?.close();
        } catch {}
        try {
            remotePcRef.current?.close();
        } catch {}
        if (statsTimerRef.current) clearInterval(statsTimerRef.current);
        localStreamRef.current?.getTracks().forEach((t) => t.stop());
        syntheticStreamRef.current?._dispose?.();
        syntheticStreamRef.current?.getTracks().forEach((t) => t.stop());
        dataChannelRef.current = null;
        localPcRef.current = null;
        remotePcRef.current = null;
        statsTimerRef.current = null;
        localStreamRef.current = null;
        syntheticStreamRef.current = null;
        pollAbortRef.current = null;
        peerIdRef.current = null;
        remotePeerIdRef.current = null;
        roomRef.current = null;
        passwordRef.current = "";
        cursorRef.current = 0;
        pendingIceRef.current = [];
        messageQueueRef.current = [];
    }, []);

    useEffect(
        () => () => {
            fullCleanup();
        },
        [fullCleanup],
    );

    const [localIsCamera, setLocalIsCamera] = useState(false);
    const [cameraToggling, setCameraToggling] = useState(false);

    // ---------- Local media ----------
    // Default to a synthetic Canvas stream so the demo NEVER blocks on
    // a permission prompt and the same-laptop-two-tabs case stays
    // sane (the second tab's getUserMedia can silently produce empty
    // frames). Visitor opts in via the "Use my camera" button, which
    // calls enableCamera() to swap the synthetic track for a real one
    // via RTCRtpSender.replaceTrack — no renegotiation required.
    const createInitialLocalStream = useCallback(() => {
        return createSyntheticStream("you");
    }, []);

    // Swap the current local stream's tracks on the live PC without
    // renegotiating SDP. RTCRtpSender.replaceTrack handles the codec
    // swap inline — the remote keeps the same RTP stream, the frames
    // just start arriving from a different source.
    const swapLocalStream = useCallback(
        async (nextStream) => {
            const pc = localPcRef.current;
            if (pc) {
                const senders = pc.getSenders();
                for (const track of nextStream.getTracks()) {
                    const sender = senders.find(
                        (s) => s.track && s.track.kind === track.kind,
                    );
                    if (sender) {
                        try {
                            await sender.replaceTrack(track);
                        } catch (e) {
                            console.warn("[webrtc] replaceTrack failed:", e);
                        }
                    } else {
                        // No sender yet for this kind — add a new one. This
                        // path triggers renegotiation, which our loopback
                        // mode handles in-process. For room mode the
                        // initial synthetic stream already has both video
                        // + audio tracks, so this branch shouldn't fire.
                        pc.addTrack(track, nextStream);
                    }
                }
            }
            const prev = localStreamRef.current;
            if (prev && prev !== nextStream) {
                prev._dispose?.();
                prev.getTracks().forEach((t) => t.stop());
            }
            localStreamRef.current = nextStream;
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = nextStream;
            }
        },
        [],
    );

    const enableCamera = useCallback(async () => {
        if (cameraToggling) return;
        setCameraToggling(true);
        try {
            const camStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });
            await swapLocalStream(camStream);
            setLocalIsCamera(true);
            log("system", "Camera + mic enabled — replacing synthetic track.");
        } catch (e) {
            log(
                "system",
                `Camera/mic denied (${e?.name || "error"}). Staying on synthetic stream.`,
            );
        } finally {
            setCameraToggling(false);
        }
    }, [cameraToggling, log, swapLocalStream]);

    const disableCamera = useCallback(async () => {
        if (cameraToggling) return;
        setCameraToggling(true);
        try {
            const synth = createSyntheticStream("you");
            await swapLocalStream(synth);
            setLocalIsCamera(false);
            log("system", "Camera disabled — back to synthetic stream.");
        } finally {
            setCameraToggling(false);
        }
    }, [cameraToggling, log, swapLocalStream]);

    const buildLocalPeerConnection = useCallback(
        (localStream) => {
            const pc = new RTCPeerConnection(ICE_CONFIG);
            for (const track of localStream.getTracks()) {
                pc.addTrack(track, localStream);
            }
            pc.ontrack = (event) => {
                const [remoteStream] = event.streams;
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                }
            };
            pc.onconnectionstatechange = () => {
                setConnectionState(pc.connectionState);
            };
            statsTimerRef.current = setInterval(async () => {
                try {
                    setStats(await readStats(pc));
                } catch {
                    /* getStats may throw if pc is closed mid-sample */
                }
            }, 1000);
            return pc;
        },
        [],
    );

    // ---------- Loopback mode ----------
    const joinLoopback = useCallback(async () => {
        setError(null);
        setMode(MODE.LOOPBACK);
        setConnectionState("new");
        const localStream = createInitialLocalStream();
        localStreamRef.current = localStream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
        const localPc = buildLocalPeerConnection(localStream);
        localPcRef.current = localPc;

        log(
            "system",
            "Loopback mode — connecting to a synthetic peer running in this same tab.",
        );

        const remotePc = new RTCPeerConnection(ICE_CONFIG);
        remotePcRef.current = remotePc;
        const synthetic = createSyntheticStream();
        syntheticStreamRef.current = synthetic;
        for (const track of synthetic.getTracks()) {
            remotePc.addTrack(track, synthetic);
        }
        localPc.onicecandidate = (e) => {
            if (e.candidate)
                remotePc.addIceCandidate(e.candidate).catch(() => {});
        };
        remotePc.onicecandidate = (e) => {
            if (e.candidate)
                localPc.addIceCandidate(e.candidate).catch(() => {});
        };
        const dc = localPc.createDataChannel("chat");
        wireDataChannel(dc);
        remotePc.ondatachannel = (e) => {
            const remoteDc = e.channel;
            remoteDc.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    remoteDc.send(
                        JSON.stringify({
                            kind: "echo",
                            text: "echo: " + payload.text,
                            ts: Date.now(),
                        }),
                    );
                } catch {}
            };
        };
        try {
            const offer = await localPc.createOffer();
            await localPc.setLocalDescription(offer);
            await remotePc.setRemoteDescription(offer);
            const answer = await remotePc.createAnswer();
            await remotePc.setLocalDescription(answer);
            await localPc.setRemoteDescription(answer);
        } catch (e) {
            setError(`Loopback negotiation failed: ${e?.message || e}`);
        }
        // wireDataChannel is a plain inner function whose behaviour
        // depends only on `log` (already in deps) + refs. Including it
        // here would force this callback to re-create every render
        // for no behavioural change, so the deps array is intentional.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createInitialLocalStream, buildLocalPeerConnection, log]);

    // ---------- Room mode ----------
    const joinRoom = useCallback(async () => {
        setError(null);
        const roomId = roomIdInput.trim();
        const password = passwordInput.trim();
        if (!roomId) {
            setError("Room ID is required.");
            return;
        }
        setMode(MODE.ROOM_CONNECTING);
        setConnectionState("new");

        const peerId = generatePeerId();
        peerIdRef.current = peerId;
        roomRef.current = roomId;
        passwordRef.current = password;

        // 1. Join the room via the signaling backend.
        let joinRes;
        try {
            const r = await fetch(SIGNAL_ENDPOINT, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    action: "join",
                    roomId,
                    peerId,
                    password,
                }),
            });
            joinRes = await r.json();
            if (!r.ok) {
                setError(joinResMessage(joinRes.error));
                setMode(MODE.IDLE);
                roomRef.current = null;
                peerIdRef.current = null;
                return;
            }
        } catch (e) {
            setError(`Signaling unreachable: ${e?.message || e}`);
            setMode(MODE.IDLE);
            return;
        }
        cursorRef.current = joinRes.cursor || 0;
        log("system", `Joined room "${roomId}" — peer id ${peerId.slice(0, 8)}`);

        // 2. Acquire local media + build the connection.
        const localStream = createInitialLocalStream();
        localStreamRef.current = localStream;
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
        }
        const pc = buildLocalPeerConnection(localStream);
        localPcRef.current = pc;

        pc.onicecandidate = (e) => {
            if (e.candidate && remotePeerIdRef.current) {
                postSignal({
                    type: "ice",
                    candidate:
                        typeof e.candidate.toJSON === "function"
                            ? e.candidate.toJSON()
                            : {
                                  candidate: e.candidate.candidate,
                                  sdpMid: e.candidate.sdpMid,
                                  sdpMLineIndex: e.candidate.sdpMLineIndex,
                              },
                    to: remotePeerIdRef.current,
                });
            }
        };

        // 3. If someone is already in the room, send them an offer.
        //    If we're alone, wait — the new joiner will offer us.
        const others = (joinRes.peers || []).filter((p) => p !== peerId);
        if (others.length > 0) {
            remotePeerIdRef.current = others[0];
            setMode(MODE.ROOM_PAIRED);
            await sendOffer(pc, remotePeerIdRef.current);
        } else {
            setMode(MODE.ROOM_WAITING);
            log(
                "system",
                "Waiting for someone to join. Share the link in the panel below.",
            );
        }

        // 4. Start the long-poll loop.
        pollLoopActiveRef.current = true;
        startPollLoop(pc);
        // postSignal / sendOffer / startPollLoop are plain inner
        // functions whose behaviour depends only on refs + the
        // already-listed callbacks. Including them would force this
        // callback to re-create on every render with no behavioural
        // change.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        createInitialLocalStream,
        buildLocalPeerConnection,
        log,
        passwordInput,
        roomIdInput,
    ]);

    // ---------- Signaling helpers ----------
    const postSignal = useCallback(async (message) => {
        const roomId = roomRef.current;
        const peerId = peerIdRef.current;
        if (!roomId || !peerId) return;
        try {
            await fetch(SIGNAL_ENDPOINT, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    action: "send",
                    roomId,
                    peerId,
                    password: passwordRef.current,
                    message,
                }),
            });
        } catch (e) {
            console.warn("[webrtc] postSignal failed:", e);
        }
    }, []);

    async function sendOffer(pc, toPeerId) {
        const dc = pc.createDataChannel("chat");
        wireDataChannel(dc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await postSignal({
            type: "offer",
            sdp: { type: offer.type, sdp: offer.sdp },
            to: toPeerId,
        });
        log("system", `Sent offer to ${toPeerId.slice(0, 8)}.`);
    }

    async function handleSignal(msg, pc) {
        if (!msg || msg.from === peerIdRef.current) return;
        if (msg.type === "offer") {
            remotePeerIdRef.current = msg.from;
            setMode(MODE.ROOM_PAIRED);
            log("system", `Incoming offer from ${msg.from.slice(0, 8)}.`);
            pc.ondatachannel = (e) => wireDataChannel(e.channel);
            await pc.setRemoteDescription(msg.sdp);
            // Flush queued ICE candidates that arrived before the
            // remote description was set.
            for (const c of pendingIceRef.current) {
                try {
                    await pc.addIceCandidate(c);
                } catch {}
            }
            pendingIceRef.current = [];
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await postSignal({
                type: "answer",
                sdp: { type: answer.type, sdp: answer.sdp },
                to: msg.from,
            });
            log("system", "Sent answer back.");
        } else if (msg.type === "answer") {
            await pc.setRemoteDescription(msg.sdp);
            for (const c of pendingIceRef.current) {
                try {
                    await pc.addIceCandidate(c);
                } catch {}
            }
            pendingIceRef.current = [];
            log("system", "Answer received — establishing media.");
        } else if (msg.type === "ice") {
            const candidate = msg.candidate;
            if (!pc.remoteDescription) {
                pendingIceRef.current.push(candidate);
            } else {
                try {
                    await pc.addIceCandidate(candidate);
                } catch (e) {
                    console.warn("[webrtc] ice add failed:", e);
                }
            }
        } else if (msg.type === "bye") {
            log("system", "Peer left the room.");
            setConnectionState("disconnected");
        }
    }

    function startPollLoop(pc) {
        (async () => {
            while (pollLoopActiveRef.current && roomRef.current) {
                const roomId = roomRef.current;
                const peerId = peerIdRef.current;
                const cursor = cursorRef.current;
                const params = new URLSearchParams();
                params.set("room", roomId);
                params.set("peer", peerId);
                params.set("cursor", String(cursor));
                if (passwordRef.current) params.set("pw", passwordRef.current);
                const controller = new AbortController();
                pollAbortRef.current = controller;
                try {
                    const r = await fetch(
                        `${SIGNAL_ENDPOINT}?${params.toString()}`,
                        { signal: controller.signal },
                    );
                    if (!r.ok) {
                        const err = await r.json().catch(() => ({}));
                        setError(`Signaling error: ${err.error || r.status}`);
                        pollLoopActiveRef.current = false;
                        break;
                    }
                    const data = await r.json();
                    cursorRef.current = data.cursor ?? cursorRef.current;
                    for (const msg of data.messages || []) {
                        await handleSignal(msg, pc);
                    }
                    // If we were waiting and a peer just joined, send
                    // them an offer.
                    if (
                        mode === MODE.ROOM_WAITING &&
                        !remotePeerIdRef.current &&
                        (data.peers || []).length > 1
                    ) {
                        const other = data.peers.find(
                            (p) => p !== peerIdRef.current,
                        );
                        if (other) {
                            remotePeerIdRef.current = other;
                            setMode(MODE.ROOM_PAIRED);
                            await sendOffer(pc, other);
                        }
                    }
                } catch (e) {
                    if (controller.signal.aborted) break;
                    console.warn("[webrtc] poll error:", e);
                    await new Promise((r) =>
                        setTimeout(r, POLL_BACKOFF_MS),
                    );
                }
            }
        })();
    }

    function joinResMessage(error) {
        switch (error) {
            case "wrong-password":
                return "Wrong password for this room.";
            case "room-full":
                return "Room is full (2-peer limit).";
            case "room-not-found":
                return "Room not found.";
            default:
                return `Could not join room: ${error || "unknown error"}`;
        }
    }

    // ---------- DataChannel chat (used by both modes) ----------
    function wireDataChannel(dc) {
        dataChannelRef.current = dc;
        dc.onopen = () => {
            log("system", "Data channel open — chat is live.");
            for (const text of messageQueueRef.current) {
                dc.send(
                    JSON.stringify({ kind: "msg", text, ts: Date.now() }),
                );
            }
            messageQueueRef.current = [];
        };
        dc.onclose = () => log("system", "Data channel closed.");
        dc.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const hint =
                    data.ts && Date.now() - data.ts < 5000
                        ? ` (${Date.now() - data.ts}ms RTT)`
                        : "";
                log("them", data.text + hint);
            } catch {
                log("them", String(event.data));
            }
        };
    }

    function sendChat(e) {
        e.preventDefault();
        const text = draftMsg.trim();
        if (!text) return;
        const dc = dataChannelRef.current;
        log("me", text);
        if (dc && dc.readyState === "open") {
            dc.send(JSON.stringify({ kind: "msg", text, ts: Date.now() }));
        } else {
            messageQueueRef.current.push(text);
        }
        setDraftMsg("");
    }

    async function hangup() {
        await fullCleanup();
        setMode(MODE.IDLE);
        setConnectionState("closed");
        setStats(null);
        log("system", "Hung up.");
    }

    // ---------- Generate / copy share link ----------
    function regenerateRoom() {
        setRoomIdInput(generateRoomId());
        setPasswordInput(generatePassword());
        setShareCopied(false);
    }

    async function copyShareUrl() {
        if (!shareUrl) return;
        try {
            await navigator.clipboard.writeText(shareUrl);
            setShareCopied(true);
            setTimeout(() => setShareCopied(false), 1500);
        } catch {
            /* clipboard blocked — ignore */
        }
    }

    // ---------- Derived UI bits ----------
    const remoteLabel =
        mode === MODE.LOOPBACK
            ? "synthetic peer"
            : mode === MODE.ROOM_PAIRED
              ? remotePeerIdRef.current?.slice(0, 8) || "peer"
              : mode === MODE.ROOM_WAITING
                ? "waiting for peer…"
                : mode === MODE.ROOM_CONNECTING
                  ? "connecting…"
                  : "—";

    const statsLine = (() => {
        if (!stats) return null;
        const { inboundVideo, outboundVideo, candidatePair } = stats;
        const rtt = candidatePair?.currentRoundTripTime
            ? `${Math.round(candidatePair.currentRoundTripTime * 1000)}ms`
            : "—";
        const inKbps = bitrateKbps(inboundVideo, "bytesReceived");
        const outKbps = bitrateKbps(outboundVideo, "bytesSent");
        const codec = inboundVideo?.codecId ? "H264/VP8" : "—";
        return { rtt, codec, inKbps, outKbps };
    })();

    const isActive = mode !== MODE.IDLE;

    return (
        <div className="webrtc-demo demo-cell overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/30 font-mono text-xs">
                <span className="text-cyan-400">▶</span>
                <span className="text-gray-400 flex-1 text-left uppercase tracking-wider text-[11px]">
                    {isActive
                        ? mode === MODE.LOOPBACK
                            ? "loopback — synthetic peer in this tab"
                            : `room ${roomRef.current || roomIdInput}`
                        : "real-time room — peer-to-peer over WebRTC"}
                </span>
                <span
                    className={
                        "inline-flex items-center gap-1.5 " +
                        (connectionState === "connected"
                            ? "text-emerald-400"
                            : connectionState === "failed" ||
                                connectionState === "disconnected"
                              ? "text-rose-400"
                              : "text-gray-400")
                    }
                >
                    <span className="relative inline-flex w-2 h-2">
                        <span
                            className={
                                "absolute inset-0  opacity-60 " +
                                (connectionState === "connected"
                                    ? "bg-emerald-400 animate-ping"
                                    : "bg-gray-500")
                            }
                        />
                        <span
                            className={
                                "relative w-2 h-2  " +
                                (connectionState === "connected"
                                    ? "bg-emerald-400"
                                    : "bg-gray-500")
                            }
                        />
                    </span>
                    {connectionState}
                </span>
            </div>

            {/* Body */}
            {!isActive ? (
                <PreJoinForm
                    connectionMode={roomConnectionMode}
                    setConnectionMode={setRoomConnectionMode}
                    roomIdInput={roomIdInput}
                    setRoomIdInput={setRoomIdInput}
                    passwordInput={passwordInput}
                    setPasswordInput={setPasswordInput}
                    shareUrl={shareUrl}
                    shareCopied={shareCopied}
                    onRegenerateRoom={regenerateRoom}
                    onCopyShareUrl={copyShareUrl}
                    onJoin={
                        roomConnectionMode === "room" ? joinRoom : joinLoopback
                    }
                />
            ) : (
                <ActiveSession
                    localVideoRef={localVideoRef}
                    remoteVideoRef={remoteVideoRef}
                    remoteLabel={remoteLabel}
                    messages={messages}
                    draftMsg={draftMsg}
                    setDraftMsg={setDraftMsg}
                    sendChat={sendChat}
                    shareUrl={mode !== MODE.LOOPBACK ? shareUrl : ""}
                    shareCopied={shareCopied}
                    onCopyShareUrl={copyShareUrl}
                    localIsCamera={localIsCamera}
                    cameraToggling={cameraToggling}
                    onEnableCamera={enableCamera}
                    onDisableCamera={disableCamera}
                />
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/10 bg-black/30 font-mono text-xs text-gray-400 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {statsLine ? (
                        <>
                            <span>
                                rtt{" "}
                                <span className="text-emerald-300">
                                    {statsLine.rtt}
                                </span>
                            </span>
                            <span>
                                in{" "}
                                <span className="text-cyan-300">
                                    {statsLine.inKbps != null
                                        ? statsLine.inKbps + " kbps"
                                        : "—"}
                                </span>
                            </span>
                            <span>
                                out{" "}
                                <span className="text-cyan-300">
                                    {statsLine.outKbps != null
                                        ? statsLine.outKbps + " kbps"
                                        : "—"}
                                </span>
                            </span>
                            <span>
                                codec{" "}
                                <span className="text-violet-300">
                                    {statsLine.codec}
                                </span>
                            </span>
                        </>
                    ) : (
                        <span>no peer connection yet</span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {isActive && (
                        <button
                            type="button"
                            onClick={hangup}
                            className="px-3 py-1.5 text-xs font-semibold  bg-rose-500/10 border border-rose-500/30 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/60 transition-colors"
                        >
                            Hang up
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="px-4 py-2 text-xs text-rose-300 bg-rose-500/10 border-t border-rose-500/30 font-mono">
                    {error}
                </div>
            )}
        </div>
    );
}

// ---------- Sub-components ----------

function PreJoinForm({
    connectionMode,
    setConnectionMode,
    roomIdInput,
    setRoomIdInput,
    passwordInput,
    setPasswordInput,
    shareUrl,
    shareCopied,
    onRegenerateRoom,
    onCopyShareUrl,
    onJoin,
}) {
    return (
        <div className="px-6 py-8 bg-black/30 space-y-6">
            <div className="space-y-2">
                <div className="text-sm text-gray-300 font-display font-medium">
                    Pick a connection mode
                </div>
                <div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    role="radiogroup"
                >
                    <ModeChoice
                        active={connectionMode === "loopback"}
                        onClick={() => setConnectionMode("loopback")}
                        title="Solo (loopback)"
                        subtitle="Pair with a synthetic peer running in this same tab. Always works — no signup or room needed."
                    />
                    <ModeChoice
                        active={connectionMode === "room"}
                        onClick={() => setConnectionMode("room")}
                        title="Multi-user room"
                        subtitle="Pair with anyone who opens your share link. Real signaling via the Next.js API + (optional) Redis."
                    />
                </div>
            </div>

            {connectionMode === "room" && (
                <div className="space-y-3 p-4  border border-white/10 bg-black/30">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_140px] gap-2">
                        <label className="block">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                                Room ID
                            </span>
                            <input
                                value={roomIdInput}
                                onChange={(e) => setRoomIdInput(e.target.value)}
                                placeholder="amber-falcon-742"
                                className="w-full bg-black/50 border border-white/10  px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </label>
                        <label className="block">
                            <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                                Password (optional)
                            </span>
                            <input
                                value={passwordInput}
                                onChange={(e) =>
                                    setPasswordInput(e.target.value)
                                }
                                placeholder="—"
                                className="w-full bg-black/50 border border-white/10  px-3 py-2 font-mono text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60"
                                autoComplete="off"
                                spellCheck={false}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={onRegenerateRoom}
                            className="self-end px-3 py-2 text-xs font-semibold  bg-white/5 border border-white/15 text-gray-200 hover:bg-white/10 hover:border-white/30 transition-colors"
                        >
                            Generate
                        </button>
                    </div>

                    {shareUrl && (
                        <div className="flex items-center gap-2 p-2  bg-violet-500/10 border border-violet-500/30 font-mono text-xs">
                            <span className="text-violet-300 flex-shrink-0">
                                share →
                            </span>
                            <code className="flex-1 truncate text-gray-200">
                                {shareUrl}
                            </code>
                            <button
                                type="button"
                                onClick={onCopyShareUrl}
                                className="px-2 py-1  bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 transition-colors"
                            >
                                {shareCopied ? "copied" : "copy"}
                            </button>
                        </div>
                    )}
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Open this URL in another browser, tab, or device to
                        pair. The signaling backend (
                        <span className="font-mono">/api/webrtc/signal</span>
                        ) runs on the server; the media stream goes
                        peer-to-peer once ICE finishes.
                    </p>
                </div>
            )}

            <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">
                    {connectionMode === "loopback"
                        ? "Click Join to spin up a peer connection against the synthetic peer."
                        : "Click Join to create or enter the room above."}
                </p>
                <button
                    type="button"
                    onClick={onJoin}
                    className="px-4 py-2 text-sm font-semibold  bg-violet-500/20 border border-violet-500/50 text-violet-100 hover:bg-violet-500/40 hover:border-violet-500/80 transition-colors"
                >
                    Join
                </button>
            </div>
        </div>
    );
}

function ModeChoice({ active, onClick, title, subtitle }) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={active}
            onClick={onClick}
            className={
                "text-left p-3  border transition-colors " +
                (active
                    ? "border-violet-500/60 bg-violet-500/10 text-white"
                    : "border-white/10 bg-black/30 text-gray-300 hover:border-white/30 hover:bg-black/50")
            }
        >
            <div className="font-semibold text-sm mb-1">{title}</div>
            <div className="text-xs text-gray-400 leading-relaxed">
                {subtitle}
            </div>
        </button>
    );
}

function ActiveSession({
    localVideoRef,
    remoteVideoRef,
    remoteLabel,
    messages,
    draftMsg,
    setDraftMsg,
    sendChat,
    shareUrl,
    shareCopied,
    onCopyShareUrl,
    localIsCamera,
    cameraToggling,
    onEnableCamera,
    onDisableCamera,
}) {
    // Single-column stack: videos on top, chat below. Side-by-side
    // layout was breaking inside the case-study sidebar column
    // because `lg:` matches viewport not container — the demo was
    // forced into a two-column squeeze and the chat got clipped.
    return (
        <div className="flex flex-col bg-black/30">
            <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <VideoTile ref={localVideoRef} label="you" muted />
                    <VideoTile ref={remoteVideoRef} label={remoteLabel} />
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                    <button
                        type="button"
                        onClick={
                            localIsCamera ? onDisableCamera : onEnableCamera
                        }
                        disabled={cameraToggling}
                        className={
                            "px-3 py-1.5  border transition-colors disabled:opacity-50 " +
                            (localIsCamera
                                ? "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20"
                                : "bg-violet-500/10 border-violet-500/30 text-violet-200 hover:bg-violet-500/20")
                        }
                    >
                        {cameraToggling
                            ? "switching…"
                            : localIsCamera
                              ? "Disable camera"
                              : "Use my camera"}
                    </button>
                    <span className="text-gray-500">
                        {localIsCamera
                            ? "your real camera is streaming — replaceTrack swap, no SDP renegotiation"
                            : "synthetic stream is being sent; click above to swap in your camera"}
                    </span>
                </div>
                {shareUrl && (
                    <div className="flex items-center gap-2 p-2  bg-violet-500/10 border border-violet-500/30 font-mono text-xs">
                        <span className="text-violet-300 flex-shrink-0">
                            share →
                        </span>
                        <code className="flex-1 truncate text-gray-200">
                            {shareUrl}
                        </code>
                        <button
                            type="button"
                            onClick={onCopyShareUrl}
                            className="px-2 py-1  bg-violet-500/20 text-violet-200 hover:bg-violet-500/40 transition-colors"
                        >
                            {shareCopied ? "copied" : "copy"}
                        </button>
                    </div>
                )}
            </div>

            <div className="flex flex-col border-t border-white/10">
                <div className="max-h-[220px] overflow-y-auto px-4 py-3 font-mono text-[13px] space-y-1.5">
                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={
                                m.who === "me"
                                    ? "text-violet-200"
                                    : m.who === "them"
                                      ? "text-cyan-200"
                                      : "text-gray-500"
                            }
                        >
                            <span className="text-gray-600 mr-1">
                                {m.who === "me"
                                    ? "you>"
                                    : m.who === "them"
                                      ? "them>"
                                      : "*"}
                            </span>
                            {m.text}
                        </div>
                    ))}
                </div>
                <form
                    onSubmit={sendChat}
                    className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-black/40 font-mono"
                >
                    <span className="text-violet-500 select-none text-xs">
                        ›
                    </span>
                    <input
                        value={draftMsg}
                        onChange={(e) => setDraftMsg(e.target.value)}
                        placeholder="type to send via DataChannel…"
                        className="flex-1 bg-transparent border-0 outline-none text-white text-sm placeholder:text-gray-600"
                        autoComplete="off"
                    />
                </form>
            </div>
        </div>
    );
}

const VideoTile = forwardRef(function VideoTile({ label, muted }, ref) {
    return (
        <div className="relative aspect-video  overflow-hidden bg-black/60 border border-white/10">
            <video
                ref={ref}
                autoPlay
                playsInline
                muted={muted}
                className="w-full h-full object-cover"
            />
            <span className="absolute bottom-2 left-2 px-2 py-0.5  bg-black/60 backdrop-blur-sm text-[10px] font-mono text-gray-300 uppercase tracking-wider">
                {label}
            </span>
        </div>
    );
});

// ---------- Small helpers ----------
function bitrateKbps(report, field) {
    if (!report) return null;
    const bytes = report[field];
    const ts = report.timestamp;
    if (!bytes || !ts) return null;
    return Math.round(((bytes * 8) / 1000 / (ts / 1000)) * 0.1);
}
