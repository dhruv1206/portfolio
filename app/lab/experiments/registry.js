// Pure metadata for the /lab experiments — no React, no client code,
// safe to import from server components (the index page +
// generateStaticParams). The actual interactive components are wired
// in experiment-host.jsx (client-only, dynamic).
//
// The lab favours CRISP, structured, high-contrast line/point art in
// the site's violet/cyan/white palette (wave / cloth / n-body /
// pendulum / boids / attractor / fourier). An earlier batch of soft
// "diffusing field" pieces (reaction-diffusion, fluid, Physarum,
// MLS-MPM) is parked — source still in app/lab/experiments/, just not
// listed here or in experiment-host.jsx. Re-add their entries to
// bring them back.

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
    {
        slug: "double-pendulum",
        title: "Double Pendulum",
        tagline: "Chaos · sensitive dependence",
        blurb:
            "A fan of double pendulums released from almost-identical angles. They track together for a moment, then the tiniest difference explodes into completely different paths — deterministic chaos, drawn as crisp fading arcs. Click to release a fresh fan.",
        accent: "#8b5cf6",
        tags: ["chaos", "ODE", "canvas"],
    },
    {
        slug: "boids",
        title: "Boids",
        tagline: "Reynolds flocking",
        blurb:
            "Hundreds of agents running Craig Reynolds' three rules — separation, alignment, cohesion — with nothing choreographing them. Coherent flocks, splits, and swirls emerge from local interactions alone. Move your cursor to herd them.",
        accent: "#06b6d4",
        tags: ["emergent", "flocking", "canvas"],
    },
    {
        slug: "attractor",
        title: "Lorenz Attractor",
        tagline: "A strange attractor in 3D",
        blurb:
            "The Lorenz system — three coupled ODEs from atmospheric convection — integrated into its famous butterfly. The trajectory never repeats yet never escapes a bounded region: a strange attractor, traced as a luminous curve you can rotate.",
        accent: "#f472b6",
        tags: ["chaos", "ODE", "3D", "canvas"],
    },
    {
        slug: "fourier",
        title: "Fourier Epicycles",
        tagline: "DFT · rotating circles draw a shape",
        blurb:
            "Any closed path can be rebuilt as a sum of rotating circles — the discrete Fourier transform made visible. Each circle spins at its own frequency; chained tip-to-tip, the last tip retraces the original drawing. Click to switch shapes.",
        accent: "#06b6d4",
        tags: ["Fourier", "DFT", "canvas"],
    },
];

export function getExperiment(slug) {
    return experiments.find((e) => e.slug === slug) || null;
}

export function getAllExperimentSlugs() {
    return experiments.map((e) => e.slug);
}
