"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * ClickToCopy - One-click copy with toast feedback
 * No mailto: links - just clean copy functionality
 */
const ClickToCopy = ({
    text,
    displayText = null,
    className = "",
    successMessage = "Copied!",
    children
}) => {
    const [copied, setCopied] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setShowToast(true);

            // Reset after 2 seconds
            setTimeout(() => {
                setCopied(false);
                setShowToast(false);
            }, 2000);
        } catch (err) {
            console.error("Failed to copy:", err);
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = text;
            textarea.style.position = "fixed";
            textarea.style.opacity = "0";
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setShowToast(true);
            setTimeout(() => {
                setCopied(false);
                setShowToast(false);
            }, 2000);
        }
    }, [text]);

    return (
        <div className="relative inline-block">
            <motion.button
                onClick={handleCopy}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                    inline-flex items-center gap-2 px-4 py-2
                    bg-white/5 hover:bg-white/10 
                    border border-white/10 hover:border-violet-500/30
                    rounded-lg transition-all duration-300
                    text-gray-300 hover:text-white
                    group ${className}
                `}
                aria-label={`Copy ${text} to clipboard`}
            >
                {children || (
                    <>
                        <span className="font-mono text-sm">
                            {displayText || text}
                        </span>
                        <svg
                            className={`w-4 h-4 transition-colors ${copied ? "text-green-400" : "text-gray-500 group-hover:text-violet-400"
                                }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            {copied ? (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                />
                            ) : (
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
                                />
                            )}
                        </svg>
                    </>
                )}
            </motion.button>

            {/* Toast notification */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.9 }}
                        className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 
                            bg-green-500/20 border border-green-500/30 
                            rounded-lg text-xs text-green-400 whitespace-nowrap
                            backdrop-blur-sm z-50"
                    >
                        ✓ {successMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ClickToCopy;
