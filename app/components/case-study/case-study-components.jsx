"use client";

import { useState, useRef, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

/**
 * StickySidebar - Challenge/Solution navigation for case studies
 */
export const StickySidebar = ({ challenge, solution }) => {
    const [activeSection, setActiveSection] = useState("challenge");

    return (
        <aside className="hidden lg:block sticky top-24 self-start w-64 shrink-0">
            <nav className="space-y-4">
                <button
                    onClick={() => {
                        document
                            .getElementById("challenge")
                            ?.scrollIntoView({ behavior: "smooth" });
                        setActiveSection("challenge");
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeSection === "challenge"
                            ? "bg-violet-500/20 border-l-2 border-violet-500 text-white"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <span className="text-xs uppercase tracking-wider text-violet-400 block mb-1">
                        01
                    </span>
                    <span className="font-medium">The Challenge</span>
                </button>

                <button
                    onClick={() => {
                        document
                            .getElementById("solution")
                            ?.scrollIntoView({ behavior: "smooth" });
                        setActiveSection("solution");
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-all ${activeSection === "solution"
                            ? "bg-cyan-500/20 border-l-2 border-cyan-500 text-white"
                            : "text-gray-400 hover:text-white hover:bg-white/5"
                        }`}
                >
                    <span className="text-xs uppercase tracking-wider text-cyan-400 block mb-1">
                        02
                    </span>
                    <span className="font-medium">The Solution</span>
                </button>
            </nav>

            {/* Quick stats */}
            <div className="mt-8 pt-8 border-t border-white/10">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                    Jump to
                </p>
                <div className="space-y-2">
                    <button
                        onClick={() =>
                            document
                                .getElementById("tech-stack")
                                ?.scrollIntoView({ behavior: "smooth" })
                        }
                        className="block text-sm text-gray-400 hover:text-violet-400 transition-colors"
                    >
                        Tech Stack
                    </button>
                    <button
                        onClick={() =>
                            document
                                .getElementById("gallery")
                                ?.scrollIntoView({ behavior: "smooth" })
                        }
                        className="block text-sm text-gray-400 hover:text-violet-400 transition-colors"
                    >
                        Gallery
                    </button>
                </div>
            </div>
        </aside>
    );
};

/**
 * BeforeAfterSlider - Image comparison component
 */
export const BeforeAfterSlider = ({ beforeImage, afterImage, beforeLabel = "Before", afterLabel = "After" }) => {
    const containerRef = useRef(null);
    const [sliderPosition, setSliderPosition] = useState(50);
    const [isDragging, setIsDragging] = useState(false);

    const handleMove = (clientX) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(percentage);
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        handleMove(e.clientX);
    };

    const handleTouchMove = (e) => {
        if (!isDragging) return;
        handleMove(e.touches[0].clientX);
    };

    useEffect(() => {
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("touchend", handleMouseUp);
        return () => {
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("touchend", handleMouseUp);
        };
    }, []);

    return (
        <div
            ref={containerRef}
            className="relative w-full aspect-video rounded-xl overflow-hidden cursor-ew-resize select-none"
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            onMouseDown={() => setIsDragging(true)}
            onTouchStart={() => setIsDragging(true)}
        >
            {/* After image (full width) */}
            <div className="absolute inset-0">
                <img
                    src={afterImage}
                    alt={afterLabel}
                    className="w-full h-full object-cover"
                    draggable={false}
                />
                <span className="absolute top-4 right-4 px-3 py-1 bg-cyan-500/80 text-white text-xs font-medium rounded-full">
                    {afterLabel}
                </span>
            </div>

            {/* Before image (clipped) */}
            <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
                <img
                    src={beforeImage}
                    alt={beforeLabel}
                    className="w-full h-full object-cover"
                    draggable={false}
                />
                <span className="absolute top-4 left-4 px-3 py-1 bg-violet-500/80 text-white text-xs font-medium rounded-full">
                    {beforeLabel}
                </span>
            </div>

            {/* Slider handle */}
            <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                style={{ left: `${sliderPosition}%`, transform: "translateX(-50%)" }}
            >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center">
                    <svg
                        className="w-5 h-5 text-gray-800"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 9l4-4 4 4m0 6l-4 4-4-4"
                        />
                    </svg>
                </div>
            </div>
        </div>
    );
};

/**
 * VideoEmbed - Custom video player for Loom/YouTube
 */
export const VideoEmbed = ({ url, thumbnail, title }) => {
    const [isPlaying, setIsPlaying] = useState(false);

    // Parse video URL to get embed URL
    const getEmbedUrl = (url) => {
        if (url.includes("youtube.com") || url.includes("youtu.be")) {
            const videoId = url.includes("youtu.be")
                ? url.split("/").pop()
                : new URLSearchParams(new URL(url).search).get("v");
            return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        }
        if (url.includes("loom.com")) {
            const videoId = url.split("/").pop()?.split("?")[0];
            return `https://www.loom.com/embed/${videoId}?autoplay=1`;
        }
        return url;
    };

    if (isPlaying) {
        return (
            <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                <iframe
                    src={getEmbedUrl(url)}
                    title={title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
        );
    }

    return (
        <button
            onClick={() => setIsPlaying(true)}
            className="relative w-full aspect-video rounded-xl overflow-hidden group"
        >
            {/* Thumbnail */}
            <div className="absolute inset-0 bg-dark-800">
                {thumbnail && (
                    <img
                        src={thumbnail}
                        alt={title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            </div>

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center"
                >
                    <svg
                        className="w-8 h-8 text-white ml-1"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </motion.div>
            </div>

            {/* Title */}
            {title && (
                <div className="absolute bottom-4 left-4 right-4">
                    <p className="text-white font-medium truncate">{title}</p>
                </div>
            )}
        </button>
    );
};

export default { StickySidebar, BeforeAfterSlider, VideoEmbed };
