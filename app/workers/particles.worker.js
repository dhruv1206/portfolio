// Particle hero worker — owns the OffscreenCanvas, the WebGPU device,
// and the per-frame loop. The main thread sends `init`, `mouse`,
// `resize`, `dispose`; the worker only posts `ready` / `error` back.

const PARTICLE_BYTES = 32; // 8 × f32 — see Particle struct in particles.wgsl
// 14 × f32 of payload (12 scalars + scrollOffset vec2). Padded to 64
// so the buffer size is a 16-byte multiple — some WebGPU drivers
// reject non-16-aligned uniform buffer sizes even if the WGSL struct
// itself only needs 8-byte alignment.
const SIM_BYTES = 64;
const RENDER_UNIFORM_BYTES = 16; // vec2 + f32 + f32

let device = null;
let canvas = null;
let context = null;
let format = null;

let computePipeline = null;
let renderPipeline = null;

let particleBuffer = null;
let simBuffer = null;
let renderUniformBuffer = null;

let computeBindGroup = null;
let renderBindGroup = null;

let particleCount = 0;
let width = 0;
let height = 0;

let rafHandle = null;
let lastFrameTime = 0;
let startTime = 0;
let disposed = false;

// Pointer state lives on the worker.
let mouseX = -10000;
let mouseY = -10000;
let mouseRadius = 0;

// Scroll offset (device pixels). Goals stored in document coords; the
// shader subtracts this each frame to translate goals into the current
// viewport. Updated from the main thread via `{type: 'scroll'}`.
let scrollX = 0;
let scrollY = 0;

// Simulation tuning. Letters formed by per-particle spring (set in
// particle buffer, not here). Damping kept lowish so the nebula
// collapse has visible swirling motion before settling, and curl-noise
// flowStrength is high enough to deflect particles off straight paths
// (so no two particles trace the same trajectory into the letters).
const config = {
    mouseForce: 320000,
    springK: 0,         // unused — per-particle spring lives in the buffer
    damping: 0.93,
    particleSize: 1.0,  // half-extent in device px
    flowStrength: 5.0,
};

function postError(message) {
    self.postMessage({ type: "error", error: message });
}

function makeParticleBuffer(goals, tints, springs, initScrollX, initScrollY) {
    const f32 = new Float32Array((particleCount * PARTICLE_BYTES) / 4);

    // "Nebula collapse" formation. Three things break the geometric-
    // contraction look:
    //
    // 1. Each particle spawns in a wide elliptical halo around its OWN
    //    goal letter — not at canvas edges, not in a uniform field.
    //    Each letter has its own swirling cloud that collapses inward,
    //    so there's no global rectangle ever visible.
    //
    // 2. Initial velocity is TANGENTIAL to the radius (orbital, with
    //    noise), not aimed at the goal. Particles spiral inward rather
    //    than zooming straight in — non-radial paths overlap and
    //    weave organically.
    //
    // 3. Per-particle spring constant is randomised inside a wide band
    //    (~×0.4 to ~×1.6 of the base k) so different particles
    //    converge at very different rates. The formation has a long
    //    tail of "stragglers" still arriving while the bulk has
    //    already settled — feels organic, not snap-to.
    const HALO_INNER = 30;     // min px from goal at spawn
    const HALO_OUTER = 520;    // max px from goal
    const ORBITAL_NOISE = 1.1; // ± radians around the pure tangent
    const SPEED_MIN = 180;
    const SPEED_VARIANCE = 540;
    const K_FACTOR_LOW = 0.4;
    const K_FACTOR_HIGH = 1.6;

    for (let i = 0; i < particleCount; i++) {
        const base = i * 8;
        const gx = goals ? goals[i * 2] : width / 2;
        const gy = goals ? goals[i * 2 + 1] : height / 2;
        const tint = tints ? tints[i] : 1.0;
        const baseK = springs ? springs[i] : 7.0;

        // Spawn center: the goal projected into the CURRENT viewport
        // (= goal − scroll-at-init). Clamped into the canvas so a
        // hash-load (e.g. `/#projects`, where the hero is scrolled
        // off-screen at mount) doesn't spawn the entire halo off-
        // canvas — that would soft-wrap chaotically before the user
        // scrolls back.
        const effGx = gx - initScrollX;
        const effGy = gy - initScrollY;
        const spawnX = Math.max(0, Math.min(width, effGx));
        const spawnY = Math.max(0, Math.min(height, effGy));

        // Halo position: random angle, biased-toward-outer radial
        // distance so the cloud is wide. sqrt() flattens the inner
        // density so halo doesn't pile up at the goal.
        const r =
            HALO_INNER +
            Math.sqrt(Math.random()) * (HALO_OUTER - HALO_INNER);
        const a = Math.random() * Math.PI * 2;
        const px = spawnX + Math.cos(a) * r;
        const py = spawnY + Math.sin(a) * r;

        // Tangential velocity (perpendicular to radius), with angular
        // noise so it isn't a perfect ring. Half spin clockwise, half
        // counter-clockwise.
        const tangent = a + Math.PI / 2 + (Math.random() - 0.5) * ORBITAL_NOISE;
        const dir = Math.random() < 0.5 ? 1 : -1;
        const speed = SPEED_MIN + Math.random() * SPEED_VARIANCE;
        const vx = Math.cos(tangent) * speed * dir;
        const vy = Math.sin(tangent) * speed * dir;

        // Per-particle k variation → staggered convergence.
        const k =
            baseK > 0
                ? baseK *
                  (K_FACTOR_LOW +
                      Math.random() * (K_FACTOR_HIGH - K_FACTOR_LOW))
                : 0;

        f32[base + 0] = px;
        f32[base + 1] = py;
        f32[base + 2] = vx;
        f32[base + 3] = vy;
        f32[base + 4] = gx;
        f32[base + 5] = gy;
        f32[base + 6] = tint;
        f32[base + 7] = k;
    }
    return f32;
}

function writeSimUniforms() {
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 1 / 30); // cap to keep big tab-out gaps sane
    lastFrameTime = now;
    const time = (now - startTime) / 1000;

    const sim = new Float32Array(SIM_BYTES / 4);
    sim[0] = mouseX;
    sim[1] = mouseY;
    sim[2] = width;
    sim[3] = height;
    sim[4] = dt;
    sim[5] = time;
    sim[6] = mouseRadius;
    sim[7] = config.mouseForce;
    sim[8] = config.springK;
    sim[9] = config.damping;
    sim[10] = config.particleSize;
    sim[11] = config.flowStrength;
    sim[12] = scrollX;
    sim[13] = scrollY;
    // sim[14], sim[15] are zero-padding so the upload is 16-byte aligned.
    device.queue.writeBuffer(simBuffer, 0, sim.buffer, 0, SIM_BYTES);
}

function writeRenderUniforms() {
    const ru = new Float32Array(RENDER_UNIFORM_BYTES / 4);
    ru[0] = width;
    ru[1] = height;
    ru[2] = config.particleSize;
    ru[3] = 0;
    device.queue.writeBuffer(renderUniformBuffer, 0, ru.buffer);
}

function frame() {
    if (disposed || !device) return;

    writeSimUniforms();
    writeRenderUniforms();

    const encoder = device.createCommandEncoder();

    // Compute: advance every particle.
    const cp = encoder.beginComputePass();
    cp.setPipeline(computePipeline);
    cp.setBindGroup(0, computeBindGroup);
    cp.dispatchWorkgroups(Math.ceil(particleCount / 64));
    cp.end();

    // Render: instanced quad per particle.
    const view = context.getCurrentTexture().createView();
    const rp = encoder.beginRenderPass({
        colorAttachments: [
            {
                view,
                clearValue: { r: 0, g: 0, b: 0, a: 0 },
                loadOp: "clear",
                storeOp: "store",
            },
        ],
    });
    rp.setPipeline(renderPipeline);
    rp.setBindGroup(0, renderBindGroup);
    rp.setVertexBuffer(0, particleBuffer);
    rp.draw(6, particleCount);
    rp.end();

    device.queue.submit([encoder.finish()]);

    rafHandle = requestAnimationFrame(frame);
}

async function init({
    canvas: offscreen,
    particleCount: count,
    width: w,
    height: h,
    shaderCode,
    targets, // legacy name retained for the postMessage API
    tints,   // parallel Float32Array, length = particleCount
    springs, // parallel Float32Array, length = particleCount
    initialScrollX = 0, // device pixels at mount time (for spawn projection)
    initialScrollY = 0,
}) {
    canvas = offscreen;
    particleCount = count;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    scrollX = initialScrollX;
    scrollY = initialScrollY;

    if (!self.navigator?.gpu) {
        postError("WebGPU unavailable in worker context");
        return;
    }

    const adapter = await self.navigator.gpu.requestAdapter();
    if (!adapter) {
        postError("No GPU adapter");
        return;
    }
    device = await adapter.requestDevice();
    device.lost.then(() => {
        if (!disposed) postError("GPU device lost");
    });

    context = canvas.getContext("webgpu");
    format = self.navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: "premultiplied" });

    // Wrap pipeline creation in an error scope so a WGSL compile failure
    // surfaces as a rejected init() instead of an invisible cascade of
    // invalid-pipeline + invalid-command-buffer messages every frame.
    device.pushErrorScope("validation");
    const shaderModule = device.createShaderModule({ code: shaderCode });
    // compilationInfo() returns the parser's diagnostics — far more
    // helpful than the catch-all "validation failed" we'd get otherwise.
    const compInfo = await shaderModule.getCompilationInfo();
    const fatal = compInfo.messages.find((m) => m.type === "error");
    if (fatal) {
        device.popErrorScope().catch(() => {});
        throw new Error(
            `WGSL compile error: ${fatal.message} (line ${fatal.lineNum})`,
        );
    }

    // Buffers
    particleBuffer = device.createBuffer({
        size: particleCount * PARTICLE_BYTES,
        usage:
            GPUBufferUsage.STORAGE |
            GPUBufferUsage.VERTEX |
            GPUBufferUsage.COPY_DST,
    });
    const initial = makeParticleBuffer(
        targets,
        tints,
        springs,
        scrollX,
        scrollY,
    );
    device.queue.writeBuffer(particleBuffer, 0, initial.buffer);

    simBuffer = device.createBuffer({
        size: SIM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    renderUniformBuffer = device.createBuffer({
        size: RENDER_UNIFORM_BYTES,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Compute pipeline reads/writes particles + reads sim.
    computePipeline = device.createComputePipeline({
        layout: "auto",
        compute: { module: shaderModule, entryPoint: "cs_main" },
    });
    computeBindGroup = device.createBindGroup({
        layout: computePipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: particleBuffer } },
            { binding: 1, resource: { buffer: simBuffer } },
        ],
    });

    // Render pipeline: vertex stage reads particle attrs via vertex buffer,
    // bind group 0 carries just the render uniforms.
    renderPipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module: shaderModule,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: PARTICLE_BYTES,
                    stepMode: "instance",
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" }, // pos
                        { shaderLocation: 1, offset: 8, format: "float32x2" }, // vel
                        { shaderLocation: 2, offset: 24, format: "float32" },  // tint
                    ],
                },
            ],
        },
        fragment: {
            module: shaderModule,
            entryPoint: "fs_main",
            targets: [
                {
                    format,
                    // Standard over-composite with premultiplied alpha.
                    // Additive blending (src=one, dst=one) accumulated
                    // brightness wherever particles clustered, turning
                    // dense regions into a saturated violet wall — wrong
                    // look for an ambient backdrop.
                    blend: {
                        color: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                        alpha: {
                            srcFactor: "one",
                            dstFactor: "one-minus-src-alpha",
                            operation: "add",
                        },
                    },
                },
            ],
        },
        primitive: { topology: "triangle-list" },
    });
    renderBindGroup = device.createBindGroup({
        layout: renderPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: renderUniformBuffer } }],
    });

    // Close the validation error scope. If anything in pipeline creation
    // produced a validation error, throw so the wrapper can fall back.
    const validationError = await device.popErrorScope();
    if (validationError) {
        throw new Error(`WebGPU validation: ${validationError.message}`);
    }

    startTime = performance.now();
    lastFrameTime = startTime;

    self.postMessage({ type: "ready" });
    rafHandle = requestAnimationFrame(frame);
}

self.onmessage = (event) => {
    const { type } = event.data || {};
    if (type === "init") {
        init(event.data).catch((err) => postError(err?.message || String(err)));
    } else if (type === "mouse") {
        mouseX = event.data.x;
        mouseY = event.data.y;
        mouseRadius = event.data.radius ?? 120;
    } else if (type === "mouse-leave") {
        mouseRadius = 0;
        mouseX = -10000;
        mouseY = -10000;
    } else if (type === "resize") {
        width = event.data.width;
        height = event.data.height;
        if (canvas) {
            canvas.width = width;
            canvas.height = height;
        }
    } else if (type === "scroll") {
        scrollX = event.data.x || 0;
        scrollY = event.data.y || 0;
    } else if (type === "dispose") {
        disposed = true;
        if (rafHandle != null) cancelAnimationFrame(rafHandle);
        rafHandle = null;
        try {
            device?.destroy?.();
        } catch (e) {
            // ignore
        }
        device = null;
    }
};
