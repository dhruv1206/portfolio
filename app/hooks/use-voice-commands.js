"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { ACTION_SCRIPTS, PROJECT_SCRIPTS } from "./use-system-voice";
import { useFeatureSupport } from "./use-feature-support";
import { eventBus } from "@/app/lib/event-bus";

// ============================================================================
// STOP WORDS & NORMALIZATION
// ============================================================================

const STOP_WORDS = new Set([
    "please", "can", "you", "would", "could", 
    "the", "a", "an", "to", "me", "my", "website", "page", "section",
    "okay", "ok", "um", "uh", "like", "just", "maybe", "actually",
    "i", "want", "need", "let", "lets", "bring", "do", "does", "have",
    "any", "some", "your", "their", "what", "where", "how", "is", "are",
]);

const GREETING_TOKENS = new Set(["hello", "hi", "hey", "greetings", "morning", "afternoon", "evening"]);

const STEMS = {
    scrolling: "scroll", scrolled: "scroll", scrolls: "scroll",
    projects: "project", skills: "skill", showing: "show",
    homes: "home", contacts: "contact", educations: "education",
    experiences: "experience", working: "work", hiring: "hire",
    located: "location", based: "location", lived: "live",
};

function normalizeTranscript(text) {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .map(word => STEMS[word] || word)
        .filter(word => !STOP_WORDS.has(word))
        .join(" ");
}

// ============================================================================
// PROJECT FINGERPRINTS (Entity Recognition)
// ============================================================================

const PROJECT_FINGERPRINTS = {
    // DStarDB
    dstardb: {
        slug: "dstardb",
        synonyms: ["database", "redis", "in-memory", "dstar", "multithreaded", "cache"],
        techs: ["c++", "cmake", "threading"],
    },
    // Real-Time Collaboration
    "realtime-collaboration": {
        slug: "realtime-collaboration",
        synonyms: ["meeting", "video call", "video chat", "zoom", "collaboration", "webrtc", "real-time", "realtime"],
        techs: ["spring", "websocket", "webrtc", "microservices"],
    },
    // AI Press Release
    "ai-press-release-generator": {
        slug: "ai-press-release-generator",
        synonyms: ["ai", "press release", "video generator", "multilingual", "pib", "government"],
        techs: ["python", "flask", "ai", "ml"],
    },
    // College Attendance
    "college-attendance-app": {
        slug: "college-attendance-app",
        synonyms: ["attendance", "college", "lnct", "university", "student"],
        techs: ["flutter", "node", "firebase"],
    },
    // Amazon Clone
    "amazon-clone": {
        slug: "amazon-clone",
        synonyms: ["amazon", "ecommerce", "shopping", "cart", "checkout", "payment"],
        techs: ["flutter", "node", "mongodb", "express"],
    },
    // WhatsApp Clone
    "whatsapp-clone": {
        slug: "whatsapp-clone",
        synonyms: ["whatsapp", "chat", "messaging", "call", "status"],
        techs: ["flutter", "firebase", "riverpod"],
    },
};

// Tech stack keywords for filtering
const TECH_KEYWORDS = {
    "c++": ["c++", "cpp", "cplusplus"],
    python: ["python", "py"],
    java: ["java", "spring", "springboot"],
    go: ["go", "golang"],
    flutter: ["flutter", "dart"],
    react: ["react", "reactjs", "next", "nextjs"],
    node: ["node", "nodejs", "express"],
    typescript: ["typescript", "ts"],
    javascript: ["javascript", "js"],
    kotlin: ["kotlin"],
    mongodb: ["mongodb", "mongo"],
    postgres: ["postgres", "postgresql"],
    redis: ["redis"],
    docker: ["docker", "kubernetes", "k8s"],
    aws: ["aws", "amazon web services"],
    gcp: ["gcp", "google cloud"],
    firebase: ["firebase"],
};

// ============================================================================
// HELP DESK HEURISTICS (Meta-questions)
// ============================================================================

const HELP_PATTERNS = {
    general: [/help/i, /what can you do/i, /guide me/i, /stuck/i, /commands/i],
    scroll: [/how.*(scroll|navigate)/i],
    projects: [/how.*(projects|show)/i, /find.*(project|work)/i],
    contact: [/how.*(contact|reach|hire)/i],
    talk: [/talk to you/i, /speak to you/i, /can we talk/i],
    creator: [/who made/i, /who built/i, /who created/i, /who is/i],
};

const HELP_RESPONSES = {
    general: "I am the voice navigation assistant. You can ask me to show projects, scroll the page, or contact the developer. Try saying: show me the database project.",
    scroll: "You can scroll manually, or tell me to scroll down, scroll up, or go to the bottom.",
    projects: "Say show projects to see all work. Or name a technology like show C++ projects.",
    contact: "Say contact or how do I hire you to reach the contact section.",
    talk: "Affirmative. I am listening for navigation commands and project queries.",
    creator: "This system was engineered by Dhruv Agrawal, using Next.js and WebGL.",
};

// ============================================================================
// KNOWLEDGE BASE (FAQ Responses)
// ============================================================================

const KNOWLEDGE_BASE = [
    {
        patterns: [/where.*(live|located|based|location)/i, /^location$/i],
        response: "I am currently based in India, open to remote work globally.",
    },
    {
        patterns: [/experience/i, /how long.*(working|coding)/i, /years/i],
        response: "I am a Software Engineer with experience at MyRik, CarWale, and JioHotstar, building systems serving 150K+ users.",
    },
    {
        patterns: [/university|college|degree|study|graduate/i],
        response: "I graduated from LNCT Bhopal with a B.Tech in Computer Science, Class of 2025.",
    },
    {
        patterns: [/strongest|best|favorite.*(language|skill|tech)/i],
        response: "My core strengths are Backend Engineering with Java/Spring Boot, System Design, and C++ for high-performance systems.",
    },
    {
        patterns: [/available|free|hire|freelance|remote/i],
        response: "Yes! I am open to full-time roles and exciting opportunities. Let's connect!",
    },
    {
        patterns: [/email|mail|contact.*(info|details)/i],
        response: "My email is agrawaldhruv1006@gmail.com. You can also use the contact form!",
    },
    {
        patterns: [/leetcode|competitive|coding|dsa|algorithm/i],
        response: "I have solved 1000+ DSA problems and achieved LeetCode Knight rating (1870+).",
    },
    {
        patterns: [/who.*(are|is)|about yourself|introduce/i],
        response: "I'm Dhruv Agrawal, a Software Engineer specializing in Backend Systems and Cloud Architecture.",
    },
];

// ============================================================================
// PROBLEM STATEMENT MAPPINGS
// ============================================================================

const PROBLEM_MAPPINGS = [
    {
        patterns: [/hire|hiring|job|work with/i],
        action: "go-contact-focus",
        response: "Let's discuss opportunities! Here's my contact form.",
    },
    {
        patterns: [/expensive|rate|cost|pricing|charge/i],
        action: "go-contact-inquiry",
        response: "Let's discuss your project requirements.",
    },
    {
        patterns: [/code|source|github|repo/i],
        action: "open-github",
        response: "Opening GitHub profile...",
    },
    {
        patterns: [/bright|dark|light|theme|mode/i],
        action: "toggle-theme",
        response: "Theme toggled!",
    },
];

// ============================================================================
// NAVIGATION INTENTS
// ============================================================================

const INTENT_TOKENS = [
    { tokens: ["project", "all"], action: "show-projects", priority: 10 },
    { tokens: ["project", "backend"], action: "filter-backend", priority: 15 },
    { tokens: ["project", "frontend"], action: "filter-frontend", priority: 15 },
    { tokens: ["project"], action: "show-projects", priority: 5 },
    { tokens: ["contact"], action: "go-contact", priority: 10 },
    { tokens: ["control", "room"], action: "go-room", priority: 15 },
    { tokens: ["room"], action: "go-room", priority: 8 },
    { tokens: ["lab"], action: "go-lab", priority: 12 },
    { tokens: ["experiment"], action: "go-lab", priority: 10 },
    { tokens: ["recruiter"], action: "go-recruiter", priority: 12 },
    { tokens: ["resume"], action: "go-recruiter", priority: 8 },
    { tokens: ["blog"], action: "go-blog", priority: 10 },
    { tokens: ["article"], action: "go-blog", priority: 8 },
    { tokens: ["home", "top"], action: "go-home", priority: 10 },
    { tokens: ["home"], action: "go-home", priority: 5 },
    { tokens: ["about"], action: "go-about", priority: 10 },
    { tokens: ["skill"], action: "go-skills", priority: 10 },
    { tokens: ["experience", "work"], action: "go-experience", priority: 10 },
    { tokens: ["experience"], action: "go-experience", priority: 5 },
    { tokens: ["education"], action: "go-education", priority: 10 },
    { tokens: ["scroll", "down", "lot"], action: "scroll-down-lot", priority: 15 },
    { tokens: ["scroll", "down", "more"], action: "scroll-down-lot", priority: 15 },
    { tokens: ["scroll", "down", "little"], action: "scroll-down-little", priority: 15 },
    { tokens: ["scroll", "up", "lot"], action: "scroll-up-lot", priority: 15 },
    { tokens: ["scroll", "up", "little"], action: "scroll-up-little", priority: 15 },
    { tokens: ["scroll", "bottom"], action: "scroll-bottom", priority: 15 },
    { tokens: ["scroll", "top"], action: "scroll-top", priority: 15 },
    { tokens: ["scroll", "down"], action: "scroll-down", priority: 10 },
    { tokens: ["scroll", "up"], action: "scroll-up", priority: 10 },
    { tokens: ["down"], action: "scroll-down", priority: 3 },
    { tokens: ["up"], action: "scroll-up", priority: 3 },
    { tokens: ["stop", "listening"], action: "stop", priority: 20 },
    { tokens: ["stop"], action: "stop", priority: 10 },
    { tokens: ["copy", "email"], action: "copy-email", priority: 15 },
];

// ============================================================================
// SCROLL AMOUNTS
// ============================================================================

const SCROLL_AMOUNTS = {
    "scroll-down": 500, "scroll-up": -500,
    "scroll-down-little": 300, "scroll-up-little": -300,
    "scroll-down-lot": 800, "scroll-up-lot": -800,
};

// ============================================================================
// ERROR MESSAGES
// ============================================================================

const ERROR_MESSAGES = {
    "not-allowed": { type: "critical", message: "Microphone access denied. Check browser settings.", shouldRestart: false },
    "no-speech": { type: "minor", message: "No speech detected. Try again.", shouldRestart: true },
    "network": { type: "critical", message: "Network error. Voice commands require internet.", shouldRestart: false },
    "aborted": { type: "info", message: null, shouldRestart: false },
    "audio-capture": { type: "critical", message: "No microphone found.", shouldRestart: false },
};

// ============================================================================
// VOICE COMMANDS MINI-AGENT HOOK
// ============================================================================

export function useVoiceCommands() {
    const router = useRouter();
    
    // Core state
    const isSupported = useFeatureSupport(
        () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    );
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState("");
    const [lastCommand, setLastCommand] = useState(null);
    
    // Granular UI states
    const [processing, setProcessing] = useState(false);
    const [matchSuccess, setMatchSuccess] = useState(false);
    const [matchFailed, setMatchFailed] = useState(false);
    const [error, setError] = useState(null);
    const [agentResponse, setAgentResponse] = useState(null);
    
    // Refs
    const recognitionRef = useRef(null);
    const targetStateRef = useRef("IDLE");
    const lastErrorTimeRef = useRef(0);
    const commandCooldownRef = useRef(false);
    const previousContextRef = useRef(null); // For correction handling
    const actionQueueRef = useRef([]); // For combo commands
    const ttsCallbacksRef = useRef({ onSpeak: null, onSpeakEnd: null }); // TTS integration
    const isPausedForTTSRef = useRef(false); // Echo prevention
    // Holds the latest stopListening callback so executeAction can call
    // it without hitting the TDZ for the const binding declared further
    // down in this hook. Mirrored in an effect at the bottom.
    const stopListeningRef = useRef(null);
    
    // Constants
    const CONFIDENCE_THRESHOLD = 0.6;
    const COMMAND_COOLDOWN_MS = 500;
    const COMBO_DELAY_MS = 600;

    // ========================================================================
    // ENTITY EXTRACTION
    // ========================================================================
    
    const extractProjectEntity = useCallback((text) => {
        const lower = text.toLowerCase();
        
        for (const [key, fingerprint] of Object.entries(PROJECT_FINGERPRINTS)) {
            for (const synonym of fingerprint.synonyms) {
                if (lower.includes(synonym)) {
                    return fingerprint.slug;
                }
            }
        }
        return null;
    }, []);

    const extractTechStack = useCallback((text) => {
        const lower = text.toLowerCase();
        const detectedTechs = [];
        
        for (const [tech, keywords] of Object.entries(TECH_KEYWORDS)) {
            for (const keyword of keywords) {
                if (lower.includes(keyword)) {
                    detectedTechs.push(tech);
                    break;
                }
            }
        }
        return detectedTechs;
    }, []);

    // ========================================================================
    // KNOWLEDGE BASE LOOKUP
    // ========================================================================
    
    const lookupKnowledgeBase = useCallback((text) => {
        for (const entry of KNOWLEDGE_BASE) {
            for (const pattern of entry.patterns) {
                if (pattern.test(text)) {
                    return entry.response;
                }
            }
        }
        return null;
    }, []);

    // ========================================================================
    // PROBLEM STATEMENT MAPPING
    // ========================================================================
    
    const matchProblemStatement = useCallback((text) => {
        for (const mapping of PROBLEM_MAPPINGS) {
            for (const pattern of mapping.patterns) {
                if (pattern.test(text)) {
                    return mapping;
                }
            }
        }
        return null;
    }, []);

    // ========================================================================
    // INTENT MATCHING
    // ========================================================================
    
    const matchIntent = useCallback((normalizedText) => {
        const words = new Set(normalizedText.split(/\s+/));
        
        let bestMatch = null;
        let bestScore = 0;
        
        for (const intent of INTENT_TOKENS) {
            const matchedTokens = intent.tokens.filter(t => words.has(t));
            const score = (matchedTokens.length / intent.tokens.length) * intent.priority;
            
            if (matchedTokens.length === intent.tokens.length && score > bestScore) {
                bestScore = score;
                bestMatch = intent.action;
            }
        }
        
        return bestMatch;
    }, []);

    // ========================================================================
    // CORRECTION HANDLING
    // ========================================================================
    
    const handleCorrection = useCallback((text, normalized) => {
        const hasNegation = /^no\b|^not\b|^wrong\b|^actually\b|^instead\b/i.test(text);
        
        if (hasNegation && previousContextRef.current) {
            // Check if switching filter
            if (previousContextRef.current.includes("backend") && normalized.includes("frontend")) {
                return "filter-frontend";
            }
            if (previousContextRef.current.includes("frontend") && normalized.includes("backend")) {
                return "filter-backend";
            }
        }
        
        return null;
    }, []);

    // ========================================================================
    // GREETING HANDLER (The Handshake)
    // ========================================================================

    const handleGreeting = useCallback((text) => {
        const lower = text.toLowerCase();
        
        // Scenario D: Identity Greeting (Jarvis/System/Dhruv)
        if (/hello.*(jarvis|system|bot|computer|dhruv)/i.test(lower) || /hey.*(jarvis|system|bot|computer|dhruv)/i.test(lower) || /hi.*(jarvis|system|bot|computer|dhruv)/i.test(lower)) {
            return { 
                response: "Hello. I am the interactive portfolio agent. Accessing Dhruv's archives.",
                toast: "Hello! I am your interactive agent.",
                action: "identity-greeting"
            };
        }

        // Scenario B: Temporal Awareness
        const timeMatch = lower.match(/good\s*(morning|afternoon|evening)/i);
        if (timeMatch) {
            const hour = new Date().getHours();
            const userTime = timeMatch[1];
            let isMatch = false;

            if (userTime === "morning" && hour < 12) isMatch = true;
            else if (userTime === "afternoon" && hour >= 12 && hour < 17) isMatch = true;
            else if (userTime === "evening" && hour >= 17) isMatch = true;

            if (isMatch) {
                return { response: `Good ${userTime}. Systems ready.`, action: "temporal-greeting" };
            } else {
                // Context Mismatch (High Intelligence)
                const actualTime = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
                return { 
                    response: `It is actually ${actualTime} here, but hello. Systems ready.`, 
                    action: "temporal-mismatch" 
                };
            }
        }

        // Scenario A: Mic Check / Standalone Greeting
        // Logic: Input length < 4 words AND contains greeting token
        // OR "can you hear me" / "are you there"
        const words = lower.split(/\s+/);
        const hasGreeting = words.some(w => GREETING_TOKENS.has(w));
        
        if ((hasGreeting && words.length <= 3) || lower.includes("hear me") || lower.includes("are you there")) {
             return { 
                 response: "Online and listening. How can I help you navigate?", 
                 toast: "Try saying: Show me backend projects",
                 action: "mic-check" 
             };
        }

        return null;
    }, []);

    // ========================================================================
    // COMBO COMMAND PARSING
    // ========================================================================
    
    const parseComboCommand = useCallback((text) => {
        // Split by "and" or "then"
        const parts = text.split(/\s+(?:and|then)\s+/i).filter(p => p.trim());
        return parts.length > 1 ? parts : null;
    }, []);

    // ========================================================================
    // EXECUTE ACTION
    // ========================================================================
    
    const executeAction = useCallback((action, originalText, response = null) => {
        setError(null);
        setMatchSuccess(true);
        setMatchFailed(false);
        setLastCommand({ text: originalText, action });
        previousContextRef.current = action;
        // Announce this on the event bus so the system-architecture
        // overlay can light up the matching edge (voice → intent →
        // router). Fire-and-forget — no listeners == no cost.
        eventBus.emit("voice:intent", { action, transcript: originalText });
        
        // Auto-lookup response from scripts if not provided
        let displayText = response;
        if (!displayText) {
            // Check for project-specific action
            if (action.startsWith("project:")) {
                const slug = action.replace("project:", "");
                displayText = PROJECT_SCRIPTS[slug] || `Opening ${slug} project.`;
            } 
            // Check for tech filter action
            else if (action.startsWith("filter-tech:")) {
                const tech = action.replace("filter-tech:", "");
                displayText = `Filtering ${tech} projects.`;
            }
            // Standard action scripts
            else {
                displayText = ACTION_SCRIPTS[action] || null;
            }
        }
        
        // Always set agentResponse for HUD display
        if (displayText) {
            setAgentResponse(displayText);
        }
        
        setTimeout(() => setMatchSuccess(false), 2000);
        // REMOVED: setTimeout(() => setAgentResponse(null), 4000); - Let text persist
        
        commandCooldownRef.current = true;
        setTimeout(() => { commandCooldownRef.current = false; }, COMMAND_COOLDOWN_MS);
        
        // The homepage is six stages: #s0 name, #s1 people, #s2 systems,
        // #s3 machines, #s4 stack, #s5 contact. Other targets are routes.
        const goStage = (id) => {
            if (window.location.pathname !== "/") router.push(`/#${id}`);
            else document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
        };
        const focusIn = (selector, prefill) => setTimeout(() => {
            const el = document.querySelector(selector);
            if (!el) return;
            el.focus();
            if (prefill && !el.value) el.value = prefill;
        }, window.location.pathname === "/" ? 500 : 900);
        switch (action) {
            case "filter-backend":
            case "filter-frontend":
            case "show-projects":
                router.push("/projects");
                break;
            case "go-contact":
                goStage("s5");
                break;
            case "go-contact-focus":
                goStage("s5");
                focusIn('#s5 input[name="name"]');
                break;
            case "go-contact-inquiry":
                goStage("s5");
                focusIn('#s5 textarea[name="message"]', "Project inquiry: ");
                break;
            case "go-home":
                if (window.location.pathname !== "/") router.push("/");
                else window.scrollTo({ top: 0, behavior: "smooth" });
                break;
            case "go-about":
                goStage("s1");
                break;
            case "go-skills":
                goStage("s4");
                break;
            case "go-experience":
                goStage("s2");
                break;
            case "go-education": {
                const footer = document.querySelector("footer");
                if (footer) footer.scrollIntoView({ behavior: "smooth" });
                else router.push("/");
                break;
            }
            case "go-room":
                router.push("/room");
                break;
            case "go-lab":
                router.push("/lab");
                break;
            case "go-recruiter":
                router.push("/r");
                break;
            case "go-blog":
                router.push("/blog");
                break;
            case "scroll-bottom":
                window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
                break;
            case "scroll-top":
                window.scrollTo({ top: 0, behavior: "smooth" });
                break;
            case "scroll-down":
            case "scroll-up":
            case "scroll-down-little":
            case "scroll-up-little":
            case "scroll-down-lot":
            case "scroll-up-lot":
                window.scrollBy({ top: SCROLL_AMOUNTS[action], behavior: "smooth" });
                break;
            case "open-github":
                window.open("https://github.com/dhruv1206", "_blank");
                break;
            case "toggle-theme":
                toast.info("This site has one theme.");
                break;
            case "copy-email":
                navigator.clipboard.writeText("agrawaldhruv1006@gmail.com");
                toast.success("Email copied to clipboard!");
                break;
            case "stop":
                // stopListening is defined further down in this hook;
                // accessing it directly would hit the TDZ for the const
                // binding. The latest reference is mirrored to a ref
                // (see effect below the stopListening definition).
                stopListeningRef.current?.();
                // Auto-dismiss HUD after 3 seconds
                setTimeout(() => setAgentResponse(null), 3000);
                break;
            default:
                if (action.startsWith("project:")) {
                    const slug = action.replace("project:", "");
                    router.push(`/projects/${slug}`);
                } else if (action.startsWith("filter-tech:")) {
                    router.push("/projects");
                }
        }
    }, [router]);

    // ========================================================================
    // EXECUTE COMBO ACTIONS
    // ========================================================================
    
    const executeComboActions = useCallback((actions) => {
        actions.forEach((action, index) => {
            setTimeout(() => {
                executeAction(action.action, action.text, action.response);
            }, index * COMBO_DELAY_MS);
        });
    }, [executeAction]);

    // ========================================================================
    // PROCESS COMMAND (Main Intelligence)
    // ========================================================================
    
    const processCommand = useCallback((text, confidence) => {
        if (confidence < CONFIDENCE_THRESHOLD) {
            setError({ type: "minor", message: "I didn't catch that. Try again." });
            return;
        }
        
        if (commandCooldownRef.current) return;
        
        const normalized = normalizeTranscript(text);
        console.debug(`[Agent] Input: "${text}" -> Normalized: "${normalized}"`);

        // 0. Check for Greetings (The Handshake)
        const greetingAction = handleGreeting(text);
        if (greetingAction) {
            setLastCommand(null); // CRITICAL: Clear last command so it doesn't get repeated
            setAgentResponse(greetingAction.response);
            setMatchSuccess(true);
            // HUD handles visualization now
            ttsCallbacksRef.current?.onSpeak?.(greetingAction.response, 'greeting');
            
            setTimeout(() => {
                 setMatchSuccess(false);
                 // Agent response persists until next command
            }, 4000);
            return;
        }
        
        // 1. Check for combo commands
        const comboParts = parseComboCommand(text);
        if (comboParts && comboParts.length > 1) {
            const actions = comboParts.map(part => {
                const partNorm = normalizeTranscript(part);
                const intent = matchIntent(partNorm);
                return intent ? { action: intent, text: part } : null;
            }).filter(Boolean);
            
            if (actions.length > 1) {
                toast.info(`Executing ${actions.length} commands...`);
                executeComboActions(actions);
                return;
            }
        }
        
        // 2. Check for corrections
        const correctionAction = handleCorrection(text, normalized);
        if (correctionAction) {
            executeAction(correctionAction, text, "Switching filter...");
            return;
        }
        
        // 3. Extract project entity
        const projectSlug = extractProjectEntity(text);
        if (projectSlug) {
            executeAction(`project:${projectSlug}`, text, `Opening ${projectSlug} project...`);
            return;
        }
        
        // 4. Extract tech stack for filtering
        const techs = extractTechStack(text);
        if (techs.length > 0 && (text.includes("show") || text.includes("filter") || text.includes("work"))) {
            executeAction(`filter-tech:${techs[0]}`, text, `Filtering projects by ${techs[0]}...`);
            return;
        }
        
        // 5. Check problem statement mappings
        const problemMapping = matchProblemStatement(text);
        if (problemMapping) {
            executeAction(problemMapping.action, text, problemMapping.response);
            return;
        }
        
        // 6. Standard intent matching
        const intent = matchIntent(normalized);
        if (intent) {
            executeAction(intent, text);
            return;
        }
        
        // 7. Help desk heuristics
        for (const [topic, patterns] of Object.entries(HELP_PATTERNS)) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    const helpResponse = HELP_RESPONSES[topic];
                    setLastCommand(null); // Clear stale command
                    setAgentResponse(helpResponse);
                    setMatchSuccess(true);
                    // HUD handles visualization now
                    ttsCallbacksRef.current?.onSpeak?.(helpResponse, topic);
                    setTimeout(() => {
                        setMatchSuccess(false);
                        // Agent response persists until next command
                    }, 8000); // Increased to 8s for reading time
                    return;
                }
            }
        }
        
        // 8. Knowledge base lookup (FAQ)
        const kbResponse = lookupKnowledgeBase(text);
        if (kbResponse) {
            setLastCommand(null); // Clear stale command
            setAgentResponse(kbResponse);
            setMatchSuccess(true);
            // HUD handles visualization now
            ttsCallbacksRef.current?.onSpeak?.(kbResponse, 'knowledge');
            setTimeout(() => {
                setMatchSuccess(false);
                // Agent response persists until next command
            }, 7000); // Increased to 7s for longer answers
            return;
        }
        
        // 9. No match found
        setMatchFailed(true);
        setTimeout(() => setMatchFailed(false), 2000); // Increased to 2s to see error
        console.debug("[Agent] No matching intent for:", normalized);
    }, [executeAction, executeComboActions, extractProjectEntity, extractTechStack, 
        handleCorrection, handleGreeting, lookupKnowledgeBase, matchIntent, matchProblemStatement, parseComboCommand]);

    // ========================================================================
    // SMART RESTART
    // ========================================================================
    
    const smartRestart = useCallback(() => {
        if (targetStateRef.current !== "LISTENING" || !recognitionRef.current) return;
        
        const timeSinceLastError = Date.now() - lastErrorTimeRef.current;
        
        if (timeSinceLastError < 1000) {
            setTimeout(() => {
                if (targetStateRef.current === "LISTENING") {
                    try { recognitionRef.current?.start(); } catch (e) {}
                }
            }, 2000);
        } else {
            try { recognitionRef.current?.start(); } catch (e) {}
        }
    }, []);

    // ========================================================================
    // INITIALIZATION
    // ========================================================================
    
    useEffect(() => {
        if (!isSupported) return undefined;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return undefined;
        
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.lang = "en-US";
        
        recognitionRef.current.onresult = (event) => {
            const last = event.results[event.results.length - 1];
            const text = last[0].transcript;
            const confidence = last[0].confidence || 0.9;
            
            setTranscript(text);
            
            if (last.isFinal) {
                setProcessing(false);
                processCommand(text, confidence);
            } else {
                setProcessing(true);
            }
        };
        
        recognitionRef.current.onerror = (event) => {
            lastErrorTimeRef.current = Date.now();
            const errorInfo = ERROR_MESSAGES[event.error] || { type: "unknown", message: `Error: ${event.error}`, shouldRestart: false };
            
            if (errorInfo.message) setError(errorInfo);
            if (errorInfo.type === "critical") {
                setIsListening(false);
                targetStateRef.current = "IDLE";
            }
        };
        
        recognitionRef.current.onend = () => {
            setProcessing(false);
            if (targetStateRef.current === "LISTENING") smartRestart();
            else setIsListening(false);
        };
        
        const handleVisibilityChange = () => {
            if (document.hidden && targetStateRef.current === "LISTENING") {
                recognitionRef.current?.stop();
            } else if (!document.hidden && targetStateRef.current === "LISTENING") {
                try { recognitionRef.current?.start(); } catch (e) {}
            }
        };
        
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            recognitionRef.current?.stop();
        };
    }, [isSupported, processCommand, smartRestart]);

    // ========================================================================
    // PUBLIC METHODS
    // ========================================================================
    
    const startListening = useCallback(() => {
        if (!recognitionRef.current) return;
        targetStateRef.current = "LISTENING";
        setError(null);
        setTranscript("");
        setMatchSuccess(false);
        setMatchFailed(false);
        // NOTE: Do NOT clear agentResponse here - we want persistence while speaking new commands
        setLastCommand(null);   // Clear previous command to prevent stale repetition
        
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            setError({ type: "minor", message: "Could not start. Try again." });
        }
    }, []);

    const stopListening = useCallback(() => {
        targetStateRef.current = "IDLE";
        recognitionRef.current?.stop();
        setIsListening(false);
        setProcessing(false);
        // NOTE: Do NOT clear agentResponse here - let the last message persist
        // so 'Voice navigation suspended' shows in HUD
    }, []);

    // Mirror stopListening into a ref so executeAction (declared above)
    // can call it without a TDZ violation.
    useEffect(() => {
        stopListeningRef.current = stopListening;
    }, [stopListening]);

    const toggleListening = useCallback(() => {
        if (isListening) {
            stopListening();
            // stopListening already clears agentResponse
        } else {
            setError(null);
            // For fresh start, clear previous state
            setAgentResponse(null);
            setLastCommand(null);
            startListening();
        }
    }, [isListening, startListening, stopListening]);

    // ========================================================================
    // TTS INTEGRATION (Echo Prevention)
    // ========================================================================
    
    const pauseRecognition = useCallback(() => {
        if (recognitionRef.current && targetStateRef.current === "LISTENING") {
            isPausedForTTSRef.current = true;
            recognitionRef.current.stop();
        }
    }, []);
    
    const resumeRecognition = useCallback(() => {
        if (recognitionRef.current && targetStateRef.current === "LISTENING" && isPausedForTTSRef.current) {
            isPausedForTTSRef.current = false;
            try { recognitionRef.current.start(); } catch (e) {}
        }
    }, []);
    
    const setTTSCallbacks = useCallback((onSpeak, onSpeakEnd) => {
        ttsCallbacksRef.current = { onSpeak, onSpeakEnd };
    }, []);

    return {
        isSupported, isListening, transcript, lastCommand, error,
        processing, matchSuccess, matchFailed, agentResponse,
        startListening, stopListening, toggleListening,
        // TTS integration
        pauseRecognition, resumeRecognition, setTTSCallbacks,
    };
}

export default useVoiceCommands;
