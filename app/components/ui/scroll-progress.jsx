"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";

/**
 * ScrollProgress - Fixed top progress bar showing scroll position
 */
const ScrollProgress = () => {
    const [isVisible, setIsVisible] = useState(false);
    const { scrollYProgress } = useScroll();

    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    useEffect(() => {
        const handleScroll = () => {
            // Show after scrolling past hero section
            setIsVisible(window.scrollY > 300);
        };

        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    return (
        <motion.div
            className="fixed top-0 left-0 right-0 h-[3px] z-[100] origin-left"
            style={{
                scaleX,
                background: "linear-gradient(90deg, #8b5cf6 0%, #06b6d4 50%, #f472b6 100%)",
                opacity: isVisible ? 1 : 0,
                transition: "opacity 0.3s",
            }}
        />
    );
};

export default ScrollProgress;
