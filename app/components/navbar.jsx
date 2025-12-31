"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import { useAudio } from "@/app/providers/audio-provider";
import { BsVolumeUp, BsVolumeMute } from "react-icons/bs";

const navLinks = [
    { name: "About", href: "#about" },
    { name: "Experience", href: "#experience" },
    { name: "Skills", href: "#skills" },
    { name: "Projects", href: "#projects" },
    { name: "Blog", href: "#blog" },
    { name: "Contact", href: "#contact" },
];

function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState("");
    const [hidden, setHidden] = useState(false);
    const [lastScrollY, setLastScrollY] = useState(0);

    // Audio mute state
    let isMuted = true;
    let toggleMute = () => { };
    try {
        const audio = useAudio();
        isMuted = audio.isMuted;
        toggleMute = audio.toggleMute;
    } catch {
        // AudioProvider not available, use defaults
    }

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Toggle glassmorphism effect
            setScrolled(currentScrollY > 50);

            // Hide/show on scroll direction
            if (currentScrollY > lastScrollY && currentScrollY > 200) {
                setHidden(true);
            } else {
                setHidden(false);
            }

            setLastScrollY(currentScrollY);

            // Active section detection
            const sections = navLinks.map((link) =>
                document.querySelector(link.href)
            );
            const scrollPosition = window.scrollY + 200;

            sections.forEach((section) => {
                if (section) {
                    const sectionTop = section.offsetTop;
                    const sectionHeight = section.offsetHeight;
                    const sectionId = section.getAttribute("id");

                    if (
                        scrollPosition >= sectionTop &&
                        scrollPosition < sectionTop + sectionHeight
                    ) {
                        setActiveSection(`#${sectionId}`);
                    }
                }
            });
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [lastScrollY]);

    const handleLinkClick = () => {
        setIsOpen(false);
    };

    return (
        <motion.nav
            initial={{ y: -100 }}
            animate={{ y: hidden ? -100 : 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled
                ? "glass border-b border-white/5"
                : "bg-transparent"
                }`}
        >
            <div className="mx-auto px-6 sm:px-12 lg:max-w-[70rem] xl:max-w-[76rem] 2xl:max-w-[92rem]">
                <div className="flex items-center justify-between py-4">
                    {/* Logo */}
                    <Link
                        href="/"
                        className="relative group"
                        onClick={handleLinkClick}
                    >
                        <span className="text-2xl md:text-3xl font-display font-bold tracking-tight">
                            <span className="gradient-text">D</span>
                            <span className="text-white">hruv</span>
                        </span>
                        <motion.span
                            className="absolute -bottom-1 left-0 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500"
                            initial={{ width: 0 }}
                            whileHover={{ width: "100%" }}
                            transition={{ duration: 0.3 }}
                        />
                    </Link>

                    {/* Desktop Navigation */}
                    <ul className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <li key={link.name}>
                                <Link
                                    href={link.href}
                                    className={`relative px-4 py-2 text-sm font-medium transition-colors duration-300 ${activeSection === link.href
                                        ? "text-violet-400"
                                        : "text-gray-300 hover:text-white"
                                        }`}
                                    onClick={handleLinkClick}
                                >
                                    {link.name}
                                    {activeSection === link.href && (
                                        <motion.span
                                            layoutId="activeSection"
                                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-violet-500 rounded-full"
                                            transition={{
                                                type: "spring",
                                                stiffness: 300,
                                                damping: 30,
                                            }}
                                        />
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>

                    {/* Right side buttons - Desktop */}
                    <div className="hidden md:flex items-center gap-3">
                        {/* Audio toggle */}
                        <button
                            onClick={toggleMute}
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-violet-400 hover:border-violet-500/50 transition-all"
                            aria-label={isMuted ? "Unmute sounds" : "Mute sounds"}
                            title={isMuted ? "Enable sounds" : "Disable sounds"}
                        >
                            {isMuted ? <BsVolumeMute size={16} /> : <BsVolumeUp size={16} />}
                        </button>

                        {/* Resume button */}
                        <Link
                            href={personalData.resume}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-xs"
                        >
                            Resume
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsOpen(!isOpen)}
                        className="md:hidden relative w-10 h-10 flex items-center justify-center"
                        aria-label="Toggle menu"
                    >
                        <div className="w-6 h-5 relative flex flex-col justify-between">
                            <motion.span
                                animate={{
                                    rotate: isOpen ? 45 : 0,
                                    y: isOpen ? 8 : 0,
                                }}
                                className="w-full h-[2px] bg-white rounded-full origin-left"
                            />
                            <motion.span
                                animate={{
                                    opacity: isOpen ? 0 : 1,
                                    x: isOpen ? -10 : 0,
                                }}
                                className="w-full h-[2px] bg-white rounded-full"
                            />
                            <motion.span
                                animate={{
                                    rotate: isOpen ? -45 : 0,
                                    y: isOpen ? -8 : 0,
                                }}
                                className="w-full h-[2px] bg-white rounded-full origin-left"
                            />
                        </div>
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="md:hidden glass border-t border-white/5 overflow-hidden"
                    >
                        <div className="px-6 py-6">
                            <ul className="flex flex-col gap-4">
                                {navLinks.map((link, index) => (
                                    <motion.li
                                        key={link.name}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: index * 0.1,
                                        }}
                                    >
                                        <Link
                                            href={link.href}
                                            onClick={handleLinkClick}
                                            className={`block py-2 text-lg font-medium ${activeSection === link.href
                                                ? "text-violet-400"
                                                : "text-gray-300"
                                                }`}
                                        >
                                            {link.name}
                                        </Link>
                                    </motion.li>
                                ))}
                            </ul>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.4 }}
                                className="mt-6 pt-6 border-t border-white/10"
                            >
                                <Link
                                    href={personalData.resume}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-primary w-full text-center"
                                    onClick={handleLinkClick}
                                >
                                    Download Resume
                                </Link>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.nav>
    );
}

export default Navbar;
