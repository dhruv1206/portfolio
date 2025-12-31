"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { BsGithub, BsArrowLeft } from "react-icons/bs";
import { MdArrowOutward } from "react-icons/md";
import {
    StickySidebar,
    BeforeAfterSlider,
    VideoEmbed,
} from "@/app/components/case-study/case-study-components";
import MagneticButton from "@/app/components/ui/magnetic-button";
import { FadeIn } from "@/app/components/ui/page-transition";

export default function CaseStudyPage({ project }) {
    return (
        <article className="relative py-24 lg:py-32">
            {/* Back button */}
            <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-8"
            >
                <Link
                    href="/#projects"
                    className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-violet-400 transition-colors"
                >
                    <BsArrowLeft />
                    <span>Back to Projects</span>
                </Link>
            </motion.div>

            {/* Hero Section */}
            <FadeIn>
                <header className="mb-16">
                    {/* Project number & role */}
                    <div className="flex items-center gap-4 mb-6">
                        <span
                            className="text-xs font-mono px-3 py-1 rounded-full"
                            style={{
                                backgroundColor: `${project.accentColor}20`,
                                color: project.accentColor,
                            }}
                        >
                            {project.role}
                        </span>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-white mb-6 leading-tight">
                        {project.name}
                    </h1>

                    {/* Description */}
                    <p className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed">
                        {project.description}
                    </p>

                    {/* CTAs */}
                    <div className="flex flex-wrap items-center gap-4 mt-8">
                        {project.url && (
                            <MagneticButton
                                href={project.url}
                                variant="primary"
                                size="lg"
                                external
                            >
                                <span>View Project</span>
                                <MdArrowOutward size={18} />
                            </MagneticButton>
                        )}
                        {project.code && (
                            <MagneticButton
                                href={project.code}
                                variant="secondary"
                                size="lg"
                                external
                            >
                                <BsGithub size={18} />
                                <span>Source Code</span>
                            </MagneticButton>
                        )}
                    </div>
                </header>
            </FadeIn>

            {/* Main content with sidebar */}
            <div className="flex gap-12">
                {/* Sidebar */}
                <StickySidebar
                    challenge={project.challenge}
                    solution={project.solution}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Challenge Section */}
                    <FadeIn>
                        <section id="challenge" className="mb-16">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-xs font-mono text-violet-400">
                                    01
                                </span>
                                <h2 className="text-2xl md:text-3xl font-display font-bold text-white">
                                    The Challenge
                                </h2>
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-violet-500/50 to-transparent" />
                            </div>
                            <div className="glass-card p-6 md:p-8">
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    {project.challenge ||
                                        "This project addressed key technical and user experience challenges in the domain."}
                                </p>
                            </div>
                        </section>
                    </FadeIn>

                    {/* Solution Section */}
                    <FadeIn>
                        <section id="solution" className="mb-16">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-xs font-mono text-cyan-400">
                                    02
                                </span>
                                <h2 className="text-2xl md:text-3xl font-display font-bold text-white">
                                    The Solution
                                </h2>
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-500/50 to-transparent" />
                            </div>
                            <div className="glass-card p-6 md:p-8">
                                <p className="text-gray-300 leading-relaxed text-lg">
                                    {project.solution ||
                                        "The solution involved careful architecture design and implementation of modern best practices."}
                                </p>
                            </div>
                        </section>
                    </FadeIn>

                    {/* Tech Stack */}
                    <FadeIn>
                        <section id="tech-stack" className="mb-16">
                            <div className="flex items-center gap-4 mb-6">
                                <span className="text-xs font-mono text-pink-400">
                                    03
                                </span>
                                <h2 className="text-2xl md:text-3xl font-display font-bold text-white">
                                    Tech Stack
                                </h2>
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-pink-500/50 to-transparent" />
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {project.tools.map((tool, index) => (
                                    <motion.span
                                        key={tool}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="px-4 py-2 text-sm font-medium rounded-full border"
                                        style={{
                                            borderColor: `${project.accentColor}40`,
                                            backgroundColor: `${project.accentColor}10`,
                                            color: project.accentColor,
                                        }}
                                    >
                                        {tool}
                                    </motion.span>
                                ))}
                            </div>
                        </section>
                    </FadeIn>

                    {/* Gallery (if available) */}
                    {project.gallery && project.gallery.length > 0 && (
                        <FadeIn>
                            <section id="gallery" className="mb-16">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="text-xs font-mono text-green-400">
                                        04
                                    </span>
                                    <h2 className="text-2xl md:text-3xl font-display font-bold text-white">
                                        Gallery
                                    </h2>
                                    <div className="flex-1 h-[1px] bg-gradient-to-r from-green-500/50 to-transparent" />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {project.gallery.map((image, index) => (
                                        <motion.div
                                            key={index}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className="rounded-xl overflow-hidden"
                                        >
                                            <img
                                                src={image}
                                                alt={`${project.name} screenshot ${index + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        </motion.div>
                                    ))}
                                </div>
                            </section>
                        </FadeIn>
                    )}

                    {/* Video (if available) */}
                    {project.video && (
                        <FadeIn>
                            <section className="mb-16">
                                <div className="flex items-center gap-4 mb-6">
                                    <span className="text-xs font-mono text-orange-400">
                                        05
                                    </span>
                                    <h2 className="text-2xl md:text-3xl font-display font-bold text-white">
                                        Demo Video
                                    </h2>
                                    <div className="flex-1 h-[1px] bg-gradient-to-r from-orange-500/50 to-transparent" />
                                </div>
                                <VideoEmbed
                                    url={project.video}
                                    title={`${project.name} Demo`}
                                />
                            </section>
                        </FadeIn>
                    )}
                </div>
            </div>

            {/* Bottom CTA */}
            <FadeIn>
                <div className="mt-24 text-center">
                    <p className="text-gray-500 mb-6">
                        Interested in working together?
                    </p>
                    <MagneticButton href="/#contact" variant="primary" size="lg">
                        <span>Let&apos;s Talk</span>
                        <MdArrowOutward size={18} />
                    </MagneticButton>
                </div>
            </FadeIn>
        </article>
    );
}
