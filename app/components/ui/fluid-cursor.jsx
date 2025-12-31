"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

/**
 * FluidCursor - GPU-accelerated fluid simulation that reacts to mouse movement
 * Uses a simplified fluid solver via CSS filters and canvas
 */
const FluidCursor = ({ opacity = 0.05 }) => {
    const canvasRef = useRef(null);
    const contextRef = useRef(null);
    const particlesRef = useRef([]);
    const mouseRef = useRef({ x: 0, y: 0, px: 0, py: 0 });
    const animationRef = useRef(null);

    // Particle class for fluid simulation
    class Particle {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.life = 1;
            this.size = 20 + Math.random() * 30;
        }

        update(dt) {
            // Apply velocity
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // Apply friction
            this.vx *= 0.98;
            this.vy *= 0.98;

            // Decay life
            this.life *= 0.99;
        }

        draw(ctx) {
            if (this.life < 0.01) return;

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * this.life, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 92, 246, ${this.life * 0.3})`;
            ctx.fill();
        }
    }

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resize();
        window.addEventListener("resize", resize);
        contextRef.current = canvas.getContext("2d");

        return () => window.removeEventListener("resize", resize);
    }, []);

    // Track mouse movement
    const handleMouseMove = useCallback((e) => {
        const mouse = mouseRef.current;
        mouse.px = mouse.x;
        mouse.py = mouse.y;
        mouse.x = e.clientX;
        mouse.y = e.clientY;

        // Calculate velocity
        const vx = (mouse.x - mouse.px) * 0.5;
        const vy = (mouse.y - mouse.py) * 0.5;
        const speed = Math.sqrt(vx * vx + vy * vy);

        // Spawn particles on fast movement
        if (speed > 3) {
            const count = Math.min(Math.floor(speed / 5), 3);
            for (let i = 0; i < count; i++) {
                const particle = new Particle(
                    mouse.x + (Math.random() - 0.5) * 20,
                    mouse.y + (Math.random() - 0.5) * 20
                );
                particle.vx = vx * 0.3 + (Math.random() - 0.5) * 2;
                particle.vy = vy * 0.3 + (Math.random() - 0.5) * 2;
                particlesRef.current.push(particle);
            }
        }

        // Limit particle count
        if (particlesRef.current.length > 50) {
            particlesRef.current = particlesRef.current.slice(-50);
        }
    }, []);

    // Animation loop
    useEffect(() => {
        const ctx = contextRef.current;
        if (!ctx) return;

        const animate = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            // Clear with trail effect
            ctx.fillStyle = "rgba(3, 0, 20, 0.1)";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            particlesRef.current = particlesRef.current.filter(
                (particle) => particle.life > 0.01
            );

            particlesRef.current.forEach((particle) => {
                particle.update(1);
                particle.draw(ctx);
            });

            animationRef.current = requestAnimationFrame(animate);
        };

        animate();
        window.addEventListener("mousemove", handleMouseMove);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [handleMouseMove]);

    return (
        <motion.canvas
            ref={canvasRef}
            initial={{ opacity: 0 }}
            animate={{ opacity }}
            className="fixed inset-0 pointer-events-none z-[1]"
            style={{
                mixBlendMode: "screen",
                filter: "blur(30px)",
            }}
            aria-hidden="true"
        />
    );
};

export default FluidCursor;
