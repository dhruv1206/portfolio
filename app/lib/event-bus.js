// Tiny pub-sub used by the system-architecture overlay to listen for
// "events that actually fired" — voice commands recognised,
// IntersectionObserver triggers, audio section changes, predictive
// prefetches queued — and animate the matching graph edges.
//
// Deliberately minimal: no priorities, no event bubbling, no payload
// schema enforcement. Listeners get whatever the emitter sent.
// The overlay is the only consumer today; existing hooks are
// instrumented via fire-and-forget `emit()` calls so unsubscribed
// listeners don't cost anything.

const listeners = new Map();

export function on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => {
        const set = listeners.get(event);
        if (!set) return;
        set.delete(handler);
        if (set.size === 0) listeners.delete(event);
    };
}

export function emit(event, data) {
    const set = listeners.get(event);
    if (!set || set.size === 0) return;
    for (const handler of set) {
        try {
            handler(data);
        } catch (e) {
            console.warn("[event-bus] handler error for", event, e);
        }
    }
}

export function listenerCount(event) {
    return listeners.get(event)?.size || 0;
}

// Convenience namespaced API for the consumers.
export const eventBus = { on, emit, listenerCount };

export default eventBus;
