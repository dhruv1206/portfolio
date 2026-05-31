"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Quick-pick command suggestions surfaced as chips below the prompt.
const QUICK_COMMANDS = [
    "SET foo bar",
    "GET foo",
    "INCR counter",
    "HSET user:1 name Dhruv age 22",
    "HGETALL user:1",
    "LPUSH stack 1 2 3",
    "LRANGE stack 0 -1",
    "ZADD leaderboard 1870 dhruv 1654 alice",
    "ZRANGE leaderboard 0 -1 WITHSCORES",
    "BENCH SET 100000",
    "BENCH GET 100000",
    "INFO",
    "HELP",
];

const WELCOME = [
    "DStarDB v0.1.0 — browser build",
    "Redis-style in-memory KV running entirely in this tab (Web Worker).",
    `Try ${"`HELP`"} or click a chip below. Source: github.com/dhruv1206/DStar-DB`,
];

function formatResult(result) {
    if (result == null) return "(nil)";
    if (Array.isArray(result)) {
        if (result.length === 0) return "(empty list or set)";
        return result.map((v, i) => `${i + 1}) ${formatResult(v)}`).join("\n");
    }
    if (typeof result === "object" && result.__bench) {
        const b = result;
        const ratio = b.redisRef ? (b.opsPerSec / b.redisRef).toFixed(2) : null;
        return [
            `Ran ${b.count.toLocaleString()} × ${b.cmd} in ${b.totalMs} ms`,
            `Throughput: ${b.opsPerSec.toLocaleString()} ops/sec` +
                (ratio ? `  (${ratio}× redis-benchmark single-thread)` : ""),
            `Latency: p50 ${b.p50}µs · p90 ${b.p90}µs · p99 ${b.p99}µs · p999 ${b.p999}µs · max ${b.max}µs`,
            b.redisRef
                ? `Redis 7.2 single-threaded reference: ~${b.redisRef.toLocaleString()} ops/sec`
                : "",
        ]
            .filter(Boolean)
            .join("\n");
    }
    if (typeof result === "string") return result;
    return String(result);
}

// Tokenise a command line, preserving "quoted strings" as single tokens.
function tokenise(line) {
    const out = [];
    let buf = "";
    let inQuote = null;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuote) {
            if (c === inQuote) {
                inQuote = null;
                out.push(buf);
                buf = "";
            } else if (c === "\\" && line[i + 1]) {
                buf += line[++i];
            } else {
                buf += c;
            }
        } else if (c === '"' || c === "'") {
            if (buf) {
                out.push(buf);
                buf = "";
            }
            inQuote = c;
        } else if (/\s/.test(c)) {
            if (buf) {
                out.push(buf);
                buf = "";
            }
        } else {
            buf += c;
        }
    }
    if (buf) out.push(buf);
    return out;
}

export default function DStarDBREPL() {
    const [entries, setEntries] = useState(() => [
        { kind: "system", lines: WELCOME },
    ]);
    const [input, setInput] = useState("");
    const [history, setHistory] = useState([]);
    const [historyPos, setHistoryPos] = useState(-1);
    const [busy, setBusy] = useState(false);

    const workerRef = useRef(null);
    const pendingRef = useRef(new Map());
    const requestIdRef = useRef(0);
    const scrollRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const worker = new Worker(
            new URL("../../workers/dstardb.worker.js", import.meta.url),
        );
        worker.onmessage = (e) => {
            const { id, result, latency, error } = e.data || {};
            const resolver = pendingRef.current.get(id);
            if (!resolver) return;
            pendingRef.current.delete(id);
            resolver({ result, latency, error });
        };
        worker.onerror = (e) => {
            console.warn("[dstardb] worker error:", e);
        };
        workerRef.current = worker;
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        // Auto-scroll to bottom when new entries land.
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
    }, [entries]);

    const execute = useCallback((cmd, args) => {
        return new Promise((resolve) => {
            if (!workerRef.current) {
                resolve({ error: "worker unavailable" });
                return;
            }
            const id = ++requestIdRef.current;
            pendingRef.current.set(id, resolve);
            workerRef.current.postMessage({ id, cmd, args });
        });
    }, []);

    const runLine = useCallback(
        async (raw) => {
            const line = raw.trim();
            if (!line) return;
            const tokens = tokenise(line);
            const cmd = (tokens[0] || "").toUpperCase();
            const args = tokens.slice(1);

            // Local-only commands (don't go to the worker).
            if (cmd === "CLEAR") {
                setEntries([{ kind: "system", lines: WELCOME }]);
                setInput("");
                setHistoryPos(-1);
                return;
            }

            setEntries((prev) => [...prev, { kind: "prompt", text: line }]);
            setHistory((prev) => [...prev, line]);
            setHistoryPos(-1);
            setInput("");
            setBusy(true);

            const { result, latency, error } = await execute(cmd, args);
            setBusy(false);

            setEntries((prev) => [
                ...prev,
                error
                    ? { kind: "error", text: `(error) ${error}`, latency }
                    : { kind: "result", text: formatResult(result), latency, raw: result },
            ]);
        },
        [execute],
    );

    function onKeyDown(e) {
        if (e.key === "Enter") {
            e.preventDefault();
            runLine(input);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            if (history.length === 0) return;
            const next =
                historyPos === -1
                    ? history.length - 1
                    : Math.max(0, historyPos - 1);
            setHistoryPos(next);
            setInput(history[next] || "");
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyPos === -1) return;
            const next = historyPos + 1;
            if (next >= history.length) {
                setHistoryPos(-1);
                setInput("");
            } else {
                setHistoryPos(next);
                setInput(history[next]);
            }
        } else if (e.key === "l" && e.ctrlKey) {
            e.preventDefault();
            setEntries([{ kind: "system", lines: WELCOME }]);
        }
    }

    return (
        <div className="dstardb-repl glass-card overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/30 font-mono text-xs">
                <span className="flex gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-red-500/70" />
                    <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
                </span>
                <span className="text-gray-400 flex-1 text-center">
                    dstardb — Redis-style KV running in your browser
                </span>
                <span className="text-emerald-400 inline-flex items-center gap-1.5">
                    <span className="relative inline-flex w-2 h-2">
                        <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" />
                        <span className="relative w-2 h-2 rounded-full bg-emerald-400" />
                    </span>
                    connected
                </span>
            </div>

            {/* Output */}
            <div
                ref={scrollRef}
                className="font-mono text-[13px] leading-relaxed px-4 py-4 h-[420px] overflow-y-auto bg-[#06061a]/80"
            >
                {entries.map((entry, i) => {
                    if (entry.kind === "system") {
                        return (
                            <div
                                key={i}
                                className="text-gray-400 whitespace-pre-wrap mb-3"
                            >
                                {entry.lines.join("\n")}
                            </div>
                        );
                    }
                    if (entry.kind === "prompt") {
                        return (
                            <div key={i} className="flex gap-2 text-violet-300">
                                <span className="text-violet-500 select-none">
                                    dstardb&gt;
                                </span>
                                <span className="text-white">{entry.text}</span>
                            </div>
                        );
                    }
                    if (entry.kind === "error") {
                        return (
                            <div key={i} className="text-rose-400 whitespace-pre-wrap mb-2">
                                {entry.text}
                                {entry.latency != null && (
                                    <span className="text-gray-500 ml-2">
                                        ({entry.latency.toFixed(1)}µs)
                                    </span>
                                )}
                            </div>
                        );
                    }
                    return (
                        <div key={i} className="text-cyan-200 whitespace-pre-wrap mb-2">
                            {entry.text}
                            {entry.latency != null && (
                                <span className="text-gray-500 ml-2">
                                    ({entry.latency.toFixed(1)}µs)
                                </span>
                            )}
                        </div>
                    );
                })}
                {busy && (
                    <div className="text-gray-500 italic">running…</div>
                )}
            </div>

            {/* Input */}
            <form
                className="flex items-center gap-2 px-4 py-3 border-t border-white/5 bg-black/40 font-mono"
                onSubmit={(e) => {
                    e.preventDefault();
                    runLine(input);
                }}
            >
                <span className="text-violet-500 select-none text-sm">dstardb&gt;</span>
                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder='try: SET foo bar   ↑ for history   "clear" to reset'
                    className="flex-1 bg-transparent border-0 outline-none text-white text-sm placeholder:text-gray-600"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                />
            </form>

            {/* Quick-pick chips */}
            <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-white/5 bg-black/30">
                {QUICK_COMMANDS.map((cmd) => (
                    <button
                        key={cmd}
                        type="button"
                        onClick={() => {
                            setInput(cmd);
                            inputRef.current?.focus();
                        }}
                        className="text-xs font-mono px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/30 text-violet-200 hover:bg-violet-500/20 hover:border-violet-500/60 transition-colors"
                    >
                        {cmd}
                    </button>
                ))}
            </div>
        </div>
    );
}
