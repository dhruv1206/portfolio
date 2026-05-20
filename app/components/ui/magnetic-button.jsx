"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import Link from "next/link";
import { useAudio } from "@/app/providers/audio-provider";
import { useHaptics } from "@/app/hooks/use-haptics";

const MagneticButton = ({
    children,
    href,
    onClick,
    variant = "primary", // primary, secondary, ghost
    size = "md", // sm, md, lg
    className = "",
    external = false,
    magneticStrength = 0.3, // How strongly button follows cursor
    ...props
}) => {
    const buttonRef = useRef(null);
    const animationFrame = useRef(null);
    const [isHovered, setIsHovered] = useState(false);

    // Use motion values + springs for smoother physics
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { damping: 20, stiffness: 300, mass: 0.5 });
    const springY = useSpring(y, { damping: 20, stiffness: 300, mass: 0.5 });

    // Content follows at half the speed
    const contentX = useSpring(x, { damping: 25, stiffness: 400, mass: 0.3 });
    const contentY = useSpring(y, { damping: 25, stiffness: 400, mass: 0.3 });

    // Audio + haptics. Both hooks always return objects (useAudio's
    // context has a default, useHaptics has no provider dependency), so
    // they can be called unconditionally — the previous try/catch wrapper
    // confused the dependency tracker for the useCallbacks below.
    const { playSound } = useAudio();
    const { vibrateOnTap } = useHaptics();

    // Reset position with sound effect
    const resetPosition = useCallback(() => {
        x.set(0);
        y.set(0);
        setIsHovered(false);
        playSound("thud");
    }, [x, y, playSound]);

    // Check if point is inside button bounds with padding
    const isInsideBounds = useCallback((clientX, clientY, padding = 20) => {
        if (!buttonRef.current) return false;
        const rect = buttonRef.current.getBoundingClientRect();
        return (
            clientX >= rect.left - padding &&
            clientX <= rect.right + padding &&
            clientY >= rect.top - padding &&
            clientY <= rect.bottom + padding
        );
    }, []);

    // Handle mouse movement - update position
    const handleMouseMove = useCallback(
        (e) => {
            if (!buttonRef.current) return;

            const { clientX, clientY } = e;
            const rect = buttonRef.current.getBoundingClientRect();

            // Calculate offset from center
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const offsetX = (clientX - centerX) * magneticStrength;
            const offsetY = (clientY - centerY) * magneticStrength;

            x.set(offsetX);
            y.set(offsetY);
        },
        [x, y, magneticStrength]
    );

    // Handle mouse enter
    const handleMouseEnter = useCallback(() => {
        setIsHovered(true);
    }, []);

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        resetPosition();
    }, [resetPosition]);

    // Global mouse tracking for rapid exits
    useEffect(() => {
        if (!isHovered) return;

        let lastMousePos = { x: 0, y: 0 };

        const handleGlobalMouseMove = (e) => {
            lastMousePos = { x: e.clientX, y: e.clientY };

            // Check if mouse is outside bounds
            if (!isInsideBounds(e.clientX, e.clientY)) {
                resetPosition();
                return;
            }

            // Update position
            handleMouseMove(e);
        };

        // Fallback: periodically check bounds (for very fast exits)
        const checkBounds = () => {
            if (!isInsideBounds(lastMousePos.x, lastMousePos.y, 10)) {
                resetPosition();
                return;
            }
            animationFrame.current = requestAnimationFrame(checkBounds);
        };

        window.addEventListener("mousemove", handleGlobalMouseMove);
        animationFrame.current = requestAnimationFrame(checkBounds);

        return () => {
            window.removeEventListener("mousemove", handleGlobalMouseMove);
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, [isHovered, isInsideBounds, handleMouseMove, resetPosition]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationFrame.current) {
                cancelAnimationFrame(animationFrame.current);
            }
        };
    }, []);

    const handleClick = (e) => {
        vibrateOnTap();
        if (onClick) onClick(e);
    };

    const variants = {
        primary:
            "bg-gradient-to-r from-violet-600 to-cyan-500 text-white shadow-glow hover:shadow-glow-lg",
        secondary:
            "border border-violet-500/30 bg-violet-500/10 text-white hover:bg-violet-500/20 hover:border-violet-500/50",
        ghost: "text-white hover:text-violet-400 hover:bg-white/5",
    };

    const sizes = {
        sm: "px-4 py-2 text-xs",
        md: "px-6 py-3 text-sm",
        lg: "px-8 py-4 text-base",
    };

    const baseClasses = `
    relative inline-flex items-center justify-center gap-2
    font-semibold uppercase tracking-wider
    rounded-full overflow-hidden
    transition-colors duration-300
    focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-dark-900
    ${variants[variant]}
    ${sizes[size]}
    ${className}
  `;

    // Inline JSX instead of inner components — defining components
    // inside another component breaks memoization (each render is a new
    // component identity) and is rejected by react-hooks/static-components.
    const buttonContent = (
        <motion.span
            className="relative z-10 flex items-center gap-2"
            style={{ x: contentX, y: contentY }}
        >
            {children}
        </motion.span>
    );

    const motionWrapperProps = {
        ref: buttonRef,
        onMouseEnter: handleMouseEnter,
        onMouseLeave: handleMouseLeave,
        style: { x: springX, y: springY },
        className: "inline-block will-change-transform",
    };

    if (href) {
        const linkProps = external
            ? { target: "_blank", rel: "noopener noreferrer" }
            : {};

        return (
            <motion.div {...motionWrapperProps}>
                <Link
                    href={href}
                    className={baseClasses}
                    onClick={handleClick}
                    {...linkProps}
                    {...props}
                >
                    {buttonContent}
                </Link>
            </motion.div>
        );
    }

    return (
        <motion.div {...motionWrapperProps}>
            <button onClick={handleClick} className={baseClasses} {...props}>
                {buttonContent}
            </button>
        </motion.div>
    );
};

export default MagneticButton;
