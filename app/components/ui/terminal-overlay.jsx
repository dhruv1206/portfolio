"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { personalData } from "@/utils/data/personal-data";

// Pre-compute the matrix rain at module load (NOT in render — the
// react-hooks/purity rule rejects Math.random() during render, including
// inside useMemo). Shared across all MatrixRain mounts; visually random
// once per JS bundle, which is plenty for a background decoration.
const MATRIX_COLUMNS = Array.from({ length: 20 }, (_, columnIndex) => ({
    left: `${columnIndex * 5}%`,
    duration: 3 + Math.random() * 2,
    delay: Math.random() * 2,
    bits: Array.from({ length: 40 }, () =>
        Math.random() > 0.5 ? "1" : "0",
    ),
}));

function MatrixRain() {
    return (
        <div className="absolute inset-0 pointer-events-none opacity-5">
            {MATRIX_COLUMNS.map((column, columnIndex) => (
                <motion.div
                    key={columnIndex}
                    className="absolute text-green-500 text-xs"
                    style={{ left: column.left }}
                    initial={{ y: "-100%" }}
                    animate={{ y: "100vh" }}
                    transition={{
                        duration: column.duration,
                        repeat: Infinity,
                        delay: column.delay,
                    }}
                >
                    {column.bits.map((bit, j) => (
                        <div key={j}>{bit}</div>
                    ))}
                </motion.div>
            ))}
        </div>
    );
}

const COMMANDS = {
    help: () => `
Available commands:
  help          - Show this help message
  whoami        - Display info about the developer
  skills        - List technical skills
  projects      - List projects
  contact       - Show contact information
  clear         - Clear terminal
  exit          - Close terminal
`,
    whoami: () => `
${personalData.name}
${personalData.designation}

${personalData.description}
`,
    skills: () => `
Technical Skills:
━━━━━━━━━━━━━━━━━
${personalData.skills?.join(", ") || "C++, Java, Spring Boot, Node.js, Flutter, React, MongoDB, PostgreSQL"}
`,
    projects: () => `
Projects:
━━━━━━━━━
1. DStarDB - Multi-threaded in-memory database in C++
2. Real-Time Collaboration Platform - WebRTC meeting system
3. AI Press Release Generator - Multilingual video automation
4. College Attendance App - 3.5k+ downloads on Play Store
5. Amazon Clone - Full e-commerce with GPay/ApplePay
6. WhatsApp Clone - Real-time messaging with video calling
`,
    contact: () => `
Contact Information:
━━━━━━━━━━━━━━━━━━
Email:    ${personalData.email}
Phone:    ${personalData.phone}
GitHub:   ${personalData.github}
LinkedIn: ${personalData.linkedIn}
`,
    clear: () => "CLEAR",
    exit: () => "EXIT",
};

const TerminalOverlay = ({ isOpen, onClose }) => {
    const [history, setHistory] = useState([
        { type: "system", text: "Welcome to Dhruv's Terminal v1.0.0" },
        { type: "system", text: 'Type "help" for available commands.' },
        { type: "system", text: "" },
    ]);
    const [input, setInput] = useState("");
    const inputRef = useRef(null);
    const terminalRef = useRef(null);

    // Auto-focus input when terminal opens
    useEffect(() => {
        if (isOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isOpen]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [history]);

    const executeCommand = useCallback((cmd) => {
        const trimmedCmd = cmd.trim().toLowerCase();
        const handler = COMMANDS[trimmedCmd];

        if (!trimmedCmd) return;

        // Add command to history
        setHistory((prev) => [
            ...prev,
            { type: "command", text: `$ ${cmd}` },
        ]);

        if (!handler) {
            setHistory((prev) => [
                ...prev,
                { type: "error", text: `Command not found: ${trimmedCmd}` },
            ]);
            return;
        }

        const result = handler();

        if (result === "CLEAR") {
            setHistory([]);
        } else if (result === "EXIT") {
            onClose?.();
        } else {
            setHistory((prev) => [
                ...prev,
                { type: "output", text: result },
            ]);
        }
    }, [onClose]);

    const handleSubmit = (e) => {
        e.preventDefault();
        executeCommand(input);
        setInput("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            onClose?.();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-0 z-[9999] bg-black"
                    onKeyDown={handleKeyDown}
                >
                    {/* Terminal header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-green-500/30">
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500" />
                            <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        <span className="text-green-500 text-sm font-mono">
                            dhruv@portfolio:~
                        </span>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-green-500 transition-colors"
                        >
                            [ESC to close]
                        </button>
                    </div>

                    {/* Terminal content */}
                    <div
                        ref={terminalRef}
                        className="h-[calc(100vh-48px)] overflow-y-auto p-4 font-mono text-sm"
                    >
                        {/* Matrix rain effect (simplified) */}
                        <MatrixRain />


                        {/* Command history */}
                        <div className="relative z-10">
                            {history.map((item, index) => (
                                <div
                                    key={index}
                                    className={`whitespace-pre-wrap ${item.type === "command"
                                            ? "text-cyan-400"
                                            : item.type === "error"
                                                ? "text-red-400"
                                                : item.type === "system"
                                                    ? "text-yellow-400"
                                                    : "text-green-400"
                                        }`}
                                >
                                    {item.text}
                                </div>
                            ))}

                            {/* Input line */}
                            <form onSubmit={handleSubmit} className="flex items-center">
                                <span className="text-cyan-400">$ </span>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    className="flex-1 bg-transparent text-green-400 outline-none caret-green-500"
                                    autoComplete="off"
                                    spellCheck="false"
                                />
                                <motion.span
                                    className="w-2 h-5 bg-green-500"
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 1, repeat: Infinity }}
                                />
                            </form>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TerminalOverlay;
