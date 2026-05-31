"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { BsGithub } from "react-icons/bs";
import { MdArrowOutward } from "react-icons/md";

const sizeClasses = {
    large: "col-span-2 row-span-2",
    wide: "col-span-2 row-span-1",
    tall: "col-span-1 row-span-2",
    medium: "col-span-1 row-span-1",
};

const heightClasses = {
    large: "min-h-[400px]",
    wide: "min-h-[200px]",
    tall: "min-h-[400px]",
    medium: "min-h-[200px]",
};

const BentoCard = ({ project, index, size = "medium" }) => {
    const [isHovered, setIsHovered] = useState(false);
    const href = `/projects/${project.slug}`;

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={`${sizeClasses[size]} ${heightClasses[size]} relative group glass-card overflow-hidden`}
        >
            {/* The whole card is a real link — covers the article via
                absolute inset-0 so any click area routes to the case
                study. Inner buttons (GitHub) opt out via z-index +
                stopPropagation. */}
            <Link
                href={href}
                aria-label={`Open case study for ${project.name}`}
                className="absolute inset-0 z-10 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-dark-900"
            />

            {/* Gradient overlay on hover */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/20 opacity-0 transition-opacity duration-500 pointer-events-none"
                animate={{ opacity: isHovered ? 1 : 0 }}
            />

            {/* Content */}
            <div className="relative h-full p-6 flex flex-col justify-between pointer-events-none">
                {/* Top section */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono text-violet-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                            {project.role}
                        </span>
                    </div>

                    <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-3 group-hover:text-violet-300 transition-colors duration-300">
                        {project.name}
                    </h3>

                    <p
                        className={`text-gray-400 text-sm leading-relaxed ${
                            size === "large" || size === "tall"
                                ? "line-clamp-4"
                                : "line-clamp-2"
                        }`}
                    >
                        {project.description}
                    </p>
                </div>

                {/* Bottom section */}
                <div className="mt-4">
                    <div className="flex flex-wrap gap-2 mb-4">
                        {project.tools
                            .slice(0, size === "medium" ? 3 : 5)
                            .map((tool, i) => (
                                <span
                                    key={i}
                                    className="px-2 py-1 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full"
                                >
                                    {tool}
                                </span>
                            ))}
                        {project.tools.length > (size === "medium" ? 3 : 5) && (
                            <span className="px-2 py-1 text-xs font-medium text-gray-500">
                                +{project.tools.length - (size === "medium" ? 3 : 5)} more
                            </span>
                        )}
                    </div>

                    {/* Action row — GitHub link sits above the overlay
                        Link so clicks on it open the repo instead of
                        routing to the case study. */}
                    <div className="flex items-center gap-3 pointer-events-auto relative z-20">
                        {project.code && (
                            <Link
                                href={project.code}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
                            >
                                <BsGithub size={16} />
                                <span>Code</span>
                            </Link>
                        )}
                        <motion.span
                            className="flex items-center gap-1 text-sm text-violet-400 ml-auto"
                            animate={{ x: isHovered ? 5 : 0 }}
                        >
                            Read case study
                            <MdArrowOutward size={16} />
                        </motion.span>
                    </div>
                </div>
            </div>

            <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
        </motion.article>
    );
};

export { BentoCard };
