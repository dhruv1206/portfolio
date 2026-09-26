// The homepage's particle spine: one WebGL2 point cloud that morphs on
// the GPU between six layouts (the name, a globe, the MEET topology,
// DStarDB's thread pool, the stack strata, a ring) as the visitor scrolls.
// Each layout is a Float32Array of [x, y, z, role.tint] per point in CSS
// pixels; the vertex shader animates the role-specific motion.

const VS = `#version 300 es
precision highp float;
layout(location=0) in vec4 aA; layout(location=1) in vec4 aB; layout(location=2) in vec2 aSeed;
uniform vec2 uRes; uniform float uT, uTime, uDpr, uSize, uReduced, uSpin, uBand, uRadA, uRadB, uMouseR, uMouseK;
uniform vec2 uMouse, uCenA, uCenB, uOffA, uOffB;
uniform vec4 uEdgeA[24]; uniform vec4 uEdgeB[24];
out vec4 vCol;
const vec3 VIOLET=vec3(0.545,0.361,0.965), CYAN=vec3(0.133,0.827,0.933), WHITE=vec3(0.95,0.95,0.97), GRAY=vec3(0.46,0.46,0.55);
vec3 palette(float t){ if(t<0.5) return mix(VIOLET,CYAN,t*2.0); if(t<0.75) return WHITE; return GRAY; }
vec4 eval(vec4 a, int which, out vec3 col){
  float role = floor(a.w+0.0001); float tint = a.w-role; col = palette(tint);
  vec2 pos = a.xy; float size = 1.0; float alpha = 0.85;
  vec2 cen = which==0 ? uCenA : uCenB; float rad = which==0 ? uRadA : uRadB;
  if(role==1.0 || role==4.0){
    float c=cos(uSpin), s=sin(uSpin);
    float x=a.x*c+a.z*s; float z=-a.x*s+a.z*c; float y=a.y;
    float ct=cos(0.34), st=sin(0.34); float y2=y*ct-z*st; float z2=y*st+z*ct;
    float persp = 1.0 + z2/(rad*5.0);
    pos = cen + vec2(x,y2)*persp;
    float depth = clamp((z2/rad)*0.5+0.5, 0.0, 1.0);
    alpha = mix(0.10, 0.92, depth); size = mix(0.7, 1.15, depth);
    if(role==4.0){ float p = 0.5+0.5*sin(uTime*2.2*(1.0-uReduced)+aSeed.x*30.0); size = (1.3+1.7*p)*mix(0.6,1.0,depth); alpha = mix(0.04,1.0,depth)*(0.55+0.45*p); }
  } else if(role==2.0){
    int idx = clamp(int(a.x+0.5),0,23); vec4 e = which==0 ? uEdgeA[idx] : uEdgeB[idx];
    float f = fract(aSeed.x + uTime*a.z*(1.0-uReduced));
    pos = mix(e.xy,e.zw,f); size = 1.7; alpha = smoothstep(0.0,0.1,f)*smoothstep(1.0,0.9,f);
  } else if(role==3.0){
    float sp = 0.06+aSeed.y*0.16; float f = fract(aSeed.x + uTime*sp*(1.0-uReduced));
    pos = vec2(a.x+f*a.z, a.y); size = 1.25; alpha = 0.9*smoothstep(0.0,0.06,f)*smoothstep(1.0,0.94,f);
  } else if(role==5.0){
    float dir = aSeed.y>0.5 ? 1.0 : -1.0; float sp = (0.03+fract(aSeed.y*7.0)*0.05)*dir;
    float ang = aSeed.x*6.2831853 + uTime*sp*(1.0-uReduced);
    pos = a.xy + a.z*vec2(cos(ang),sin(ang)); size = tint<0.5 ? 2.3 : 1.0; alpha = tint<0.5 ? 1.0 : 0.8;
  } else if(role==6.0){
    pos = a.xy + vec2(0.0, sin(a.x*0.045 - uTime*1.4*(1.0-uReduced) + a.z*1.1)*6.0);
    float hot = abs(a.z-uBand)<0.5 ? 1.0 : 0.0; alpha = mix(0.7,1.0,hot); size = mix(1.0,1.6,hot);
    if(hot>0.5) col = mix(col,CYAN,0.6);
  } else if(role==7.0){
    float w = 0.5+0.5*sin(uTime*3.0*(1.0-uReduced) - a.y*0.06 + aSeed.x*0.5); alpha = 0.25+0.75*w; size = 0.9+0.8*w;
  }
  pos += which==0 ? uOffA : uOffB;
  return vec4(pos,size,alpha);
}
void main(){
  vec3 cA, cB; vec4 A = eval(aA,0,cA); vec4 B = eval(aB,1,cB);
  float st = clamp((uT - aSeed.y*0.3)/0.7, 0.0, 1.0); float e = st*st*(3.0-2.0*st); float h = e*(1.0-e);
  vec2 off = vec2(sin(aSeed.x*6.283+uTime*0.6), cos(aSeed.y*6.283+uTime*0.5)) * h*48.0*(1.0-uReduced);
  vec2 pos = mix(A.xy,B.xy,e)+off; float size = mix(A.z,B.z,e)+h*0.6; float alpha = mix(A.w,B.w,e); vec3 col = mix(cA,cB,e);
  vec2 d = pos-uMouse; float dist = length(d);
  if(dist<uMouseR && dist>0.001){ float f = 1.0-dist/uMouseR; pos += (d/dist)*f*f*uMouseK; }
  vec2 ndc = (pos/uRes)*2.0-1.0;
  gl_Position = vec4(ndc.x,-ndc.y,0.0,1.0); gl_PointSize = max(1.0, uSize*size*uDpr); vCol = vec4(col,alpha);
}`;
const FS = `#version 300 es
precision mediump float; in vec4 vCol; out vec4 o;
void main(){ vec2 c = gl_PointCoord*2.0-1.0; float d = dot(c,c); float a = (1.0-smoothstep(0.5,1.0,d))*vCol.a; o = vec4(vCol.rgb*a,a); }`;

type Pt = [number, number, number?, number?];
interface Label { cls: "c" | "l" | "r"; x?: number; y?: number; html: string; city?: City }
interface Meta { edges: number[][]; cen: [number, number]; rad: number; labels: Label[]; doc?: boolean }
type City = [number, number, number, string];
const CITIES: City[] = [[12.97, 77.59, 5, "Bengaluru"], [19.03, 73.03, 3, "Navi Mumbai"], [28.61, 77.21, 3, ""], [23.26, 77.41, 2, ""], [25.45, 78.57, 2, "Jhansi"], [17.39, 78.49, 2, ""], [13.08, 80.27, 2, ""], [22.57, 88.36, 1.5, ""], [18.52, 73.86, 1.5, ""], [26.85, 80.95, 1, ""], [23.02, 72.57, 1, ""], [1.35, 103.82, 2, "Singapore"], [51.5, -0.12, 1, ""], [37.77, -122.42, 1, ""], [25.2, 55.27, 1, ""], [50.11, 8.68, 0.7, ""]];
export const LAYERS = ["L0 transport", "L1 runtime", "L2 data", "L3 infra", "L4 observability", "L5 languages"];
const R = Math.random, TAU = Math.PI * 2, K = 7;
const gauss = () => (R() + R() + R() - 1.5) * 0.8;
function sph(lat: number, lon: number, r: number): [number, number, number] { const la = (lat * Math.PI) / 180, lo = ((lon - 78) * Math.PI) / 180; return [r * Math.cos(la) * Math.sin(lo), -r * Math.sin(la), r * Math.cos(la) * Math.cos(lo)]; }

export interface SpineOptions { canvas: HTMLCanvasElement; labelsRoot: HTMLElement; nameLines: () => (HTMLElement | null)[]; labelClass: (cls: string) => string; onAssembled?: () => void }

export class Spine {
    N: number; target = 1; cur = 0; band = -1; stats = { fps: 0, ms: 0, gpu: "—" }; ready = false; nogl = false;
    private gl: WebGL2RenderingContext | null = null; private prog: WebGLProgram | null = null; private U: Record<string, WebGLUniformLocation | null> = {};
    private bufs: WebGLBuffer[] = []; private meta: Meta[] = []; private scratch: Float32Array; private W = 0; private H = 0; private DPR = 1;
    private raf = 0; private last = 0; private t0 = 0; private fpsAcc = 0; private fpsN = 0; private fpsT = 0; private assembled = false; private reduced: boolean;
    private mouse = { x: -9999, y: -9999 }; private edgeA = new Float32Array(96); private edgeB = new Float32Array(96);
    private labelEls: { el: HTMLElement; k: number; l: Label }[] = []; private nameToken = 0; private primed = false; private rT: ReturnType<typeof setTimeout> | null = null;
    private opts: SpineOptions; private unbind: (() => void)[] = []; private ctxLost = false;

    constructor(opts: SpineOptions) {
        this.opts = opts; this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const bootW = Math.max(innerWidth || 0, (screen && screen.width) || 0); this.N = bootW < 821 ? 12000 : 36000; this.scratch = new Float32Array(this.N * 4);
        const gl = opts.canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: true, powerPreference: "high-performance" });
        if (!gl) { this.nogl = true; return; }
        this.gl = gl;
        opts.canvas.addEventListener("webglcontextlost", () => { this.nogl = true; this.ctxLost = true; });
        try { const ext = gl.getExtension("WEBGL_debug_renderer_info"); if (ext) { const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || ""); const m = r.match(/(Apple M\d[^,)]*|Apple GPU|NVIDIA [^,)]+|AMD [^,)]+|Intel[^,)]+|Adreno[^,)]+|Mali[^,)]+)/); this.stats.gpu = (m ? m[1] : r).trim().slice(0, 26) || "masked"; } } catch { /* optional */ }
        const sh = (type: number, src: string) => { const s = gl.createShader(type) as WebGLShader; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
        const prog = gl.createProgram() as WebGLProgram; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.error(gl.getProgramInfoLog(prog)); this.nogl = true; return; }
        this.prog = prog; gl.useProgram(prog);
        for (const n of ["uRes", "uT", "uTime", "uDpr", "uSize", "uReduced", "uSpin", "uBand", "uRadA", "uRadB", "uMouseR", "uMouseK", "uMouse", "uCenA", "uCenB", "uOffA", "uOffB", "uEdgeA", "uEdgeB"]) this.U[n] = gl.getUniformLocation(prog, n);
        gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(0.0196, 0.0196, 0.0314, 1);
        for (let k = 0; k < K; k++) { this.bufs.push(gl.createBuffer() as WebGLBuffer); this.meta.push({ edges: [], cen: [0, 0], rad: 1, labels: [] }); }
        const seeds = new Float32Array(this.N * 2); for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
        const seedBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
        const vao = gl.createVertexArray(); gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, seedBuf); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1);
        const onMove = (e: PointerEvent) => { this.mouse.x = e.clientX; this.mouse.y = e.clientY; }; const onLeave = () => { this.mouse.x = -9999; };
        const onResize = () => { if (this.rT) clearTimeout(this.rT); this.rT = setTimeout(() => this.resize(), 160); };
        addEventListener("pointermove", onMove, { passive: true }); addEventListener("pointerleave", onLeave); addEventListener("resize", onResize);
        this.unbind.push(() => { removeEventListener("pointermove", onMove); removeEventListener("pointerleave", onLeave); removeEventListener("resize", onResize); });
        this.resize(); this.last = performance.now(); this.t0 = this.last; this.fpsT = this.last; this.raf = requestAnimationFrame(this.frame);
    }
    destroy() { cancelAnimationFrame(this.raf); for (const u of this.unbind) u(); this.unbind = []; if (this.rT) clearTimeout(this.rT); this.opts.labelsRoot.innerHTML = ""; }

    /* ---------- layouts ---------- */
    private mobile() { return this.W < 821; }
    private box() { const W = this.W, H = this.H; return this.mobile() ? { x: W * 0.06, y: H * 0.1, w: W * 0.88, h: H * 0.34 } : { x: W * 0.53, y: H * 0.15, w: W * 0.42, h: H * 0.72 }; }
    private fill(arr: Float32Array, a: number, b: number, fn: (i: number, t: number) => Pt) { for (let i = a; i < b; i++) { const o = i * 4; const p = fn(i, (i - a) / Math.max(1, b - a - 1)); arr[o] = p[0]; arr[o + 1] = p[1]; arr[o + 2] = p[2] || 0; arr[o + 3] = p[3] ?? 0.9; } }
    private grid(arr: Float32Array, a: number, b: number, bx: { x: number; y: number; w: number; h: number }, step: number) { const cols = Math.max(1, Math.floor(bx.w / step)), rows = Math.max(1, Math.floor(bx.h / step)); this.fill(arr, a, b, (i) => { const j = (i - a) % (cols * rows); return [bx.x + (j % cols) * step + step / 2, bx.y + Math.floor(j / cols) * step + step / 2, 0, 0.9]; }); }
    private ring(arr: Float32Array, a: number, b: number, cx: number, cy: number, r: number, tint: number) { this.fill(arr, a, b, () => { const ang = R() * TAU; const rr = R() < 0.25 ? r * Math.sqrt(R()) * 0.8 : r + gauss() * 0.6; return [cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 0, tint]; }); }
    private line(arr: Float32Array, a: number, b: number, x1: number, y1: number, x2: number, y2: number, tint: number) { this.fill(arr, a, b, () => { const f = R(); return [x1 + (x2 - x1) * f + gauss() * 0.4, y1 + (y2 - y1) * f + gauss() * 0.4, 0, tint]; }); }
    private layoutScatter(arr: Float32Array): Meta { this.fill(arr, 0, this.N, () => [R() * this.W, R() * this.H, 0, 0.9]); return { edges: [], cen: [0, 0], rad: 1, labels: [] }; }
    private layoutGlobe(arr: Float32Array): Meta {
        const N = this.N, bx = this.box(); const cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2; const r = Math.min(bx.w, bx.h) * (this.mobile() ? 0.42 : 0.44);
        const nSurf = Math.floor(N * 0.66), nGrat = Math.floor(N * 0.18); let i = 0;
        this.fill(arr, 0, nSurf, (k) => { const y = 1 - (k / (nSurf - 1)) * 2; const rad = Math.sqrt(1 - y * y); const th = k * 2.399963; return [Math.cos(th) * rad * r, y * r, Math.sin(th) * rad * r, 1.58]; }); i = nSurf;
        this.fill(arr, i, i + nGrat, (k) => { const u = R(); if (R() < 0.45) { const lat = [-60, -30, 0, 30, 60][k % 5]; const p = sph(lat, u * 360, r); return [p[0], p[1], p[2], 1.3]; } const p = sph(u * 180 - 90, (k % 12) * 30, r); return [p[0], p[1], p[2], 1.3]; }); i += nGrat;
        const wsum = CITIES.reduce((s, c) => s + c[2], 0); const rest = Math.floor(N * 0.08);
        for (const c of CITIES) { const n = Math.floor((rest * c[2]) / wsum); this.fill(arr, i, i + n, () => { const p = sph(c[0] + gauss(), c[1] + gauss(), r * (1 + R() * 0.012)); return [p[0], p[1], p[2], c[1] > 60 && c[1] < 95 ? 4.42 : 4.05]; }); i += n; }
        this.fill(arr, i, N, () => { const p = sph(R() * 180 - 90, R() * 360, r); return [p[0], p[1], p[2], 1.58]; });
        const labels: Label[] = [{ cls: "c", x: cx, y: cy - r - 30, html: "users by region · <b>India-first</b>" }]; for (const c of CITIES) if (c[3]) labels.push({ cls: "l", city: c, html: "<b>" + c[3] + "</b>" });
        return { edges: [], cen: [cx, cy], rad: r, labels };
    }
    private layoutTopology(arr: Float32Array): Meta {
        const N = this.N, bx = this.box(); const P = (u: number, v: number): [number, number] => [bx.x + u * bx.w, bx.y + v * bx.h];
        const nodes: Record<string, [number, number]> = { client: P(0.05, 0.5), gateway: P(0.28, 0.5), eureka: P(0.55, 0.1), config: P(0.82, 0.1), user: P(0.62, 0.35), signal: P(0.62, 0.58), product: P(0.62, 0.82), db: P(0.92, 0.58) };
        const tintOf: Record<string, number> = { client: 0.9, gateway: 0.02, eureka: 0.6, config: 0.6, user: 0.46, signal: 0.46, product: 0.46, db: 0.9 };
        const E = [["client", "gateway"], ["gateway", "user"], ["gateway", "signal"], ["gateway", "product"], ["gateway", "eureka"], ["user", "eureka"], ["signal", "eureka"], ["product", "eureka"], ["config", "eureka"], ["user", "db"], ["product", "db"], ["signal", "db"]];
        const edges = E.map(([a, b]) => [...nodes[a], ...nodes[b]]); const r = Math.max(12, Math.min(24, bx.w * 0.045)); const names = Object.keys(nodes); let i = 0;
        const nNode = Math.floor(N * 0.024), nEdge = Math.floor(N * 0.022), nPk = Math.floor(N * 0.11);
        for (const n of names) { this.ring(arr, i, i + nNode, nodes[n][0], nodes[n][1], r, tintOf[n]); i += nNode; }
        for (const e of edges) { this.line(arr, i, i + nEdge, e[0], e[1], e[2], e[3], 0.88); i += nEdge; }
        this.fill(arr, i, i + nPk, (k) => { const ei = k % edges.length; const main = ei < 4; return [ei, 0, main ? 0.22 + R() * 0.2 : 0.08 + R() * 0.1, 2 + (main ? 0.42 : 0.04)]; }); i += nPk;
        this.grid(arr, i, N, bx, this.mobile() ? 22 : 26);
        const lab: Record<string, string> = { client: "browser", gateway: "<b>Gateway</b><small>:8222 · public port</small>", eureka: "<b>Eureka</b><small>discovery</small>", config: "<b>Config</b><small>secrets</small>", user: "User<small>service</small>", signal: "<b>Signalling</b><small>STOMP/WS</small>", product: "Product<small>service</small>", db: "Postgres" };
        return { edges, cen: [0, 0], rad: 1, labels: names.map((n) => ({ cls: "c", x: nodes[n][0], y: nodes[n][1] + (n === "client" ? -r - 22 : r + 12), html: lab[n] })) };
    }
    private layoutLanes(arr: Float32Array): Meta {
        const N = this.N, bx = this.box(); const L = this.mobile() ? 6 : 8; const x0 = bx.x + bx.w * 0.1, x1 = bx.x + bx.w * 0.2, x2 = bx.x + bx.w * 0.8, sx = bx.x + bx.w * 0.86; let i = 0;
        const lanesY: number[] = []; for (let l = 0; l < L; l++) lanesY.push(bx.y + bx.h * (0.16 + (0.68 * (l + 0.5)) / L));
        const nLoop = Math.floor(N * 0.06), nCl = Math.floor(N * 0.02), nGuide = Math.floor(N * 0.012), nFlow = Math.floor((N * 0.3) / L), nPk = Math.floor(N * 0.07), nStore = Math.floor(N * 0.08), nCells = Math.floor(N * 0.06);
        this.fill(arr, i, i + nLoop, () => [x0 + gauss() * 0.5, bx.y + bx.h * 0.12 + R() * bx.h * 0.76, 0, 7.02]); i += nLoop;
        this.fill(arr, i, i + nCl, (k) => { const c = k % 3; return [bx.x + bx.w * 0.02 + gauss() * 2, bx.y + bx.h * (0.3 + c * 0.2) + gauss() * 2, 0, 0.9]; }); i += nCl;
        const edges: number[][] = [];
        lanesY.forEach((y, l) => { this.line(arr, i, i + nGuide, x1, y, x2, y, 0.88); i += nGuide; this.fill(arr, i, i + nFlow, () => [x1, y + gauss() * 0.6, x2 - x1, 3 + (l % 3 === 0 ? 0.04 : l % 3 === 1 ? 0.44 : 0.6)]); i += nFlow; edges.push([x0, bx.y + bx.h * 0.5, x1, y]); });
        this.fill(arr, i, i + nPk, (k) => [k % edges.length, 0, 0.35 + R() * 0.3, 2.42]); i += nPk;
        const sy1 = bx.y + bx.h * 0.14, sy2 = bx.y + bx.h * 0.86, sx2 = sx + bx.w * 0.12;
        this.fill(arr, i, i + nStore, (k) => { const s = k % 4; const f = R(); return s === 0 ? [sx + f * (sx2 - sx), sy1, 0, 0.6] : s === 1 ? [sx + f * (sx2 - sx), sy2, 0, 0.6] : s === 2 ? [sx, sy1 + f * (sy2 - sy1), 0, 0.6] : [sx2, sy1 + f * (sy2 - sy1), 0, 0.6]; }); i += nStore;
        this.grid(arr, i, i + nCells, { x: sx + 6, y: sy1 + 6, w: sx2 - sx - 12, h: sy2 - sy1 - 12 }, 10); i += nCells;
        this.grid(arr, i, N, bx, this.mobile() ? 22 : 26);
        const labels: Label[] = [{ cls: "c", x: x0, y: bx.y + bx.h * 0.04, html: "<b>event loop</b><small>select()</small>" }, { cls: "c", x: (x1 + x2) / 2, y: bx.y + bx.h * 0.04, html: "<b>worker pool</b><small>" + L + " threads · rw locks</small>" }, { cls: "c", x: (sx + sx2) / 2, y: bx.y + bx.h * 0.04, html: "<b>store</b>" }, { cls: "c", x: bx.x + bx.w * 0.02, y: bx.y + bx.h * 0.14, html: "clients" }];
        return { edges, cen: [0, 0], rad: 1, labels };
    }
    private layoutStrata(arr: Float32Array): Meta {
        const N = this.N, bx = this.box(); const per = Math.floor(N * 0.075); let i = 0; const labels: Label[] = [];
        for (let j = 0; j < 6; j++) { const y = bx.y + bx.h * ((j + 0.5) / 6); const t = j % 3 === 0 ? 0.6 : j % 3 === 1 ? 0.08 : 0.42; this.fill(arr, i, i + per, () => [bx.x + R() * bx.w, y + gauss() * 0.5, j, 6 + t]); i += per; labels.push({ cls: "l", x: bx.x + 2, y: y - 17, html: LAYERS[j] }); }
        this.grid(arr, i, N, bx, this.mobile() ? 22 : 26);
        return { edges: [], cen: [0, 0], rad: 1, labels };
    }
    private layoutRing(arr: Float32Array): Meta {
        const N = this.N, bx = this.box(); const cx = bx.x + bx.w / 2, cy = bx.y + bx.h * (this.mobile() ? 0.5 : 0.42); const r = Math.min(bx.w, bx.h) * (this.mobile() ? 0.36 : 0.31); let i = 0;
        const nRing = Math.floor(N * 0.6), nIn = Math.floor(N * 0.22), nSat = 28;
        this.fill(arr, i, i + nRing, () => [cx, cy, r + gauss() * 0.8, 5.6]); i += nRing;
        this.fill(arr, i, i + nIn, () => [cx, cy, r * 0.62 + gauss() * 0.6, 5.9]); i += nIn;
        this.fill(arr, i, i + nSat, (k) => [cx, cy, r * 1.28, 5 + (k % 2 ? 0.02 : 0.45)]); i += nSat;
        this.fill(arr, i, N, () => [cx, cy, r * 1.62 + gauss() * 0.5, 5.92]);
        return { edges: [], cen: [cx, cy], rad: r, labels: [] };
    }
    private async layoutName(arr: Float32Array): Promise<Meta> {
        try { await document.fonts.load('800 100px "Archivo"'); } catch { /* fallback font */ }
        const els = this.opts.nameLines(); const pts: number[] = []; const sy = scrollY;
        for (let li = 0; li < els.length; li++) {
            const el = els[li]; if (!el) continue; const rc = el.getBoundingClientRect(); const cs = getComputedStyle(el); const w = Math.ceil(rc.width), h = Math.ceil(rc.height); if (!w || !h) continue;
            const c = document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) continue;
            ctx.font = `${cs.fontWeight} ${parseFloat(cs.fontSize)}px ${cs.fontFamily}`; if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing; ctx.fillStyle = "#fff"; ctx.textBaseline = "alphabetic";
            const text = (el.textContent || "").trim().toUpperCase(); const m = ctx.measureText(text); const asc = m.fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9, desc = m.fontBoundingBoxDescent || parseFloat(cs.fontSize) * 0.2;
            ctx.fillText(text, 0, (h - (asc + desc)) / 2 + asc);
            const d = ctx.getImageData(0, 0, w, h).data; const stride = Math.max(1, Math.round(Math.sqrt((w * h * 0.35) / (this.N * 0.9))));
            for (let y = 0; y < h; y += stride) for (let x = 0; x < w; x += stride) if (d[(y * w + x) * 4 + 3] > 110) pts.push(rc.left + x, rc.top + sy + y, li === 0 ? 0.5 * (x / w) : 0.6);
        }
        if (pts.length < 30) { this.fill(arr, 0, this.N, () => [this.W * 0.3 + R() * this.W * 0.4, this.H * 0.3 + R() * this.H * 0.3, 0, 0.6]); return { edges: [], cen: [0, 0], rad: 1, labels: [], doc: true }; }
        const n = pts.length / 3; this.fill(arr, 0, this.N, () => { const j = (R() * n) | 0; return [pts[j * 3] + (R() - 0.5) * 1.2, pts[j * 3 + 1] + (R() - 0.5) * 1.2, 0, pts[j * 3 + 2]]; });
        return { edges: [], cen: [0, 0], rad: 1, labels: [], doc: true };
    }
    private upload(k: number, arr: Float32Array) { const gl = this.gl; if (!gl) return; gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[k]); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.DYNAMIC_DRAW); }
    private async relayout() {
        const s = this.scratch; this.meta[0] = this.layoutScatter(s); this.upload(0, s);
        if (!this.primed) { this.primed = true; for (let k = 1; k < K; k++) this.upload(k, s); }
        const L = [null, null, this.layoutGlobe, this.layoutTopology, this.layoutLanes, this.layoutStrata, this.layoutRing];
        for (let k = 2; k < K; k++) { const fn = L[k] as (a: Float32Array) => Meta; this.meta[k] = fn.call(this, s); this.upload(k, s); }
        const tok = ++this.nameToken; const arr = new Float32Array(this.N * 4); const m = await this.layoutName(arr); if (tok !== this.nameToken) return; this.meta[1] = m; this.upload(1, arr); this.buildLabels(); this.ready = true;
    }
    resize() { const gl = this.gl; if (!gl) return; this.DPR = Math.min(2, devicePixelRatio || 1); this.W = innerWidth; this.H = innerHeight; this.opts.canvas.width = Math.floor(this.W * this.DPR); this.opts.canvas.height = Math.floor(this.H * this.DPR); gl.viewport(0, 0, this.opts.canvas.width, this.opts.canvas.height); this.relayout(); }
    /** Re-sample the name (e.g. after fonts settle or layout shifts). */
    resampleName() { this.relayout(); }
    private buildLabels() { const root = this.opts.labelsRoot; root.innerHTML = ""; this.labelEls = []; this.meta.forEach((m, k) => m.labels.forEach((l) => { const d = document.createElement("div"); d.className = this.opts.labelClass(l.cls); d.innerHTML = l.html; if (!l.city) { d.style.left = l.x + "px"; d.style.top = l.y + "px"; } root.appendChild(d); this.labelEls.push({ el: d, k, l }); })); }

    /* ---------- frame ---------- */
    private packEdges(dst: Float32Array, edges: number[][]) { dst.fill(0); edges.slice(0, 24).forEach((e, i) => { dst[i * 4] = e[0]; dst[i * 4 + 1] = e[1]; dst[i * 4 + 2] = e[2]; dst[i * 4 + 3] = e[3]; }); }
    private frame = (now: number) => {
        this.raf = requestAnimationFrame(this.frame); const gl = this.gl; if (!gl || this.ctxLost || document.hidden) { this.last = now; return; }
        const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000)); this.last = now; const time = Math.max(0, (now - this.t0) / 1000);
        const tgt = Math.max(0, Math.min(K - 1, Number.isFinite(this.target) ? this.target : 1));
        this.cur = this.reduced ? tgt : Math.max(0, Math.min(K - 1, this.cur + (tgt - this.cur) * Math.min(1, dt * 3.6))); if (Math.abs(tgt - this.cur) < 0.002) this.cur = tgt;
        if (!this.assembled && this.cur > 0.985) { this.assembled = true; this.opts.onAssembled?.(); }
        const kA = Math.min(K - 2, Math.floor(this.cur)), kB = kA + 1, t = this.cur - kA; const U = this.U;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[kA]); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ARRAY_BUFFER, this.bufs[kB]); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 0, 0);
        const mA = this.meta[kA], mB = this.meta[kB]; this.packEdges(this.edgeA, mA.edges); this.packEdges(this.edgeB, mB.edges);
        gl.uniform2f(U.uRes, this.W, this.H); gl.uniform1f(U.uT, t); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uDpr, this.DPR); gl.uniform1f(U.uSize, this.mobile() ? 1.35 : 1.5); gl.uniform1f(U.uReduced, this.reduced ? 1 : 0);
        const spin = Math.sin(time * 0.16) * 0.45 + Math.max(0, Math.min(1, this.cur - 1.5)) * 0.9; gl.uniform1f(U.uSpin, spin); gl.uniform1f(U.uBand, this.band);
        gl.uniform1f(U.uRadA, mA.rad); gl.uniform1f(U.uRadB, mB.rad); gl.uniform2f(U.uCenA, mA.cen[0], mA.cen[1]); gl.uniform2f(U.uCenB, mB.cen[0], mB.cen[1]);
        gl.uniform2f(U.uOffA, 0, mA.doc ? -scrollY : 0); gl.uniform2f(U.uOffB, 0, mB.doc ? -scrollY : 0);
        const near = Math.abs(this.cur - 1); gl.uniform2f(U.uMouse, this.mouse.x, this.mouse.y); gl.uniform1f(U.uMouseR, near < 0.5 ? 120 : 90); gl.uniform1f(U.uMouseK, near < 0.5 ? 70 : 24);
        gl.uniform4fv(U.uEdgeA, this.edgeA); gl.uniform4fv(U.uEdgeB, this.edgeB);
        gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.POINTS, 0, this.N);
        for (const L of this.labelEls) { const op = Math.max(0, 1 - Math.abs(this.cur - L.k) * 2.6); if (L.l.city) { const m = this.meta[2]; const p = sph(L.l.city[0], L.l.city[1], m.rad); const c = Math.cos(spin), s = Math.sin(spin); const x = p[0] * c + p[2] * s, z = -p[0] * s + p[2] * c; const ct = Math.cos(0.34), st = Math.sin(0.34); const y2 = p[1] * ct - z * st, z2 = p[1] * st + z * ct; const persp = 1 + z2 / (m.rad * 5); L.el.style.left = m.cen[0] + x * persp + 10 + "px"; L.el.style.top = m.cen[1] + y2 * persp + "px"; L.el.style.opacity = String(z2 > m.rad * 0.15 ? op : 0); } else L.el.style.opacity = String(op); }
        this.fpsAcc += dt; this.fpsN++; if (now - this.fpsT > 500) { this.stats.fps = this.fpsN / this.fpsAcc; this.stats.ms = (this.fpsAcc / this.fpsN) * 1000; this.fpsAcc = 0; this.fpsN = 0; this.fpsT = now; }
    };
}
