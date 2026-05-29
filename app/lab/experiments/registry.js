// Pure metadata for the /lab experiments — no React, no client code,
// safe to import from server components (the index page +
// generateStaticParams). The actual interactive components are wired
// in experiment-host.jsx (client-only, dynamic).

export const experiments = [
    {
        slug: "wave-equation",
        title: "Wave Equation",
        tagline: "2D finite-difference PDE solver",
        blurb:
            "The classical wave equation ∂²u/∂t² = c²∇²u integrated on a grid with a leapfrog scheme. Click or drag to drop a disturbance and watch it propagate, reflect off the walls, and interfere with itself.",
        accent: "#06b6d4",
        tags: ["numerical methods", "PDE", "canvas"],
    },
    {
        slug: "verlet-cloth",
        title: "Verlet Cloth",
        tagline: "Position-based dynamics + constraints",
        blurb:
            "A grid of point masses joined by distance constraints, integrated with Verlet integration and relaxed over several constraint passes per frame. Drag to push the cloth around; drag hard and it tears.",
        accent: "#8b5cf6",
        tags: ["physics", "constraints", "canvas"],
    },
    {
        slug: "n-body",
        title: "N-Body Gravity",
        tagline: "Velocity-Verlet gravitational integration",
        blurb:
            "Point masses under mutual Newtonian gravity, integrated with a symplectic velocity-Verlet step so orbits stay stable instead of spiralling from numerical drift. Starts as a binary; click to fling in more bodies.",
        accent: "#f472b6",
        tags: ["physics", "n-body", "canvas"],
    },
];

export function getExperiment(slug) {
    return experiments.find((e) => e.slug === slug) || null;
}

export function getAllExperimentSlugs() {
    return experiments.map((e) => e.slug);
}
