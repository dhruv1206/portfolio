"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";
import { initWebGPU, makeShaderModule, WEBGPU_FALLBACK_TEXT } from "./webgpu-util";

// Physarum (slime-mold) transport-network sim, after Jeff Jones (2010)
// / Sebastian Lague. ~200k agents, each with a position + heading,
// run two GPU compute passes per frame:
//
//   1. agents: sample the trail map through three forward sensors
//      (left / centre / right), steer toward the strongest, step
//      forward, wrap toroidally, and deposit onto the trail.
//   2. diffuse: 3×3 blur + exponential decay of the trail map.
//
// No rule says "make a network" — the networks are emergent. Deposits
// use atomic<u32> fixed-point so concurrent agents writing the same
// cell don't race; the trail map ping-pongs A→B→A so sensing always
// reads a stable field.

const COMPUTE_WGSL = /* wgsl */ `
struct Sim {
  gridW: f32, gridH: f32, agentCount: f32, time: f32,
  sensorAngle: f32, sensorDist: f32, turnSpeed: f32, moveSpeed: f32,
  decay: f32, depositScale: f32, pointerActive: f32, pointerX: f32,
  pointerY: f32, pointerR: f32, _p0: f32, _p1: f32,
}
struct Agent { pos: vec2<f32>, angle: f32, _pad: f32 }

@group(0) @binding(0) var<uniform> sim: Sim;
@group(0) @binding(1) var<storage, read_write> agents: array<Agent>;
@group(0) @binding(2) var<storage, read_write> trailA: array<f32>;
@group(0) @binding(3) var<storage, read_write> trailB: array<f32>;
@group(0) @binding(4) var<storage, read_write> deposit: array<atomic<u32>>;

const DEPOSIT_U: u32 = 120u;

fn gw() -> i32 { return i32(sim.gridW); }
fn gh() -> i32 { return i32(sim.gridH); }

fn wrapI(v: i32, m: i32) -> i32 { return ((v % m) + m) % m; }

fn sampleTrail(x: f32, y: f32) -> f32 {
  let w = gw(); let h = gh();
  let ix = wrapI(i32(floor(x)), w);
  let iy = wrapI(i32(floor(y)), h);
  return trailA[u32(iy) * u32(w) + u32(ix)];
}

fn hash(n: u32) -> f32 {
  var x = n;
  x = (x ^ 61u) ^ (x >> 16u);
  x = x * 9u;
  x = x ^ (x >> 4u);
  x = x * 0x27d4eb2du;
  x = x ^ (x >> 15u);
  return f32(x & 0xffffffu) / f32(0xffffffu);
}

// ---- agents: sense → steer → move → deposit ----
@compute @workgroup_size(64)
fn agentsPass(@builtin(global_invocation_id) gid: vec3<u32>) {
  let id = gid.x;
  if (id >= u32(sim.agentCount)) { return; }
  var a = agents[id];
  let ang = a.angle;
  let sd = sim.sensorDist;
  let sa = sim.sensorAngle;
  let cF = sampleTrail(a.pos.x + cos(ang) * sd, a.pos.y + sin(ang) * sd);
  let cL = sampleTrail(a.pos.x + cos(ang - sa) * sd, a.pos.y + sin(ang - sa) * sd);
  let cR = sampleTrail(a.pos.x + cos(ang + sa) * sd, a.pos.y + sin(ang + sa) * sd);

  let rnd = hash(id + u32(sim.time) * 2654435761u);
  var newAng = ang;
  if (cF >= cL && cF >= cR) {
    // continue straight
  } else if (cF < cL && cF < cR) {
    newAng += (rnd - 0.5) * 2.0 * sim.turnSpeed; // random turn
  } else if (cR > cL) {
    newAng -= sim.turnSpeed;
  } else {
    newAng += sim.turnSpeed;
  }

  var np = a.pos + vec2<f32>(cos(newAng), sin(newAng)) * sim.moveSpeed;
  let fw = sim.gridW; let fh = sim.gridH;
  np.x = np.x - floor(np.x / fw) * fw;
  np.y = np.y - floor(np.y / fh) * fh;

  a.pos = np;
  a.angle = newAng;
  agents[id] = a;

  let ci = wrapI(i32(floor(np.y)), gh()) * gw() + wrapI(i32(floor(np.x)), gw());
  atomicAdd(&deposit[u32(ci)], DEPOSIT_U);
}

// ---- diffuse + decay; fold in deposits and a pointer brush ----
@compute @workgroup_size(8, 8)
fn diffusePass(@builtin(global_invocation_id) gid: vec3<u32>) {
  let w = gw(); let h = gh();
  if (i32(gid.x) >= w || i32(gid.y) >= h) { return; }
  let i = u32(gid.y) * u32(w) + u32(gid.x);
  // 3×3 box blur of the old trail (toroidal).
  var sum = 0.0;
  for (var dy = -1; dy <= 1; dy = dy + 1) {
    for (var dx = -1; dx <= 1; dx = dx + 1) {
      let sx = wrapI(i32(gid.x) + dx, w);
      let sy = wrapI(i32(gid.y) + dy, h);
      sum = sum + trailA[u32(sy) * u32(w) + u32(sx)];
    }
  }
  let blurred = sum / 9.0;
  let dep = f32(atomicLoad(&deposit[i])) / 255.0 * sim.depositScale;
  atomicStore(&deposit[i], 0u);

  var v = (blurred + dep) * sim.decay;

  // Pointer brush: paint extra trail so agents swarm the cursor.
  if (sim.pointerActive > 0.5) {
    let d = vec2<f32>(f32(gid.x) - sim.pointerX, f32(gid.y) - sim.pointerY);
    let r = sim.pointerR;
    v = v + exp(-dot(d, d) / (r * r)) * 0.6;
  }

  trailB[i] = clamp(v, 0.0, 4.0);
}
`;

const RENDER_WGSL = /* wgsl */ `
struct RSim { gridW: f32, gridH: f32, _a: f32, _b: f32 }
@group(0) @binding(0) var<uniform> rsim: RSim;
@group(0) @binding(1) var<storage, read> rtrail: array<f32>;
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
fn sampleT(uvx: f32, uvy: f32, w: u32, h: u32) -> f32 {
  let fx = clamp(uvx * rsim.gridW - 0.5, 0.0, rsim.gridW - 1.001);
  let fy = clamp(uvy * rsim.gridH - 0.5, 0.0, rsim.gridH - 1.001);
  let x0 = u32(floor(fx)); let y0 = u32(floor(fy));
  let x1 = min(x0 + 1u, w - 1u); let y1 = min(y0 + 1u, h - 1u);
  let tx = fx - f32(x0); let ty = fy - f32(y0);
  let a = mix(rtrail[y0 * w + x0], rtrail[y0 * w + x1], tx);
  let b = mix(rtrail[y1 * w + x0], rtrail[y1 * w + x1], tx);
  return mix(a, b, ty);
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  let w = u32(rsim.gridW); let h = u32(rsim.gridH);
  let t = clamp(sampleT(in.uv.x, in.uv.y, w, h), 0.0, 1.5);
  // dark → teal → lime → white slime ramp.
  let teal = vec3<f32>(0.02, 0.4, 0.4);
  let lime = vec3<f32>(0.64, 0.9, 0.21);
  var c = mix(vec3<f32>(0.01, 0.02, 0.03), teal, smoothstep(0.0, 0.5, t));
  c = mix(c, lime, smoothstep(0.5, 1.1, t));
  c = mix(c, vec3<f32>(1.0, 1.0, 0.95), smoothstep(1.1, 1.5, t));
  return vec4<f32>(c, 1.0);
}
`;

const GRID_W = 700;
const AGENTS = 200000;
const SIM_FLOATS = 16;

export default function Physarum() {
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
        canvas.className = "w-full h-full block cursor-crosshair";
        canvas.setAttribute("role", "img");
        canvas.setAttribute(
            "aria-label",
            "Physarum slime-mold simulation: ~200,000 GPU agents that sense and deposit a trail, forming emergent transport networks. Drag to attract them.",
        );
        canvas.dataset.physarumStatus = "init";
        container.appendChild(canvas);
        const setCanvasStatus = (s) => {
            canvas.dataset.physarumStatus = s;
        };

        (async () => {
            const rect = container.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const aspect = rect.height / rect.width || 0.6;

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
                console.error("[physarum] uncaptured GPU error:", e.error?.message);
            });

            const W = GRID_W;
            const H = Math.max(120, Math.round(GRID_W * aspect));
            const N = W * H;

            let computeModule;
            let renderModule;
            try {
                computeModule = await makeShaderModule(device, COMPUTE_WGSL, "physarum-compute");
                renderModule = await makeShaderModule(device, RENDER_WGSL, "physarum-render");
            } catch (e) {
                if (!disposed) {
                    setErrMsg(String(e.message || e));
                    setCanvasStatus("error");
                    setStatus("error");
                }
                return;
            }
            if (disposed) return;

            // Agents buffer, randomly seeded in a central disk.
            const agentData = new Float32Array(AGENTS * 4);
            for (let k = 0; k < AGENTS; k++) {
                const r = Math.sqrt(Math.random()) * Math.min(W, H) * 0.3;
                const a = Math.random() * Math.PI * 2;
                agentData[k * 4] = W / 2 + Math.cos(a) * r;
                agentData[k * 4 + 1] = H / 2 + Math.sin(a) * r;
                agentData[k * 4 + 2] = Math.random() * Math.PI * 2;
                agentData[k * 4 + 3] = 0;
            }
            const agentBuf = device.createBuffer({
                size: agentData.byteLength,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Float32Array(agentBuf.getMappedRange()).set(agentData);
            agentBuf.unmap();

            const mkBuf = (bytes) =>
                device.createBuffer({
                    size: bytes,
                    usage:
                        GPUBufferUsage.STORAGE |
                        GPUBufferUsage.COPY_SRC |
                        GPUBufferUsage.COPY_DST,
                });
            const trailA = mkBuf(N * 4);
            const trailB = mkBuf(N * 4);
            const deposit = mkBuf(N * 4); // atomic<u32>
            const simBuf = device.createBuffer({
                size: SIM_FLOATS * 4,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            });

            const bgl = device.createBindGroupLayout({
                entries: [
                    { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
                    ...[1, 2, 3, 4].map((b) => ({
                        binding: b,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: "storage" },
                    })),
                ],
            });
            const computeLayout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
            const agentsPipe = device.createComputePipeline({
                layout: computeLayout,
                compute: { module: computeModule, entryPoint: "agentsPass" },
            });
            const diffusePipe = device.createComputePipeline({
                layout: computeLayout,
                compute: { module: computeModule, entryPoint: "diffusePass" },
            });
            const bg = device.createBindGroup({
                layout: bgl,
                entries: [
                    { binding: 0, resource: { buffer: simBuf } },
                    { binding: 1, resource: { buffer: agentBuf } },
                    { binding: 2, resource: { buffer: trailA } },
                    { binding: 3, resource: { buffer: trailB } },
                    { binding: 4, resource: { buffer: deposit } },
                ],
            });

            const renderPipe = device.createRenderPipeline({
                layout: "auto",
                vertex: { module: renderModule, entryPoint: "vs" },
                fragment: { module: renderModule, entryPoint: "fs", targets: [{ format }] },
                primitive: { topology: "triangle-list" },
            });
            const renderBG = device.createBindGroup({
                layout: renderPipe.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: simBuf } },
                    { binding: 1, resource: { buffer: trailA } },
                ],
            });

            const agentWG = Math.ceil(AGENTS / 64);
            const gx = Math.ceil(W / 8);
            const gy = Math.ceil(H / 8);

            const pointer = { active: false, x: 0, y: 0 };
            const toGrid = (cx, cy) => {
                const r = canvas.getBoundingClientRect();
                return {
                    x: ((cx - r.left) / r.width) * W,
                    y: ((cy - r.top) / r.height) * H,
                };
            };
            const onDown = (e) => {
                pointer.active = true;
                const g = toGrid(e.clientX, e.clientY);
                pointer.x = g.x;
                pointer.y = g.y;
            };
            const onMove = (e) => {
                if (!pointer.active) return;
                const g = toGrid(e.clientX, e.clientY);
                pointer.x = g.x;
                pointer.y = g.y;
            };
            const onUp = () => {
                pointer.active = false;
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
            let t = 0;
            function writeSim() {
                t++;
                sim[0] = W; sim[1] = H; sim[2] = AGENTS; sim[3] = t % 4096;
                sim[4] = 0.5; // sensor angle (rad)
                sim[5] = 9.0; // sensor distance (px)
                sim[6] = 0.32; // turn speed (rad)
                sim[7] = 1.1; // move speed (px/frame)
                sim[8] = 0.94; // decay
                sim[9] = 1.0; // deposit scale
                sim[10] = pointer.active ? 1 : 0;
                sim[11] = pointer.x; sim[12] = pointer.y;
                sim[13] = W * 0.03; // pointer brush radius
                device.queue.writeBuffer(simBuf, 0, sim.buffer, 0, SIM_FLOATS * 4);
            }

            function frame() {
                if (disposed) return;
                writeSim();
                const enc = device.createCommandEncoder();
                let p = enc.beginComputePass();
                p.setPipeline(agentsPipe);
                p.setBindGroup(0, bg);
                p.dispatchWorkgroups(agentWG);
                p.end();
                p = enc.beginComputePass();
                p.setPipeline(diffusePipe);
                p.setBindGroup(0, bg);
                p.dispatchWorkgroups(gx, gy);
                p.end();
                enc.copyBufferToBuffer(trailB, 0, trailA, 0, N * 4);

                const view = context.getCurrentTexture().createView();
                const rp = enc.beginRenderPass({
                    colorAttachments: [
                        { view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: "clear", storeOp: "store" },
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
                                ? `Physarum shader failed to compile: ${errMsg}`
                                : WEBGPU_FALLBACK_TEXT}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
