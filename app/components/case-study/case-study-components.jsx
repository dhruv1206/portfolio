"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";

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
            <div className="relative w-full aspect-video  overflow-hidden">
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
            className="relative w-full aspect-video  overflow-hidden group"
        >
            {/* Thumbnail */}
            <div className="absolute inset-0 bg-dark-800">
                {thumbnail && (
                    <Image
                        src={thumbnail}
                        alt={title}
                        fill
                        sizes="(min-width: 1024px) 80vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                )}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/30 transition-colors" />
            </div>

            {/* Play button */}
            <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="w-20 h-20  bg-black/60 border border-white/30 flex items-center justify-center"
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
