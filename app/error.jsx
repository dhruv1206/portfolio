"use client";

// Route-level error page, in the site's language. Next renders it in
// place of the segment that threw; `reset` re-renders that segment.

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }) {
    useEffect(() => { console.error(error); }, [error]);
    const digest = error && error.digest ? error.digest : null;
    return (
        <main id="main-content" className="rp" style={{ minHeight: "80vh", padding: "calc(56px + 10vh) clamp(16px, 4vw, 56px) 80px" }}>
            <div style={{ maxWidth: 760, margin: "0 auto" }}>
                <header className="rp-head">
                    <p className="rp-eyebrow"><b>500</b> unhandled <i>{digest ? "digest " + digest : "client-side"}</i></p>
                    <h1 className="rp-h1">Something <em>threw.</em></h1>
                    <p className="rp-lede">This part of the page hit an error it could not recover from. Trying again usually works; if it does not, the rest of the site still does.</p>
                </header>
                <div className="btns">
                    <button type="button" className="mbtn mbtn-primary" onClick={() => reset()}>Try again</button>
                    <Link href="/" className="mbtn">Go home</Link>
                    <Link href="/#s5" className="mbtn mbtn-ghost">Tell me about it</Link>
                </div>
            </div>
        </main>
    );
}
