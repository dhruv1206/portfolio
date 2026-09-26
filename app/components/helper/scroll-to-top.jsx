"use client";

import { useEffect, useState } from "react";

// A quiet way back up on long reading pages: a square mono button that
// appears after the first screen and matches the site bar's buttons.
export default function ScrollToTop() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        let ticking = false;
        const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { setVisible(window.scrollY > 700); ticking = false; }); };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);
    if (!visible) return null;
    return (
        <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
            aria-label="Back to top"
            className="mbtn mbtn-sm"
            style={{ position: "fixed", right: "clamp(16px, 4vw, 56px)", bottom: "calc(18px + env(safe-area-inset-bottom, 0px))", zIndex: 40, background: "rgba(5,5,8,.85)" }}
        >
            ↑ top
        </button>
    );
}
