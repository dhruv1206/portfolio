"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { experiences } from "@/utils/data/experience";
import { FadeIn } from "../../ui/page-transition";

if (typeof window !== "undefined") {
    gsap.registerPlugin(ScrollTrigger);
}

const ExperienceCard = ({ experience, index, isLeft }) => {
    const cardRef = useRef(null);

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, x: isLeft ? -50 : 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className={`relative flex items-center ${isLeft ? "lg:justify-end" : "lg:justify-start"
                } w-full lg:w-1/2 ${isLeft ? "lg:pr-12" : "lg:pl-12 lg:ml-auto"}`}
        >
            <div className="glass-card p-6 w-full max-w-md group">
                {/* Top row - Duration & Icon */}
                <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-mono text-cyan-400">
                        {experience.duration}
                    </span>
                    {experience.icon && (
                        <div className="w-10 h-10 relative overflow-hidden rounded-lg bg-white/10 p-1.5">
                            <Image
                                src={experience.icon}
                                alt={experience.company}
                                fill
                                sizes="40px"
                                className="object-contain"
                            />
                        </div>
                    )}
                </div>

                {/* Title */}
                <h3 className="text-lg font-display font-semibold text-white mb-1 group-hover:text-violet-300 transition-colors">
                    {experience.title}
                </h3>

                {/* Company */}
                <p className="text-base text-gray-400">{experience.company}</p>

                {/* Decorative elements */}
                <div className="absolute -top-10 -right-10 w-20 h-20 bg-violet-500/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            {/* Timeline dot */}
            <div
                className={`hidden lg:block absolute top-1/2 -translate-y-1/2 ${isLeft ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2"
                    }`}
            >
                <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 + 0.3 }}
                    className="w-4 h-4 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-full border-4 border-dark-900"
                />
            </div>
        </motion.div>
    );
};

function Experience() {
    const sectionRef = useRef(null);
    const lineRef = useRef(null);

    useEffect(() => {
        if (typeof window === "undefined" || !lineRef.current) return;

        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        if (prefersReducedMotion) {
            gsap.set(lineRef.current, { scaleY: 1 });
            return;
        }

        gsap.fromTo(
            lineRef.current,
            { scaleY: 0 },
            {
                scaleY: 1,
                ease: "none",
                scrollTrigger: {
                    trigger: sectionRef.current,
                    start: "top center",
                    end: "bottom center",
                    scrub: true,
                },
            }
        );

        return () => {
            ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
        };
    }, []);

    return (
        <section
            ref={sectionRef}
            id="experience"
            className="relative py-24 lg:py-32"
        >
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-violet-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Section Header */}
            <FadeIn>
                <div className="text-center mb-16">
                    <span className="inline-block text-sm font-mono text-violet-400 mb-4">
                        &lt;experience&gt;
                    </span>
                    <h2 className="section-heading">Professional Journey</h2>
                    <p className="section-subheading mx-auto">
                        My career path and the amazing teams I&apos;ve worked with.
                    </p>
                </div>
            </FadeIn>

            {/* Timeline */}
            <div className="relative">
                {/* Vertical line - desktop only */}
                <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-[2px] bg-dark-600 -translate-x-1/2">
                    <div
                        ref={lineRef}
                        className="absolute inset-0 bg-gradient-to-b from-violet-500 via-cyan-500 to-pink-500 origin-top"
                        style={{ transformOrigin: "top" }}
                    />
                </div>

                {/* Experience Cards */}
                <div className="space-y-8 lg:space-y-16">
                    {experiences.map((experience, index) => (
                        <ExperienceCard
                            key={experience.id}
                            experience={experience}
                            index={index}
                            isLeft={index % 2 === 0}
                        />
                    ))}
                </div>
            </div>

            {/* Section closing tag */}
            <FadeIn>
                <div className="text-center mt-16">
                    <span className="text-sm font-mono text-violet-400">
                        &lt;/experience&gt;
                    </span>
                </div>
            </FadeIn>
        </section>
    );
}

export default Experience;
