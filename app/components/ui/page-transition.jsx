"use client";

// Route-level page transitions live in `view-transitions.jsx` now and
// use the native browser View Transitions API (no Framer Motion). This
// file keeps the scroll-into-view helpers (FadeIn, SectionTransition,
// StaggerContainer, StaggerItem, ScaleIn) which are still consumed by
// every homepage section.

import { motion } from "framer-motion";

/**
 * SectionTransition - Animated section wrapper
 */
export const SectionTransition = ({
    children,
    className = "",
    delay = 0,
}) => {
    return (
        <motion.section
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
                duration: 0.8,
                delay,
                ease: [0.4, 0, 0.2, 1],
            }}
            className={className}
        >
            {children}
        </motion.section>
    );
};

/**
 * StaggerContainer - Container for staggered child animations
 */
export const StaggerContainer = ({
    children,
    className = "",
    staggerDelay = 0.1,
    containerDelay = 0,
}) => {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                delay: containerDelay,
                staggerChildren: staggerDelay,
            },
        },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-50px" }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * StaggerItem - Individual item for stagger animations
 */
export const StaggerItem = ({ children, className = "" }) => {
    const itemVariants = {
        hidden: { opacity: 0, y: 30 },
        visible: {
            opacity: 1,
            y: 0,
            transition: {
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1],
            },
        },
    };

    return (
        <motion.div variants={itemVariants} className={className}>
            {children}
        </motion.div>
    );
};

/**
 * FadeIn - Simple fade in animation
 */
export const FadeIn = ({
    children,
    className = "",
    delay = 0,
    direction = "up", // up, down, left, right
}) => {
    const directions = {
        up: { y: 40, x: 0 },
        down: { y: -40, x: 0 },
        left: { y: 0, x: 40 },
        right: { y: 0, x: -40 },
    };

    const { x, y } = directions[direction];

    return (
        <motion.div
            initial={{ opacity: 0, x, y }}
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
                duration: 0.7,
                delay,
                ease: [0.4, 0, 0.2, 1],
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

/**
 * ScaleIn - Scale in animation
 */
export const ScaleIn = ({ children, className = "", delay = 0 }) => {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{
                duration: 0.5,
                delay,
                ease: [0.4, 0, 0.2, 1],
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

