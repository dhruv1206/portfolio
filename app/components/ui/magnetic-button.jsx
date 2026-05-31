"use client";

import { useRef, useCallback } from "react";
import { motion, useSpring, useMotionValue, useTransform } from "framer-motion";
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

    // Use motion values + springs for smoother physics.
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springX = useSpring(x, { damping: 20, stiffness: 300, mass: 0.5 });
    const springY = useSpring(y, { damping: 20, stiffness: 300, mass: 0.5 });

    // Content drifts a *fraction* of the wrapper's offset for a subtle
    // parallax. Driving it off the full offset made the label travel ~2×
    // the pill (wrapper offset + content offset), so it overshot and was
    // the first thing to clip off-screen; 0.25 keeps the label inside the
    // pill while still giving a little depth.
    const contentXTarget = useTransform(x, (v) => v * 0.25);
    const contentYTarget = useTransform(y, (v) => v * 0.25);
    const contentX = useSpring(contentXTarget, {
        damping: 25,
        stiffness: 400,
        mass: 0.3,
    });
    const contentY = useSpring(contentYTarget, {
        damping: 25,
        stiffness: 400,
        mass: 0.3,
    });

    // Audio + haptics. Both hooks always return objects (useAudio's
    // context has a default, useHaptics has no provider dependency), so
    // they can be called unconditionally.
    const { playSound } = useAudio();
    const { vibrateOnTap } = useHaptics();

    // Pull the button toward the cursor. `onMouseMove` only fires while
    // the pointer is genuinely over the element, so the offset is only
    // ever set while hovering.
    const handleMouseMove = useCallback(
        (e) => {
            const el = buttonRef.current;
            if (!el) return;

            // getBoundingClientRect reflects the CURRENT transform, so we
            // subtract the offset already applied to recover the rest box.
            // Measuring from rest keeps the pull from feeding back on
            // itself and lets us clamp against the viewport correctly.
            const rect = el.getBoundingClientRect();
            const restLeft = rect.left - springX.get();
            const restTop = rect.top - springY.get();
            const centerX = restLeft + rect.width / 2;
            const centerY = restTop + rect.height / 2;

            let ox = (e.clientX - centerX) * magneticStrength;
            let oy = (e.clientY - centerY) * magneticStrength;

            // 1) Keep the pull a subtle nudge.
            const MAX = 14;
            ox = Math.max(-MAX, Math.min(MAX, ox));
            oy = Math.max(-MAX, Math.min(MAX, oy));

            // 2) Never translate the button off-screen: constrain the
            //    offset so the rest box + offset stays within the viewport
            //    (small margin). An offset of 0 is always permitted.
            const M = 10;
            const loX = Math.min(M - restLeft, 0);
            const hiX = Math.max(
                window.innerWidth - M - (restLeft + rect.width),
                0,
            );
            const loY = Math.min(M - restTop, 0);
            const hiY = Math.max(
                window.innerHeight - M - (restTop + rect.height),
                0,
            );
            ox = Math.max(loX, Math.min(hiX, ox));
            oy = Math.max(loY, Math.min(hiY, oy));

            x.set(ox);
            y.set(oy);
        },
        [x, y, springX, springY, magneticStrength],
    );

    // Snap back to rest. `mouseleave` is dispatched by the browser on the
    // element-boundary crossing regardless of pointer speed, so this is
    // the single, reliable reset.
    //
    // This deliberately replaces an earlier design that also ran a global
    // window `mousemove` listener + rAF bounds-check with a 20px padding
    // halo. That raced with this reset: on a fast exit the global handler
    // could re-apply a non-zero offset (cursor still inside the halo)
    // *after* the leave reset, then get torn down — leaving the button
    // stuck, translated off-center. Local move + leave cannot get stuck:
    // the only thing that sets an offset is movement over the element,
    // and leaving always zeroes it.
    const handleMouseLeave = useCallback(() => {
        x.set(0);
        y.set(0);
        playSound("thud");
    }, [x, y, playSound]);

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
        onMouseMove: handleMouseMove,
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
