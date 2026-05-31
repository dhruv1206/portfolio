"use client";

import { useCallback, useSyncExternalStore } from "react";

// Boolean-typed localStorage-backed state, backed by useSyncExternalStore
// so the value reads through React 19's external-store contract without
// any setState-in-effect anti-pattern. Subscribes to the `storage` event
// so a change in another tab is observed live. Manual writes dispatch a
// synthetic event so subscribers in the same tab stay in sync.
//
// Usage:
//   const [isMuted, setMuted] = useLocalStorageBoolean("audio-muted", true);
//   setMuted(!isMuted);

const STORAGE_EVENT = "use-localstorage-state";

function subscribe(callback) {
    if (typeof window === "undefined") return () => {};
    const onStorage = () => callback();
    window.addEventListener("storage", onStorage);
    window.addEventListener(STORAGE_EVENT, onStorage);
    return () => {
        window.removeEventListener("storage", onStorage);
        window.removeEventListener(STORAGE_EVENT, onStorage);
    };
}

export function useLocalStorageBoolean(key, defaultValue) {
    const value = useSyncExternalStore(
        subscribe,
        () => {
            try {
                const raw = window.localStorage.getItem(key);
                if (raw === null) return defaultValue;
                return raw === "true";
            } catch {
                return defaultValue;
            }
        },
        () => defaultValue,
    );

    const setValue = useCallback(
        (next) => {
            try {
                const resolved =
                    typeof next === "function" ? next(value) : next;
                window.localStorage.setItem(key, String(Boolean(resolved)));
                window.dispatchEvent(new Event(STORAGE_EVENT));
            } catch {
                // localStorage may be unavailable (private mode, quota). Silent.
            }
        },
        [key, value],
    );

    return [value, setValue];
}

export default useLocalStorageBoolean;
