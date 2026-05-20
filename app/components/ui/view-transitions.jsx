"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Native View Transitions for App Router navigation.
 *
 * Intercepts left-clicks on internal anchors, prevents the default,
 * and runs `router.push(href)` inside `document.startViewTransition()`.
 * Browsers without the API (older Safari, all Firefox stable as of 2026)
 * fall through to vanilla Next routing. Zero animation library required.
 *
 * Mount once at the root (inside ClientProviders).
 */
export function ViewTransitions() {
    const router = useRouter();

    useEffect(() => {
        if (typeof document === "undefined") return;
        if (typeof document.startViewTransition !== "function") return;

        const onClick = (event) => {
            if (event.defaultPrevented) return;
            if (event.button !== 0) return;
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

            const link = event.target.closest("a[href]");
            if (!link) return;
            if (link.target === "_blank") return;
            if (link.hasAttribute("data-no-vt")) return;
            if (link.hasAttribute("download")) return;

            const href = link.getAttribute("href");
            if (!href) return;
            if (
                href.startsWith("http") ||
                href.startsWith("//") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("#")
            ) {
                return;
            }

            event.preventDefault();
            document.startViewTransition(() => router.push(href));
        };

        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, [router]);

    return null;
}

export default ViewTransitions;
