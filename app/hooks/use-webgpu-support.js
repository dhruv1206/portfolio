"use client";

import { useState, useEffect } from "react";

/**
 * useWebGPUSupport - Detect WebGPU availability
 * Falls back to WebGL if WebGPU unavailable
 */
export function useWebGPUSupport() {
    const [support, setSupport] = useState({
        isChecking: true,
        hasWebGPU: false,
        hasWebGL2: false,
        hasWebGL: false,
        adapter: null,
        device: null,
        preferredRenderer: "none",
    });

    useEffect(() => {
        async function checkSupport() {
            const result = {
                isChecking: false,
                hasWebGPU: false,
                hasWebGL2: false,
                hasWebGL: false,
                adapter: null,
                device: null,
                preferredRenderer: "none",
            };

            // Check WebGPU
            if (typeof navigator !== "undefined" && "gpu" in navigator) {
                try {
                    const adapter = await navigator.gpu.requestAdapter();
                    if (adapter) {
                        const device = await adapter.requestDevice();
                        result.hasWebGPU = true;
                        result.adapter = adapter;
                        result.device = device;
                        result.preferredRenderer = "webgpu";
                    }
                } catch (e) {
                    console.debug("WebGPU not available:", e);
                }
            }

            // Check WebGL2
            if (!result.hasWebGPU) {
                try {
                    const canvas = document.createElement("canvas");
                    const gl2 = canvas.getContext("webgl2");
                    if (gl2) {
                        result.hasWebGL2 = true;
                        result.preferredRenderer = "webgl2";
                    }
                } catch (e) {
                    console.debug("WebGL2 not available:", e);
                }
            }

            // Check WebGL
            if (!result.hasWebGL2) {
                try {
                    const canvas = document.createElement("canvas");
                    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                    if (gl) {
                        result.hasWebGL = true;
                        result.preferredRenderer = "webgl";
                    }
                } catch (e) {
                    console.debug("WebGL not available:", e);
                }
            }

            setSupport(result);
        }

        checkSupport();
    }, []);

    return support;
}

export default useWebGPUSupport;
