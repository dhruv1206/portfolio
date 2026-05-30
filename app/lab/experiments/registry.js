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
    {
        slug: "reaction-diffusion",
        title: "Reaction-Diffusion",
        tagline: "Gray-Scott Turing patterns",
        blurb:
            "Two virtual chemicals diffusing at different rates and reacting A+2B→3B. The Gray-Scott model self-organises into Turing patterns — spots, stripes, mazes, mitosis, coral — and a hair's-width change to the feed/kill rates flips the entire regime. Click to seed; switch presets live.",
        accent: "#22d3ee",
        tags: ["reaction-diffusion", "PDE", "emergent", "canvas"],
    },
    {
        slug: "fluid",
        title: "Stable Fluids",
        tagline: "WebGPU · incompressible Navier-Stokes",
        blurb:
            "Jos Stam's unconditionally-stable fluid solver, running as WebGPU compute passes: semi-Lagrangian advection, a Jacobi-iteration pressure projection that enforces incompressibility, and vorticity confinement to keep the curls crisp. Drag to inject dye and velocity — it physically cannot blow up.",
        accent: "#38bdf8",
        tags: ["fluid dynamics", "Navier-Stokes", "WebGPU compute"],
    },
    {
        slug: "physarum",
        title: "Physarum",
        tagline: "WebGPU · slime-mold agents",
        blurb:
            "Hundreds of thousands of agents, each sensing a trail map through three forward sensors, steering toward concentration and depositing their own trail — which then diffuses and decays. No rule says 'build a network', yet transport networks emerge anyway. Agent update + trail diffusion both run on the GPU.",
        accent: "#a3e635",
        tags: ["agent-based", "emergent", "WebGPU compute"],
    },
    {
        slug: "mpm-fluid",
        title: "MLS-MPM Fluid",
        tagline: "WebGPU · 3D material-point method",
        blurb:
            "A genuinely 3D liquid simulated with the Moving-Least-Squares Material Point Method — momentum is transferred particle→grid→particle (P2G/G2P) each step, sidestepping the neighbour search that bottlenecks SPH. Tens of thousands of particles slosh in a box you can tilt. The moonshot of the lab.",
        accent: "#60a5fa",
        tags: ["MLS-MPM", "3D fluid", "WebGPU compute"],
    },
];

export function getExperiment(slug) {
    return experiments.find((e) => e.slug === slug) || null;
}

export function getAllExperimentSlugs() {
    return experiments.map((e) => e.slug);
}
