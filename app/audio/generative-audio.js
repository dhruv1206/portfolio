"use client";

/**
 * Generative Audio System using Tone.js
 * Creates section-aware ambient soundscapes
 */

let Tone = null;
let isInitialized = false;
let synth = null;
let bassSynth = null;
let noiseSynth = null;
let filter = null;
let reverb = null;
let volume = null;
let currentSection = "hero";
let isPlaying = false;
let sequenceInterval = null;

// Section-specific musical configurations
const SECTION_CONFIGS = {
    hero: {
        key: "C",
        scale: ["C4", "E4", "G4", "B4", "C5", "E5", "G5"],
        tempo: 140,
        arpPattern: "up",
        filterFreq: 2000,
        reverbWet: 0.3,
        energy: "high",
    },
    about: {
        key: "Am",
        scale: ["A3", "C4", "E4", "G4", "A4", "C5"],
        tempo: 100,
        arpPattern: "upDown",
        filterFreq: 1500,
        reverbWet: 0.4,
        energy: "medium",
    },
    skills: {
        key: "F",
        scale: ["F3", "A3", "C4", "E4", "F4", "A4", "C5"],
        tempo: 120,
        arpPattern: "random",
        filterFreq: 1800,
        reverbWet: 0.35,
        energy: "focused",
    },
    experience: {
        key: "G",
        scale: ["G3", "B3", "D4", "F#4", "G4", "B4"],
        tempo: 110,
        arpPattern: "down",
        filterFreq: 1600,
        reverbWet: 0.4,
        energy: "medium",
    },
    projects: {
        key: "D",
        scale: ["D3", "F#3", "A3", "C#4", "D4", "F#4", "A4"],
        tempo: 130,
        arpPattern: "upDown",
        filterFreq: 2200,
        reverbWet: 0.25,
        energy: "creative",
    },
    education: {
        key: "Bb",
        scale: ["Bb3", "D4", "F4", "A4", "Bb4", "D5"],
        tempo: 90,
        arpPattern: "up",
        filterFreq: 1400,
        reverbWet: 0.5,
        energy: "calm",
    },
    contact: {
        key: "Eb",
        scale: ["Eb3", "G3", "Bb3", "D4", "Eb4", "G4"],
        tempo: 70,
        arpPattern: "down",
        filterFreq: 1000,
        reverbWet: 0.6,
        energy: "resolving",
    },
};

/**
 * Initialize the Tone.js audio engine
 */
export async function initGenerativeAudio() {
    if (isInitialized) return true;

    try {
        // Dynamic import to avoid SSR issues
        Tone = await import("tone");

        // Master volume
        volume = new Tone.Volume(-12).toDestination();

        // Effects chain
        reverb = new Tone.Reverb({ decay: 3, wet: 0.3 }).connect(volume);
        filter = new Tone.Filter({ frequency: 2000, type: "lowpass" }).connect(reverb);

        // Main melodic synth
        synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 1.5 },
        }).connect(filter);
        synth.volume.value = -20;

        // Bass synth
        bassSynth = new Tone.MonoSynth({
            oscillator: { type: "triangle" },
            envelope: { attack: 0.2, decay: 0.5, sustain: 0.3, release: 2 },
        }).connect(filter);
        bassSynth.volume.value = -24;

        // Ambient noise
        noiseSynth = new Tone.Noise("brown").connect(
            new Tone.Filter(200, "lowpass").connect(
                new Tone.Volume(-40).connect(volume)
            )
        );

        isInitialized = true;
        return true;
    } catch (error) {
        console.debug("Generative audio init failed:", error);
        return false;
    }
}

/**
 * Start playing generative music
 */
export async function startGenerativeAudio() {
    if (!isInitialized) {
        const success = await initGenerativeAudio();
        if (!success) return;
    }

    // Start audio context (requires user gesture)
    await Tone.start();
    isPlaying = true;

    // Start ambient noise
    noiseSynth?.start();

    // Start generative sequence
    playSection(currentSection);
}

/**
 * Stop playing
 */
export function stopGenerativeAudio() {
    isPlaying = false;
    if (sequenceInterval) {
        clearInterval(sequenceInterval);
        sequenceInterval = null;
    }
    noiseSynth?.stop();
    synth?.releaseAll();
}

/**
 * Change to a new section
 */
export function setSection(section) {
    if (section === currentSection) return;
    currentSection = section;
    if (isPlaying) {
        playSection(section);
    }
}

/**
 * Play music for a specific section
 */
function playSection(section) {
    const config = SECTION_CONFIGS[section] || SECTION_CONFIGS.hero;

    // Update filter and reverb
    if (filter) {
        filter.frequency.rampTo(config.filterFreq, 2);
    }
    if (reverb) {
        reverb.wet.rampTo(config.reverbWet, 2);
    }

    // Clear existing sequence
    if (sequenceInterval) {
        clearInterval(sequenceInterval);
    }

    // Note interval based on tempo
    const intervalMs = (60 / config.tempo) * 1000;
    let noteIndex = 0;
    const scale = config.scale;

    sequenceInterval = setInterval(() => {
        if (!isPlaying) {
            clearInterval(sequenceInterval);
            return;
        }

        // Get next note based on pattern
        let note;
        switch (config.arpPattern) {
            case "up":
                note = scale[noteIndex % scale.length];
                noteIndex++;
                break;
            case "down":
                note = scale[(scale.length - 1 - (noteIndex % scale.length))];
                noteIndex++;
                break;
            case "upDown":
                const len = scale.length;
                const cycle = noteIndex % (len * 2 - 2);
                note = cycle < len ? scale[cycle] : scale[len * 2 - 2 - cycle];
                noteIndex++;
                break;
            case "random":
            default:
                note = scale[Math.floor(Math.random() * scale.length)];
                break;
        }

        // Play note with slight velocity variation
        const velocity = 0.3 + Math.random() * 0.2;
        synth?.triggerAttackRelease(note, "8n", undefined, velocity);

        // Occasional bass note
        if (Math.random() < 0.15) {
            const bassNote = scale[0].replace(/\d/, "2");
            bassSynth?.triggerAttackRelease(bassNote, "2n", undefined, 0.3);
        }
    }, intervalMs);
}

/**
 * Set master volume (0 to 1)
 */
export function setVolume(level) {
    if (volume) {
        volume.volume.value = -60 + level * 50; // -60dB to -10dB
    }
}

/**
 * Check if audio is currently playing
 */
export function isAudioPlaying() {
    return isPlaying;
}

/**
 * Get current section
 */
export function getCurrentSection() {
    return currentSection;
}

const generativeAudio = {
    initGenerativeAudio,
    startGenerativeAudio,
    stopGenerativeAudio,
    setSection,
    setVolume,
    isAudioPlaying,
    getCurrentSection,
};

export default generativeAudio;
