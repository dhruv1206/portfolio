"use client";

// Voice navigation dock. Reached from the ⌘K palette ("Voice
// navigation"): it starts listening as soon as it mounts, shows what it
// heard and what the system answered, and unmounts on close. The
// recognition, matching and speech logic live in the hooks; this file
// is only the dock.

import { useEffect, useRef } from "react";
import { useVoiceCommands } from "@/app/hooks/use-voice-commands";
import { useSystemVoice } from "@/app/hooks/use-system-voice";
import styles from "./voice-dock.module.scss";

const STATUS_TXT = { idle: "ready", listening: "listening", speaking: "speaking", success: "done", failed: "not recognised" };

export default function VoiceControlButton({ autoStart = false, onExit }) {
    const {
        isSupported, isListening, transcript, lastCommand, error, matchSuccess, matchFailed, agentResponse,
        toggleListening, pauseRecognition, resumeRecognition,
    } = useVoiceCommands();
    const { isSupported: ttsSupported, isSpeaking, speakAction, speak, onSpeakStart, onSpeakEnd } = useSystemVoice();
    const acknowledged = useRef(false);
    const lastSpokenRef = useRef(null);

    // Echo prevention: the mic pauses while the system speaks.
    useEffect(() => {
        if (!ttsSupported || !isSupported) return;
        onSpeakStart(() => pauseRecognition());
        onSpeakEnd(() => resumeRecognition());
    }, [ttsSupported, isSupported, onSpeakStart, onSpeakEnd, pauseRecognition, resumeRecognition]);

    // Speak the reply once per successful match.
    useEffect(() => {
        if (matchSuccess && ttsSupported) {
            if (lastCommand?.action) {
                const key = `action-${lastCommand.action}`;
                if (lastSpokenRef.current !== key) { lastSpokenRef.current = key; speakAction(lastCommand.action); }
            } else if (agentResponse) {
                const key = `response-${agentResponse.slice(0, 30)}`;
                if (lastSpokenRef.current !== key) { lastSpokenRef.current = key; speak(agentResponse); }
            }
        }
        if (!matchSuccess) lastSpokenRef.current = null;
    }, [matchSuccess, lastCommand, agentResponse, ttsSupported, speakAction, speak]);

    const start = async () => {
        if (!isListening && !acknowledged.current && ttsSupported) { acknowledged.current = true; await speak("Voice navigation ready."); }
        toggleListening();
    };
    useEffect(() => {
        if (!autoStart || !isSupported) return undefined;
        const t = setTimeout(() => { start(); }, 60);
        return () => clearTimeout(t);
    }, [autoStart, isSupported]); // eslint-disable-line react-hooks/exhaustive-deps

    const status = isSpeaking ? "speaking" : matchSuccess ? "success" : matchFailed ? "failed" : isListening ? "listening" : "idle";
    const close = () => { if (isListening) toggleListening(); if (onExit) onExit(); };

    if (!isSupported) {
        return (
            <aside className={styles.dock} role="status" aria-label="Voice navigation">
                <header><i /><span>voice · unavailable</span><button type="button" onClick={close}>esc</button></header>
                <div className={styles.body}><p className={styles.err}>Speech recognition is not available in this browser. Chrome and Edge support it.</p></div>
            </aside>
        );
    }
    return (
        <aside className={styles.dock} data-status={status} aria-live="polite" aria-label="Voice navigation">
            <header><i /><span>voice · {STATUS_TXT[status]}</span><button type="button" onClick={close} aria-label="Close voice navigation">esc</button></header>
            <div className={styles.body}>
                {status === "listening" && <p className={styles.you}>{transcript ? "› " + transcript : "› listening…"}</p>}
                {agentResponse && status !== "failed" && <p className={styles.sys}>{agentResponse}</p>}
                {status === "success" && !agentResponse && <p className={styles.sys}>done · {lastCommand?.action?.replace(/-/g, " ")}</p>}
                {status === "failed" && <p className={styles.err}>not recognised · say “help” for the list</p>}
                {error && <p className={styles.err}>{error.message}</p>}
                {status === "idle" && !agentResponse && <p className={styles.hint}>say “show me projects”, “open the lab” or “go to contact”</p>}
            </div>
            <footer><button type="button" onClick={start} aria-pressed={isListening}>{isListening ? "stop mic" : "start mic"}</button><span>say “help” for every command</span></footer>
        </aside>
    );
}
