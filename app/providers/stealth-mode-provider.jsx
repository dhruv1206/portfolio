"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
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

    // Listen for double Escape, and for the control room's ⌘K entry.
    useDoubleEscape(toggleStealthMode);
    useEffect(() => {
        window.addEventListener("cr:stealth", toggleStealthMode);
        return () => window.removeEventListener("cr:stealth", toggleStealthMode);
    }, [toggleStealthMode]);

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
                            <strong>MyRik, Bengaluru</strong>
                            <span>Sep 2025 - Present</span>
                        </div>
                        <div className="italic">Software Engineer</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                            <li>Zero-downtime GCP to AWS migration with a hybrid VPC-tunnel phase; observability moved to self-hosted Grafana, Loki and Tempo</li>
                            <li>Cut p99 API latency from over 1 s to under 300 ms: OpenTelemetry tracing, N+1 queries, missing indexes, cross-region RTDB</li>
                            <li>Reduced Google Maps API cost from Rs 200 to Rs 3 per ride (session tokens, debounced Distance Matrix)</li>
                            <li>Designed a CQRS, event-driven product service for 150K+ monthly active users; Razorpay flow with webhook reconciliation</li>
                        </ul>
                    </div>
                    <div>
                        <div className="flex justify-between">
                            <strong>CarWale (CarTrade Tech), Navi Mumbai</strong>
                            <span>Jan 2025 - Sep 2025</span>
                        </div>
                        <div className="italic">Associate Software Engineer</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                            <li>Launched desktop Short Videos and AI chat support for 1M+ monthly users: +15% engagement, 50% faster query resolution</li>
                            <li>20% fewer Kubernetes pods and 25% lower infrastructure cost; legacy frontend to 70% test coverage, 40% fewer defects</li>
                        </ul>
                    </div>
                    <div>
                        <div className="flex justify-between">
                            <strong>JioHotstar, Bengaluru</strong>
                            <span>Nov 2024 - Dec 2024</span>
                        </div>
                        <div className="italic">Software Engineering Intern</div>
                        <ul className="list-disc list-inside text-sm mt-1">
                            <li>Migrated messaging from Kafka to GCP Pub/Sub: 5M+ content-quality events a day at 99.9% reliability</li>
                            <li>Go APIs handling 10,000+ CQC jobs a day; containerized the CQC portal, 30% faster deploys</li>
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
                    <strong>Languages:</strong> C++, Go, Java, Python, TypeScript, JavaScript, SQL
                </p>
                <p className="text-sm">
                    <strong>Frameworks:</strong> Node.js, Next.js, Spring Boot, React, Flutter
                </p>
                <p className="text-sm">
                    <strong>Databases and messaging:</strong> PostgreSQL, Redis, MongoDB, MySQL, Kafka, GCP Pub/Sub
                </p>
                <p className="text-sm">
                    <strong>Cloud, DevOps and observability:</strong> AWS, GCP, Docker, Kubernetes, CI/CD, OpenTelemetry, Grafana, Loki, Tempo
                </p>
            </section>

            {/* Education */}
            <section className="mb-6">
                <h2 className="text-lg font-bold uppercase border-b border-black mb-2">
                    Education
                </h2>
                <div className="flex justify-between">
                    <div>
                        <strong>Lakshmi Narain College of Technology, Bhopal</strong>
                        <div className="text-sm">B.Tech in Computer Science, 8.23 CGPA</div>
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
                        <strong>DStarDB:</strong> Redis-compatible in-memory database in C++20; reactor event loop plus thread pool, 40+ commands, transactions, snapshot and AOF persistence; 13% more throughput and 50% lower latency than Redis under concurrent reads (YCSB)
                    </li>
                    <li>
                        <strong>Warehouse CCTV anomaly detection:</strong> 35 cameras across 8 warehouses, tamper and disconnection detection, per-zone person counting
                    </li>
                    <li>
                        <strong>Real-time collaboration platform:</strong> Spring Boot microservices with STOMP signalling and WebRTC media
                    </li>
                    <li>
                        <strong>College attendance app:</strong> Flutter and Node.js, 6.5K+ downloads, 4.4 rating
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
