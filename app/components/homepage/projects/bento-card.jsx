"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { BsGithub } from "react-icons/bs";
import { MdArrowOutward, MdClose } from "react-icons/md";

const BentoCard = ({ project, index, size = "medium", onViewDetails }) => {
    const [isHovered, setIsHovered] = useState(false);

    // Size configurations for bento grid
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

    const handleKeyDown = (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onViewDetails(project);
        }
    };

    return (
        <motion.article
            layout
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            tabIndex={0}
            role="button"
            aria-label={`View details for ${project.name}`}
            onKeyDown={handleKeyDown}
            className={`
        ${sizeClasses[size]} ${heightClasses[size]}
        relative group glass-card overflow-hidden
        cursor-pointer
        focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-dark-900
      `}
            onClick={() => onViewDetails(project)}
        >
            {/* Gradient overlay on hover */}
            <motion.div
                className="absolute inset-0 bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-500/20 opacity-0 transition-opacity duration-500"
                animate={{ opacity: isHovered ? 1 : 0 }}
            />

            {/* Content */}
            <div className="relative h-full p-6 flex flex-col justify-between z-10">
                {/* Top section */}
                <div>
                    {/* Project number & role */}
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-mono text-violet-400">
                            {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                            {project.role}
                        </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl md:text-2xl font-display font-bold text-white mb-3 group-hover:text-violet-300 transition-colors duration-300">
                        {project.name}
                    </h3>

                    {/* Description - show more on larger cards */}
                    <p
                        className={`text-gray-400 text-sm leading-relaxed ${size === "large" || size === "tall"
                            ? "line-clamp-4"
                            : "line-clamp-2"
                            }`}
                    >
                        {project.description}
                    </p>
                </div>

                {/* Bottom section */}
                <div className="mt-4">
                    {/* Tech stack */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        {project.tools.slice(0, size === "medium" ? 3 : 5).map((tool, i) => (
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

                    {/* Action buttons */}
                    <div className="flex items-center gap-3">
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
                            View Details
                            <MdArrowOutward size={16} />
                        </motion.span>
                    </div>
                </div>
            </div>

            {/* Glow effect on corners */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        </motion.article>
    );
};

// Project Detail Modal
const ProjectModal = ({ project, onClose }) => {
    if (!project) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25 }}
                className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
                >
                    <MdClose size={20} />
                </button>

                {/* Content */}
                <div className="p-8">
                    {/* Header */}
                    <div className="mb-6">
                        <span className="text-xs font-mono text-violet-400 mb-2 block">
                            {project.role}
                        </span>
                        <h2 className="text-3xl font-display font-bold text-white mb-4">
                            {project.name}
                        </h2>
                        <p className="text-gray-400 leading-relaxed">
                            {project.description}
                        </p>
                    </div>

                    {/* Tech stack */}
                    <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                            Technologies
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {project.tools.map((tool, i) => (
                                <span
                                    key={i}
                                    className="px-3 py-1.5 text-sm font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-full"
                                >
                                    {tool}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-4">
                        {project.url && (
                            <Link
                                href={project.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-primary"
                            >
                                <span>View Project</span>
                                <MdArrowOutward size={16} />
                            </Link>
                        )}
                        {project.code && (
                            <Link
                                href={project.code}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-secondary"
                            >
                                <BsGithub size={16} />
                                <span>Source Code</span>
                            </Link>
                        )}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};

export { BentoCard, ProjectModal };
