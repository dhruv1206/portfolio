"use client";

import { useSyncExternalStore } from "react";

// Detects a browser feature without ever calling setState inside an
// effect. The check runs on every render but is cheap (a property
// existence test or a small predicate). Server snapshot is always
// false, so SSR renders match the "unsupported" branch and hydration
// completes without mismatch warnings.
//
// Usage:
//   const hasTouch = useFeatureSupport(
//       () => "ontouchstart" in window || navigator.maxTouchPoints > 0,
//   );

const noopSubscribe = () => () => {};

export function useFeatureSupport(check) {
    return useSyncExternalStore(
        noopSubscribe,
        () => {
            try {
                return Boolean(check());
            } catch {
                return false;
            }
        },
        () => false,
    );
}

export default useFeatureSupport;
