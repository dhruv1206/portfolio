"use client";

import { useSyncExternalStore } from "react";

// false on the server and while hydrating, true from the render right
// after: for the parts of a server-rendered component that its HTML can do
// without. No effect and no hydration mismatch.

const subscribe = () => () => {};

export function useHydrated() {
    return useSyncExternalStore(subscribe, () => true, () => false);
}
