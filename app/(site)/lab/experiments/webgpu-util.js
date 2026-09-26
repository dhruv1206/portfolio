"use client";

// Shared WebGPU bring-up for /lab compute experiments. Main-thread
// (not a worker like the hero) because these are pointer-driven and
// the postMessage round-trip would add input latency. Returns null
// when WebGPU is unavailable so each experiment can render a graceful
// fallback panel instead.

export async function initWebGPU(canvas, { alphaMode = "premultiplied" } = {}) {
    if (typeof navigator === "undefined" || !navigator.gpu) return null;
    let adapter;
    try {
        adapter = await navigator.gpu.requestAdapter();
    } catch {
        return null;
    }
    if (!adapter) return null;
    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu");
    if (!context) return null;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode });
    return { adapter, device, context, format };
}

// Build a shader module and surface WGSL compile errors as a thrown
// Error (instead of an invisible cascade of invalid-pipeline messages
// every frame). Mirrors the pattern in the particle hero worker.
export async function makeShaderModule(device, code, label = "wgsl") {
    device.pushErrorScope("validation");
    const shaderModule = device.createShaderModule({ code, label });
    const info = await shaderModule.getCompilationInfo();
    const fatal = info.messages.find((m) => m.type === "error");
    if (fatal) {
        device.popErrorScope().catch(() => {});
        throw new Error(
            `WGSL compile error in ${label}: ${fatal.message} (line ${fatal.lineNum})`,
        );
    }
    const validationErr = await device.popErrorScope();
    if (validationErr) {
        throw new Error(`WGSL validation in ${label}: ${validationErr.message}`);
    }
    return shaderModule;
}

// Standard "this experiment needs WebGPU" fallback content. Returns a
// plain object the component renders; keeps the message consistent.
export const WEBGPU_FALLBACK_TEXT =
    "This experiment runs on WebGPU compute, which isn't available in this browser. Try the latest Chrome or Edge on desktop. (The canvas2D experiments in the lab work everywhere.)";
