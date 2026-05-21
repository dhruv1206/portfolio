"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Mirrors the original Flask service's pipeline
// (github.com/dhruv1206/synth-ai-envoys):
//
//   Scrape PIB → Summarize (LLM) → Scrape images → Translate (10 langs)
//   → TTS (gTTS) → Compose MP4 (MoviePy: blur bg + scaled fg with
//   gradual zoom + fade in/out + translated title overlay) → Upload to
//   Firebase + FCM notifications.
//
// Browser limitations we work around:
//   • Real used Google Translate; the demo proxies MyMemory.
//   • Real used gTTS to render MP3s; the demo speaks via Web Speech.
//   • Real composed an MP4 via MoviePy; the demo paints the same
//     timeline live on Canvas (zoom + fade + per-slide title overlay).

const STAGES = [
    { id: "ingest", label: "Ingest" },
    { id: "summarize", label: "Summarize" },
    { id: "translate", label: "Translate · 10 langs" },
    { id: "tts", label: "Synthesize speech" },
    { id: "compose", label: "Compose video" },
    { id: "distribute", label: "Distribute" },
];

// Same 10 languages the real synth-ai-envoys deployment fans out to.
// Native labels render in the language's own script so the multi-
// lingual nature of the pipeline is visually obvious at a glance.
const PIB_LANGS = [
    { code: "en", label: "English",   native: "English",   bcp47: "en-IN" },
    { code: "hi", label: "Hindi",     native: "हिन्दी",     bcp47: "hi-IN" },
    { code: "bn", label: "Bengali",   native: "বাংলা",      bcp47: "bn-IN" },
    { code: "te", label: "Telugu",    native: "తెలుగు",     bcp47: "te-IN" },
    { code: "mr", label: "Marathi",   native: "मराठी",      bcp47: "mr-IN" },
    { code: "ta", label: "Tamil",     native: "தமிழ்",      bcp47: "ta-IN" },
    { code: "ur", label: "Urdu",      native: "اردو",       bcp47: "ur-PK" },
    { code: "gu", label: "Gujarati",  native: "ગુજરાતી",    bcp47: "gu-IN" },
    { code: "ml", label: "Malayalam", native: "മലയാളം",    bcp47: "ml-IN" },
    { code: "kn", label: "Kannada",   native: "ಕನ್ನಡ",      bcp47: "kn-IN" },
];

// PIB-style sample, modelled on the original codebase's test fixture
// ("National Teachers' Award 2023"). Title + 3-4 paragraphs maps
// 1:1 to the slide structure the real video composer produced.
const SAMPLE_TITLE =
    "President of India to confer National Teachers' Award 2023 to 75 selected teachers";
const SAMPLE_BODY =
    "Smt. Droupadi Murmu will confer the National Teachers' Award 2023 to 75 selected awardees on 5th September 2023 at Vigyan Bhawan, New Delhi. The award honours teachers who have improved the quality of education and enriched the lives of their students. Each awardee receives a certificate of merit, a cash award of fifty thousand rupees, and a silver medal. This year the ambit of the award expanded to include teachers from higher education and skill development.";

const STAGE_STATUS = {
    PENDING: "pending",
    RUNNING: "running",
    DONE: "done",
    ERROR: "error",
};

// ---------- Small utilities ----------
function splitIntoSlides(body, maxSlides = 4) {
    const safe = typeof body === "string" ? body.trim() : "";
    if (!safe) return [safe || "—"];
    // The regex `(?<=[.!?])\s+` only matches Latin punctuation — for
    // languages whose script uses different terminators (e.g. Hindi
    // danda ।) the whole body falls into a single chunk, which is the
    // sensible default for the slide carousel.
    const sentences = safe
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
    if (sentences.length === 0) return [safe];
    if (sentences.length <= maxSlides) return sentences;
    // Group sentences into roughly equal slides.
    const per = Math.ceil(sentences.length / maxSlides);
    const out = [];
    for (let i = 0; i < sentences.length; i += per) {
        out.push(sentences.slice(i, i + per).join(" "));
    }
    return out;
}

function pickVoice(bcp47) {
    if (typeof window === "undefined" || !window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const lower = bcp47.toLowerCase();
    const langOnly = lower.split("-")[0];
    return (
        voices.find((v) => v.lang.toLowerCase() === lower) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(langOnly + "-")) ||
        voices.find((v) => v.lang.toLowerCase().startsWith(langOnly)) ||
        null
    );
}

async function speak(text, voice, lang) {
    if (typeof window === "undefined" || !window.speechSynthesis) {
        return { skipped: true, reason: "no speech synthesis" };
    }
    return new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        if (voice) u.voice = voice;
        u.lang = lang;
        u.rate = 0.95;
        const t0 = performance.now();
        u.onend = () =>
            resolve({
                durationMs: Math.round(performance.now() - t0),
                voiceName: voice?.name || "default",
                skipped: false,
            });
        u.onerror = (e) =>
            resolve({
                durationMs: Math.round(performance.now() - t0),
                voiceName: voice?.name || "default",
                skipped: true,
                reason: e?.error || "speech-error",
            });
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
    });
}

// ---------- Compose stage: slide carousel on Canvas ----------
//
// Mirrors what `generate_pr_video.GeneratePRVideo` produced:
//   • One slide per paragraph (real used one per image).
//   • Per slide: blurred-gradient backdrop, scaled foreground motif,
//     gradual zoom 1.0 → 1.2, fade-in/fade-out (~0.5s each).
//   • Translated title overlay at top, on a semi-transparent dark
//     backdrop (matches the real `ColorClip` + `TextClip` at y=0.05).
function startSlideShow(canvas, opts) {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const start = performance.now();
    let raf = 0;
    let stopped = false;
    const slides = opts.slides;
    const slideDurMs = opts.slideDurMs;
    const totalMs = slides.length * slideDurMs;

    function draw(now) {
        if (stopped) return;
        const elapsed = now - start;
        const overallT = Math.min(elapsed / totalMs, 1);
        const idx = Math.min(
            Math.floor(elapsed / slideDurMs),
            slides.length - 1,
        );
        const within = (elapsed - idx * slideDurMs) / slideDurMs; // 0..1
        const fade = (() => {
            // First 0.15 → fade in. Last 0.15 → fade out. Otherwise full opacity.
            if (within < 0.15) return within / 0.15;
            if (within > 0.85) return (1 - within) / 0.15;
            return 1;
        })();
        const zoom = 1 + 0.2 * within;

        // Background (blurred-gradient mimic). Per-slide hue shift.
        const hueA = (220 + idx * 40) % 360;
        const hueB = (260 + idx * 40) % 360;
        const grd = ctx.createLinearGradient(0, 0, W, H);
        grd.addColorStop(0, `hsl(${hueA}, 60%, 12%)`);
        grd.addColorStop(1, `hsl(${hueB}, 60%, 6%)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, W, H);

        // Foreground motif (rotating orbit + offset hex) standing in
        // for the scaled image clip. Zoom factor matches the
        // GradualScaleClip's 1.0 → 1.2.
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(W / 2, H / 2);
        ctx.scale(zoom, zoom);
        ctx.strokeStyle = `hsla(${(hueA + 30) % 360}, 80%, 70%, 0.7)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2 + (elapsed / 1000) * 0.4;
            const r = 140 + Math.sin((elapsed / 1000) * 1.6) * 26;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
        // Inner counter-rotating ring
        ctx.rotate(-elapsed * 0.0006);
        ctx.strokeStyle = `hsla(${(hueB + 30) % 360}, 80%, 60%, 0.55)`;
        ctx.beginPath();
        ctx.arc(0, 0, 80, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Title overlay (translated). Real used ColorClip+TextClip at y=0.05.
        const titleY = Math.round(H * 0.07);
        const title = opts.title;
        ctx.font = "bold 28px ui-sans-serif, system-ui, sans-serif";
        const measured = ctx.measureText(title).width;
        const titleBoxW = Math.min(W - 80, measured + 40);
        const titleBoxX = (W - titleBoxW) / 2;
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(titleBoxX, titleY, titleBoxW, 50);
        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(title, W / 2, titleY + 25, titleBoxW - 30);

        // Slide caption (current paragraph, big and centered)
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.font = "600 22px ui-sans-serif, system-ui, sans-serif";
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        ctx.textBaseline = "top";
        ctx.textAlign = "left";
        wrapText(ctx, slides[idx], 60, H * 0.55, W - 120, 30);
        ctx.restore();

        // Slide indicator pips + progress bar
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "13px ui-monospace, monospace";
        ctx.textAlign = "left";
        ctx.fillText(
            `slide ${idx + 1}/${slides.length}  ·  t=${(elapsed / 1000).toFixed(1)}s  ·  zoom ${zoom.toFixed(2)}×  ·  fade ${fade.toFixed(2)}`,
            40,
            H - 40,
        );
        ctx.fillStyle = "rgba(255,255,255,0.10)";
        ctx.fillRect(40, H - 18, W - 80, 4);
        ctx.fillStyle = `hsl(${(hueA + 60) % 360}, 90%, 60%)`;
        ctx.fillRect(40, H - 18, (W - 80) * overallT, 4);

        if (elapsed < totalMs) {
            raf = requestAnimationFrame(draw);
        }
    }
    raf = requestAnimationFrame(draw);
    return () => {
        stopped = true;
        cancelAnimationFrame(raf);
    };
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const safe = typeof text === "string" && text ? text : "";
    if (!safe) return;
    const words = safe.split(/\s+/);
    let line = "";
    let cy = y;
    for (let i = 0; i < words.length; i++) {
        const test = line ? line + " " + words[i] : words[i];
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, x, cy);
            cy += lineHeight;
            line = words[i];
        } else {
            line = test;
        }
    }
    if (line) ctx.fillText(line, x, cy);
}

// ---------- Translation fan-out ----------
async function translateOne(text, from, to) {
    const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, from, to }),
    });
    const json = await r.json();
    if (!r.ok || !json?.translatedText) {
        throw new Error(json?.error || `http ${r.status}`);
    }
    return { ...json, to };
}

// ---------- Main component ----------
export default function PressReleasePipeline() {
    const [title, setTitle] = useState(SAMPLE_TITLE);
    const [body, setBody] = useState(SAMPLE_BODY);
    const [primaryLang, setPrimaryLang] = useState("hi");
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);

    const [stages, setStages] = useState(() =>
        Object.fromEntries(
            STAGES.map((s) => [s.id, { status: STAGE_STATUS.PENDING }]),
        ),
    );
    const [slides, setSlides] = useState([]);
    // Per-language results: { en: { titleTr, bodyTr, ms, source }, ... }
    const [translations, setTranslations] = useState({});
    const [ttsInfo, setTtsInfo] = useState(null);
    const [distribute, setDistribute] = useState(null);

    const canvasRef = useRef(null);
    const stopAnimRef = useRef(null);

    useEffect(() => {
        // Touch getVoices to populate the list on Chromium.
        if (typeof window !== "undefined" && window.speechSynthesis) {
            window.speechSynthesis.getVoices();
            const onVoices = () => window.speechSynthesis.getVoices();
            window.speechSynthesis.addEventListener?.(
                "voiceschanged",
                onVoices,
            );
            return () => {
                window.speechSynthesis.removeEventListener?.(
                    "voiceschanged",
                    onVoices,
                );
            };
        }
    }, []);

    useEffect(
        () => () => {
            stopAnimRef.current?.();
            if (typeof window !== "undefined" && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        },
        [],
    );

    const setStage = useCallback((id, patch) => {
        setStages((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

    const run = useCallback(async () => {
        if (running) return;
        setError(null);
        setRunning(true);
        setTranslations({});
        setTtsInfo(null);
        setDistribute(null);
        setStages(
            Object.fromEntries(
                STAGES.map((s) => [s.id, { status: STAGE_STATUS.PENDING }]),
            ),
        );

        // ---- 1. Ingest ----
        setStage("ingest", { status: STAGE_STATUS.RUNNING });
        const text = body.trim();
        const titleText = title.trim();
        if (!text || !titleText) {
            setError("Title and body are both required.");
            setStage("ingest", {
                status: STAGE_STATUS.ERROR,
                detail: "empty input",
            });
            setRunning(false);
            return;
        }
        const charCount = text.length + titleText.length;
        setStage("ingest", {
            status: STAGE_STATUS.DONE,
            detail: `title=${titleText.length}c · body=${text.length}c · total=${charCount}c`,
        });

        // ---- 2. Summarize (slide split) ----
        setStage("summarize", { status: STAGE_STATUS.RUNNING });
        const t0 = performance.now();
        const slideTexts = splitIntoSlides(text, 4);
        setSlides(slideTexts);
        setStage("summarize", {
            status: STAGE_STATUS.DONE,
            detail: `${slideTexts.length} slides · ${(performance.now() - t0).toFixed(1)}ms (LLM in prod, paragraph split here)`,
        });

        // ---- 3. Translate (10 langs in parallel) ----
        setStage("translate", {
            status: STAGE_STATUS.RUNNING,
            detail: `0 / ${PIB_LANGS.length} languages`,
        });
        const tx = {};
        const tStart = performance.now();
        let done = 0;
        let warnings = 0;
        const results = await Promise.all(
            PIB_LANGS.map(async (lang) => {
                if (lang.code === "en") {
                    // Identity for English — skip the upstream hop.
                    return {
                        code: lang.code,
                        titleTr: titleText,
                        bodyTr: text,
                        ms: 0,
                        source: "identity",
                    };
                }
                try {
                    const [tt, bb] = await Promise.all([
                        translateOne(titleText, "en", lang.code),
                        translateOne(text, "en", lang.code),
                    ]);
                    if (tt.source !== "mymemory" || bb.source !== "mymemory") {
                        warnings++;
                    }
                    return {
                        code: lang.code,
                        titleTr: tt.translatedText,
                        bodyTr: bb.translatedText,
                        ms: tt.durationMs + bb.durationMs,
                        source:
                            tt.source === "mymemory" &&
                            bb.source === "mymemory"
                                ? "mymemory"
                                : "fallback",
                    };
                } catch (err) {
                    warnings++;
                    return {
                        code: lang.code,
                        titleTr: titleText,
                        bodyTr: text,
                        ms: 0,
                        source: "error",
                        warning: String(err?.message || err),
                    };
                } finally {
                    done++;
                    setStage("translate", {
                        status: STAGE_STATUS.RUNNING,
                        detail: `${done} / ${PIB_LANGS.length} languages`,
                    });
                }
            }),
        );
        for (const r of results) {
            tx[r.code] = r;
        }
        setTranslations(tx);
        const translateMs = performance.now() - tStart;
        setStage("translate", {
            status: STAGE_STATUS.DONE,
            detail: `${PIB_LANGS.length} languages in ${(translateMs / 1000).toFixed(1)}s · ${warnings} fallbacks`,
        });

        // ---- 4. TTS (selected language) ----
        const langCfg = PIB_LANGS.find((l) => l.code === primaryLang);
        const primary = tx[primaryLang];
        const voice = pickVoice(langCfg.bcp47);
        setStage("tts", {
            status: STAGE_STATUS.RUNNING,
            detail: `voice=${voice?.name || "none-local"} · lang=${langCfg.bcp47}`,
        });

        // ---- 5. Compose (canvas slideshow, kicked off concurrently with TTS) ----
        setStage("compose", {
            status: STAGE_STATUS.RUNNING,
            detail: "rendering slides…",
        });

        const slideDurMs = 4_200; // approximate per-slide; mirrors real pacing
        const totalMs = slideDurMs * slideTexts.length;
        const canvas = canvasRef.current;
        if (canvas) {
            stopAnimRef.current?.();
            // Translate the slide body per-slide too so the displayed
            // text matches the spoken language. We already have the
            // full translated body — split it into the same number of
            // slides as the English body for visual sync.
            const translatedSlides = splitIntoSlides(
                primary.bodyTr,
                slideTexts.length,
            );
            stopAnimRef.current = startSlideShow(canvas, {
                slides: translatedSlides,
                slideDurMs,
                title: primary.titleTr,
            });
        }

        const ttsRes = await speak(primary.bodyTr, voice, langCfg.bcp47);
        setTtsInfo({ ...ttsRes, lang: langCfg.bcp47 });
        setStage("tts", {
            status: ttsRes.skipped
                ? STAGE_STATUS.ERROR
                : STAGE_STATUS.DONE,
            detail: ttsRes.skipped
                ? `skipped (${ttsRes.reason}) · voice=${ttsRes.voiceName}`
                : `voice=${ttsRes.voiceName} · ${(ttsRes.durationMs / 1000).toFixed(1)}s spoken`,
        });

        // Wait for the slideshow to fully play out (or TTS, whichever
        // is longer) before marking compose done.
        await new Promise((r) =>
            setTimeout(
                r,
                Math.max(0, totalMs - (ttsRes.durationMs || 0) + 200),
            ),
        );
        setStage("compose", {
            status: STAGE_STATUS.DONE,
            detail: `Canvas ${canvas?.width}×${canvas?.height} · ${slideTexts.length} slides · zoom 1.0→1.2× · fade-in/out 0.15`,
        });

        // ---- 6. Distribute (simulated) ----
        setStage("distribute", { status: STAGE_STATUS.RUNNING });
        const prId = Math.floor(1_000_000 + Math.random() * 9_000_000);
        const fakeBucket = "synth-ai-envoys.appspot.com";
        const audioUrls = PIB_LANGS.map((l) => ({
            language: l.code,
            url: `gs://${fakeBucket}/audio/${prId}_${l.code}.mp3`,
        }));
        const videoUrl = `gs://${fakeBucket}/video/${prId}.mp4`;
        setDistribute({ prId, videoUrl, audioUrls });
        setStage("distribute", {
            status: STAGE_STATUS.DONE,
            detail: `prId=${prId} · ${audioUrls.length} audio + 1 video uploaded · FCM notify queued`,
        });

        setRunning(false);
    }, [body, primaryLang, running, setStage, title]);

    // ---------- Derived render bits ----------
    const sortedTranslations = useMemo(
        () =>
            PIB_LANGS.map((l) => ({ ...l, result: translations[l.code] })),
        [translations],
    );

    return (
        <div className="press-release-pipeline glass-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/30 font-mono text-xs">
                <span className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                </span>
                <span className="text-gray-400 flex-1 text-center">
                    synth-ai-envoys · PIB press-release pipeline
                </span>
                <span className="text-emerald-400 inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    {running ? "running" : "ready"}
                </span>
            </div>

            {/* Input row */}
            <div className="px-4 py-4 bg-[#06061a]/80 space-y-3">
                <label className="block">
                    <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                        Press-release title (English)
                    </span>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={running}
                        maxLength={200}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 font-mono text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60 disabled:opacity-60"
                    />
                </label>
                <label className="block">
                    <span className="block text-[11px] uppercase tracking-wider text-gray-500 mb-1">
                        Body (English) — paragraphs become slides
                    </span>
                    <textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={4}
                        maxLength={1500}
                        disabled={running}
                        className="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 font-mono text-[13px] text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-violet-500/60 disabled:opacity-60"
                    />
                </label>
                <div className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-gray-500">
                            Speak in
                        </span>
                        <select
                            value={primaryLang}
                            onChange={(e) => setPrimaryLang(e.target.value)}
                            disabled={running}
                            className="bg-black/40 border border-white/10 rounded-md px-2 py-1.5 font-mono text-sm text-gray-100 focus:outline-none focus:border-violet-500/60 disabled:opacity-60"
                        >
                            {PIB_LANGS.map((l) => (
                                <option key={l.code} value={l.code}>
                                    {l.label} ({l.code}) · {l.native}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="text-[11px] text-gray-500">
                        all 10 languages are translated in parallel; the
                        chosen language gets spoken via Web Speech and overlaid
                        on the rendered slides
                    </span>
                    <button
                        type="button"
                        onClick={run}
                        disabled={
                            running || !title.trim() || !body.trim()
                        }
                        className="ml-auto px-4 py-2 text-sm font-semibold rounded-md bg-violet-500/20 border border-violet-500/50 text-violet-100 hover:bg-violet-500/40 hover:border-violet-500/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {running ? "Running pipeline…" : "Run pipeline"}
                    </button>
                </div>
            </div>

            {/* Stage list + canvas */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-0 border-t border-white/5">
                <ol className="bg-[#06061a]/80 border-r border-white/5 p-4 space-y-3 font-mono text-[13px]">
                    {STAGES.map((s, i) => {
                        const st = stages[s.id];
                        return (
                            <li key={s.id} className="flex items-start gap-3">
                                <StageDot status={st.status} />
                                <div className="flex-1 min-w-0">
                                    <div
                                        className={
                                            "font-semibold " +
                                            (st.status === STAGE_STATUS.DONE
                                                ? "text-emerald-300"
                                                : st.status ===
                                                    STAGE_STATUS.RUNNING
                                                  ? "text-violet-300"
                                                  : st.status ===
                                                      STAGE_STATUS.ERROR
                                                    ? "text-rose-300"
                                                    : "text-gray-500")
                                        }
                                    >
                                        {String(i + 1).padStart(2, "0")} ·{" "}
                                        {s.label}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 break-words">
                                        {st.detail ||
                                            (st.status ===
                                            STAGE_STATUS.PENDING
                                                ? "pending"
                                                : "")}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ol>

                <div className="p-4 bg-[#02020a]/80 space-y-3">
                    <div className="aspect-video rounded-md overflow-hidden border border-white/5 bg-black/60">
                        <canvas
                            ref={canvasRef}
                            width={1280}
                            height={720}
                            className="w-full h-full"
                        />
                    </div>
                    {distribute && (
                        <div className="p-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 font-mono text-[12px] space-y-1">
                            <div className="text-emerald-300">
                                ✓ uploaded · prId={distribute.prId}
                            </div>
                            <div className="text-gray-400 break-all">
                                {distribute.videoUrl}
                            </div>
                            <div className="text-gray-500 text-[11px]">
                                + {distribute.audioUrls.length} audio tracks
                                (one per language) · FCM push notification
                                queued for ministry subscribers
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Per-language translations grid */}
            <div className="px-4 py-4 bg-[#06061a]/80 border-t border-white/5">
                <div className="text-[11px] uppercase tracking-wider text-gray-500 mb-3">
                    Translated body · 10 PIB languages
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {sortedTranslations.map((l) => {
                        const r = l.result;
                        return (
                            <div
                                key={l.code}
                                className={
                                    "p-3 rounded-md border " +
                                    (l.code === primaryLang
                                        ? "border-violet-500/60 bg-violet-500/10"
                                        : "border-white/10 bg-black/30")
                                }
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[11px] font-mono text-gray-500">
                                        {l.code}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-200">
                                        {l.native}
                                    </span>
                                    <span className="text-[11px] text-gray-600">
                                        / {l.label}
                                    </span>
                                    {r && (
                                        <span
                                            className={
                                                "ml-auto text-[10px] font-mono " +
                                                (r.source === "mymemory"
                                                    ? "text-emerald-400"
                                                    : r.source === "identity"
                                                      ? "text-gray-500"
                                                      : "text-amber-400")
                                            }
                                        >
                                            {r.source}
                                            {r.ms ? ` · ${r.ms}ms` : ""}
                                        </span>
                                    )}
                                </div>
                                <div className="text-[12px] text-gray-300 leading-relaxed line-clamp-3">
                                    {r ? r.bodyTr : "—"}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-white/5 bg-black/30 font-mono text-xs text-gray-400 flex-wrap">
                <div>
                    {slides.length
                        ? `${slides.length} slides · ${Object.keys(translations).length}/10 langs`
                        : "no run yet"}
                </div>
                <div>
                    {ttsInfo
                        ? `TTS ${ttsInfo.skipped ? "skipped" : "done"} · ${ttsInfo.voiceName || "—"}`
                        : ""}
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

function StageDot({ status }) {
    const cls =
        status === STAGE_STATUS.DONE
            ? "bg-emerald-400"
            : status === STAGE_STATUS.RUNNING
              ? "bg-violet-400"
              : status === STAGE_STATUS.ERROR
                ? "bg-rose-400"
                : "bg-gray-600";
    return (
        <span className="relative inline-flex w-2.5 h-2.5 mt-1.5">
            {status === STAGE_STATUS.RUNNING && (
                <span className="absolute inset-0 rounded-full bg-violet-400 animate-ping opacity-60" />
            )}
            <span className={`relative w-2.5 h-2.5 rounded-full ${cls}`} />
        </span>
    );
}
