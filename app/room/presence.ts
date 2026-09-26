// Presence client for the control room: polls /api/room while the tab
// is visible, uploads this visitor's cursor and any chaos action, and
// interpolates the other visitors' cursors between polls so they glide
// instead of jumping.

export interface PeerCursor { id: string; x: number; y: number; city: string }
export interface RemoteAction { id: string; action: string; city: string; at: number }
export interface SharedRecords { [metric: string]: { value: number; city: string; at: number } }

interface Opts {
    city: string;
    onPeers: (peers: PeerCursor[]) => void;
    onAction: (a: RemoteAction) => void;
    onRecords: (r: SharedRecords) => void;
}

const POLL_MS = 3000;

export class PresenceClient {
    private id: string;
    private opts: Opts;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private since = 0;
    private cursor = { x: 0, y: 0 };
    private pendingAction: string | null = null;
    private pendingRecord: { metric: string; value: number } | null = null;
    private targets = new Map<string, PeerCursor>();
    private current = new Map<string, PeerCursor>();
    private running = false;
    private inflight = false;
    connected = false;

    constructor(opts: Opts) {
        this.opts = opts;
        this.id = Math.random().toString(36).slice(2, 12);
    }
    start() { if (this.running) return; this.running = true; this.schedule(200); document.addEventListener("visibilitychange", this.onVis); }
    stop() { this.running = false; if (this.timer) clearTimeout(this.timer); this.timer = null; document.removeEventListener("visibilitychange", this.onVis); }
    private onVis = () => { if (!document.hidden && this.running) this.schedule(100); };
    setCursor(x: number, y: number) { this.cursor = { x, y }; }
    sendAction(action: string) { this.pendingAction = action; this.schedule(150); }
    sendRecord(metric: string, value: number) { this.pendingRecord = { metric, value }; }
    /** Interpolated cursors for the renderer; call every frame. */
    tick(dt: number): PeerCursor[] {
        const k = Math.min(1, dt / 400); const out: PeerCursor[] = [];
        for (const [id, t] of this.targets) {
            let c = this.current.get(id); if (!c) { c = { ...t }; this.current.set(id, c); }
            c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.city = t.city; out.push(c);
        }
        for (const id of this.current.keys()) if (!this.targets.has(id)) this.current.delete(id);
        return out;
    }
    private schedule(ms: number) { if (!this.running) return; if (this.timer) clearTimeout(this.timer); this.timer = setTimeout(() => this.poll(), ms); }
    private async poll() {
        if (!this.running) return;
        if (document.hidden || this.inflight) { this.schedule(POLL_MS); return; }
        this.inflight = true;
        const body: Record<string, unknown> = { id: this.id, x: Math.round(this.cursor.x), y: Math.round(this.cursor.y), city: this.opts.city, since: this.since };
        if (this.pendingAction) { body.action = this.pendingAction; this.pendingAction = null; }
        if (this.pendingRecord) { body.record = this.pendingRecord; this.pendingRecord = null; }
        try {
            const res = await fetch("/api/room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
            if (res.ok) {
                const data = await res.json();
                this.connected = true; this.since = data.now || Date.now();
                this.targets = new Map((data.peers || []).map((p: PeerCursor) => [p.id, p]));
                this.opts.onPeers(Array.from(this.targets.values()));
                for (const a of data.actions || []) this.opts.onAction(a);
                if (data.records) this.opts.onRecords(data.records);
            } else this.connected = false;
        } catch { this.connected = false; }
        this.inflight = false;
        this.schedule(POLL_MS);
    }
}
