"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { projectsData } from "@/utils/data/projects-data";
import { BentoCard, ProjectModal } from "./bento-card";
import { FadeIn } from "../../ui/page-transition";

// Assign sizes to projects for bento grid layout
const getProjectSize = (index) => {
    const sizes = ["large", "wide", "medium", "tall", "medium", "wide"];
    return sizes[index % sizes.length];
};

const Projects = () => {
    const [selectedProject, setSelectedProject] = useState(null);

    return (
        <section id="projects" className="relative py-24 lg:py-32">
            {/* Background decoration */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute top-1/4 -left-32 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
            </div>

            {/* Section Header */}
            <FadeIn>
                <div className="text-center mb-16">
                    <motion.span
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-block text-sm font-mono text-violet-400 mb-4"
                    >
                        &lt;projects&gt;
                    </motion.span>
                    <h2 className="section-heading">Featured Work</h2>
                    <p className="section-subheading mx-auto">
                        A selection of projects I&apos;ve built, from full-stack applications
                        to innovative solutions.
                    </p>
                </div>
            </FadeIn>

            {/* Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 auto-rows-min">
                {projectsData.map((project, index) => (
                    <BentoCard
                        key={project.id}
                        project={project}
                        index={index}
                        size={getProjectSize(index)}
                        onViewDetails={setSelectedProject}
                    />
                ))}
            </div>

            {/* Section closing tag */}
            <FadeIn>
                <div className="text-center mt-16">
                    <span className="text-sm font-mono text-violet-400">
                        &lt;/projects&gt;
                    </span>
                </div>
            </FadeIn>

            {/* Project Modal */}
            <AnimatePresence>
                {selectedProject && (
                    <ProjectModal
                        project={selectedProject}
                        onClose={() => setSelectedProject(null)}
                    />
                )}
            </AnimatePresence>
        </section>
    );
};

export default Projects;
