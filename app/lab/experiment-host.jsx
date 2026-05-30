"use client";

import dynamic from "next/dynamic";

// Client-only host: each experiment owns a canvas + rAF loop, so it
// must not SSR. Keyed by slug; the server route only passes the slug
// string across the boundary.
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
    "reaction-diffusion": dynamic(
        () => import("./experiments/reaction-diffusion"),
        { ssr: false, loading: () => <LoadingShim /> },
    ),
    fluid: dynamic(() => import("./experiments/fluid"), {
        ssr: false,
        loading: () => <LoadingShim />,
    }),
    physarum: dynamic(() => import("./experiments/physarum"), {
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
