"use client";

import dynamic from "next/dynamic";

// Client-only host: each experiment owns a canvas + rAF loop, so it
// must not SSR. Keyed by slug; the server route only passes the slug
// string across the boundary.
//
// The soft "diffusing field" batch (reaction-diffusion / fluid /
// physarum / mpm-fluid) is parked — files remain in
// app/lab/experiments/ but aren't wired here. Re-add the loaders +
// their registry entries to bring them back.
const LOADERS = {
    "wave-equation": dynamic(() => import("./experiments/wave-equation"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    "verlet-cloth": dynamic(() => import("./experiments/verlet-cloth"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    "n-body": dynamic(() => import("./experiments/nbody"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    "double-pendulum": dynamic(
        () => import("./experiments/double-pendulum"),
        { ssr: false, loading: () => <LoadingShim /> },
    ),
    boids: dynamic(() => import("./experiments/boids"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    attractor: dynamic(() => import("./experiments/attractor"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    fourier: dynamic(() => import("./experiments/fourier"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
};

function LoadingShim() {
    return (
        <div className="w-full h-full flex items-center justify-center">
            <div className="w-10 h-10 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
        </div>
    );
}

export default function ExperimentHost({ slug }) {
    const Comp = LOADERS[slug];
    if (!Comp) {
        return (
            <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono text-sm">
                unknown experiment
            </div>
        );
    }
    return <Comp />;
}
