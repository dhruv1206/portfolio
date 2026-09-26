"use client";

// Site bar, shared by every page: the DA mark, the current path, and a
// row of mono links. Hairline and backdrop appear once the page scrolls.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { personalData } from "@/utils/data/personal-data";
import { useAudio } from "@/app/providers/audio-provider";

const LINKS = [
    { name: "Home", href: "/" },
    { name: "Room", href: "/room" },
    { name: "Lab", href: "/lab" },
    { name: "/r", href: "/r" },
    { name: "Blog", href: "/blog" },
];

// `usePathname` is dynamic during prerendering, so the path-aware bar
// streams in under a Suspense boundary while NavbarShell (identical
// markup, no active state) sits in the static HTML.
export default function Navbar() {
    const pathname = usePathname() || "/";
    return <NavbarShell pathname={pathname} />;
}

export function NavbarShell({ pathname = "/" }) {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    const audio = useAudio();

    useEffect(() => {
        let ticking = false;
        const onScroll = () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(() => { setScrolled(window.scrollY > 40); ticking = false; });
        };
        window.addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    const active = (href) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
    const section = pathname === "/" ? "" : pathname.split("/")[1];

    return (
        <header className={`site-bar${scrolled ? " is-scrolled" : ""}`}>
            <Link href="/" className="site-mark" onClick={() => setOpen(false)}>
                <b>DA</b>
                <span>dhruuv.me{section ? <i> / {section}</i> : null}</span>
            </Link>
            <nav className={`site-links${open ? " is-open" : ""}`} aria-label="Site">
                {LINKS.map((l) => (
                    <Link key={l.href} href={l.href} className={active(l.href) ? "is-active" : ""} onClick={() => setOpen(false)}>
                        {l.name}
                    </Link>
                ))}
                <button
                    type="button"
                    className="opt"
                    aria-pressed={!audio.isMuted}
                    onClick={audio.toggleMute}
                    title={audio.isMuted ? "Enable sounds" : "Disable sounds"}
                >
                    {audio.isMuted ? "sound off" : "sound on"}
                </button>
                <button type="button" className="opt" onClick={() => window.dispatchEvent(new CustomEvent("cr:palette"))} title="Modes">
                    <kbd>⌘K</kbd>
                </button>
                <a href={personalData.resume} target="_blank" rel="noopener noreferrer">
                    Résumé
                </a>
            </nav>
            <button type="button" className="site-menu" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? "close" : "menu"}
            </button>
        </header>
    );
}
