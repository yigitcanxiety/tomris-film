// Spray & mist: instanced soft sprites, fully stateless. Each slot re-emits every `life` seconds; its emission
// point/velocity come from the boat state at emission time (trail texture), so any boat track works.
// Young particles are drawn as ligaments (stretched back along their own path toward where they were a few
// hundredths of a second ago) that shorten into droplets as they age; torn sheet fragments at the spray root
// and jet plumes give the white water body; mist is lit with a strong forward-scattering lobe (golden rim
// against a low sun, cool sky light at blue hour). Plus the shutter streak and depth-of-field growth.
import * as THREE from "three";
import { wavesGLSL, waveUniforms, QUALITY } from "./waves.js";
import { TRAIL_TEX } from "./wake.js";
import { HULL_GLSL } from "./boat.js";

// type: 0 bow sheet droplets, 1 bow sheet mist, 2 jet wash droplets, 3 wake mist, 4 jet wash mist,
//       5 bow sheet fragments, 6 jet plume (rooster tail body)
const COUNTS = [9000, 4500, 4500, 700, 1100, 2600, 2000];   // x8 sub-frames in film quality

const vert = (sea) => /* glsl */ `
${wavesGLSL(sea)}
attribute vec4 aSeed;      // type, r1, r2, r3
attribute vec2 corner;
uniform float uTime; uniform mat4 uPrevView; uniform float uRootX; uniform float uTrimTan; uniform float uLift; uniform sampler2D uTrail; uniform float uTrailDt; uniform float uTrailN;
uniform float uStreak; uniform float uFocalPx; uniform float uFocus; uniform float uCocK; uniform float uSpeedF;
uniform vec3 uSunDir; uniform vec3 uSunIrr; uniform vec3 uSkyRad; uniform float uGain;
varying vec2 vQ; varying float vAlpha; varying vec3 vCol; varying float vLen; varying float vSoft; varying float vSeed;
float h1(float n){ return fract(sin(n * 12.9898) * 43758.5453); }
vec4 trailAt(float tau){ float f = clamp(tau / uTrailDt, 0.0, uTrailN - 1.001); float i = floor(f);
  vec4 a = texelFetch(uTrail, ivec2(int(i), 0), 0), b = texelFetch(uTrail, ivec2(int(i) + 1, 0), 0); return mix(a, b, f - i); }
${HULL_GLSL}
// position of this particle at absolute time t (emitted in the cycle that contains t)
void particle(float t, out vec3 pos, out vec3 vel, out float age, out float life, out float sizeM, out float a0, out float g) {
  float type = aSeed.x;
  life = type < 0.5 ? mix(0.35, 1.0, aSeed.y) : type < 1.5 ? mix(0.6, 1.4, aSeed.y) : type < 2.5 ? mix(0.45, 1.2, aSeed.y)
       : type < 3.5 ? mix(2.2, 3.8, aSeed.y) : type < 4.5 ? mix(1.2, 2.4, aSeed.y) : type < 5.5 ? mix(0.22, 0.5, aSeed.y) : mix(0.35, 0.8, aSeed.y);
  float ph = aSeed.z * life;
  float cyc = floor((t + ph) / life);
  float te = cyc * life - ph; age = t - te;
  float k = aSeed.w * 97.0 + cyc * 7.31;
  float r1 = h1(k), r2 = h1(k + 1.7), r3 = h1(k + 3.1), r4 = h1(k + 5.3), r5 = h1(k + 8.9);
  vec4 bs = trailAt(age + (uTime - t));                       // x, z, heading, speed at emission
  float c = cos(bs.z), s = sin(bs.z);
  vec3 fwd = vec3(c, 0.0, -s), stb = vec3(s, 0.0, c);
  float V = bs.w, side = r1 < 0.5 ? -1.0 : 1.0;
  vec3 lp, lv; float drag;
  if (type < 1.5 || (type > 4.5 && type < 5.5)) {   // bow chine sheets
    // spray root: forward end of the wetted bottom (~6.4 m at 4.2 deg trim); most water leaves there
    bool frag = type > 4.5;
    float x = uRootX - pow(r2, frag ? 2.4 : 1.6) * (uRootX - 0.3);
    float wly = -uLift - uTrimTan * x;               // planing waterline in the boat frame
    lp = vec3(x, 0.0, side * (beamAt(x, wly + 0.04) + 0.05));
    float fw = smoothstep(0.5, uRootX - 0.2, x);
    lv = vec3(-V * mix(0.86, 1.0, r3), (0.2 + 2.4 * fw * r4 * r4 + 2.6 * pow(fw, 6.0) * r4) , side * (1.5 + 7.5 * fw) * mix(0.55, 1.0, r5));
    if (frag) lv.y *= 0.8;
    drag = type < 0.5 ? 0.9 : frag ? 1.4 : 2.4;
    sizeM = type < 0.5 ? mix(0.003, 0.016, r3 * r3 * r3) : frag ? mix(0.05, 0.16, r3) : mix(0.12, 0.4, r3);
    a0 = (type < 0.5 ? 0.8 : frag ? 0.42 : 0.17) * mix(0.2, 1.0, fw);   // the sheet is born at the root; aft emission is mostly mist
  } else if (type < 2.5 || (type > 3.5 && type < 4.5) || type > 5.5) {   // waterjet wash / rooster tail
    float jz = (r1 < 0.5 ? -0.62 : 0.62) + (r2 - 0.5) * 0.7;
    lp = vec3(-0.3 - r3 * 1.4, -0.05, jz);
    bool plume = type > 5.5;
    lv = vec3(-V * mix(0.15, 0.45, r4), mix(0.8, 3.6, r5) * (0.3 + 0.7 * r2) * (plume ? 0.75 : 1.0), (r3 - 0.5) * (plume ? 2.4 : 3.5));
    drag = type < 2.5 ? 1.2 : plume ? 1.6 : 2.0;
    sizeM = type < 2.5 ? mix(0.004, 0.022, r3 * r3) : plume ? mix(0.12, 0.32, r4) : mix(0.35, 0.9, r4);
    a0 = type < 2.5 ? 0.5 : plume ? 0.3 : 0.08;
  } else {                                       // drifting mist over the wake
    lp = vec3(-r2 * 7.0 + 2.0 * r3, 0.1, (r4 - 0.5) * 4.5);
    lv = vec3(-V * 0.92, mix(0.1, 0.6, r5), (r4 - 0.5) * 2.0);
    drag = 2.0; sizeM = mix(0.8, 2.2, r3); a0 = 0.04;
  }
  vec3 bp = vec3(bs.x, 0.0, bs.y);
  vec3 wp = bp + fwd * lp.x + stb * lp.z;
  wp.y = seaHeightLong(wp.xz, te) + lp.y;
  vec3 wv = fwd * V + fwd * lv.x + stb * lv.z + vec3(0.0, lv.y, 0.0);
  float ex = exp(-drag * age), ed = (1.0 - ex) / drag, gk = 9.81 * (type > 2.5 && type < 3.5 ? 0.05 : 1.0);
  pos = wp + wv * ed;
  pos.y -= gk * (age - ed) / drag;
  vel = wv * ex; vel.y -= gk * (1.0 - ex) / drag;                 // analytic velocity: streak / ligament tails
  g = type < 0.5 || (type > 1.5 && type < 2.5) ? 0.75 : type > 4.5 ? 0.6 : 0.5;
}
void main(){
  vec3 p1, vel; float age, life, sizeM, a0, g;
  particle(uTime, p1, vel, age, life, sizeM, a0, g);
  float type = aSeed.x;
  bool mist = type > 0.5 && type < 1.5 || (type > 2.5 && type < 4.5);
  bool sheet = type > 4.5;
  // ligament: young droplets / fragments are stretched along their own path (sheet breaking into droplets)
  float lig = mist ? 0.0 : (sheet ? 0.07 : 0.045) * exp(-age / (sheet ? 0.25 : 0.12));
  lig = min(lig, age * 0.95);
  float st = min(uStreak, age * 0.95);
  // keep the spray outside the hull: the topsides flare out above the chine, so a sheet rising from the
  // waterline would otherwise end up inside the hull and get cut along the hull's depth
  {
    vec4 b0 = trailAt(0.0); vec3 f0 = vec3(cos(b0.z), 0.0, -sin(b0.z)), s0 = vec3(sin(b0.z), 0.0, cos(b0.z));
    vec3 rel = p1 - vec3(b0.x, 0.0, b0.y);
    float lx = dot(rel, f0), lz = dot(rel, s0), ly = p1.y - uLift - uTrimTan * lx;
    float bm = beamAt(lx, ly) + 0.04 + 0.6 * sizeM;
    if (lx > -0.2 && lx < 13.0 && abs(lz) < bm) p1 += s0 * (sign(lz + 1e-4) * bm - lz);
  }
  vec3 p0 = p1 - vel * st, pl = p1 - vel * lig;
  if (mist) sizeM *= mix(0.6, 1.8, age / life);
  if (sheet) sizeM *= mix(1.0, 0.45, age / life);                // fragments tear apart
  vec4 v1 = viewMatrix * vec4(p1, 1.0);
  // tail = where it was a shutter ago (seen by the camera of that moment) + the ligament length (seen now)
  vec3 tail = (uPrevView * vec4(p0, 1.0)).xyz + (viewMatrix * vec4(pl, 1.0)).xyz - v1.xyz;
  float z = max(-v1.z, 0.05);
  float px = sizeM * uFocalPx / z;
  float coc = uCocK * abs(1.0 - uFocus / z);
  float pxEff = sqrt(px * px + coc * coc + 1.2);
  float sizeEff = pxEff * z / uFocalPx;
  float energy = (px * px) / (pxEff * pxEff);
  vec2 dv = v1.xy - tail.xy; float len = length(dv);
  vec2 dir = len > 1e-5 ? dv / len : vec2(1.0, 0.0), perp = vec2(-dir.y, dir.x);
  vec2 mid = (v1.xy + tail.xy) * 0.5;
  float hl = len * 0.5;
  // pulled toward the camera by about its own size: a flat billboard that grazes the hull or the water would
  // otherwise be cut along a hard depth-intersection line (soft particles without a depth read)
  float pull = min(sizeEff * 1.3 + 0.03, z * 0.4);
  vec3 vpos = vec3(mid + dir * corner.x * (hl + sizeEff) + perp * corner.y * sizeEff, v1.z + pull);
  vpos.xy *= (z - pull) / z;                                       // same screen position and size
  vQ = vec2(corner.x * (hl / sizeEff + 1.0), corner.y); vLen = hl / sizeEff;
  // fade in/out, under water, low speed
  float water = seaHeightLong(p1.xz, uTime);
  float fade = smoothstep(0.0, 0.06, age / life) * (1.0 - smoothstep(0.6, 1.0, age / life)) * smoothstep(water - 0.35, water + 0.0, p1.y);
  // a ligament keeps its water: thinning with length, not fading as fast as a pure motion streak
  vAlpha = a0 * fade * energy * uSpeedF * uGain / (1.0 + vLen * (sheet ? 0.25 : 0.5));
  // lighting: forward scattering (Henyey-Greenstein) + sky; mist is optically thin, so its phase lobe dominates
  vec3 V = normalize(cameraPosition - p1);
  vec3 Ls = normalize(uSunDir);
  float ct = dot(-V, Ls);
  float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * ct, 1.5) / 12.566;
  float lamb = mist ? 0.12 : 0.24;
  vCol = uSunIrr * (lamb * max(Ls.y + 0.3, 0.0) + hg * (mist ? 2.2 : 1.0)) + uSkyRad * (mist ? 0.85 : 0.95);
  vSoft = mist ? 1.0 : sheet ? 2.0 : 0.0; vSeed = aSeed.w;
  gl_Position = projectionMatrix * vec4(vpos, 1.0);
  if (vAlpha < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;

const FRAG = /* glsl */ `
varying vec2 vQ; varying float vAlpha; varying vec3 vCol; varying float vLen; varying float vSoft; varying float vSeed;
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
void main(){
  float dx = max(abs(vQ.x) - vLen, 0.0);
  float d2 = dx * dx + vQ.y * vQ.y;
  float a = exp(-d2 * 3.0);
  // the quad border must be fully transparent whatever the noise does (no rectangular "barcode" sprites)
  float border = (1.0 - smoothstep(0.55, 1.0, abs(vQ.y))) * (1.0 - smoothstep(vLen + 0.55, vLen + 1.0, abs(vQ.x)));
  if (vSoft > 1.5) {            // torn sheet fragment: thin translucent water film, streaky along its path, ragged edges
    float n = vnoise(vec2(vQ.x * 0.7, vQ.y * 3.5) + vSeed * 41.0) * 0.65 + vnoise(vec2(vQ.x * 2.1, vQ.y * 7.0) - vSeed * 13.0) * 0.35;
    a = smoothstep(0.3, 0.7, n * exp(-d2 * 1.6)) * 0.75;
  } else if (vSoft > 0.5) a *= 0.45 + 0.9 * vnoise(vQ * 1.7 + vSeed * 31.0) * vnoise(vQ * 3.3 - vSeed * 17.0);
  a *= border;
  a *= vAlpha;
  if (a < 0.001) discard;
  gl_FragColor = vec4(vCol * a, a);              // premultiplied
}`;

export function createSpray(sea, trailTex) {
  const counts = COUNTS.map((c) => Math.round(c * QUALITY.sprayScale));
  const total = counts.reduce((a, b) => a + b, 0);
  const base = new THREE.PlaneGeometry(2, 2);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  const corners = new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]);
  geo.setAttribute("position", base.attributes.position);
  geo.setAttribute("corner", new THREE.BufferAttribute(corners, 2));
  const seeds = new Float32Array(total * 4); let o = 0, n = 0;
  counts.forEach((c, type) => { for (let i = 0; i < c; i++, n++) { const h = (x) => { const s = Math.sin(x) * 43758.5453; return s - Math.floor(s); };
    seeds.set([type, h(n * 1.13 + 0.1), h(n * 2.71 + 0.7), h(n * 0.37 + 4.2)], o); o += 4; } });
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
  geo.instanceCount = total;
  const uniforms = {
    ...waveUniforms(sea),
    uTime: { value: 0 }, uRootX: { value: 8 }, uTrimTan: { value: 0.045 }, uLift: { value: 0.1 }, uPrevView: { value: new THREE.Matrix4() }, uTrail: { value: trailTex }, uTrailDt: { value: TRAIL_TEX.dt }, uTrailN: { value: TRAIL_TEX.n },
    uStreak: { value: 1 / 120 }, uFocalPx: { value: 1000 }, uFocus: { value: 20 }, uCocK: { value: 0 }, uSpeedF: { value: 1 },
    uSunDir: { value: new THREE.Vector3() }, uSunIrr: { value: new THREE.Vector3() }, uSkyRad: { value: new THREE.Vector3() }, uGain: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, vertexShader: vert(sea), fragmentShader: FRAG, transparent: true, depthWrite: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; mesh.renderOrder = 10;
  return { mesh, uniforms };
}
