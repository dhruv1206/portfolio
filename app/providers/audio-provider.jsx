"use client";

import { createContext, useContext, useEffect, useCallback, useRef } from "react";
import { useMounted } from "@/app/hooks/use-mounted";
import { useLocalStorageBoolean } from "@/app/hooks/use-localstorage-state";

const AudioContextAPI = createContext({
    isMuted: true,
    isAmbientEnabled: false,
    toggleMute: () => { },
    toggleAmbient: () => { },
    playSound: () => { },
    setScrollVelocity: () => { },
});

export function AudioProvider({ children }) {
    // Hydration-safe persistent state. useSyncExternalStore-backed
    // helpers eliminate the setState-in-effect pattern that
    // react-hooks/set-state-in-effect (correctly) flags.
    const isClient = useMounted();
    const [isMuted, setIsMuted] = useLocalStorageBoolean("audio-muted", true);
    const [isAmbientEnabled, setIsAmbientEnabled] = useLocalStorageBoolean(
        "audio-ambient",
        false,
    );

    // WebAudio context and oscillator refs
    const audioContextRef = useRef(null);
    const oscillatorRef = useRef(null);
    const gainNodeRef = useRef(null);
    const filterRef = useRef(null);

    // Initialize WebAudio for ambient noise
    const initAmbientAudio = useCallback(() => {
        if (typeof window === "undefined" || audioContextRef.current) return;

        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            audioContextRef.current = new AudioContext();

            // Create brown noise (random values filtered)
            const bufferSize = 2 * audioContextRef.current.sampleRate;
            const noiseBuffer = audioContextRef.current.createBuffer(
                1,
                bufferSize,
                audioContextRef.current.sampleRate
            );
            const output = noiseBuffer.getChannelData(0);

            // Brown noise generation
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = output[i];
                output[i] *= 3.5; // Normalize
            }

            // Create source
            const noiseSource = audioContextRef.current.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;

            // Low-pass filter for rumble effect
            filterRef.current = audioContextRef.current.createBiquadFilter();
            filterRef.current.type = "lowpass";
            filterRef.current.frequency.value = 60; // Base frequency (Hz)
            filterRef.current.Q.value = 1;

            // Gain node for volume control
            gainNodeRef.current = audioContextRef.current.createGain();
            gainNodeRef.current.gain.value = 0; // Start silent

            // Connect: source -> filter -> gain -> destination
            noiseSource.connect(filterRef.current);
            filterRef.current.connect(gainNodeRef.current);
            gainNodeRef.current.connect(audioContextRef.current.destination);

            noiseSource.start();
            oscillatorRef.current = noiseSource;
        } catch (error) {
            console.debug("Ambient audio init failed:", error);
        }
    }, []);

    // Control ambient audio based on state
    useEffect(() => {
        if (!isClient) return;

        if (isAmbientEnabled && !isMuted) {
            initAmbientAudio();
            // Fade in
            if (gainNodeRef.current) {
                gainNodeRef.current.gain.linearRampToValueAtTime(
                    0.03, // Very quiet (5% of max)
                    audioContextRef.current.currentTime + 1
                );
            }
        } else {
            // Fade out
            if (gainNodeRef.current && audioContextRef.current) {
                gainNodeRef.current.gain.linearRampToValueAtTime(
                    0,
                    audioContextRef.current.currentTime + 0.5
                );
            }
        }
    }, [isAmbientEnabled, isMuted, isClient, initAmbientAudio]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Modulate pitch based on scroll velocity
    const setScrollVelocity = useCallback((velocity) => {
        if (!filterRef.current || !audioContextRef.current) return;
        if (!isAmbientEnabled || isMuted) return;

        // Map velocity (0-2000 px/s) to frequency (40-80 Hz)
        const normalizedVelocity = Math.min(Math.abs(velocity) / 2000, 1);
        const targetFrequency = 40 + normalizedVelocity * 40;

        filterRef.current.frequency.linearRampToValueAtTime(
            targetFrequency,
            audioContextRef.current.currentTime + 0.1
        );
    }, [isAmbientEnabled, isMuted]);

    const toggleMute = useCallback(() => {
        setIsMuted((prev) => !prev);
    }, [setIsMuted]);

    const toggleAmbient = useCallback(() => {
        setIsAmbientEnabled((prev) => !prev);
    }, [setIsAmbientEnabled]);

    const playSound = useCallback(
        async (soundName) => {
            if (isMuted || !isClient) return;

            try {
                const sounds = {
                    thud: "/sounds/thud.mp3",
                    whoosh: "/sounds/whoosh.mp3",
                    click: "/sounds/click.mp3",
                };

                const soundPath = sounds[soundName];
                if (!soundPath) return;

                const audio = new Audio(soundPath);
                audio.volume = 0.3;
                await audio.play();
            } catch (error) {
                console.debug("Audio playback failed:", error);
            }
        },
        [isMuted, isClient]
    );

    return (
        <AudioContextAPI.Provider
            value={{
                isMuted,
                isAmbientEnabled,
                toggleMute,
                toggleAmbient,
                playSound,
                setScrollVelocity,
            }}
        >
            {children}
        </AudioContextAPI.Provider>
    );
}

export function useAudio() {
    const context = useContext(AudioContextAPI);
    if (!context) {
        throw new Error("useAudio must be used within an AudioProvider");
    }
    return context;
}

export default AudioProvider;
