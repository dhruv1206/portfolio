"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAudio } from "@/app/providers/audio-provider";
import { useFeatureSupport } from "@/app/hooks/use-feature-support";

// ============================================================================
// VOICE CASTING - Premium Voice Selection
// ============================================================================

const PREMIUM_VOICES = [
    // Tier 1: Deep/Male Preferred (Jarvis Persona)
    "Microsoft David Desktop", // Windows Default Male
    "Microsoft David",         // Windows Edge
    "Daniel",                  // macOS Male
    "Google US English Male",  // Chrome Male (if specific)
    "Google UK English Male",  // Chrome UK Male
    
    // Tier 2: High Quality Female (Fallback)
    "Google US English",       // Chrome Default (often female)
    "Samantha",                // macOS Default
    "Microsoft Zira Desktop",  // Windows Default Female
    "Alex",                    // macOS
];

function selectBestVoice(voices) {
    // Try premium voices first
    for (const premiumName of PREMIUM_VOICES) {
        const voice = voices.find(v => v.name.includes(premiumName));
        if (voice) return voice;
    }
    
    // Fallback: Any en-US local voice
    const localEnUS = voices.find(v => v.lang === "en-US" && v.localService);
    if (localEnUS) return localEnUS;
    
    // Final fallback: Any English voice
    const anyEnglish = voices.find(v => v.lang.startsWith("en"));
    return anyEnglish || voices[0];
}

// ============================================================================
// SCRIPTWRITER ENGINE - Action to Speech Mapping
// ============================================================================

export const ACTION_SCRIPTS = {
    // Navigation
    "show-projects": "Opening the projects.",
    "filter-backend": "Opening the projects.",
    "filter-frontend": "Opening the projects.",
    "go-contact": "Opening the contact section.",
    "go-contact-focus": "Contact form ready.",
    "go-contact-inquiry": "Contact form ready.",
    "go-home": "Going home.",
    "go-about": "Going to the numbers.",
    "go-skills": "Going to the stack.",
    "go-experience": "Going to the systems I have run.",
    "go-education": "Going to the ledger.",
    "go-room": "Opening the control room.",
    "go-lab": "Opening the lab.",
    "go-recruiter": "Opening recruiter mode.",
    "go-blog": "Opening the blog.",
    
    // Scroll
    "scroll-down": "Navigating to lower sectors.",
    "scroll-up": "Ascending to upper regions.",
    "scroll-down-lot": "Fast descending.",
    "scroll-up-lot": "Rapid ascent initiated.",
    "scroll-down-little": "Descending slightly.",
    "scroll-up-little": "Ascending slightly.",
    "scroll-bottom": "Proceeding to terminal coordinates.",
    "scroll-top": "Returning to origin point.",
    
    // Actions
    "copy-email": "Contact coordinates copied to clipboard.",
    "open-github": "Accessing source repository.",
    "toggle-theme": "This site has one theme.",
    "stop": "Voice navigation suspended.",
    
    // System
    "welcome": "System online. Voice navigation ready.",
    "listening-start": "Listening.",
    "listening-stop": "Standing by.",
    "status-report": "All systems nominal. Rendering engine at 60 FPS. Portfolio data loaded.",
    "system-check": "All systems nominal. Rendering engine at 60 FPS. Portfolio data loaded.",

    // Errors
    "error-no-match": "Input unrecognized. Please adjust your parameters.",
    "error-no-speech": "No input detected. Sensors calibrated.",
    "error-critical": "Voice system error. Manual navigation available.",
};

// Project-specific scripts
export const PROJECT_SCRIPTS = {
    "dstardb": "Loading DStarDB. High-performance in-memory database.",
    "realtime-collaboration": "Accessing real-time collaboration platform.",
    "ai-press-release-generator": "Opening AI content generation system.",
    "college-attendance-app": "Displaying mobile attendance solution.",
    "amazon-clone": "Loading e-commerce platform demo.",
    "whatsapp-clone": "Accessing messaging application project.",
};

// Knowledge base spoken responses
const KNOWLEDGE_SCRIPTS = {
    location: "Currently based in India. Available for remote collaboration globally.",
    experience: "Software Engineer with production experience at MyRik, CarWale, and JioHotstar. Systems serving over 150,000 users.",
    education: "Bachelor of Technology in Computer Science. LNCT Bhopal. Class of 2025.",
    skills: "Core expertise in backend engineering with Java, Spring Boot, and system design. Proficient in C++ for high-performance applications.",
    contact: "Email address is agrawaldhruv1006@gmail.com. Contact form is also available below.",
    leetcode: "One thousand plus data structure problems solved. LeetCode Knight rating, 1870 plus.",
    identity: "This is Dhruv Agrawal's portfolio. Software Engineer specializing in backend systems and cloud architecture.",
};

// Help responses
const HELP_SCRIPTS = {
    general: "I am the voice navigation assistant. You can ask me to show projects, scroll the page, or contact the developer. Try saying: show me the database project.",
    scroll: "You can scroll manually, or tell me to scroll down, scroll up, or go to the bottom.",
    projects: "Say 'show projects' to see all work. Or name a technology like 'show C++ projects'.",
    contact: "Say 'contact' or 'how do I hire you' to reach the contact section.",
    commands: "Available commands: projects, contact, scroll, about, skills, experience, education, and help.",
};

// ============================================================================
// THE useSystemVoice HOOK
// ============================================================================

export function useSystemVoice() {
    const { isMuted } = useAudio();

    // Feature detection without setState-in-effect.
    const isSupported = useFeatureSupport(
        () => Boolean(window.speechSynthesis),
    );

    const [isSpeaking, setIsSpeaking] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState(null);

    const synthRef = useRef(null);
    const utteranceRef = useRef(null);
    const onSpeakStartRef = useRef(null);
    const onSpeakEndRef = useRef(null);

    // Voice settings for "Jarvis" tone
    const VOICE_RATE = 1.1;   // Adjusted (1.0 was too slow)
    const VOICE_PITCH = 0.85; // Deeper, authoritative
    const VOICE_VOLUME = 0.9;

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    // selectedVoice updates come from speechSynthesis.onvoiceschanged,
    // which is an external-system event — the canonical setState-from-
    // subscription pattern that react-hooks/set-state-in-effect allows.
    useEffect(() => {
        if (!isSupported) return undefined;
        synthRef.current = window.speechSynthesis;

        const loadVoices = () => {
            const voices = synthRef.current.getVoices();
            if (voices.length > 0) {
                const best = selectBestVoice(voices);
                setSelectedVoice(best);
                console.debug("[SystemVoice] Selected:", best?.name);
            }
        };

        loadVoices();
        synthRef.current.onvoiceschanged = loadVoices;

        return () => {
            synthRef.current?.cancel();
        };
    }, [isSupported]);

    // ========================================================================
    // SPEAK FUNCTION (Interrupt-First Architecture)
    // ========================================================================
    
    const speak = useCallback((text, options = {}) => {
        if (!synthRef.current || !isSupported || isMuted) {
            console.debug("[SystemVoice] Skipped:", text, { isSupported, isMuted });
            return Promise.resolve();
        }
        
        // Cancel any ongoing speech (interrupt-first)
        synthRef.current.cancel();
        
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);
            utteranceRef.current = utterance;
            
            // Apply voice settings
            if (selectedVoice) utterance.voice = selectedVoice;
            utterance.rate = options.rate || VOICE_RATE;
            utterance.pitch = options.pitch || VOICE_PITCH;
            utterance.volume = options.volume || VOICE_VOLUME;
            
            utterance.onstart = () => {
                setIsSpeaking(true);
                onSpeakStartRef.current?.();
            };
            
            utterance.onend = () => {
                setIsSpeaking(false);
                onSpeakEndRef.current?.();
                resolve();
            };
            
            utterance.onerror = (e) => {
                console.debug("[SystemVoice] Error:", e);
                setIsSpeaking(false);
                onSpeakEndRef.current?.();
                resolve();
            };
            
            synthRef.current.speak(utterance);
        });
    }, [isSupported, isMuted, selectedVoice]);

    // ========================================================================
    // SPEAK ACTION (Maps action to script)
    // ========================================================================
    
    const speakAction = useCallback((action) => {
        // Check for project-specific scripts
        if (action.startsWith("project:")) {
            const slug = action.replace("project:", "");
            const script = PROJECT_SCRIPTS[slug] || `Opening ${slug} project.`;
            return speak(script);
        }
        
        // Check for tech filter
        if (action.startsWith("filter-tech:")) {
            const tech = action.replace("filter-tech:", "");
            return speak(`Filtering ${tech} projects.`);
        }
        
        // Standard action scripts
        const script = ACTION_SCRIPTS[action];
        if (script) return speak(script);
        
        return Promise.resolve();
    }, [speak]);

    // ========================================================================
    // SPEAK KNOWLEDGE (FAQ Responses)
    // ========================================================================
    
    const speakKnowledge = useCallback((key) => {
        const script = KNOWLEDGE_SCRIPTS[key];
        if (script) return speak(script);
        return Promise.resolve();
    }, [speak]);

    // ========================================================================
    // SPEAK HELP (Meta-questions)
    // ========================================================================
    
    const speakHelp = useCallback((topic = "general") => {
        const script = HELP_SCRIPTS[topic] || HELP_SCRIPTS.general;
        return speak(script);
    }, [speak]);

    // ========================================================================
    // CANCEL SPEECH
    // ========================================================================
    
    const cancel = useCallback(() => {
        synthRef.current?.cancel();
        setIsSpeaking(false);
    }, []);

    // ========================================================================
    // CALLBACK SETTERS (For echo prevention)
    // ========================================================================
    
    const onSpeakStart = useCallback((callback) => {
        onSpeakStartRef.current = callback;
    }, []);
    
    const onSpeakEnd = useCallback((callback) => {
        onSpeakEndRef.current = callback;
    }, []);

    return {
        isSupported,
        isSpeaking,
        selectedVoice,
        speak,
        speakAction,
        speakKnowledge,
        speakHelp,
        cancel,
        onSpeakStart,
        onSpeakEnd,
    };
}

export default useSystemVoice;
