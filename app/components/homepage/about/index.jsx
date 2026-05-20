"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { personalData } from "@/utils/data/personal-data";
import { FadeIn } from "../../ui/page-transition";

const stats = [
    { label: "DSA Problems", value: "700+", suffix: "" },
    { label: "Projects", value: "15+", suffix: "" },
    { label: "Experience", value: "2+", suffix: "yrs" },
];

function AboutSection() {
    return (
        <section id="about" className="relative py-24 lg:py-32">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-violet-500/10 rounded-full blur-[100px]" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-[100px]" />
            </div>

            <div className="relative z-10">
                {/* Section Header */}
                <FadeIn>
                    <div className="text-center mb-16">
                        <span className="inline-block text-sm font-mono text-violet-400 mb-4">
                            &lt;about&gt;
                        </span>
                        <h2 className="section-heading">About Me</h2>
                    </div>
                </FadeIn>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
                    {/* Left - Image */}
                    <FadeIn direction="left">
                        <div className="relative flex justify-center lg:justify-end">
                            {/* Main image container */}
                            <div className="relative w-[280px] h-[340px] md:w-[320px] md:h-[400px]">
                                {/* Gradient border effect */}
                                <div className="absolute -inset-1 bg-gradient-to-br from-violet-500 via-cyan-500 to-pink-500 rounded-2xl opacity-50 blur-sm" />

                                {/* Image */}
                                <div className="relative w-full h-full rounded-2xl overflow-hidden bg-dark-800">
                                    <Image
                                        src={personalData.profile}
                                        alt="Dhruv Agrawal"
                                        fill
                                        sizes="(min-width: 768px) 320px, 280px"
                                        className="object-cover transition-all duration-700 grayscale hover:grayscale-0 hover:scale-105"
                                        priority
                                    />
                                </div>

                                {/* Floating decoration */}
                                <motion.div
                                    animate={{
                                        y: [0, -10, 0],
                                        rotate: [0, 5, 0],
                                    }}
                                    transition={{
                                        duration: 4,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                    }}
                                    className="absolute -top-6 -left-6 w-12 h-12 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-lg opacity-80"
                                />
                                <motion.div
                                    animate={{
                                        y: [0, 10, 0],
                                        rotate: [0, -5, 0],
                                    }}
                                    transition={{
                                        duration: 5,
                                        repeat: Infinity,
                                        ease: "easeInOut",
                                        delay: 1,
                                    }}
                                    className="absolute -bottom-4 -right-4 w-8 h-8 bg-gradient-to-br from-cyan-500 to-pink-500 rounded-lg opacity-80"
                                />
                            </div>
                        </div>
                    </FadeIn>

                    {/* Right - Content */}
                    <FadeIn direction="right">
                        <div>
                            {/* Who am I */}
                            <div className="flex items-center gap-4 mb-6">
                                <h3 className="text-lg font-display font-semibold text-cyan-400">
                                    Who am I?
                                </h3>
                                <div className="flex-1 h-[1px] bg-gradient-to-r from-cyan-500/50 to-transparent" />
                            </div>

                            {/* Description */}
                            <p className="text-gray-300 text-base leading-relaxed mb-8">
                                I am a passionate software engineer with a strong foundation in
                                full-stack development, specializing in building scalable and
                                efficient web and mobile applications. With hands-on experience
                                in leading product engineering initiatives, I have successfully
                                launched end-to-end solutions, leveraging technologies like{" "}
                                <span className="text-violet-400">Flutter</span>,{" "}
                                <span className="text-violet-400">Node.js</span>, and{" "}
                                <span className="text-violet-400">Google Cloud Platform</span>.
                            </p>

                            <p className="text-gray-400 text-base leading-relaxed mb-8">
                                I thrive in solving complex challenges, whether it&apos;s reducing
                                operational costs by 97% or implementing deep learning models
                                that drive accuracy and business growth. I enjoy solving data
                                structures and algorithms problems, with over 700+ DSA questions
                                solved across platforms. Open to exciting opportunities where I
                                can contribute, grow, and make a meaningful impact.
                            </p>

                            {/* Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                {stats.map((stat, index) => (
                                    <motion.div
                                        key={stat.label}
                                        initial={{ opacity: 0, y: 20 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: index * 0.1 }}
                                        className="glass-card p-4 text-center"
                                    >
                                        <div className="text-2xl md:text-3xl font-display font-bold gradient-text">
                                            {stat.value}
                                            <span className="text-lg">{stat.suffix}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1">
                                            {stat.label}
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </FadeIn>
                </div>

                {/* Section closing tag */}
                <FadeIn>
                    <div className="text-center mt-16">
                        <span className="text-sm font-mono text-violet-400">
                            &lt;/about&gt;
                        </span>
                    </div>
                </FadeIn>
            </div>
        </section>
    );
}

export default AboutSection;
