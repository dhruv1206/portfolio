"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useVoiceCommands } from "@/app/hooks/use-voice-commands";
import { useSystemVoice } from "@/app/hooks/use-system-voice";

const VoiceControlButton = () => {
    const {
        isSupported,
        isListening,
        transcript,
        lastCommand,
        error,
        processing,
        matchSuccess,
        matchFailed,
        agentResponse,
        toggleListening,
        startListening,
        pauseRecognition,
        resumeRecognition,
    } = useVoiceCommands();

    const {
        isSupported: ttsSupported,
        isSpeaking,
        speakAction,
        speakHelp,
        speak,
        onSpeakStart,
        onSpeakEnd,
    } = useSystemVoice();

    const [showTooltip, setShowTooltip] = useState(false);
    const [hasAcknowledged, setHasAcknowledged] = useState(false);

    // ========================================================================
    // TTS ECHO PREVENTION INTEGRATION
    // ========================================================================

    useEffect(() => {
        if (!ttsSupported || !isSupported) return;

        // Pause recognition when TTS starts speaking (echo prevention)
        onSpeakStart(() => {
            pauseRecognition();
        });

        // Resume recognition when TTS finishes
        onSpeakEnd(() => {
            resumeRecognition();
        });
    }, [ttsSupported, isSupported, onSpeakStart, onSpeakEnd, pauseRecognition, resumeRecognition]);

    // ========================================================================
    // SPEAK ACTION/RESPONSE WHEN COMMAND SUCCEEDS (with dedup)
    // ========================================================================

    const lastSpokenRef = useRef(null);

    useEffect(() => {
        if (matchSuccess && ttsSupported) {
            // For action-based commands that have specific TTS scripts
            if (lastCommand?.action) {
                const commandKey = `action-${lastCommand.action}-${Date.now()}`;
                if (lastSpokenRef.current !== commandKey) {
                    lastSpokenRef.current = commandKey;
                    speakAction(lastCommand.action);
                }
            }
            // For responses without actions (greetings, KB, help) - speak the text directly
            else if (agentResponse) {
                const responseKey = `response-${agentResponse.slice(0, 30)}-${Date.now()}`;
                if (lastSpokenRef.current !== responseKey) {
                    lastSpokenRef.current = responseKey;
                    speak(agentResponse);
                }
            }
        }

        // Clear lastSpoken when matchSuccess ends to allow re-speaking
        if (!matchSuccess) {
            lastSpokenRef.current = null;
        }
    }, [matchSuccess, lastCommand, agentResponse, ttsSupported, speakAction, speak]);

    // Don't render if speech recognition not supported
    if (!isSupported) return null;

    // ========================================================================
    // WELCOME MESSAGE ON FIRST ACTIVATION
    // ========================================================================

    const handleToggle = async () => {
        if (!isListening && !hasAcknowledged && ttsSupported) {
            setHasAcknowledged(true);
            await speak("System online. Voice navigation ready.");
        }
        toggleListening();
    };

    // Determine button visual state
    const getButtonStatus = () => {
        if (isSpeaking) return "speaking";
        if (matchSuccess) return "success";
        if (matchFailed) return "failed";
        if (isListening) return "listening";
        return "idle";
    };

    const status = getButtonStatus();

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-4 pointer-events-none">

            {/* CINEMATIC HUD PANEL */}
            <AnimatePresence>
                {(isListening || isSpeaking || agentResponse || error) && (
                    <motion.div
                        initial={{ opacity: 0, x: 20, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="pointer-events-auto bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden w-80 shadow-2xl shadow-cyan-500/10"
                    >
                        {/* HUD Header */}
                        <div className={`
                            px-4 py-1.5 text-[10px] tracking-widest font-mono uppercase font-bold flex justify-between items-center border-b border-white/5
                            ${status === "listening" ? "text-amber-400 bg-amber-500/5" :
                                status === "speaking" ? "text-cyan-400 bg-cyan-500/5" :
                                    status === "success" ? "text-green-400 bg-green-500/5" :
                                        status === "failed" ? "text-red-400 bg-red-500/5" : "text-gray-500"}
                        `}>
                            <span>
                                {status === "listening" ? "MIC ACTIVE" :
                                    status === "speaking" ? "SYSTEM AUDIO" :
                                        status === "success" ? "CMD SUCCESS" :
                                            status === "failed" ? "CMD FAILED" : "SYSTEM IDLE"}
                            </span>

                            {/* Animated Pulse Dot */}
                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === "listening" ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]" :
                                status === "speaking" ? "bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]" :
                                    status === "success" ? "bg-green-500" :
                                        status === "failed" ? "bg-red-500" : "bg-gray-500"
                                }`} />
                        </div>

                        {/* HUD Content Area */}
                        <div className="p-4 min-h-[80px] flex flex-col justify-center relative">

                            {/* Listening Visualizer (Waveform) */}
                            {status === "listening" && !processing && (
                                <div className="absolute inset-0 opacity-10 flex items-center justify-center gap-1">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{ height: [10, 40, 10] }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                delay: i * 0.1,
                                                ease: "easeInOut"
                                            }}
                                            className="w-1 bg-amber-500/50 rounded-full h-4"
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Processing Matrix Rain effect (Subtle) */}
                            {processing && (
                                <div className="absolute inset-0 opacity-5 bg-[url('https://media.giphy.com/media/L0qTl8qbSk9u9e25Cr/giphy.gif')] bg-cover mix-blend-screen pointer-events-none" />
                            )}

                            {/* Main Text Output */}
                            <div className="relative z-10 font-mono text-sm leading-relaxed flex flex-col gap-2">
                                {/* 1. SYSTEM RESPONSE (Always visible if exists) */}
                                {(agentResponse && status !== "failed") && (
                                    <div className="text-cyan-300 border-l-2 border-cyan-500/30 pl-2">
                                        <span className="text-cyan-500/50 text-[10px] uppercase block mb-1 tracking-wider">[System Output]</span>
                                        {agentResponse}
                                    </div>
                                )}

                                {/* 2. USER TRANSCRIPT (Visible when speaking or listening) */}
                                {status === "listening" && (
                                    <div className="text-gray-300 mt-1">
                                        {transcript ? (
                                            <>
                                                <span className="text-amber-500/50 text-[10px] uppercase block mb-1 tracking-wider">[User Input]</span>
                                                &gt; {transcript}
                                                <motion.span
                                                    animate={{ opacity: [0, 1, 0] }}
                                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                                    className="inline-block w-2 h-4 bg-amber-500 ml-1 align-middle"
                                                />
                                            </>
                                        ) : (
                                            <span className="text-amber-400 text-xs animate-pulse font-bold tracking-wide block mt-2">
                                                &gt; LISTENING...
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* 3. STATUS MESSAGES (Success/Error) */}
                                {status === "success" && !agentResponse && (
                                    <span className="text-green-400">
                                        &gt; COMMAND EXECUTED<br />
                                        <span className="text-white/70 text-xs">
                                            {lastCommand?.action?.replace(/-/g, " ").toUpperCase()}
                                        </span>
                                    </span>
                                )}

                                {status === "failed" && (
                                    <span className="text-red-400">
                                        &gt; ERROR: INPUT UNRECOGNIZED<br />
                                        <span className="text-white/50 text-xs">Please adjust parameters or say "Help"</span>
                                    </span>
                                )}

                                {error && (
                                    <span className="text-red-400 block mt-2">
                                        &gt; SYSTEM ALERT<br />
                                        <span className="text-white/70 text-xs">{error.message}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* HUD Footer (Technical Decoration) */}
                        <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* MAIN ORB BUTTON */}
            <motion.button
                onClick={handleToggle}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                    pointer-events-auto relative w-16 h-16 rounded-full flex items-center justify-center
                    backdrop-blur-md border transition-all duration-500 z-50 overflow-hidden
                    ${status === "listening" ? "bg-amber-600/20 border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.4)]" :
                        status === "speaking" ? "bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.4)]" :
                            status === "success" ? "bg-green-500/20 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)]" :
                                status === "failed" ? "bg-red-500/20 border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)]" :
                                    "bg-violet-600/20 border-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:bg-violet-600/30"}
                `}
                aria-label="Voice Control"
            >
                {/* Inner Orb Core */}
                <div className={`w-8 h-8 rounded-full transition-all duration-500 ${status === "listening" ? "bg-amber-500 animate-pulse scale-110" :
                    status === "speaking" ? "bg-cyan-400 shadow-[0_0_15px_cyan]" :
                        status === "success" ? "bg-green-500 scale-125" :
                            status === "failed" ? "bg-red-500" :
                                "bg-violet-500"
                    }`} />

                {/* Rotating Ring (Iron Man Arc Reactor Style) */}
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-dashed border-white/20"
                />

                {/* Counter-Rotating Ring */}
                <motion.div
                    animate={{ rotate: -360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-2 rounded-full border border-dotted border-white/10"
                />

                {/* Icon Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    {status === "speaking" ? (
                        <motion.div
                            animate={{ scale: [1, 1.2, 1] }}
                            transition={{ repeat: Infinity, duration: 2 }}
                            className="bg-cyan-500/20 w-full h-full rounded-full animate-ping absolute"
                        />
                    ) : (
                        <svg className={`w-6 h-6 transition-colors duration-300 ${status === "idle" ? "text-white/80" : "text-white"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                    )}
                </div>
            </motion.button>

            {/* Tooltip (Only when Idle) */}
            <AnimatePresence>
                {showTooltip && status === "idle" && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute right-20 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-black/80 backdrop-blur border border-white/10 rounded font-mono text-xs text-violet-300 pointer-events-none whitespace-nowrap"
                    >
                        INITIATE VOICE PROTOCOL
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VoiceControlButton;
