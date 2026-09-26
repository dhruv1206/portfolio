// Synthesised ticks and thuds for the control room. Off by default;
// the context is created lazily on the first enabled sound so nothing
// plays before the visitor interacts.

let ac: AudioContext | null = null;
let enabled = false;

export function setSoundEnabled(on: boolean) {
    enabled = on;
    if (on && ac && ac.state === "suspended") ac.resume().catch(() => {});
}
export function isSoundEnabled() { return enabled; }

function tone(freq: number, dur: number, type: OscillatorType = "sine", gain = 0.05) {
    if (!enabled || typeof window === "undefined") return;
    try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        ac = ac || new Ctor();
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = freq; g.gain.value = 0;
        o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime;
        g.gain.linearRampToValueAtTime(gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.start(t); o.stop(t + dur + 0.02);
    } catch { /* audio is optional */ }
}

export const snd = {
    tick: () => tone(1320, 0.06, "square", 0.02),
    thud: () => { tone(90, 0.35, "sine", 0.12); tone(60, 0.5, "triangle", 0.08); },
    chime: () => { tone(660, 0.25, "sine", 0.05); setTimeout(() => tone(990, 0.35, "sine", 0.05), 120); },
    buzz: () => tone(140, 0.3, "sawtooth", 0.03),
    boot: (i: number) => tone(880 + i * 40, 0.05, "square", 0.015),
};
