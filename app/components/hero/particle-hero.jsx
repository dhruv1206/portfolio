"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Points, PointMaterial } from "@react-three/drei";
import * as THREE from "three";
import { personalData } from "@/utils/data/personal-data";

// Generate points for text/name shape
function generateTextPoints(text, count = 10000) {
    const points = [];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 512;
    canvas.height = 128;

    ctx.fillStyle = "white";
    ctx.font = "bold 80px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Sample points from text pixels
    for (let i = 0; i < count; i++) {
        let found = false;
        let attempts = 0;
        while (!found && attempts < 100) {
            const x = Math.floor(Math.random() * canvas.width);
            const y = Math.floor(Math.random() * canvas.height);
            const index = (y * canvas.width + x) * 4;
            if (data[index] > 128) {
                points.push({
                    x: (x - canvas.width / 2) * 0.02,
                    y: -(y - canvas.height / 2) * 0.02,
                    z: (Math.random() - 0.5) * 0.5,
                });
                found = true;
            }
            attempts++;
        }
    }

    // Fill remaining with random points
    while (points.length < count) {
        points.push({
            x: (Math.random() - 0.5) * 5,
            y: (Math.random() - 0.5) * 1.5,
            z: (Math.random() - 0.5) * 0.5,
        });
    }

    return points;
}

// Generate sphere/globe points
function generateGlobePoints(count = 10000, radius = 2) {
    const points = [];
    for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        points.push({
            x: radius * Math.sin(phi) * Math.cos(theta),
            y: radius * Math.sin(phi) * Math.sin(theta),
            z: radius * Math.cos(phi),
        });
    }
    return points;
}

// Generate keyboard layout points
function generateKeyboardPoints(count = 10000) {
    const points = [];
    const rows = 4;
    const cols = 12;
    const keySize = 0.35;
    const offsetX = -(cols * keySize) / 2;
    const offsetY = (rows * keySize) / 2;

    for (let i = 0; i < count; i++) {
        const row = Math.floor(Math.random() * rows);
        const col = Math.floor(Math.random() * cols);
        const x = offsetX + col * keySize + (Math.random() - 0.5) * 0.2;
        const y = offsetY - row * keySize + (Math.random() - 0.5) * 0.2;
        const z = (Math.random() - 0.5) * 0.3;
        points.push({ x, y, z });
    }
    return points;
}

// Generate neural network graph points
function generateNetworkPoints(count = 10000) {
    const points = [];
    const layers = 5;
    const nodesPerLayer = 8;

    for (let i = 0; i < count; i++) {
        const layer = Math.floor(Math.random() * layers);
        const node = Math.floor(Math.random() * nodesPerLayer);

        const x = (layer - layers / 2) * 1.5;
        const y = (node - nodesPerLayer / 2) * 0.5;
        const z = (Math.random() - 0.5) * 0.5;

        // Add some noise to create connection lines
        const jitter = Math.random() < 0.3 ? 1 : 0;
        points.push({
            x: x + (Math.random() - 0.5) * jitter,
            y: y + (Math.random() - 0.5) * 0.3,
            z,
        });
    }
    return points;
}

// Particle system component
function ParticleField({ scrollProgress = 0, mousePos = { x: 0, y: 0 } }) {
    const pointsRef = useRef();
    const { viewport } = useThree();

    // Generate shape points
    const shapes = useMemo(() => {
        if (typeof document === "undefined") return null;

        const name = personalData.name?.split(" ")[0] || "DHRUV";
        return {
            name: generateTextPoints(name, 15000),
            globe: generateGlobePoints(15000),
            keyboard: generateKeyboardPoints(15000),
            network: generateNetworkPoints(15000),
        };
    }, []);

    // Initial positions
    const [positions, targetPositions] = useMemo(() => {
        if (!shapes) return [new Float32Array(0), new Float32Array(0)];

        const count = shapes.name.length;
        const pos = new Float32Array(count * 3);
        const target = new Float32Array(count * 3);

        shapes.name.forEach((p, i) => {
            pos[i * 3] = p.x;
            pos[i * 3 + 1] = p.y;
            pos[i * 3 + 2] = p.z;
            target[i * 3] = p.x;
            target[i * 3 + 1] = p.y;
            target[i * 3 + 2] = p.z;
        });

        return [pos, target];
    }, [shapes]);

    // Animation frame
    useFrame((state, delta) => {
        if (!pointsRef.current || !shapes) return;

        const posArray = pointsRef.current.geometry.attributes.position.array;
        const count = shapes.name.length;

        // Determine current shape based on scroll
        let currentShape, nextShape, blend;
        if (scrollProgress < 0.25) {
            currentShape = shapes.name;
            nextShape = shapes.globe;
            blend = scrollProgress / 0.25;
        } else if (scrollProgress < 0.5) {
            currentShape = shapes.globe;
            nextShape = shapes.keyboard;
            blend = (scrollProgress - 0.25) / 0.25;
        } else if (scrollProgress < 0.75) {
            currentShape = shapes.keyboard;
            nextShape = shapes.network;
            blend = (scrollProgress - 0.5) / 0.25;
        } else {
            currentShape = shapes.network;
            nextShape = shapes.name;
            blend = (scrollProgress - 0.75) / 0.25;
        }

        // Apply mouse force
        const mouseForceRadius = 1.5;
        const mouseForceStrength = 0.5;
        const mouseX = (mousePos.x / window.innerWidth - 0.5) * viewport.width;
        const mouseY = -(mousePos.y / window.innerHeight - 0.5) * viewport.height;

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            // Lerp between shapes
            const targetX = currentShape[i].x * (1 - blend) + nextShape[i].x * blend;
            const targetY = currentShape[i].y * (1 - blend) + nextShape[i].y * blend;
            const targetZ = currentShape[i].z * (1 - blend) + nextShape[i].z * blend;

            // Current position
            let x = posArray[i3];
            let y = posArray[i3 + 1];
            let z = posArray[i3 + 2];

            // Mouse repulsion
            const dx = x - mouseX;
            const dy = y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < mouseForceRadius && dist > 0.01) {
                const force = (mouseForceRadius - dist) / mouseForceRadius * mouseForceStrength;
                x += (dx / dist) * force;
                y += (dy / dist) * force;
            }

            // Spring back to target
            const springStrength = 0.03;
            x += (targetX - x) * springStrength;
            y += (targetY - y) * springStrength;
            z += (targetZ - z) * springStrength;

            // Add subtle floating movement
            const time = state.clock.elapsedTime;
            x += Math.sin(time * 0.5 + i * 0.01) * 0.003;
            y += Math.cos(time * 0.3 + i * 0.01) * 0.003;

            posArray[i3] = x;
            posArray[i3 + 1] = y;
            posArray[i3 + 2] = z;
        }

        pointsRef.current.geometry.attributes.position.needsUpdate = true;
    });

    if (!shapes) return null;

    return (
        <Points ref={pointsRef} positions={positions} stride={3}>
            <PointMaterial
                transparent
                size={0.03}
                sizeAttenuation={true}
                depthWrite={false}
                color="#8b5cf6"
                opacity={0.8}
                blending={THREE.AdditiveBlending}
            />
        </Points>
    );
}

// Main particle hero component
const ParticleHero = ({ className = "" }) => {
    const mousePos = useRef({ x: 0, y: 0 });
    const scrollProgress = useRef(0);

    useEffect(() => {
        const handleMouseMove = (e) => {
            mousePos.current = { x: e.clientX, y: e.clientY };
        };

        const handleScroll = () => {
            const scrolled = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            scrollProgress.current = docHeight > 0 ? scrolled / docHeight : 0;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("scroll", handleScroll);

        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return (
        <div className={`absolute inset-0 ${className}`}>
            <Canvas
                camera={{ position: [0, 0, 5], fov: 60 }}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: true }}
            >
                <ambientLight intensity={0.5} />
                <ParticleFieldWrapper mousePos={mousePos} scrollProgress={scrollProgress} />
            </Canvas>
        </div>
    );
};

// Wrapper to access refs in canvas
function ParticleFieldWrapper({ mousePos, scrollProgress }) {
    const posRef = useRef({ x: 0, y: 0 });
    const progressRef = useRef(0);

    useFrame(() => {
        posRef.current = mousePos.current;
        progressRef.current = scrollProgress.current;
    });

    return <ParticleField mousePos={posRef.current} scrollProgress={progressRef.current} />;
}

export default ParticleHero;
