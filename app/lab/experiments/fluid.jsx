"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";
import { initWebGPU, makeShaderModule, WEBGPU_FALLBACK_TEXT } from "./webgpu-util";

// Jos Stam "stable fluids" — incompressible Navier-Stokes — as a stack
// of WebGPU compute passes over a velocity grid + a dye grid:
//
//   splat → advect velocity (semi-Lagrangian) → curl → vorticity
//   confinement → divergence → Jacobi pressure solve (×N) →
//   subtract pressure gradient (project to divergence-free) →
//   advect dye.
//
// The projection step (Helmholtz-Hodge: solve ∇²p = ∇·u, then
// u ← u − ∇p) is what makes it look like real fluid. Semi-Lagrangian
// advection is unconditionally stable, so no amount of mouse-flinging
// blows it up.
//
// Buffers ping-pong via copyBufferToBuffer for velocity/dye; pressure
// ping-pongs between two bind groups across the Jacobi iterations.

const WGSL = /* wgsl */ `
struct Sim {
  sizeX: f32, sizeY: f32, dt: f32, pointerActive: f32,
  pointerX: f32, pointerY: f32, deltaX: f32, deltaY: f32,
  colR: f32, colG: f32, colB: f32, splatRadius: f32,
  dissipation: f32, vorticity: f32, _p0: f32, _p1: f32,
}
@group(0) @binding(0) var<uniform> sim: Sim;
@group(0) @binding(1) var<storage, read_write> velA: array<vec2<f32>>;
@group(0) @binding(2) var<storage, read_write> velB: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read_write> pIn: array<f32>;
@group(0) @binding(4) var<storage, read_write> pOut: array<f32>;
@group(0) @binding(5) var<storage, read_write> divg: array<f32>;
@group(0) @binding(6) var<storage, read_write> curlb: array<f32>;
@group(0) @binding(7) var<storage, read_write> dyeA: array<vec4<f32>>;
@group(0) @binding(8) var<storage, read_write> dyeB: array<vec4<f32>>;

fn W() -> u32 { return u32(sim.sizeX); }
fn H() -> u32 { return u32(sim.sizeY); }
fn idx(x: u32, y: u32) -> u32 { return y * W() + x; }
fn inb(gid: vec3<u32>) -> bool { return gid.x < W() && gid.y < H(); }

fn sampleVel(p: vec2<f32>) -> vec2<f32> {
  let w = W(); let h = H();
  let x = clamp(p.x, 0.0, f32(w) - 1.001);
  let y = clamp(p.y, 0.0, f32(h) - 1.001);
  let x0 = u32(floor(x)); let y0 = u32(floor(y));
  let x1 = min(x0 + 1u, w - 1u); let y1 = min(y0 + 1u, h - 1u);
  let fx = x - f32(x0); let fy = y - f32(y0);
  let v00 = velA[idx(x0, y0)]; let v10 = velA[idx(x1, y0)];
  let v01 = velA[idx(x0, y1)]; let v11 = velA[idx(x1, y1)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}
fn sampleDye(p: vec2<f32>) -> vec4<f32> {
  let w = W(); let h = H();
  let x = clamp(p.x, 0.0, f32(w) - 1.001);
  let y = clamp(p.y, 0.0, f32(h) - 1.001);
  let x0 = u32(floor(x)); let y0 = u32(floor(y));
  let x1 = min(x0 + 1u, w - 1u); let y1 = min(y0 + 1u, h - 1u);
  let fx = x - f32(x0); let fy = y - f32(y0);
  let v00 = dyeA[idx(x0, y0)]; let v10 = dyeA[idx(x1, y0)];
  let v01 = dyeA[idx(x0, y1)]; let v11 = dyeA[idx(x1, y1)];
  return mix(mix(v00, v10, fx), mix(v01, v11, fx), fy);
}

// ---- splat: inject velocity + dye near the pointer (in place) ----
@compute @workgroup_size(8, 8)
fn splat(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let i = idx(gid.x, gid.y);
  if (sim.pointerActive < 0.5) { return; }
  let d = vec2<f32>(f32(gid.x) - sim.pointerX, f32(gid.y) - sim.pointerY);
  let r2 = sim.splatRadius * sim.splatRadius;
  let fall = exp(-dot(d, d) / r2);
  velA[i] = velA[i] + vec2<f32>(sim.deltaX, sim.deltaY) * fall;
  dyeA[i] = dyeA[i] + vec4<f32>(sim.colR, sim.colG, sim.colB, 1.0) * fall;
}

// ---- advect velocity (semi-Lagrangian backtrace) ----
@compute @workgroup_size(8, 8)
fn advectVel(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let i = idx(gid.x, gid.y);
  let pos = vec2<f32>(f32(gid.x), f32(gid.y));
  let back = pos - velA[i] * sim.dt;
  velB[i] = sampleVel(back) * sim.dissipation;
}

// ---- curl (z-component of ∇×u) ----
@compute @workgroup_size(8, 8)
fn curl(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let w = W(); let h = H();
  let xl = max(gid.x, 1u) - 1u; let xr = min(gid.x + 1u, w - 1u);
  let yd = max(gid.y, 1u) - 1u; let yu = min(gid.y + 1u, h - 1u);
  let dvy_dx = velB[idx(xr, gid.y)].y - velB[idx(xl, gid.y)].y;
  let dvx_dy = velB[idx(gid.x, yu)].x - velB[idx(gid.x, yd)].x;
  curlb[idx(gid.x, gid.y)] = 0.5 * (dvy_dx - dvx_dy);
}

// ---- vorticity confinement: push velocity toward curl extrema ----
@compute @workgroup_size(8, 8)
fn vorticity(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let w = W(); let h = H();
  let i = idx(gid.x, gid.y);
  let xl = max(gid.x, 1u) - 1u; let xr = min(gid.x + 1u, w - 1u);
  let yd = max(gid.y, 1u) - 1u; let yu = min(gid.y + 1u, h - 1u);
  let cL = abs(curlb[idx(xl, gid.y)]);
  let cR = abs(curlb[idx(xr, gid.y)]);
  let cD = abs(curlb[idx(gid.x, yd)]);
  let cU = abs(curlb[idx(gid.x, yu)]);
  var grad = vec2<f32>(cR - cL, cU - cD) * 0.5;
  let len = max(length(grad), 1e-5);
  grad = grad / len;
  let c = curlb[i];
  // N × curl gives a force perpendicular to the gradient of |curl|.
  let force = vec2<f32>(grad.y * c, -grad.x * c) * sim.vorticity;
  velA[i] = velB[i] + force * sim.dt;
}

// ---- divergence of the (confined) velocity ----
@compute @workgroup_size(8, 8)
fn divergence(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let w = W(); let h = H();
  let xl = max(gid.x, 1u) - 1u; let xr = min(gid.x + 1u, w - 1u);
  let yd = max(gid.y, 1u) - 1u; let yu = min(gid.y + 1u, h - 1u);
  let dx = velA[idx(xr, gid.y)].x - velA[idx(xl, gid.y)].x;
  let dy = velA[idx(gid.x, yu)].y - velA[idx(gid.x, yd)].y;
  divg[idx(gid.x, gid.y)] = 0.5 * (dx + dy);
}

// ---- Jacobi iteration for the pressure Poisson equation ----
@compute @workgroup_size(8, 8)
fn jacobi(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let w = W(); let h = H();
  let xl = max(gid.x, 1u) - 1u; let xr = min(gid.x + 1u, w - 1u);
  let yd = max(gid.y, 1u) - 1u; let yu = min(gid.y + 1u, h - 1u);
  let i = idx(gid.x, gid.y);
  let sum = pIn[idx(xl, gid.y)] + pIn[idx(xr, gid.y)]
          + pIn[idx(gid.x, yd)] + pIn[idx(gid.x, yu)];
  pOut[i] = (sum - divg[i]) * 0.25;
}

// ---- subtract pressure gradient → divergence-free velocity ----
@compute @workgroup_size(8, 8)
fn gradientSubtract(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let w = W(); let h = H();
  let xl = max(gid.x, 1u) - 1u; let xr = min(gid.x + 1u, w - 1u);
  let yd = max(gid.y, 1u) - 1u; let yu = min(gid.y + 1u, h - 1u);
  let i = idx(gid.x, gid.y);
  let gx = pIn[idx(xr, gid.y)] - pIn[idx(xl, gid.y)];
  let gy = pIn[idx(gid.x, yu)] - pIn[idx(gid.x, yd)];
  var v = velA[i] - vec2<f32>(gx, gy) * 0.5;
  // Clamp speed so the field can't run away to Inf over many frames
  // (vorticity confinement pumps energy in; without a ceiling it
  // eventually overflows float range and NaNs spread through advection).
  let sp = length(v);
  let maxSp = 12.0;
  if (sp > maxSp) { v = v * (maxSp / sp); }
  velB[i] = v;
}

// ---- advect dye with the projected velocity ----
@compute @workgroup_size(8, 8)
fn advectDye(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (!inb(gid)) { return; }
  let i = idx(gid.x, gid.y);
  let pos = vec2<f32>(f32(gid.x), f32(gid.y));
  let back = pos - velA[i] * sim.dt;
  dyeB[i] = sampleDye(back) * sim.dissipation;
}
`;

// Render module is SEPARATE — sharing one module with the compute
// passes would collide @group(0) @binding(1) (velA vs the dye texture),
// and "auto" layout would bind the wrong buffer.
const RENDER_WGSL = /* wgsl */ `
struct RSim { sizeX: f32, sizeY: f32, _a: f32, _b: f32 }
@group(0) @binding(0) var<uniform> rsim: RSim;
@group(0) @binding(1) var<storage, read> rdye: array<vec4<f32>>;
struct VSOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> }
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -3.0), vec2<f32>(-1.0, 1.0), vec2<f32>(3.0, 1.0));
  var out: VSOut;
  let xy = p[vi];
  out.pos = vec4<f32>(xy, 0.0, 1.0);
  out.uv = vec2<f32>((xy.x + 1.0) * 0.5, (1.0 - xy.y) * 0.5);
  return out;
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let w = u32(rsim.sizeX); let h = u32(rsim.sizeY);
  let gx = min(u32(in.uv.x * rsim.sizeX), w - 1u);
  let gy = min(u32(in.uv.y * rsim.sizeY), h - 1u);
  let c = rdye[gy * w + gx].rgb;
  let mapped = c / (c + vec3<f32>(0.6)); // tonemap toward white
  return vec4<f32>(mapped, 1.0);
}
`;

const SIM_W = 240;
const JACOBI_ITERS = 30;
const SIM_FLOATS = 16; // 64-byte uniform

export default function Fluid() {
    const containerRef = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [status, setStatus] = useState("init"); // init | running | unsupported | error
    const [errMsg, setErrMsg] = useState("");

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        let disposed = false;
        let raf = 0;
        let cleanupListeners = () => {};

        // Create the canvas imperatively (fresh per mount) so React
        // Strict Mode's double-invoke can't double-transfer the same
        // element. Same pattern as the particle hero.
        container.querySelectorAll("canvas").forEach((c) => c.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "w-full h-full block cursor-crosshair";
        canvas.setAttribute("role", "img");
        canvas.setAttribute(
            "aria-label",
            "Real-time fluid simulation solving the incompressible Navier-Stokes equations on the GPU. Drag to inject dye and stir the fluid.",
        );
        canvas.dataset.fluidStatus = "init";
        container.appendChild(canvas);
        const setCanvasStatus = (s) => {
            canvas.dataset.fluidStatus = s;
        };

        (async () => {
            const rect = container.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const aspect = rect.height / rect.width || 0.6;

            // Render through an OffscreenCanvas used on the MAIN thread
            // (no worker). transferControlToOffscreen wires it to the
            // placeholder <canvas> for compositing — the same path the
            // particle hero uses, which presents reliably where a plain
            // main-thread getContext("webgpu") canvas does not.
            let surface = canvas;
            if (typeof canvas.transferControlToOffscreen === "function") {
                surface = canvas.transferControlToOffscreen();
            }
            surface.width = Math.max(1, Math.floor(rect.width * dpr));
            surface.height = Math.max(1, Math.floor(rect.height * dpr));

            const gpu = await initWebGPU(surface);
            if (!gpu) {
                if (!disposed) {
                    setCanvasStatus("unsupported");
                    setStatus("unsupported");
                }
                return;
            }
            const { device, context, format } = gpu;
            device.addEventListener?.("uncapturederror", (e) => {
                console.error("[fluid] uncaptured GPU error:", e.error?.message);
            });
            const W = SIM_W;
            const H = Math.max(80, Math.round(SIM_W * aspect));
            const N = W * H;

            let computeModule;
            let renderModule;
            try {
                computeModule = await makeShaderModule(device, WGSL, "fluid-compute");
                renderModule = await makeShaderModule(
                    device,
                    RENDER_WGSL,
                    "fluid-render",
                );
            } catch (e) {
                if (!disposed) {
                    setErrMsg(String(e.message || e));
                    setCanvasStatus("error");
                    setStatus("error");
                }
                return;
            }
            if (disposed) return;

            const mkBuf = (bytes, extra = 0) =>
                device.createBuffer({
                    size: bytes,
                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_SRC |
                        GPUBufferUsage.COPY_DST |
                        extra,
                });
            const velA = mkBuf(N * 8);
            const velB = mkBuf(N * 8);
            const pA = mkBuf(N * 4);
            const pB = mkBuf(N * 4);
            const divg = mkBuf(N * 4);
            const curlb = mkBuf(N * 4);
            const dyeA = mkBuf(N * 16);
            const dyeB = mkBuf(N * 16);
            const simBuf = device.createBuffer({
                size: SIM_FLOATS * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            // Compute pipelines (one per entry point, shared explicit layout).
            const computeBGL = device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                    ...[1, 2, 3, 4, 5, 6, 7, 8].map((b) => ({
                        binding: b,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: "storage" },
                    })),
                ],
            });
            const computeLayout = device.createPipelineLayout({
                bindGroupLayouts: [computeBGL],
            });
            const mkPipe = (entryPoint) =>
                device.createComputePipeline({
                    layout: computeLayout,
                    compute: { module: computeModule, entryPoint },
                });
            const pipes = {
                splat: mkPipe("splat"),
                advectVel: mkPipe("advectVel"),
                curl: mkPipe("curl"),
                vorticity: mkPipe("vorticity"),
                divergence: mkPipe("divergence"),
                jacobi: mkPipe("jacobi"),
                gradientSubtract: mkPipe("gradientSubtract"),
                advectDye: mkPipe("advectDye"),
            };

            // bgMain: pIn=pA, pOut=pB. bgSwap: pIn=pB, pOut=pA. Everything
            // else identical — only pressure ping-pongs across Jacobi iters.
            const bgEntries = (pin, pout) => [
                { binding: 0, resource: { buffer: simBuf } },
                { binding: 1, resource: { buffer: velA } },
                { binding: 2, resource: { buffer: velB } },
                { binding: 3, resource: { buffer: pin } },
                { binding: 4, resource: { buffer: pout } },
                { binding: 5, resource: { buffer: divg } },
                { binding: 6, resource: { buffer: curlb } },
                { binding: 7, resource: { buffer: dyeA } },
                { binding: 8, resource: { buffer: dyeB } },
            ];
            const bgMain = device.createBindGroup({
                layout: computeBGL,
                entries: bgEntries(pA, pB),
            });
            const bgSwap = device.createBindGroup({
                layout: computeBGL,
                entries: bgEntries(pB, pA),
            });

            // Render pipeline.
            const renderPipe = device.createRenderPipeline({
                layout: "auto",
                vertex: { module: renderModule, entryPoint: "vs" },
                fragment: {
                    module: renderModule,
                    entryPoint: "fs",
                    targets: [{ format }],
                },
                primitive: { topology: "triangle-list" },
            });
            const renderBG = device.createBindGroup({
                layout: renderPipe.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: simBuf } },
                    { binding: 1, resource: { buffer: dyeA } },
                ],
            });

            const wgX = Math.ceil(W / 8);
            const wgY = Math.ceil(H / 8);
            const runPass = (encoder, pipe, bg) => {
                const p = encoder.beginComputePass();
                p.setPipeline(pipe);
                p.setBindGroup(0, bg);
                p.dispatchWorkgroups(wgX, wgY);
                p.end();
            };

            // ---- pointer state ----
            const sim = new Float32Array(SIM_FLOATS);
            const pointer = {
                active: false,
                x: 0, y: 0, px: 0, py: 0, hue: 0, drag: false,
            };
            let autoSeed = 90; // auto-stir for the first ~1.5s
            const toGrid = (cx, cy) => {
                const r = canvas.getBoundingClientRect();
                return {
                    x: ((cx - r.left) / r.width) * W,
                    y: ((cy - r.top) / r.height) * H,
                };
            };
            const onDown = (e) => {
                pointer.drag = true;
                const g = toGrid(e.clientX, e.clientY);
                pointer.x = pointer.px = g.x;
                pointer.y = pointer.py = g.y;
            };
            const onMove = (e) => {
                const g = toGrid(e.clientX, e.clientY);
                pointer.px = pointer.x;
                pointer.py = pointer.y;
                pointer.x = g.x;
                pointer.y = g.y;
            };
            const onUp = () => {
                pointer.drag = false;
            };
            canvas.addEventListener("pointerdown", onDown);
            canvas.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            cleanupListeners = () => {
                canvas.removeEventListener("pointerdown", onDown);
                canvas.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            };

            function hsv(h) {
                const f = (n) => {
                    const k = (n + h * 6) % 6;
                    return 1 - Math.max(0, Math.min(Math.min(k, 4 - k), 1));
                };
                return [f(5), f(3), f(1)];
            }

            function writeSim() {
                // Decide injection: either an active drag or the auto-seed.
                let active = 0;
                let dx = 0;
                let dy = 0;
                let px = pointer.x;
                let py = pointer.y;
                let col = [0, 0, 0];
                if (pointer.drag) {
                    dx = (pointer.x - pointer.px) * 6;
                    dy = (pointer.y - pointer.py) * 6;
                    if (Math.abs(dx) + Math.abs(dy) > 0.01) {
                        active = 1;
                        pointer.hue = (pointer.hue + 0.01) % 1;
                        col = hsv(pointer.hue);
                    }
                } else if (autoSeed > 0) {
                    const t = (90 - autoSeed) * 0.08;
                    px = W * (0.5 + 0.25 * Math.cos(t));
                    py = H * (0.5 + 0.25 * Math.sin(t * 1.3));
                    dx = -Math.sin(t) * 4;
                    dy = Math.cos(t * 1.3) * 4;
                    active = 1;
                    pointer.hue = (pointer.hue + 0.012) % 1;
                    col = hsv(pointer.hue);
                    autoSeed--;
                }
                sim[0] = W; sim[1] = H; sim[2] = 1.0; sim[3] = active;
                sim[4] = px; sim[5] = py; sim[6] = dx; sim[7] = dy;
                sim[8] = col[0] * 0.6; sim[9] = col[1] * 0.6; sim[10] = col[2] * 0.6;
                sim[11] = W * 0.03; // splat radius
                sim[12] = 0.995; // dissipation
                sim[13] = 2.0; // vorticity (kept low for stability)
                device.queue.writeBuffer(simBuf, 0, sim.buffer, 0, SIM_FLOATS * 4);
            }

            function frame() {
                if (disposed) return;
                writeSim();
                const enc = device.createCommandEncoder();
                runPass(enc, pipes.splat, bgMain);
                runPass(enc, pipes.advectVel, bgMain); // velA -> velB
                runPass(enc, pipes.curl, bgMain); // velB -> curl
                runPass(enc, pipes.vorticity, bgMain); // velB+curl -> velA
                runPass(enc, pipes.divergence, bgMain); // velA -> div
                // Jacobi: result lands in pA after an even count (bgSwap last).
                for (let k = 0; k < JACOBI_ITERS; k++) {
                    runPass(enc, pipes.jacobi, k % 2 === 0 ? bgMain : bgSwap);
                }
                runPass(enc, pipes.gradientSubtract, bgMain); // velA - ∇pA -> velB
                enc.copyBufferToBuffer(velB, 0, velA, 0, N * 8);
                runPass(enc, pipes.advectDye, bgMain); // dyeA via velA -> dyeB
                enc.copyBufferToBuffer(dyeB, 0, dyeA, 0, N * 16);

                const view = context.getCurrentTexture().createView();
                const rp = enc.beginRenderPass({
                    colorAttachments: [
                        {
                            view,
                            clearValue: { r: 0, g: 0, b: 0, a: 1 },
                            loadOp: "clear",
                            storeOp: "store",
                        },
                    ],
                });
                rp.setPipeline(renderPipe);
                rp.setBindGroup(0, renderBG);
                rp.draw(3);
                rp.end();
                device.queue.submit([enc.finish()]);

                if (!reduced) raf = requestAnimationFrame(frame);
            }

            setCanvasStatus("running");
            setStatus("running");
            if (reduced) {
                // A few seeded frames then stop.
                for (let i = 0; i < 40; i++) frame();
            } else {
                raf = requestAnimationFrame(frame);
            }
        })();

        return () => {
            disposed = true;
            if (raf) cancelAnimationFrame(raf);
            cleanupListeners();
            canvas.remove();
        };
    }, [reduced]);

    return (
        <div className="relative w-full h-full">
            {/* The simulation canvas is appended here imperatively (see
                the effect). This container has no React-managed
                children so the reconciler won't clobber it. */}
            <div ref={containerRef} className="absolute inset-0" />
            {(status === "unsupported" || status === "error") && (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-[#03000f]/80">
                    <div className="max-w-md">
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {status === "error"
                                ? `Fluid shader failed to compile: ${errMsg}`
                                : WEBGPU_FALLBACK_TEXT}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
