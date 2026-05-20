"use client";

import { useMounted } from "@/app/hooks/use-mounted";
import { usePrefersReducedMotion } from "@/app/hooks/use-performance";
import { useWebGPUSupport } from "@/app/hooks/use-webgpu-support";
import { useEffect, useRef } from "react";

// Every particle anchors to a letter pixel; the spring pulls them back
// after the mouse repels them. No ambient pool — once the name is
// formed, the only motion outside the letters comes from particles
// in transit (dispersed by the mouse, springing home).
const PARTICLE_ANCHORED = 90000;
const PARTICLE_AMBIENT = 0;
const PARTICLE_COUNT_WEBGPU = PARTICLE_ANCHORED + PARTICLE_AMBIENT;
const PARTICLE_COUNT_CANVAS = 600;
const MOUSE_RADIUS = 100; // pixels (CSS), scaled by DPR before posting

/**
 * Sample text pixels from the (visually hidden but laid out) hero h1
 * elements so the particle "letters" land at exactly the same viewport
 * coords as the original typography. Returns parallel buffers:
 *   targets: Float32Array [x0, y0, x1, y1, …]    device-pixel goals
 *   tints:   Float32Array [t0, t1, …]            per-particle colour key
 * Tint convention:
 *   0 … 1   = DHRUV gradient (violet → cyan), `t` = horizontal position
 *   2.0     = AGRAWAL white
 *   < 0     = ambient (no goal, gradient violet/cyan by random hue)
 */
async function sampleAnchorTargets(canvasW, canvasH, dpr) {
  if (
    typeof document === "undefined" ||
    typeof OffscreenCanvas === "undefined"
  ) {
    return null;
  }
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }

  const els = [
    document.getElementById("hero-name-line-0"),
    document.getElementById("hero-name-line-1"),
  ];
  if (!els[0] || !els[1]) return null;

  const lines = els.map((el, idx) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      text: el.textContent.trim(),
      lineIdx: idx,
      x: rect.left * dpr,
      y: rect.top * dpr,
      w: rect.width * dpr,
      h: rect.height * dpr,
      fontPx: parseFloat(style.fontSize) * dpr,
      fontFamily: style.fontFamily,
      fontWeight: style.fontWeight || "700",
    };
  });

  const sampler = new OffscreenCanvas(canvasW, canvasH);
  const ctx = sampler.getContext("2d");
  if (!ctx) return null;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";

  for (const line of lines) {
    ctx.font = `${line.fontWeight} ${line.fontPx}px ${line.fontFamily}`;
    const baselineY = line.y + line.fontPx * 0.82;
    // Use the actual measured letter width so the gradient runs the
    // full visual width of the word, not the wrapper's box width.
    const measured = ctx.measureText(line.text).width;
    line.glyphW = measured;
    ctx.fillText(line.text, line.x, baselineY);
  }

  const data = ctx.getImageData(0, 0, canvasW, canvasH).data;
  const stride = Math.max(2, Math.floor(canvasW / 1400));
  const pixels = []; // [x, y, lineIdx, gradT]
  for (let py = 0; py < canvasH; py += stride) {
    for (let px = 0; px < canvasW; px += stride) {
      if (data[(py * canvasW + px) * 4 + 3] <= 128) continue;
      let owner = null;
      for (const line of lines) {
        if (py >= line.y - 2 && py <= line.y + line.h + 2) {
          owner = line;
          break;
        }
      }
      if (!owner) continue;
      const gradT = Math.max(
        0,
        Math.min(1, (px - owner.x) / (owner.glyphW || owner.w)),
      );
      pixels.push(px, py, owner.lineIdx, gradT);
    }
  }
  return pixels.length > 0 ? pixels : null;
}

/**
 * Build a per-particle data plan:
 *   - first PARTICLE_ANCHORED particles take random samples from `pixels`
 *     as their goal, tinted by line/gradient.
 *   - next PARTICLE_AMBIENT particles get no goal (springK=0) so they
 *     drift via curl-noise + mouse repulsion only. They're sentinel-
 *     tagged with `tint = -1` so the shader renders them with a random
 *     violet/cyan tone.
 *
 * Returns { targets, tints, springs } — three parallel Float32Arrays.
 */
function buildParticlePlan(pixels) {
  const count = PARTICLE_COUNT_WEBGPU;
  const targets = new Float32Array(count * 2);
  const tints = new Float32Array(count);
  const springs = new Float32Array(count);

  if (pixels && pixels.length > 0) {
    const stride = 4;
    const nPixels = pixels.length / stride;
    for (let i = 0; i < PARTICLE_ANCHORED; i++) {
      const idx = (Math.random() * nPixels) | 0;
      const base = idx * stride;
      const jx = (Math.random() - 0.5) * 1.4;
      const jy = (Math.random() - 0.5) * 1.4;
      targets[i * 2] = pixels[base] + jx;
      targets[i * 2 + 1] = pixels[base + 1] + jy;
      const lineIdx = pixels[base + 2];
      const gradT = pixels[base + 3];
      tints[i] = lineIdx === 0 ? gradT : 2.0;
      springs[i] = 7.0;
    }
  }

  // No ambient particles — PARTICLE_AMBIENT is 0. (Loop kept for
  // forward compatibility if we want to bring them back later.)
  for (let i = PARTICLE_ANCHORED; i < count; i++) {
    targets[i * 2] = 0;
    targets[i * 2 + 1] = 0;
    tints[i] = Math.random() * 0.95;
    springs[i] = 0;
  }

  return { targets, tints, springs };
}

/**
 * ParticleHeroWebGPU
 *
 * Mounts a viewport-sized particle canvas behind the hero. ~80k
 * particles spring to "DHRUV AGRAWAL" letter targets sampled from the
 * actual DOM h1 positions; ~25k drift as ambient field across the
 * whole viewport so mouse repulsion is responsive in every corner.
 *
 * Renderer chain: WebGPU compute (OffscreenCanvas + worker) → canvas2D
 * ambient → static (reduced-motion or no canvas2D). Chosen renderer is
 * exposed via `data-renderer` on the container.
 */
export default function ParticleHeroWebGPU() {
  const mounted = useMounted();
  const { isChecking, hasWebGPU, hasWebGL2 } = useWebGPUSupport();
  const reduced = usePrefersReducedMotion();

  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const rafRef = useRef(null);
  const cleanupRef = useRef(() => {});

  useEffect(() => {
    if (!mounted) return undefined;
    if (isChecking) return undefined;
    const container = containerRef.current;
    const setRenderer = (value) => {
      container?.setAttribute("data-renderer", value);
      console.log("[particles] renderer =", value);
    };
    console.log("[particles] mount", { hasWebGPU, hasWebGL2, reduced });
    if (reduced) {
      setRenderer("static");
      return undefined;
    }

    let disposed = false;
    const canvas = canvasRef.current;
    if (!container || !canvas) return undefined;

    // Full-viewport sizing — wrapper is `fixed inset-0`.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(window.innerWidth, 1);
    const cssHeight = Math.max(window.innerHeight, 1);
    const width = Math.floor(cssWidth * dpr);
    const height = Math.floor(cssHeight * dpr);
    canvas.style.width = cssWidth + "px";
    canvas.style.height = cssHeight + "px";

    async function tryWebGPU() {
      try {
        console.log("[particles] try WebGPU; viewport =", {
          w: cssWidth,
          h: cssHeight,
          devicePR: dpr,
        });
        const response = await fetch("/shaders/particles.wgsl");
        if (!response.ok) throw new Error("shader fetch " + response.status);
        const shaderCode = await response.text();
        if (disposed) return false;

        const pixels = await sampleAnchorTargets(width, height, dpr);
        const plan = buildParticlePlan(pixels);
        console.log("[particles] sample =", {
          pixels: pixels ? pixels.length / 4 : 0,
          anchored: PARTICLE_ANCHORED,
          ambient: PARTICLE_AMBIENT,
        });

        const offscreen = canvas.transferControlToOffscreen();
        const worker = new Worker(
          new URL("../../workers/particles.worker.js", import.meta.url),
        );
        workerRef.current = worker;

        const readyPromise = new Promise((resolve, reject) => {
          worker.onmessage = (e) => {
            if (e.data?.type === "ready") resolve();
            if (e.data?.type === "error") reject(new Error(e.data.error));
          };
          worker.onerror = (e) =>
            reject(new Error(e.message || "worker error"));
        });

        const transfers = [offscreen];
        if (plan.targets) transfers.push(plan.targets.buffer);
        if (plan.tints) transfers.push(plan.tints.buffer);
        if (plan.springs) transfers.push(plan.springs.buffer);

        worker.postMessage(
          {
            type: "init",
            canvas: offscreen,
            particleCount: PARTICLE_COUNT_WEBGPU,
            width,
            height,
            shaderCode,
            targets: plan.targets,
            tints: plan.tints,
            springs: plan.springs,
          },
          transfers,
        );

        await readyPromise;
        if (disposed) return false;
        setRenderer("webgpu");

        // Window-level pointer events — the canvas covers the
        // entire viewport so coords map 1:1 (scaled by DPR).
        const handlePointerMove = (e) => {
          worker.postMessage({
            type: "mouse",
            x: e.clientX * dpr,
            y: e.clientY * dpr,
            radius: MOUSE_RADIUS * dpr,
          });
        };
        const handlePointerLeave = () => {
          worker.postMessage({ type: "mouse-leave" });
        };

        const handleResize = () => {
          const w = Math.max(window.innerWidth, 1);
          const h = Math.max(window.innerHeight, 1);
          canvas.style.width = w + "px";
          canvas.style.height = h + "px";
          worker.postMessage({
            type: "resize",
            width: Math.floor(w * dpr),
            height: Math.floor(h * dpr),
          });
        };

        // Hide the layer once the hero is mostly off-screen.
        const handleScroll = () => {
          const fade = 1 - Math.min(window.scrollY / window.innerHeight, 1);
          container.style.opacity = String(fade);
        };
        handleScroll();

        window.addEventListener("pointermove", handlePointerMove);
        window.addEventListener("pointerleave", handlePointerLeave);
        window.addEventListener("blur", handlePointerLeave);
        window.addEventListener("resize", handleResize);
        window.addEventListener("scroll", handleScroll, {
          passive: true,
        });

        cleanupRef.current = () => {
          window.removeEventListener("pointermove", handlePointerMove);
          window.removeEventListener("pointerleave", handlePointerLeave);
          window.removeEventListener("blur", handlePointerLeave);
          window.removeEventListener("resize", handleResize);
          window.removeEventListener("scroll", handleScroll);
          worker.postMessage({ type: "dispose" });
          worker.terminate();
          workerRef.current = null;
        };

        return true;
      } catch (err) {
        console.warn("[particles] WebGPU init failed; falling back:", err);
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        return false;
      }
    }

    // ---------- Canvas2D ambient fallback (no text formation) ----------
    function runCanvas2D() {
      const fallback =
        canvasRef.current?.isConnected &&
        !canvasRef.current.transferControlToOffscreen
          ? document.createElement("canvas")
          : canvas;
      if (fallback !== canvas) {
        fallback.className = canvas.className;
        fallback.style.width = cssWidth + "px";
        fallback.style.height = cssHeight + "px";
        container.appendChild(fallback);
      }
      fallback.width = width;
      fallback.height = height;

      const ctx = fallback.getContext("2d");
      if (!ctx) {
        setRenderer("static");
        return;
      }
      setRenderer("canvas2d");

      const particles = new Array(PARTICLE_COUNT_CANVAS).fill(0).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 40,
        vy: (Math.random() - 0.5) * 40,
      }));

      let mx = -10000;
      let my = -10000;
      const handlePointerMove = (e) => {
        mx = e.clientX * dpr;
        my = e.clientY * dpr;
      };
      const handlePointerLeave = () => {
        mx = -10000;
        my = -10000;
      };
      const handleResize = () => {
        fallback.style.width = window.innerWidth + "px";
        fallback.style.height = window.innerHeight + "px";
      };
      const handleScroll = () => {
        const fade = 1 - Math.min(window.scrollY / window.innerHeight, 1);
        container.style.opacity = String(fade);
      };
      handleScroll();
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerleave", handlePointerLeave);
      window.addEventListener("blur", handlePointerLeave);
      window.addEventListener("resize", handleResize);
      window.addEventListener("scroll", handleScroll, { passive: true });

      let last = performance.now();
      const draw = () => {
        if (disposed) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 1 / 30);
        last = now;

        ctx.globalCompositeOperation = "source-over";
        ctx.clearRect(0, 0, width, height);

        const radius = MOUSE_RADIUS * dpr;
        for (const p of particles) {
          const fx = Math.sin(p.y * 0.005 + now * 0.0006) * 25;
          const fy = Math.cos(p.x * 0.005 + now * 0.0005) * 25;
          let ax = fx;
          let ay = fy;
          const dx = p.x - mx;
          const dy = p.y - my;
          const d2 = dx * dx + dy * dy;
          if (d2 < radius * radius) {
            const d = Math.sqrt(d2) || 1;
            const falloff = 1 - d / radius;
            ax += (dx / d) * falloff * 1800;
            ay += (dy / d) * falloff * 1800;
          }
          p.vx = (p.vx + ax * dt) * 0.92;
          p.vy = (p.vy + ay * dt) * 0.92;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.x < -10) p.x = width + 10;
          else if (p.x > width + 10) p.x = -10;
          if (p.y < -10) p.y = height + 10;
          else if (p.y > height + 10) p.y = -10;
          const speed = Math.min(Math.sqrt(p.vx * p.vx + p.vy * p.vy) / 200, 1);
          ctx.beginPath();
          ctx.arc(p.x, p.y, 1.2 * dpr, 0, Math.PI * 2);
          const r = Math.round(139 + (6 - 139) * speed);
          const g = Math.round(92 + (182 - 92) * speed);
          const b = Math.round(246 + (212 - 246) * speed);
          ctx.fillStyle = `rgba(${r},${g},${b},0.45)`;
          ctx.fill();
        }
        rafRef.current = requestAnimationFrame(draw);
      };
      rafRef.current = requestAnimationFrame(draw);

      cleanupRef.current = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerleave", handlePointerLeave);
        window.removeEventListener("blur", handlePointerLeave);
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("scroll", handleScroll);
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (fallback !== canvas) fallback.remove();
      };
    }

    if (hasWebGPU) {
      tryWebGPU().then((ok) => {
        if (!ok && !disposed) runCanvas2D();
      });
    } else {
      runCanvas2D();
    }

    return () => {
      disposed = true;
      cleanupRef.current?.();
      cleanupRef.current = () => {};
    };
  }, [mounted, isChecking, hasWebGPU, hasWebGL2, reduced]);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      // `fixed inset-0` — particle canvas spans the entire viewport
      // so particles drift through corners and mouse repulsion
      // reaches the screen edges. Opacity is driven by scroll so
      // the layer hides once the hero is mostly out of view.
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      data-renderer="init"
      style={{ opacity: 1, transition: "opacity 80ms linear" }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto"
      />
    </div>
  );
}
