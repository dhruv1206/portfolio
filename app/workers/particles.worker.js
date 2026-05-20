// Particle hero worker — owns the OffscreenCanvas, the WebGPU device,
// and the per-frame loop. The main thread sends `init`, `mouse`,
// `resize`, `dispose`; the worker only posts `ready` / `error` back.

const PARTICLE_BYTES = 32; // 8 × f32 — see Particle struct in particles.wgsl
const SIM_BYTES = 48;      // 12 × f32 (16-byte aligned padding included)
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

// Simulation tuning. Quiet starfield: particles drift almost
// independently, with just enough flow to keep them alive. Hero text
// + SystemTopology stay the focus.
const config = {
    mouseForce: 220000,
    springK: 0,         // 0 = ambient flow (text-formation reserved for later)
    damping: 0.97,      // higher = slower / longer settling
    particleSize: 1.3,  // half-extent in device px
    flowStrength: 3.2,  // very gentle drift — bigger values cluster particles into visible curl bands
};

function postError(message) {
    self.postMessage({ type: "error", error: message });
}

function makeParticleBuffer(goals) {
    const f32 = new Float32Array((particleCount * PARTICLE_BYTES) / 4);
    for (let i = 0; i < particleCount; i++) {
        const base = i * 8;
        // `goal` (was named "target" before, but that's a WGSL reserved
        // keyword — see particles.wgsl).
        const gx = goals ? goals[i * 2] : width / 2;
        const gy = goals ? goals[i * 2 + 1] : height / 2;
        f32[base + 0] = Math.random() * width;
        f32[base + 1] = Math.random() * height;
        f32[base + 2] = (Math.random() - 0.5) * 40;
        f32[base + 3] = (Math.random() - 0.5) * 40;
        f32[base + 4] = gx;
        f32[base + 5] = gy;
        f32[base + 6] = 0;
        f32[base + 7] = 0;
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
}) {
    canvas = offscreen;
    particleCount = count;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;

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
    const initial = makeParticleBuffer(targets);
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
