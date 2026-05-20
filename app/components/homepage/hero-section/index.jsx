"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { personalData } from "@/utils/data/personal-data";
import { useMounted } from "@/app/hooks/use-mounted";
import MagneticButton from "../../ui/magnetic-button";
import { BsGithub, BsLinkedin } from "react-icons/bs";
import { SiLeetcode } from "react-icons/si";
import { FaXTwitter } from "react-icons/fa6";
import { MdDownload, MdArrowOutward } from "react-icons/md";

// Dynamically import the system topology to keep it out of the critical path
const SystemTopology = dynamic(() => import("../../hero/system-topology"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
    ),
});

const socialLinks = [
    { icon: BsGithub, href: personalData.github, label: "GitHub" },
    { icon: BsLinkedin, href: personalData.linkedIn, label: "LinkedIn" },
    { icon: SiLeetcode, href: personalData.leetcode, label: "LeetCode" },
    { icon: FaXTwitter, href: personalData.twitter, label: "Twitter" },
];

function HeroSection() {
    const mounted = useMounted();
    const containerRef = useRef(null);

    // Text animation variants
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
                delayChildren: 0.3,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.8,
                ease: [0.4, 0, 0.2, 1],
            },
        },
    };

    const letterVariants = {
        hidden: { opacity: 0, y: 50 },
        visible: (i) => ({
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.5,
                delay: i * 0.05,
                ease: [0.4, 0, 0.2, 1],
            },
        }),
    };

    const firstName = "DHRUV";
    const lastName = "AGRAWAL";

    return (
        <section
            ref={containerRef}
            className="relative min-h-screen flex items-center pt-20 pb-12 overflow-hidden"
        >
            {/* Background decorative elements */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-violet-500/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10 w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
                {/* Left Content */}
                <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="order-2 lg:order-1 flex flex-col"
                >
                    {/* Greeting */}
                    <motion.p
                        variants={itemVariants}
                        className="text-violet-400 font-mono text-sm md:text-base mb-4"
                    >
                        Hello, I&apos;m
                    </motion.p>

                    {/* Giant Name */}
                    <div className="mb-2">
                        <h1 className="font-display font-bold text-display-xl leading-none tracking-tighter">
                            {firstName.split("").map((letter, i) => (
                                <motion.span
                                    key={i}
                                    custom={i}
                                    variants={letterVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="inline-block gradient-text"
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </h1>
                    </div>

                    <div className="mb-6">
                        <h1 className="font-display font-bold text-display-lg leading-none tracking-tighter text-white/90">
                            {lastName.split("").map((letter, i) => (
                                <motion.span
                                    key={i}
                                    custom={i + firstName.length}
                                    variants={letterVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="inline-block"
                                >
                                    {letter}
                                </motion.span>
                            ))}
                        </h1>
                    </div>

                    {/* Tagline */}
                    <motion.div
                        variants={itemVariants}
                        className="flex items-center gap-3 mb-6"
                    >
                        <span className="w-12 h-[2px] bg-gradient-to-r from-violet-500 to-cyan-500" />
                        <p className="text-xl md:text-2xl font-display font-medium text-gray-300">
                            Engineering, <span className="gradient-text">demonstrated.</span>
                        </p>
                    </motion.div>

                    {/* Description */}
                    <motion.p
                        variants={itemVariants}
                        className="text-gray-400 text-base md:text-lg max-w-lg mb-8 leading-relaxed"
                    >
                        Backend engineer architecting systems that serve{" "}
                        <span className="text-violet-300">150k+ MAU</span>, shaving{" "}
                        <span className="text-violet-300">P99 latency</span> from
                        seconds to milliseconds, and cutting infra spend by{" "}
                        <span className="text-violet-300">95%</span>. Every claim on
                        this page is runnable — try the demos.
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        variants={itemVariants}
                        className="flex flex-wrap items-center gap-4 mb-10"
                    >
                        <MagneticButton href="#projects" variant="primary" size="lg">
                            <span>View My Work</span>
                            <MdArrowOutward size={18} />
                        </MagneticButton>

                        <MagneticButton
                            href={personalData.resume}
                            variant="secondary"
                            size="lg"
                            external
                        >
                            <span>Resume</span>
                            <MdDownload size={18} />
                        </MagneticButton>
                    </motion.div>

                    {/* Social Links */}
                    <motion.div
                        variants={itemVariants}
                        className="flex items-center gap-4"
                    >
                        {socialLinks.map((social, index) => (
                            <motion.div
                                key={social.label}
                                whileHover={{ scale: 1.1, y: -2 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Link
                                    href={social.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-12 h-12 flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-400 hover:text-violet-400 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all duration-300"
                                    aria-label={social.label}
                                >
                                    <social.icon size={20} />
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                </motion.div>

                {/* Right Content - 3D Element */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                        duration: 1,
                        delay: 0.5,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                    className="order-1 lg:order-2 relative h-[350px] md:h-[450px] lg:h-[500px]"
                >
                    {mounted && <SystemTopology />}
                </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            >
                <span className="text-xs text-gray-500 uppercase tracking-widest">
                    Scroll
                </span>
                <motion.div
                    animate={{ y: [0, 8, 0] }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                    className="w-6 h-10 rounded-full border-2 border-gray-700 flex justify-center pt-2"
                >
                    <div className="w-1 h-2 bg-violet-500 rounded-full" />
                </motion.div>
            </motion.div>
        </section>
    );
}

export default HeroSection;
