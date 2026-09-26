// One registry behind the ⌘K palette. A page or feature registers its own
// commands while it is mounted (the homepage adds the director's cut, the
// control room adds its console); the global palette lists those first,
// then the site-wide pages and modes.

export interface Command {
    id: string;
    title: string;
    detail?: string;
    /** shown on the right: a key, a shortcut or a path */
    keys?: string;
    /** heading the command is listed under */
    group?: string;
    kind?: "chaos" | "fix";
    href?: string;
    run?: () => void;
}

type Listener = () => void;
const sources = new Map<string, Command[]>();
const listeners = new Set<Listener>();
let order: string[] = [];
let snapshot: Command[] = [];

function rebuild() {
    snapshot = order.flatMap((k) => sources.get(k) || []);
    for (const l of listeners) l();
}

/** Registers a named set of commands; returns the function that removes them again. */
export function registerCommands(source: string, cmds: Command[]) {
    sources.set(source, cmds);
    if (!order.includes(source)) order.push(source);
    rebuild();
    return () => {
        if (sources.get(source) !== cmds) return; // a newer registration replaced this one
        sources.delete(source);
        order = order.filter((k) => k !== source);
        rebuild();
    };
}
export function subscribeCommands(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function getCommands() { return snapshot; }
const EMPTY: Command[] = [];
export function getServerCommands() { return EMPTY; }

/** Opens (or closes) the palette from anywhere: the site bar button, a key handler, a link. */
export function togglePalette() { window.dispatchEvent(new CustomEvent("cr:palette")); }
