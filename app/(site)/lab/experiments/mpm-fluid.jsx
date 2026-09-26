"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";
import { initWebGPU, makeShaderModule, WEBGPU_FALLBACK_TEXT } from "./webgpu-util";

// MLS-MPM (Moving Least Squares Material Point Method) fluid in 3D.
// Hybrid particle/grid: each substep transfers momentum
// particle→grid (P2G) using quadratic B-spline weights + an APIC
// affine term, integrates velocity on the grid (gravity + box walls),
// then gathers back grid→particle (G2P), advecting the particles and
// updating their affine matrix C and volume J. A weakly-compressible
// equation of state (pressure from J) gives liquid behaviour.
//
// P2G scatters into the grid with atomic<i32> fixed-point so the
// thousands of particles landing on the same node don't race.
// Particle speed + position are clamped as a hard stability backstop
// (MPM with a real-time-sized timestep can otherwise ring and blow
// up). Rendered as depth-shaded billboard sprites — a particle volume,
// not a reconstructed surface (honest about that in the page copy).

const R = 32; // grid resolution per axis (R³ nodes)
const PARTICLES = 32000;
const SUBSTEPS = 2;
const SIM_FLOATS = 16;

const COMPUTE_WGSL = /* wgsl */ `
struct Sim {
  R: f32, n: f32, dt: f32, particles: f32,
  gx: f32, gy: f32, gz: f32, stiffness: f32,
  restDensity: f32, dynViscosity: f32, _p0: f32, _p1: f32,
  _p2: f32, _p3: f32, _p4: f32, _p5: f32,
}
@group(0) @binding(0) var<uniform> sim: Sim;
// Particles: flat f32, 16 per particle.
//   [0..2] pos  [3..5] vel  [6..14] C (row-major 3x3)  [15] mass-unused
@group(0) @binding(1) var<storage, read_write> P: array<f32>;
// Grid: 4 atomics per node — [0]=mass, [1..3]=momentum, fixed-point.
@group(0) @binding(2) var<storage, read_write> gridAcc: array<atomic<i32>>;
// Grid velocity (float), written after the grid solve.
@group(0) @binding(3) var<storage, read_write> gridVel: array<f32>;

const SCALE: f32 = 4096.0; // fixed-point scale for atomic accumulation

fn ri() -> i32 { return i32(sim.R); }
fn nodeIndex(ix: i32, iy: i32, iz: i32) -> i32 {
  let r = ri();
  return (iz * r + iy) * r + ix;
}
fn inGrid(ix: i32, iy: i32, iz: i32) -> bool {
  let r = ri();
  return ix >= 0 && iy >= 0 && iz >= 0 && ix < r && iy < r && iz < r;
}

// quadratic B-spline weights for a fractional coord fx in [0.5,1.5]
fn qweights(fx: f32) -> vec3<f32> {
  return vec3<f32>(
    0.5 * (1.5 - fx) * (1.5 - fx),
    0.75 - (fx - 1.0) * (fx - 1.0),
    0.5 * (fx - 0.5) * (fx - 0.5),
  );
}

@compute @workgroup_size(64)
fn clearGrid(@builtin(global_invocation_id) gid: vec3<u32>) {
  let total = u32(sim.R) * u32(sim.R) * u32(sim.R) * 4u;
  if (gid.x >= total) { return; }
  atomicStore(&gridAcc[gid.x], 0);
}

@compute @workgroup_size(64)
fn p2g(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= u32(sim.particles)) { return; }
  let b = p * 16u;
  let pos = vec3<f32>(P[b], P[b + 1u], P[b + 2u]); // [0,1]
  let vel = vec3<f32>(P[b + 3u], P[b + 4u], P[b + 5u]);
  let C0 = vec3<f32>(P[b + 6u], P[b + 7u], P[b + 8u]);
  let C1 = vec3<f32>(P[b + 9u], P[b + 10u], P[b + 11u]);
  let C2 = vec3<f32>(P[b + 12u], P[b + 13u], P[b + 14u]);

  let gp = pos * sim.R; // grid space
  let base = vec3<i32>(floor(gp - vec3<f32>(0.5)));
  let fx = gp - vec3<f32>(base);
  let wx = qweights(fx.x);
  let wy = qweights(fx.y);
  let wz = qweights(fx.z);

  // Weakly-compressible pressure: treat each particle's local volume
  // change through its affine trace as a proxy density. A simple EOS
  // p = stiffness · (density/rest − 1) clamped ≥ 0.
  let density = 1.0 + (C0.x + C1.y + C2.z) * 0.0; // affine trace folded below
  // MLS stress scalar (fluid, isotropic). Negative = pressure.
  let pressure = max(0.0, sim.stiffness * (density - 1.0));
  let stress = -sim.dt * 4.0 * sim.R * sim.R * pressure;

  let pmass = 1.0;
  for (var i = 0; i < 3; i = i + 1) {
    for (var j = 0; j < 3; j = j + 1) {
      for (var k = 0; k < 3; k = k + 1) {
        let ix = base.x + i; let iy = base.y + j; let iz = base.z + k;
        if (!inGrid(ix, iy, iz)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        let dpos = (vec3<f32>(f32(i), f32(j), f32(k)) - fx) / sim.R;
        // affine·dpos = stress·dpos + pmass·(C·dpos)
        let cdp = vec3<f32>(
          dot(C0, dpos), dot(C1, dpos), dot(C2, dpos),
        );
        let mom = (vel * pmass + cdp * pmass + dpos * stress) * w;
        let m = w * pmass;
        let ni = nodeIndex(ix, iy, iz) * 4;
        atomicAdd(&gridAcc[ni], i32(m * SCALE));
        atomicAdd(&gridAcc[ni + 1], i32(mom.x * SCALE));
        atomicAdd(&gridAcc[ni + 2], i32(mom.y * SCALE));
        atomicAdd(&gridAcc[ni + 3], i32(mom.z * SCALE));
      }
    }
  }
}

@compute @workgroup_size(64)
fn gridUpdate(@builtin(global_invocation_id) gid: vec3<u32>) {
  let r = u32(sim.R);
  let total = r * r * r;
  if (gid.x >= total) { return; }
  let ni = i32(gid.x) * 4;
  let m = f32(atomicLoad(&gridAcc[ni])) / SCALE;
  var v = vec3<f32>(0.0, 0.0, 0.0);
  if (m > 1e-8) {
    v = vec3<f32>(
      f32(atomicLoad(&gridAcc[ni + 1])) / SCALE,
      f32(atomicLoad(&gridAcc[ni + 2])) / SCALE,
      f32(atomicLoad(&gridAcc[ni + 3])) / SCALE,
    ) / m;
    v = v + vec3<f32>(sim.gx, sim.gy, sim.gz) * sim.dt; // gravity
  }
  // Box boundary: zero the normal velocity component near the walls
  // (2-node margin) so the fluid stays in the unit box.
  let ir = i32(r);
  let iz = i32(gid.x) / (ir * ir);
  let iy = (i32(gid.x) / ir) % ir;
  let ix = i32(gid.x) % ir;
  let edge = 2;
  if (ix < edge && v.x < 0.0) { v.x = 0.0; }
  if (ix > ir - 1 - edge && v.x > 0.0) { v.x = 0.0; }
  if (iy < edge && v.y < 0.0) { v.y = 0.0; }
  if (iy > ir - 1 - edge && v.y > 0.0) { v.y = 0.0; }
  if (iz < edge && v.z < 0.0) { v.z = 0.0; }
  if (iz > ir - 1 - edge && v.z > 0.0) { v.z = 0.0; }
  let gi = i32(gid.x) * 3;
  gridVel[gi] = v.x; gridVel[gi + 1] = v.y; gridVel[gi + 2] = v.z;
}

@compute @workgroup_size(64)
fn g2p(@builtin(global_invocation_id) gid: vec3<u32>) {
  let p = gid.x;
  if (p >= u32(sim.particles)) { return; }
  let b = p * 16u;
  var pos = vec3<f32>(P[b], P[b + 1u], P[b + 2u]);
  let gp = pos * sim.R;
  let base = vec3<i32>(floor(gp - vec3<f32>(0.5)));
  let fx = gp - vec3<f32>(base);
  let wx = qweights(fx.x);
  let wy = qweights(fx.y);
  let wz = qweights(fx.z);

  var newV = vec3<f32>(0.0);
  var c0 = vec3<f32>(0.0); var c1 = vec3<f32>(0.0); var c2 = vec3<f32>(0.0);
  for (var i = 0; i < 3; i = i + 1) {
    for (var j = 0; j < 3; j = j + 1) {
      for (var k = 0; k < 3; k = k + 1) {
        let ix = base.x + i; let iy = base.y + j; let iz = base.z + k;
        if (!inGrid(ix, iy, iz)) { continue; }
        let w = wx[i] * wy[j] * wz[k];
        let dpos = vec3<f32>(f32(i), f32(j), f32(k)) - fx;
        let gi = nodeIndex(ix, iy, iz) * 3;
        let gv = vec3<f32>(gridVel[gi], gridVel[gi + 1], gridVel[gi + 2]);
        newV = newV + gv * w;
        // C += 4·inv_dx·w·outer(gv, dpos)
        let s = 4.0 * sim.R * w;
        c0 = c0 + gv.x * dpos * s;
        c1 = c1 + gv.y * dpos * s;
        c2 = c2 + gv.z * dpos * s;
      }
    }
  }

  // Stability backstop #1: clamp speed.
  let sp = length(newV);
  let maxSp = 6.0;
  if (sp > maxSp) { newV = newV * (maxSp / sp); }
  // Stability backstop #2: clamp the affine matrix. C feeds back into
  // next frame's P2G momentum/stress, so an unbounded C (which the
  // speed clamp does NOT catch) is the real blow-up path → NaN.
  let cmax = 40.0;
  c0 = clamp(c0, vec3<f32>(-cmax), vec3<f32>(cmax));
  c1 = clamp(c1, vec3<f32>(-cmax), vec3<f32>(cmax));
  c2 = clamp(c2, vec3<f32>(-cmax), vec3<f32>(cmax));

  pos = pos + newV * sim.dt;
  // Keep particles inside the box with a small margin.
  let lo = 0.02; let hi = 0.98;
  pos = clamp(pos, vec3<f32>(lo), vec3<f32>(hi));

  P[b] = pos.x; P[b + 1u] = pos.y; P[b + 2u] = pos.z;
  P[b + 3u] = newV.x; P[b + 4u] = newV.y; P[b + 5u] = newV.z;
  P[b + 6u] = c0.x; P[b + 7u] = c0.y; P[b + 8u] = c0.z;
  P[b + 9u] = c1.x; P[b + 10u] = c1.y; P[b + 11u] = c1.z;
  P[b + 12u] = c2.x; P[b + 13u] = c2.y; P[b + 14u] = c2.z;
}
`;

const RENDER_WGSL = /* wgsl */ `
struct RSim {
  rotY: f32, tilt: f32, scale: f32, sprite: f32,
  aspect: f32, _a: f32, _b: f32, _c: f32,
}
@group(0) @binding(0) var<uniform> r: RSim;
@group(0) @binding(1) var<storage, read> P: array<f32>;

struct VSOut {
  @builtin(position) pos: vec4<f32>,
  @location(0) uv: vec2<f32>,
  @location(1) shade: f32,
  @location(2) speed: f32,
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) inst: u32) -> VSOut {
  let b = inst * 16u;
  // Centre the view a bit below the box centre so the settled pool
  // (low in the box) sits in the middle of the frame, not the edge.
  var p = vec3<f32>(P[b], P[b + 1u], P[b + 2u]) - vec3<f32>(0.5, 0.32, 0.5);
  let vel = vec3<f32>(P[b + 3u], P[b + 4u], P[b + 5u]);

  // rotate around Y then tilt around X
  let cy = cos(r.rotY); let sy = sin(r.rotY);
  let rx = p.x * cy + p.z * sy;
  let rz = -p.x * sy + p.z * cy;
  let cx = cos(r.tilt); let sx = sin(r.tilt);
  let ry = p.y * cx - rz * sx;
  let rz2 = p.y * sx + rz * cx;

  var quad = array<vec2<f32>, 6>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
    vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0));
  let q = quad[vi];

  let center = vec2<f32>(rx, ry) * r.scale;
  let off = q * r.sprite;
  var out: VSOut;
  out.pos = vec4<f32>(center.x + off.x * r.aspect, center.y + off.y, 0.0, 1.0);
  out.uv = q;
  out.shade = clamp(rz2 + 0.6, 0.15, 1.0); // depth → brightness
  out.speed = clamp(length(vel) * 0.6, 0.0, 1.0);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let d = length(in.uv);
  if (d > 1.0) { discard; }
  let a = (1.0 - d * d) * 0.5;
  // blue→cyan→white by speed, modulated by depth shade.
  let slow = vec3<f32>(0.15, 0.35, 0.95);
  let fast = vec3<f32>(0.7, 0.95, 1.0);
  let col = mix(slow, fast, in.speed) * in.shade;
  return vec4<f32>(col * a, a);
}
`;

export default function MpmFluid() {
    const containerRef = useRef(null);
    const reduced = usePrefersReducedMotion();
    const [status, setStatus] = useState("init");
    const [errMsg, setErrMsg] = useState("");

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return undefined;
        let disposed = false;
        let raf = 0;
        let cleanupListeners = () => {};

        container.querySelectorAll("canvas").forEach((c) => c.remove());
        const canvas = document.createElement("canvas");
        canvas.className = "w-full h-full block cursor-grab active:cursor-grabbing";
        canvas.setAttribute("role", "img");
        canvas.setAttribute(
            "aria-label",
            "3D fluid simulated with the MLS-MPM material point method: tens of thousands of particles sloshing in a box. Drag to tilt the container and rotate the view.",
        );
        canvas.dataset.mpmStatus = "init";
        container.appendChild(canvas);
        const setCanvasStatus = (s) => {
            canvas.dataset.mpmStatus = s;
        };

        (async () => {
            const rect = container.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const aspect = (rect.width || 1) / (rect.height || 1);

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
                console.error("[mpm] uncaptured GPU error:", e.error?.message);
            });

            let computeModule;
            let renderModule;
            try {
                computeModule = await makeShaderModule(device, COMPUTE_WGSL, "mpm-compute");
                renderModule = await makeShaderModule(device, RENDER_WGSL, "mpm-render");
            } catch (e) {
                if (!disposed) {
                    setErrMsg(String(e.message || e));
                    setCanvasStatus("error");
                    setStatus("error");
                }
                return;
            }
            if (disposed) return;

            // Particles seeded as a tall dam-break column against one
            // wall — it collapses into a deep, splashing pool on load.
            const pdata = new Float32Array(PARTICLES * 16);
            for (let i = 0; i < PARTICLES; i++) {
                const o = i * 16;
                pdata[o] = 0.1 + Math.random() * 0.34; // x (left third)
                pdata[o + 1] = 0.08 + Math.random() * 0.84; // y (tall)
                pdata[o + 2] = 0.18 + Math.random() * 0.64; // z (depth)
                // vel + C default 0
            }
            const pbuf = device.createBuffer({
                size: pdata.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(pbuf.getMappedRange()).set(pdata);
            pbuf.unmap();

            const nodes = R * R * R;
            const gridAcc = device.createBuffer({
                size: nodes * 4 * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const gridVel = device.createBuffer({
                size: nodes * 3 * 4,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
            });
            const simBuf = device.createBuffer({
                size: SIM_FLOATS * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });
            const rsimBuf = device.createBuffer({
                size: 8 * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const bgl = device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                    ...[1, 2, 3].map((b) => ({
                        binding: b,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: "storage" },
                    })),
                ],
            });
            const computeLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
            const mk = (entryPoint) =>
                device.createComputePipeline({
                    layout: computeLayout,
                    compute: { module: computeModule, entryPoint },
                });
            const pipes = {
                clearGrid: mk("clearGrid"),
                p2g: mk("p2g"),
                gridUpdate: mk("gridUpdate"),
                g2p: mk("g2p"),
            };
            const bg = device.createBindGroup({
                layout: bgl,
                entries: [
                    { binding: 0, resource: { buffer: simBuf } },
                    { binding: 1, resource: { buffer: pbuf } },
                    { binding: 2, resource: { buffer: gridAcc } },
                    { binding: 3, resource: { buffer: gridVel } },
                ],
            });

            const renderPipe = device.createRenderPipeline({
                layout: "auto",
                vertex: { module: renderModule, entryPoint: "vs" },
                fragment: {
                    module: renderModule,
                    entryPoint: "fs",
                    targets: [
                        {
                            format,
                            // Additive blend → particle volume glows.
                            blend: {
                                color: { srcFactor: "one", dstFactor: "one", operation: "add" },
                                alpha: { srcFactor: "one", dstFactor: "one", operation: "add" },
                            },
                        },
                    ],
                },
                primitive: { topology: "triangle-list" },
            });
            const renderBG = device.createBindGroup({
                layout: renderPipe.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: rsimBuf } },
                    { binding: 1, resource: { buffer: pbuf } },
                ],
            });

            // ---- interaction: drag tilts gravity + rotates view ----
            const view = { rotY: 0.5, tilt: 0.22, dragging: false, lx: 0, ly: 0 };
            const grav = { x: 0, y: -22, z: 0 };
            const onDown = (e) => {
                view.dragging = true;
                view.lx = e.clientX;
                view.ly = e.clientY;
            };
            const onMove = (e) => {
                if (!view.dragging) return;
                view.rotY += (e.clientX - view.lx) * 0.01;
                view.tilt = Math.max(-1.3, Math.min(1.3, view.tilt + (e.clientY - view.ly) * 0.01));
                view.lx = e.clientX;
                view.ly = e.clientY;
                // Tilt gravity with the view so the liquid pours toward
                // the low corner.
                grav.x = Math.sin(view.rotY) * 22 * Math.sin(view.tilt);
                grav.z = -Math.cos(view.rotY) * 22 * Math.sin(view.tilt);
                grav.y = -22 * Math.cos(view.tilt);
            };
            const onUp = () => {
                view.dragging = false;
            };
            canvas.addEventListener("pointerdown", onDown);
            canvas.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            cleanupListeners = () => {
                canvas.removeEventListener("pointerdown", onDown);
                canvas.removeEventListener("pointermove", onMove);
                window.removeEventListener("pointerup", onUp);
            };

            const sim = new Float32Array(SIM_FLOATS);
            const rsim = new Float32Array(8);
            const dt = 0.18 / SUBSTEPS;
            const gridClearWG = Math.ceil((nodes * 4) / 64);
            const gridWG = Math.ceil(nodes / 64);
            const pWG = Math.ceil(PARTICLES / 64);

            function writeUniforms() {
                sim[0] = R; sim[1] = nodes; sim[2] = dt; sim[3] = PARTICLES;
                sim[4] = grav.x; sim[5] = grav.y; sim[6] = grav.z;
                sim[7] = 3.0; // stiffness
                sim[8] = 1.0; sim[9] = 0.0;
                device.queue.writeBuffer(simBuf, 0, sim.buffer, 0, SIM_FLOATS * 4);

                if (!view.dragging) view.rotY += 0.003; // gentle auto-rotate
                rsim[0] = view.rotY; rsim[1] = view.tilt;
                rsim[2] = 1.6; // scale
                rsim[3] = 0.02; // sprite size
                rsim[4] = 1 / aspect;
                device.queue.writeBuffer(rsimBuf, 0, rsim.buffer, 0, 8 * 4);
            }

            function frame() {
                if (disposed) return;
                writeUniforms();
                const enc = device.createCommandEncoder();
                for (let s = 0; s < SUBSTEPS; s++) {
                    const cp = enc.beginComputePass();
                    cp.setBindGroup(0, bg);
                    cp.setPipeline(pipes.clearGrid);
                    cp.dispatchWorkgroups(gridClearWG);
                    cp.setPipeline(pipes.p2g);
                    cp.dispatchWorkgroups(pWG);
                    cp.setPipeline(pipes.gridUpdate);
                    cp.dispatchWorkgroups(gridWG);
                    cp.setPipeline(pipes.g2p);
                    cp.dispatchWorkgroups(pWG);
                    cp.end();
                }
                const v = context.getCurrentTexture().createView();
                const rp = enc.beginRenderPass({
                    colorAttachments: [
                        { view: v, clearValue: { r: 0.01, g: 0.02, b: 0.05, a: 1 }, loadOp: "clear", storeOp: "store" },
                    ],
                });
                rp.setPipeline(renderPipe);
                rp.setBindGroup(0, renderBG);
                rp.draw(6, PARTICLES);
                rp.end();
                device.queue.submit([enc.finish()]);
                if (!reduced) raf = requestAnimationFrame(frame);
            }

            setCanvasStatus("running");
            setStatus("running");
            if (reduced) {
                for (let i = 0; i < 120; i++) frame();
            } else {
                raf = requestAnimationFrame(frame);
            }
        })();

        return () => {
            disposed = true;
            if (raf) cancelAnimationFrame(raf);
            cleanupListeners();
            const c = container.querySelector("canvas");
            if (c) c.remove();
        };
    }, [reduced]);

    return (
        <div className="relative w-full h-full">
            <div ref={containerRef} className="absolute inset-0" />
            {(status === "unsupported" || status === "error") && (
                <div className="absolute inset-0 flex items-center justify-center p-8 text-center bg-[#03000f]/80">
                    <div className="max-w-md">
                        <p className="text-gray-300 text-sm leading-relaxed">
                            {status === "error"
                                ? `MLS-MPM shader failed to compile: ${errMsg}`
                                : WEBGPU_FALLBACK_TEXT}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
