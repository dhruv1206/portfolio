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
        <div className="spin-wrap"><span className="spin" />loading the simulation</div>
    );
}

export default function ExperimentHost({ slug }) {
    const Comp = LOADERS[slug];
    if (!Comp) {
        return (
            <div className="spin-wrap">unknown experiment</div>
        );
    }
    return <Comp />;
}
