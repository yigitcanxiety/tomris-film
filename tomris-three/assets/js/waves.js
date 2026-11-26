// Sea state: one deterministic set of Gerstner waves shared by the GPU (ocean, spray) and the CPU (boat pose).
// No timeline knowledge: everything takes (x, z, t).
// Also home of the quality switch shared by ocean / spray / sky / post:
//   import { setQuality } from "./waves.js"; setQuality("realtime");  // before createEngine()
// or open the page with ?quality=realtime (or set globalThis.TOMRIS_QUALITY).
import * as THREE from "three";
const G = 9.81;

export const QUALITY_PRESETS = {
  // gridU/V: projected ocean grid (vertices across the frame / down it); tileA/B: fine-wave tile resolution;
  // shadow: sun shadow map size; refl: planar reflection scale; subframes: cap on motion-blur sub-frames
  film:     { name: "film",     nFine: 48, nCap: 24, gridU: 360, gridV: 240, tileA: 512, tileB: 256, sprayScale: 1.0,  foamDetail: 1, msaa: 0, bg4k: true,
              shadow: 2048, refl: 0.5, maxSub: 64 },
  realtime: { name: "realtime", nFine: 32, nCap: 16, gridU: 240, gridV: 160, tileA: 256, tileB: 128, sprayScale: 0.35, foamDetail: 0, msaa: 2, bg4k: false,
              shadow: 1024, refl: 0.33, maxSub: 1 },
};
export const QUALITY = { ...QUALITY_PRESETS.film };
export function setQuality(name) { Object.assign(QUALITY, QUALITY_PRESETS[name] || QUALITY_PRESETS.film); return QUALITY; }
try {
  const q = globalThis.TOMRIS_QUALITY || new URLSearchParams(globalThis.location?.search || "").get("quality");
  if (q) setQuality(q);
} catch (e) { /* no location (worker / node) */ }

function rng(seed) {            // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// lambdas from lmax down to lmin, amplitude from a steepness profile, directions spread around the wind.
// back > 0: that fraction of the waves runs against the wind (short waves come from everywhere).
function makeSet(n, lmax, lmin, steep, spread, windDir, seed, ampScale = 1, Q = 0.55, back = 0) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : i / (n - 1);
    const lambda = lmax * Math.pow(lmin / lmax, f) * (0.9 + 0.2 * r());
    const k = (2 * Math.PI) / lambda;
    let a = windDir + (r() * 2 - 1) * spread * (0.6 + 0.4 * f);
    if (r() < back) a += Math.PI;
    const s = steep * (0.75 + 0.5 * r());
    const A = (s / k) * ampScale;
    // capillary-gravity dispersion (matters below ~10 cm)
    out.push({ dx: Math.cos(a), dz: Math.sin(a), k, A, w: Math.sqrt(G * k + 7.4e-5 * k * k * k), ph: r() * Math.PI * 2, Q, lambda });
  }
  return out;
}

export function createSea({ windDir = 0.5, hs = 0.8, seed = 7 } = {}) {
  const amp = hs / 0.8;
  // geometric waves (vertex displacement) — sea state 3 (Hs ~0.8 m). The two long sets are what the hull and
  // camera follow (heightLong); the short set is short-crested (wide spread, two families) so crests break up.
  const geo = [
    ...makeSet(4, 90, 38, 0.030, 0.35, windDir, seed, amp),
    ...makeSet(6, 30, 9, 0.045, 0.6, windDir, seed + 1, amp),
    ...makeSet(6, 8, 2.6, 0.05, 1.25, windDir, seed + 2, amp, 0.5),
    ...makeSet(4, 5.5, 3.1, 0.04, 1.4, windDir + 0.5, seed + 5, amp, 0.5),
  ];
  // fine waves (per-pixel normals only). Total slope variance stays near Cox-Munk for ~6 m/s wind
  // (sigma^2 ~ 0.035): a rough sheet spreads sun glitter over the whole sea, which is the CG give-away.
  const fine = [
    ...makeSet(QUALITY.nFine, 2.6, 0.09, 0.028, 1.35, windDir, seed + 3, amp, 0.55, 0.12),
    ...makeSet(QUALITY.nCap, 0.09, 0.018, 0.024, 1.9, windDir, seed + 4, amp, 0.55, 0.3),
  ];
  const pack = (set) => {
    const A = new Float32Array(set.length * 4), B = new Float32Array(set.length * 4);
    set.forEach((w, i) => { A.set([w.dx, w.dz, w.k, w.A], i * 4); B.set([w.w, w.ph, w.Q, w.lambda], i * 4); });
    return { A, B, n: set.length };
  };
  const long = geo.filter((w) => w.lambda > 12);   // what a 13 m hull actually follows
  return {
    geo, fine, glsl: { geo: pack(geo), fine: pack(fine) }, wind: new THREE.Vector2(Math.cos(windDir), Math.sin(windDir)),
    // height of the undisplaced point (good enough for pose sampling)
    height(x, z, t, set = geo) {
      let h = 0;
      for (const w of set) h += w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
      return h;
    },
    heightLong(x, z, t) { return this.height(x, z, t, long); },
    // horizontal-compression Jacobian of the Gerstner field (< ~0.5 on breaking crests)
    jacobian(x, z, t) {
      let j = 1;
      for (const w of geo) j -= w.Q * w.k * w.A * Math.sin(w.k * (w.dx * x + w.dz * z) - w.w * t + w.ph);
      return j;
    },
  };
}

// GLSL: Gerstner displacement + analytic normal pieces. Arrays come in as uniforms; sizes follow the sea.
export function wavesGLSL(sea) {
  return /* glsl */ `
#define NGEO ${sea.geo.length}
#define NFINE ${sea.fine.length}
uniform vec4 uGeoA[NGEO]; uniform vec4 uGeoB[NGEO];
uniform vec4 uFineA[NFINE]; uniform vec4 uFineB[NFINE];
// displaced position offset; spacing = local grid spacing (fades waves the grid can't carry)
vec3 gerstner(vec2 p, float t, float spacing, float flatK) {
  vec3 o = vec3(0.0);
  for (int i = 0; i < NGEO; i++) {
    vec4 a = uGeoA[i]; vec4 b = uGeoB[i];
    float fade = 1.0 - smoothstep(b.w * 0.18, b.w * 0.4, spacing);
    float A = a.w * fade * flatK;
    float th = a.z * dot(a.xy, p) - b.x * t + b.y;
    float c = cos(th);
    o.xz += b.z * A * a.xy * c;
    o.y += A * sin(th);
  }
  return o;
}
float seaHeight(vec2 p, float t) {
  float h = 0.0;
  for (int i = 0; i < NGEO; i++) { vec4 a = uGeoA[i]; vec4 b = uGeoB[i]; h += a.w * sin(a.z * dot(a.xy, p) - b.x * t + b.y); }
  return h;
}
// Jacobian of the horizontal displacement: dips toward ~0.4 on steep, breaking crests
float seaJacobian(vec2 p, float t) {
  float j = 1.0;
  for (int i = 0; i < NGEO; i++) { vec4 a = uGeoA[i]; vec4 b = uGeoB[i]; j -= b.z * a.z * a.w * sin(a.z * dot(a.xy, p) - b.x * t + b.y); }
  return j;
}
// slope (dh/dx, dh/dz) of all waves at p, filtered by the pixel footprint fp; returns removed variance in .z
// flatK damps everything (wake slick), fineK scales only the fine waves (wind streaks / gusts)
vec3 seaSlope(vec2 p, float t, float fp, float flatK, float fineK) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < NGEO; i++) {
    vec4 a = uGeoA[i]; vec4 b = uGeoB[i];
    float keep = 1.0 - smoothstep(b.w * 0.25, b.w * 1.0, fp);
    float ka = a.z * a.w * flatK;
    float th = a.z * dot(a.xy, p) - b.x * t + b.y;
    s.xy += keep * ka * cos(th) * a.xy;
    s.z += (1.0 - keep) * ka * ka * 0.5;
  }
  float fk = mix(1.0, flatK, 0.6) * fineK;
  for (int i = 0; i < NFINE; i++) {
    vec4 a = uFineA[i]; vec4 b = uFineB[i];
    float keep = 1.0 - smoothstep(b.w * 0.125, b.w * 0.33, fp);     // >= 3-8 px per wavelength or it aliases
    float ka = a.z * a.w * fk;
    float th = a.z * dot(a.xy, p) - b.x * t + b.y;
    s.xy += keep * ka * cos(th) * a.xy;
    s.z += (1.0 - keep) * ka * ka * 0.5;
  }
  return s;
}
`;
}

export function waveUniforms(sea) {
  const g = sea.glsl.geo, f = sea.glsl.fine;
  const v4 = (arr) => { const out = []; for (let i = 0; i < arr.length; i += 4) out.push(new THREE.Vector4(arr[i], arr[i + 1], arr[i + 2], arr[i + 3])); return out; };
  return { uGeoA: { value: v4(g.A) }, uGeoB: { value: v4(g.B) }, uFineA: { value: v4(f.A) }, uFineB: { value: v4(f.B) } };
}
