// Server Component: renders the full footer including the dynamic
// copyright year. Removing the previous "use client" directive (and the
// motion/AnimatePresence imports) lets Cache Components statically
// prerender the route while still keeping `new Date()` correct on each
// build/revalidate. The heart-pulse animation is CSS (`animate-heartbeat`
// defined in globals.scss) and hover transforms are Tailwind utilities,
// so no React state is needed.

import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import { BsGithub, BsLinkedin, BsHeart } from "react-icons/bs";
import { FaXTwitter } from "react-icons/fa6";
import { SiLeetcode } from "react-icons/si";

const socialLinks = [
    { icon: BsGithub, href: personalData.github, label: "GitHub" },
    { icon: BsLinkedin, href: personalData.linkedIn, label: "LinkedIn" },
    { icon: SiLeetcode, href: personalData.leetcode, label: "LeetCode" },
    { icon: FaXTwitter, href: personalData.twitter, label: "Twitter" },
];

const navLinks = [
    { name: "Control room", href: "/" },
    { name: "Recruiter mode", href: "/r" },
    { name: "Lab", href: "/lab" },
    { name: "Blog", href: "/blog" },
];

function Footer() {
    // BUILD_YEAR is injected at build time by `next.config.js`'s `env`
    // field, so the literal is baked into the bundle — Cache Components
    // sees a static string. Year refreshes on every deploy / ISR
    // revalidation (≤1h per the route config), which is plenty often
    // enough for a copyright line.
    const currentYear = process.env.BUILD_YEAR;

    return (
        <footer className="relative border-t border-white/5 bg-dark-900/50 backdrop-blur-sm">
            {/* Gradient line */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

            <div className="mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem] py-12">
                {/* Top section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
                    {/* Brand */}
                    <div>
                        <Link href="/" className="inline-block mb-4">
                            <span className="text-2xl font-display font-bold">
                                <span className="gradient-text">D</span>
                                <span className="text-white">hruv</span>
                            </span>
                        </Link>
                        <p className="text-sm text-gray-500 max-w-xs">
                            Backend engineer. The homepage is a live, breakable model of the
                            systems I run; this page is the reading version.
                        </p>
                    </div>

                    {/* Quick links */}
                    <div>
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                            Quick Links
                        </h4>
                        <ul className="space-y-2">
                            {navLinks.map((link) => (
                                <li key={link.name}>
                                    <Link
                                        href={link.href}
                                        className="text-sm text-gray-400 hover:text-violet-400 transition-colors"
                                    >
                                        {link.name}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Connect */}
                    <div>
                        <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
                            Connect
                        </h4>
                        <div className="flex gap-3">
                            {socialLinks.map((social) => (
                                <Link
                                    key={social.label}
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:text-violet-400 hover:border-violet-500/50 hover:-translate-y-0.5 transition-all duration-200"
                                    aria-label={social.label}
                                >
                                    <social.icon size={18} />
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Divider */}
                <div className="h-[1px] bg-white/5 mb-6" />

                {/* Bottom section */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
                    <p>
                        © {currentYear}{" "}
                        <Link
                            href={personalData.linkedIn}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:text-violet-300 transition-colors"
                        >
                            Dhruv Agrawal
                        </Link>
                        . All rights reserved.
                    </p>

                    <p className="flex items-center gap-1">
                        Made with{" "}
                        <span className="inline-flex animate-heartbeat origin-center">
                            <BsHeart className="text-pink-500" />
                        </span>{" "}
                        & Next.js
                    </p>
                </div>

                {/* Subtle discoverable hints — easter eggs that
                    reward the curious. The perf HUD is the closing
                    argument of the backend-craft thesis ("the site
                    I'm asking you to trust me to build is itself the
                    proof"); stealth mode is a recruiter-friendly
                    plain-text resume. */}
                <p className="mt-3 text-center text-[11px] text-gray-600 font-mono flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    <span>
                        press{" "}
                        <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400">
                            `
                        </kbd>{" "}
                        to see how fast this is
                    </span>
                    <span>
                        press{" "}
                        <kbd className="px-1 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400">
                            Esc
                        </kbd>{" "}
                        twice for a printable resume
                    </span>
                    <Link
                        href="/lab"
                        className="text-violet-500/70 hover:text-violet-300 transition-colors"
                    >
                        /lab — live experiments →
                    </Link>
                </p>
            </div>
        </footer>
    );
}

export default Footer;
