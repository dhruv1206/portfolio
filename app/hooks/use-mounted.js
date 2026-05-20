"use client";

import { useSyncExternalStore } from "react";

// Canonical React 19 "am I on the client" hook. Replaces the
// `useState(false) + useEffect(() => setState(true), [])` pattern that
// eslint-plugin-react-hooks@7 flags as `set-state-in-effect`. Returns
// false during server prerender + hydration's first render, true once
// React is committed in the browser.

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useMounted() {
    return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export default useMounted;
