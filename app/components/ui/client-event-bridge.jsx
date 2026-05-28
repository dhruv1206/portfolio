"use client";

import { useEffect } from "react";
import { eventBus } from "@/app/lib/event-bus";

// Bridges DOM behaviour into the event bus so the system-architecture
// overlay has something to animate on the homepage even when the
// visitor hasn't triggered voice or cinematic-mode flows.
//
// Two natural emit sources:
//   1. Hover/focus on any `<a href="/projects/...">` or in-page
//      anchor → `prefetch:queued`. Mirrors the spirit of
//      usePredictivePrefetch (which exists but isn't yet mounted
//      against the homepage targets).
//   2. IntersectionObserver across every element with an `id`
//      attribute → `io:enter` when the section enters viewport.
//      Cheap, catches every `#about`, `#projects`, `#experience`,
//      `#contact`, etc. without further wiring.

export default function ClientEventBridge() {
    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        // ----- prefetch:queued on hover/focus of internal links -----
        const seenPrefetch = new Set();
        const onPointerOver = (e) => {
            const a = e.target.closest?.("a[href]");
            if (!a) return;
            const href = a.getAttribute("href");
            if (!href) return;
            if (
                href.startsWith("http") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("#")
            ) {
                return;
            }
            if (seenPrefetch.has(href)) return;
            seenPrefetch.add(href);
            eventBus.emit("prefetch:queued", { url: href });
        };
        document.addEventListener("pointerover", onPointerOver, { capture: true });

        // ----- io:enter on first viewport entry of any [id] section -----
        const seenIo = new Set();
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const id = entry.target.id;
                    if (!id || seenIo.has(id)) continue;
                    seenIo.add(id);
                    eventBus.emit("io:enter", {
                        target: entry.target.tagName.toLowerCase(),
                        id,
                    });
                }
            },
            { rootMargin: "0px 0px -25% 0px", threshold: 0.1 },
        );
        const observed = new WeakSet();
        const observeAllIds = () => {
            for (const el of document.querySelectorAll("[id]")) {
                if (observed.has(el)) continue;
                observed.add(el);
                io.observe(el);
            }
        };
        observeAllIds();
        // Re-scan when the DOM grows (route navigations, lazy mounts).
        const mo = new MutationObserver(() => observeAllIds());
        mo.observe(document.body, { childList: true, subtree: true });

        return () => {
            document.removeEventListener("pointerover", onPointerOver, {
                capture: true,
            });
            io.disconnect();
            mo.disconnect();
        };
    }, []);

    return null;
}
