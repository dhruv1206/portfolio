"use client";

import { useSyncExternalStore } from "react";

// The reader's reduced-motion setting, for components the server renders.
// The server and the hydrating render both say "no", which is what the
// server's HTML was made with; the real setting re-renders right after.
// framer-motion's useReducedMotion reads it during the first client
// render, so for those readers the first render differs from the server's
// HTML and hydration fails (React error #418).

const QUERY = "(prefers-reduced-motion: reduce)";
const subscribe = (onChange) => {
    const query = window.matchMedia(QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
};

export function usePrefersReducedMotion() {
    return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
