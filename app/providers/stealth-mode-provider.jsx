"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { personalData } from "@/utils/data/personal-data";
import { useDoubleEscape } from "@/app/hooks/use-konami-code";

const StealthModeContext = createContext({
    isStealthMode: false,
    toggleStealthMode: () => { },
});

export function StealthModeProvider({ children }) {
    const [isStealthMode, setIsStealthMode] = useState(false);

    const toggleStealthMode = useCallback(() => {
        setIsStealthMode((prev) => !prev);
    }, []);

    // Listen for double Escape
    useDoubleEscape(toggleStealthMode);

    return (
        <StealthModeContext.Provider value={{ isStealthMode, toggleStealthMode }}>
            <AnimatePresence mode="wait">
                {isStealthMode ? (
                    <StealthResume key="stealth" onExit={toggleStealthMode} />
                ) : (
                    <motion.div
                        key="main"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </StealthModeContext.Provider>
    );
}

// Plain HTML resume for stealth mode
function StealthResume({ onExit }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen bg-white text-black p-8 font-sans print:p-4"
            style={{ fontFamily: "Times New Roman, serif" }}
        >
            {/* Exit hint */}
            <div className="fixed top-4 right-4 text-xs text-gray-400 print:hidden">
                Press Esc twice to exit | Cmd/Ctrl+P to print
            </div>

            {/* Header */}
            <header className="text-center mb-8 border-b-2 border-black pb-4">
                <h1 className="text-3xl font-bold uppercase tracking-widest">
                    {personalData.name}
                </h1>
                <p className="text-lg mt-2">{personalData.designation}</p>
                <div className="flex justify-center gap-4 mt-2 text-sm">
                    <span>{personalData.email}</span>
                    <span>|</span>
                    <span>{personalData.phone}</span>
                    <span>|</span>
                    <span>{personalData.address}</span>
                </div>
            </header>

            {/* Summary */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Professional Summary
                </h2>
                <p className="text-sm leading-relaxed">{personalData.description}</p>
            </section>

            {/* Experience */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Experience
                </h2>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between">
                            <strong>Vibes Technologies</strong>
                            <span>Jul 2024 - Present</span>
                        </div>
                        <div className="italic">Backend Developer (SDE-1)</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                            <li>Built robust meeting system with Spring Boot, WebSockets, WebRTC</li>
                            <li>Architected microservices: Config Server, Eureka, Gateway, Signalling Server</li>
                        </ul>
                    </div>
                    <div>
                        <div className="flex justify-between">
                            <strong>Press Information Bureau (PIB)</strong>
                            <span>Jun 2024 - Jul 2024</span>
                        </div>
                        <div className="italic">Software Developer Intern</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                            <li>Developed AI-powered multilingual press release video generator</li>
                            <li>Reduced production time by 45%, boosted productivity by 35%</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* Skills */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Technical Skills
                </h2>
                <p className="text-sm">
                    <strong>Languages:</strong> C++, Java, Python, JavaScript, Dart, SQL
                </p>
                <p className="text-sm">
                    <strong>Frameworks:</strong> Spring Boot, Node.js, Flutter, React, Next.js
                </p>
                <p className="text-sm">
                    <strong>Databases:</strong> MongoDB, PostgreSQL, Redis, Elasticsearch
                </p>
                <p className="text-sm">
                    <strong>Tools:</strong> Git, Docker, Kubernetes, AWS, Firebase
                </p>
            </section>

            {/* Education */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Education
                </h2>
                <div className="flex justify-between">
                    <div>
                        <strong>LNCT Bhopal</strong>
                        <div className="text-sm">Bachelor of Technology in Computer Science</div>
                    </div>
                    <span>2021 - 2025</span>
                </div>
            </section>

            {/* Projects */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Key Projects
                </h2>
                <ul className="list-disc list-inside text-sm space-y-1">
                    <li>
                        <strong>DStarDB:</strong> Multi-threaded in-memory database in C++ with Redis-style commands
                    </li>
                    <li>
                        <strong>College Attendance App:</strong> 3.5k+ downloads, 236% monthly growth
                    </li>
                    <li>
                        <strong>Real-Time Collaboration:</strong> WebRTC-based meeting platform with microservices
                    </li>
                </ul>
            </section>

            {/* Footer */}
            <footer className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300 print:hidden">
                Double-tap Escape to return to the fancy version
            </footer>
        </motion.div>
    );
}

export function useStealthMode() {
    const context = useContext(StealthModeContext);
    if (!context) {
        return { isStealthMode: false, toggleStealthMode: () => { } };
    }
    return context;
}

export default StealthModeProvider;
