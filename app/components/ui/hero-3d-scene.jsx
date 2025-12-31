"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshDistortMaterial } from "@react-three/drei";
import * as THREE from "three";

const AnimatedSphere = ({ mouse }) => {
    const meshRef = useRef();

    useFrame((state) => {
        if (meshRef.current) {
            // Smooth rotation
            meshRef.current.rotation.x = THREE.MathUtils.lerp(
                meshRef.current.rotation.x,
                mouse.y * 0.5,
                0.05
            );
            meshRef.current.rotation.y = THREE.MathUtils.lerp(
                meshRef.current.rotation.y,
                mouse.x * 0.5,
                0.05
            );

            // Subtle continuous rotation
            meshRef.current.rotation.z += 0.002;
        }
    });

    const gradientMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color("#8b5cf6") },
                uColor2: { value: new THREE.Color("#06b6d4") },
                uColor3: { value: new THREE.Color("#f472b6") },
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float uTime;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                uniform vec3 uColor3;
                uniform float uTime;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    float mixStrength = (sin(vPosition.x + vPosition.y + uTime) + 1.0) / 2.0;
                    vec3 color = mix(uColor1, uColor2, vUv.y);
                    color = mix(color, uColor3, mixStrength * 0.3);
                    gl_FragColor = vec4(color, 0.85);
                }
            `,
            transparent: true,
        });
    }, []);

    useFrame((state) => {
        if (gradientMaterial.uniforms) {
            gradientMaterial.uniforms.uTime.value = state.clock.elapsedTime * 0.5;
        }
    });

    return (
        <Float speed={2} rotationIntensity={0.5} floatIntensity={1}>
            <mesh ref={meshRef}>
                <icosahedronGeometry args={[2, 20]} />
                <MeshDistortMaterial
                    color="#8b5cf6"
                    attach="material"
                    distort={0.4}
                    speed={2}
                    roughness={0.2}
                    metalness={0.8}
                    transparent
                    opacity={0.85}
                />
            </mesh>
            {/* Outer glow ring */}
            <mesh scale={1.1}>
                <torusGeometry args={[2.2, 0.02, 16, 100]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.6} />
            </mesh>
        </Float>
    );
};

const ParticleField = () => {
    const particlesRef = useRef();
    const count = 200;

    const positions = useMemo(() => {
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            positions[i * 3] = (Math.random() - 0.5) * 15;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 15;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 15;
        }
        return positions;
    }, []);

    useFrame((state) => {
        if (particlesRef.current) {
            particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02;
            particlesRef.current.rotation.x = state.clock.elapsedTime * 0.01;
        }
    });

    return (
        <points ref={particlesRef}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={count}
                    array={positions}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={0.03}
                color="#8b5cf6"
                transparent
                opacity={0.6}
                sizeAttenuation
            />
        </points>
    );
};

const Hero3DScene = () => {
    const mouseRef = useRef({ x: 0, y: 0 });

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        mouseRef.current = {
            x: ((e.clientX - rect.left) / rect.width - 0.5) * 2,
            y: -((e.clientY - rect.top) / rect.height - 0.5) * 2,
        };
    };

    return (
        <div
            className="w-full h-full min-h-[400px]"
            onMouseMove={handleMouseMove}
        >
            <Canvas
                camera={{ position: [0, 0, 6], fov: 45 }}
                gl={{ antialias: true, alpha: true }}
                style={{ background: "transparent" }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} color="#06b6d4" />
                <pointLight position={[10, -10, 5]} intensity={0.5} color="#f472b6" />

                <AnimatedSphere mouse={mouseRef.current} />
                <ParticleField />
            </Canvas>
        </div>
    );
};

export default Hero3DScene;
