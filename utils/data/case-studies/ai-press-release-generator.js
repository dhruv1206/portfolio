// Scroll-cinema chapter data for the AI-Enhanced Multilingual Press
// Release Generator (github.com/dhruv1206/synth-ai-envoys). Same
// shape as the other two case studies.

const COLORS = {
    violet: "#8b5cf6",
    cyan: "#06b6d4",
    rose: "#f43f5e",
    amber: "#f59e0b",
    emerald: "#10b981",
    slate: "#64748b",
    pink: "#f472b6",
};

export const diagramStates = {
    "the-problem": {
        caption:
            "Government press releases are text-only and English-first. The audience is a billion people across 22 official languages; the producer is a handful of typists in Delhi.",
        nodes: {
            pib: {
                x: 0.18,
                y: 0.5,
                label: "PIB releases",
                kind: "rect",
                color: COLORS.slate,
                w: 0.2,
                h: 0.36,
            },
            human: {
                x: 0.52,
                y: 0.5,
                label: "Manual translation",
                kind: "rect",
                color: COLORS.rose,
                w: 0.22,
                h: 0.36,
            },
            output: {
                x: 0.86,
                y: 0.5,
                label: "1 video / week",
                kind: "rect",
                color: COLORS.slate,
                w: 0.16,
                h: 0.3,
            },
        },
        edges: [
            { from: "pib", to: "human", animated: true, color: COLORS.rose },
            { from: "human", to: "output" },
        ],
    },

    "scraper": {
        caption:
            "A daily Selenium scraper opens pib.gov.in, walks ministries → press releases → detail pages, and writes each one into Mongo as an OriginalPressRelease.",
        nodes: {
            cron: {
                x: 0.12,
                y: 0.5,
                label: "cron · daily",
                kind: "rect",
                color: COLORS.amber,
                w: 0.16,
                h: 0.24,
            },
            scraper: {
                x: 0.4,
                y: 0.5,
                label: "scrape_pib.py · Selenium",
                kind: "rect",
                color: COLORS.violet,
                w: 0.26,
                h: 0.28,
            },
            mongo: {
                x: 0.78,
                y: 0.5,
                label: "Mongo · press_releases",
                kind: "rect",
                color: COLORS.cyan,
                w: 0.26,
                h: 0.3,
            },
        },
        edges: [
            { from: "cron", to: "scraper" },
            { from: "scraper", to: "mongo", animated: true, color: COLORS.violet },
        ],
    },

    "llm-summary": {
        caption:
            "Raw releases get rewritten by an LLM into 4-5 slide-sized paragraphs + extracted keywords for the image search.",
        nodes: {
            raw: {
                x: 0.14,
                y: 0.5,
                label: "OriginalPressRelease",
                kind: "rect",
                color: COLORS.slate,
                w: 0.22,
                h: 0.26,
            },
            llm: {
                x: 0.5,
                y: 0.5,
                label: "DescriptiveContentGenerator (GPT)",
                kind: "rect",
                color: COLORS.violet,
                w: 0.32,
                h: 0.34,
            },
            slides: { x: 0.84, y: 0.32, label: "descriptive_text[]", kind: "small", color: COLORS.amber },
            keywords: { x: 0.84, y: 0.68, label: "key_words[]", kind: "small", color: COLORS.amber },
        },
        edges: [
            { from: "raw", to: "llm", animated: true, color: COLORS.violet },
            { from: "llm", to: "slides" },
            { from: "llm", to: "keywords" },
        ],
    },

    "translate-fanout": {
        caption:
            "googletrans + gTTS run in parallel for ten languages — English, Hindi, Bengali, Telugu, Marathi, Tamil, Urdu, Gujarati, Malayalam, Kannada. One MP3 per language per release.",
        nodes: {
            src: {
                x: 0.14,
                y: 0.5,
                label: "summary text",
                kind: "rect",
                color: COLORS.slate,
                w: 0.18,
                h: 0.24,
            },
            translate: {
                x: 0.42,
                y: 0.5,
                label: "googletrans + gTTS",
                kind: "rect",
                color: COLORS.violet,
                w: 0.24,
                h: 0.3,
            },
            mEn: { x: 0.78, y: 0.08, label: "en", kind: "small", color: COLORS.amber },
            mHi: { x: 0.78, y: 0.2, label: "hi", kind: "small", color: COLORS.amber },
            mBn: { x: 0.78, y: 0.32, label: "bn", kind: "small", color: COLORS.amber },
            mTe: { x: 0.78, y: 0.44, label: "te", kind: "small", color: COLORS.amber },
            mMr: { x: 0.78, y: 0.56, label: "mr", kind: "small", color: COLORS.amber },
            mTa: { x: 0.78, y: 0.68, label: "ta", kind: "small", color: COLORS.amber },
            mUr: { x: 0.78, y: 0.8, label: "ur", kind: "small", color: COLORS.amber },
            mGu: { x: 0.92, y: 0.32, label: "gu", kind: "small", color: COLORS.amber },
            mMl: { x: 0.92, y: 0.5, label: "ml", kind: "small", color: COLORS.amber },
            mKn: { x: 0.92, y: 0.68, label: "kn", kind: "small", color: COLORS.amber },
        },
        edges: [
            { from: "src", to: "translate", animated: true, color: COLORS.violet },
            { from: "translate", to: "mEn" },
            { from: "translate", to: "mHi" },
            { from: "translate", to: "mBn" },
            { from: "translate", to: "mTe" },
            { from: "translate", to: "mMr" },
            { from: "translate", to: "mTa" },
            { from: "translate", to: "mUr" },
            { from: "translate", to: "mGu" },
            { from: "translate", to: "mMl" },
            { from: "translate", to: "mKn" },
        ],
    },

    "compose": {
        caption:
            "MoviePy stitches the slides — for each image: blurred backdrop + scaled foreground with a 1.0→1.2× zoom, 1-second fade in / out, translated title overlaid at y=0.05. Audio length drives slide duration.",
        nodes: {
            imgs: {
                x: 0.18,
                y: 0.3,
                label: "scraped images",
                kind: "rect",
                color: COLORS.slate,
                w: 0.22,
                h: 0.22,
            },
            tts: {
                x: 0.18,
                y: 0.65,
                label: "per-lang MP3",
                kind: "rect",
                color: COLORS.amber,
                w: 0.22,
                h: 0.22,
            },
            compose: {
                x: 0.52,
                y: 0.5,
                label: "MoviePy timeline (zoom + fade + title)",
                kind: "rect",
                color: COLORS.violet,
                w: 0.34,
                h: 0.36,
            },
            mp4: {
                x: 0.86,
                y: 0.5,
                label: "MP4 · 1920×1080",
                kind: "rect",
                color: COLORS.emerald,
                w: 0.2,
                h: 0.3,
            },
        },
        edges: [
            { from: "imgs", to: "compose" },
            { from: "tts", to: "compose" },
            { from: "compose", to: "mp4", animated: true, color: COLORS.emerald },
        ],
    },

    "distribute": {
        caption:
            "Final MP4 + ten audio tracks land in Firebase Storage. FCM pushes a notification to every subscriber of that ministry. A daily run produces ~30 videos at 45 % less time than manual production.",
        nodes: {
            mp4: {
                x: 0.18,
                y: 0.5,
                label: "MP4 + 10 MP3s",
                kind: "rect",
                color: COLORS.emerald,
                w: 0.2,
                h: 0.3,
            },
            firebase: {
                x: 0.5,
                y: 0.5,
                label: "Firebase Storage",
                kind: "rect",
                color: COLORS.amber,
                w: 0.22,
                h: 0.3,
            },
            fcm: { x: 0.82, y: 0.3, label: "FCM push", kind: "small", color: COLORS.violet },
            users: { x: 0.82, y: 0.7, label: "mobile users", kind: "small", color: COLORS.slate },
        },
        edges: [
            { from: "mp4", to: "firebase", animated: true, color: COLORS.emerald },
            { from: "firebase", to: "fcm" },
            { from: "fcm", to: "users", animated: true, color: COLORS.violet },
        ],
    },

    "try-it": {
        caption: "Run the same six-stage pipeline in your browser. Translation goes through `/api/translate`, speech through `/api/tts`, composition paints on Canvas.",
        nodes: {},
        edges: [],
    },
};

export const chapters = [
    {
        id: "the-problem",
        eyebrow: "01 · The constraint",
        title: "A billion-person audience, a Hindi-only output pipe",
        diagramState: "the-problem",
        body: [
            "The Press Information Bureau publishes 200-odd statements a day across 50+ ministries. The English text reaches the press; the actual audience — including the ~70 % of India that doesn't read English comfortably — is served by manual translators producing a trickle of videos for one or two regional languages.",
            "The throughput gap was the bottleneck this project attacks: not the writing, the *delivery* of writing as a watchable, listenable artefact in every official language the citizen actually speaks.",
        ],
    },
    {
        id: "scraper",
        eyebrow: "02 · Ingestion",
        title: "A Selenium walker pulls the daily docket",
        diagramState: "scraper",
        body: [
            "`scrape_pib.py` opens `pib.gov.in/allRel.aspx` headless, picks today's date, and walks the DOM: ministries → press-release lists → detail pages. Each detail page yields a title, a body, and a list of inline image URLs.",
            "The output is an `OriginalPressRelease` per item, written into MongoDB keyed by the upstream PRID. Re-running the scraper is idempotent — PRIDs already in Mongo are skipped before any AI cost is spent.",
        ],
    },
    {
        id: "llm-summary",
        eyebrow: "03 · Summarise",
        title: "GPT turns paragraphs into slide-sized chunks (and image keywords)",
        diagramState: "llm-summary",
        body: [
            "Raw press releases are long, dense, and not built for a 30-second video. `DescriptiveContentGenerator` prompts GPT for two things: a list of paragraph-per-slide summaries (≤2000 total chars) and a list of image-search keywords pulled from the news.",
            "The keyword list is the bridge to step 4 — `scrape_images.py` queries Bing for each keyword and merges the results into the same `DescriptiveContent` record. Slides + relevant images, ready for compose.",
        ],
        code: {
            file: "Models/DescriptiveContent.py",
            lang: "python",
            highlight: [5, 10],
            snippet: `prompt = f"""Given the press release: "{pr.content}",
generate more descriptive and summarized content...

Result fields:
  descriptive_text: list[str]  # one paragraph per slide
  key_words:        list[str]  # 5-10 image-search terms
  language:         "english"
The sum of all descriptive_text chars must not exceed 2000.
Output JSON only."""
response = MetaAI().prompt(prompt)`,
        },
    },
    {
        id: "translate-fanout",
        eyebrow: "04 · Multilingual fan-out",
        title: "10 languages in parallel · googletrans + gTTS",
        diagramState: "translate-fanout",
        body: [
            "`convert_to_speech_in_multiple_languages(prId, joined_text, languages)` runs `googletrans` for each target language (en, hi, bn, te, mr, ta, ur, gu, ml, kn), then `gTTS` to render an MP3 per language. The 10 audio files land on disk keyed by `{prId}_output_{lang}.mp3`.",
            "Same upstream the browser demo uses — `/api/tts` proxies Google's translate_tts endpoint to mirror gTTS's behaviour, and `/api/translate` proxies MyMemory because Google Translate's free API has a stricter quota.",
        ],
        code: {
            file: "text_to_voice.py",
            lang: "python",
            highlight: [6, 8],
            snippet: `def convert_to_speech_in_multiple_languages(prId, phrase, languages):
    translator = Translator()
    for lang in languages:
        try:
            translated = translator.translate(phrase, dest=lang).text
            tts = gTTS(text=translated, lang=lang)
            tts.save(f"{prId}_output_{lang}.mp3")
        except Exception as e:
            print(f"Error :{e} for language:{lang}")`,
        },
    },
    {
        id: "compose",
        eyebrow: "05 · Compose",
        title: "MoviePy: zoom + blur + fade · title overlay at y=0.05",
        diagramState: "compose",
        body: [
            "`generate_pr_video.GeneratePRVideo` is the heavy hitter. For each image: a blurred background clip, a foreground clip scaled to 1.0 → 1.2× over the slide via the custom `GradualScaleClip`, 1 s `fadein` + `fadeout`. The translated title sits on a semi-transparent dark box at `y_pct=0.05`. Slide duration = audio length ÷ image count.",
            "Final clip is concatenated, audio attached, written out as `{prId}.mp4` at 1920×1080 / 30 fps via libx264. The browser demo paints the same effects (zoom, fade, title overlay) onto Canvas frame-by-frame instead of MoviePy.",
        ],
        code: {
            file: "generate_pr_video.py",
            lang: "python",
            highlight: [3, 6],
            snippet: `image_clip = VideoFileClip(image_file, audio=False)
image_clip = image_clip.resize(scaling_factor)
scaled_clip = GradualScaleClip(
    image_clip, zoom_factor=1.2,
    duration=duration_per_image, target_fps=video_fps)
fade_in_clip  = fadein(scaled_clip, duration=1)
fade_out_clip = fadeout(scaled_clip, duration=1)
text_line = TextClip(translator.translate(pr.title, dest=lan).text,
                     font="Segoe-UI", fontsize=40, color="white")`,
        },
    },
    {
        id: "distribute",
        eyebrow: "06 · Distribute",
        title: "Firebase Storage + FCM · 45 % less production time",
        diagramState: "distribute",
        body: [
            "Output MP4 and the ten MP3s go to Firebase Storage under `gs://synth-ai-envoys.appspot.com/`. Each new `DescriptiveContent` triggers an FCM push to every user subscribed to that ministry — `title: \"New Press Release\"`, body and thumbnail derived from the record.",
            "Net effect on the production team: ~30 videos a day, ten languages each, with the human only intervening for moderation. The 45 % time reduction and 35 % throughput lift in the project description come from this stage replacing all of the previous manual work.",
        ],
    },
    {
        id: "try-it",
        eyebrow: "07 · Try it",
        title: "Run the six stages in your browser",
        diagramState: "try-it",
        demoSlot: "ai-press-release-generator",
        body: [
            "Paste a press-release-style paragraph below. The pipeline runs the same shape as the Flask service — ingest, summarise (paragraph-split here, LLM in prod), translate to all 10 languages in parallel via `/api/translate`, speak the chosen language via `/api/tts` (gTTS upstream), compose a Canvas slideshow with the same zoom + fade + title overlay MoviePy produced, then a simulated upload.",
        ],
    },
];
