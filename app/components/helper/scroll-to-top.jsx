"use client";

import { useEffect, useRef, useState } from "react";

// A quiet way back up on long reading pages: a square mono button that
// appears after the first screen and matches the site bar's buttons.
export default function ScrollToTop() {
    const [visible, setVisible] = useState(false);
    const marker = useRef(null);
    useEffect(() => {
        // Watches a marker 700 px down the page (the reading container
        // starts at the top) instead of reading scrollY, which at load
        // forced a layout of the whole page. The observer's first report
        // also covers a page that opens already scrolled.
        const io = new IntersectionObserver(([entry]) => setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0));
        io.observe(marker.current);
        return () => io.disconnect();
    }, []);
    return (
        <>
            <span ref={marker} aria-hidden="true" style={{ position: "absolute", top: 700, left: 0, width: 1, height: 1, pointerEvents: "none" }} />
            {visible && (
                <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
                    aria-label="Back to top"
                    className="mbtn mbtn-sm scroll-top"
                    style={{ position: "fixed", right: "clamp(16px, 4vw, 56px)", bottom: "calc(18px + env(safe-area-inset-bottom, 0px))", zIndex: 40, background: "rgba(5,5,8,.85)" }}
                >
                    ↑ top
                </button>
            )}
        </>
    );
}
