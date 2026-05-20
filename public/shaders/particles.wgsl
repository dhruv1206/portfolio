// Particle hero — compute + render passes.
//
// The same GPU buffer holds the particle state for both passes:
//   - Compute binds it as `storage<read_write>` to update.
//   - Render binds it as an instanced vertex buffer (read-only) for draw.
//     (Render stages can't bind writable storage in WebGPU.)
//
// Per particle (32-byte stride):
//   pos:   vec2<f32>   (px, y down)
//   vel:   vec2<f32>   (px/sec)
//   goal:  vec2<f32>   (px; rest position; springK=0 disables)
//   tint:  f32         (0..1 = DHRUV gradient, 2.0 = AGRAWAL white)
//   _pad:  f32         (alignment)
//
// Field is `goal` not `target` — `target` is a WGSL reserved keyword
// (rejected by Dawn / Chrome's WGSL compiler).

struct Particle {
    pos: vec2<f32>,
    vel: vec2<f32>,
    goal: vec2<f32>,
    tint: f32,
    spring: f32,   // per-particle k; 0 → ambient (no goal influence)
}

struct Sim {
    mouse: vec2<f32>,       // pixels; off-screen value disables
    resolution: vec2<f32>,  // canvas size in pixels
    dt: f32,                // seconds since last frame (capped)
    time: f32,              // seconds since worker init
    mouseRadius: f32,       // pixels; 0 disables
    mouseForce: f32,        // peak px/s^2 inside the radius
    springK: f32,           // toward-target spring constant
    damping: f32,           // per-frame velocity multiplier
    particleSize: f32,      // half-extent of the rendered quad
    flowStrength: f32,      // curl-noise multiplier
}

@group(0) @binding(0) var<storage, read_write> particles: array<Particle>;
@group(0) @binding(1) var<uniform> sim: Sim;

// ---- 2D value noise -> curl (divergence-free flow field) ----

fn hash(p: vec2<f32>) -> f32 {
    var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
    p3 = p3 + dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

fn noise2(p: vec2<f32>) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);
    let a = hash(i + vec2<f32>(0.0, 0.0));
    let b = hash(i + vec2<f32>(1.0, 0.0));
    let c = hash(i + vec2<f32>(0.0, 1.0));
    let d = hash(i + vec2<f32>(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn curl(p: vec2<f32>) -> vec2<f32> {
    let e = 1.0;
    let n1 = noise2(p + vec2<f32>(0.0, e));
    let n2 = noise2(p - vec2<f32>(0.0, e));
    let n3 = noise2(p + vec2<f32>(e, 0.0));
    let n4 = noise2(p - vec2<f32>(e, 0.0));
    return vec2<f32>(n1 - n2, n4 - n3);
}

// ---- Compute pass ----

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) gid: vec3<u32>) {
    let idx = gid.x;
    if (idx >= arrayLength(&particles)) { return; }
    var p = particles[idx];

    var force = vec2<f32>(0.0, 0.0);

    // Spring toward rest position. Per-particle: anchored particles
    // have spring > 0, ambient particles have spring == 0.
    if (p.spring > 0.0) {
        force = force + (p.goal - p.pos) * p.spring;
    }

    // Curl-noise flow.
    let scale = 0.004;
    let drift = vec2<f32>(sim.time * 0.05, sim.time * 0.03);
    let c = curl(p.pos * scale + drift);
    force = force + c * sim.flowStrength;

    // Mouse repulsion.
    if (sim.mouseRadius > 0.0) {
        let to_mouse = p.pos - sim.mouse;
        let dist = length(to_mouse);
        if (dist < sim.mouseRadius && dist > 0.001) {
            let falloff = 1.0 - dist / sim.mouseRadius;
            force = force + normalize(to_mouse) * falloff * sim.mouseForce;
        }
    }

    // Semi-implicit Euler + damping.
    p.vel = (p.vel + force * sim.dt) * sim.damping;
    p.pos = p.pos + p.vel * sim.dt;

    // Soft-wrap so particles re-enter on the opposite side.
    if (p.pos.x < -50.0) { p.pos.x = sim.resolution.x + 50.0; }
    if (p.pos.x > sim.resolution.x + 50.0) { p.pos.x = -50.0; }
    if (p.pos.y < -50.0) { p.pos.y = sim.resolution.y + 50.0; }
    if (p.pos.y > sim.resolution.y + 50.0) { p.pos.y = -50.0; }

    particles[idx] = p;
}

// ---- Render pass ----
//
// Particles are bound as an instanced vertex buffer (see pipeline layout
// in particles.worker.js). vs_main reads pos/vel via vertex attributes
// at locations 0/1; the per-vertex quad shape comes from `vertex_index`.

struct RenderUniforms {
    resolution: vec2<f32>,
    particleSize: f32,
    _pad: f32,
}

@group(0) @binding(0) var<uniform> ru: RenderUniforms;

struct VSIn {
    @location(0) pos: vec2<f32>,
    @location(1) vel: vec2<f32>,
    @location(2) tint: f32,
}

struct VSOut {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32, in: VSIn) -> VSOut {
    var positions = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
    );
    let local = positions[vi];

    let world = in.pos + local * ru.particleSize;
    // pixels -> NDC, flipping y to match canvas convention.
    let ndc = (world / ru.resolution) * 2.0 - 1.0;

    var out: VSOut;
    out.position = vec4<f32>(ndc.x, -ndc.y, 0.0, 1.0);
    out.uv = local;

    // Colour from per-particle `tint`:
    //   tint in [0, 1] → DHRUV gradient (violet → cyan)
    //   tint == 2.0    → AGRAWAL near-white
    // Speed-based brightness boost pops dispersing particles briefly.
    let violet = vec3<f32>(0.545, 0.361, 0.965); // #8b5cf6
    let cyan   = vec3<f32>(0.024, 0.714, 0.831); // #06b6d4
    let white  = vec3<f32>(0.96,  0.96,  0.98);

    let t = clamp(in.tint, 0.0, 1.0);
    let dhruv = mix(violet, cyan, t);
    var base = dhruv;
    if (in.tint > 1.5) {
        base = white;
    }
    let speed = length(in.vel);
    let pulse = clamp(speed / 320.0, 0.0, 0.4);
    let rgb = base + vec3<f32>(pulse);
    out.color = vec4<f32>(rgb, 0.78);
    return out;
}

@fragment
fn fs_main(in: VSOut) -> @location(0) vec4<f32> {
    let d = length(in.uv);
    if (d > 1.0) { discard; }
    // Smooth radial falloff so each particle reads as a small soft dot
    // rather than a hard square.
    let alpha = (1.0 - smoothstep(0.0, 1.0, d)) * in.color.a;
    return vec4<f32>(in.color.rgb * alpha, alpha);
}
