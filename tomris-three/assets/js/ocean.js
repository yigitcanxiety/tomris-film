// Ocean: camera-centred radial grid displaced by Gerstner waves + wake waves; per-pixel analytic normals with
// wind streaks / gust patches modulating the fine waves, footprint-filtered roughness (glitter softens with
// distance), fresnel sky reflection (below-horizon facets see the sea, not the sky), GGX sun glitter with
// Smith masking, navy water body + backlit crest scatter, whitecaps from the Gerstner Jacobian, hull white
// water / jet wash / Kelvin arms / lacy old foam from the wake map, foam thickness + bubble shading,
// contact darkening at the hull, horizon haze. State comes in through update(state); no timeline knowledge.
import * as THREE from "three";
import { wavesGLSL, waveUniforms, QUALITY } from "./waves.js";
import { SKY_GLSL } from "./sky.js";
import { WAKE } from "./wake.js";
import { HULL_GLSL } from "./boat.js";

export const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash12(i), hash12(i+vec2(1,0)), u.x), mix(hash12(i+vec2(0,1)), hash12(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
// worley F2-F1: thin bright lines between cells -> lacy foam
float lace(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(x, y); vec2 o = hash22(i + g);
    o = 0.5 + 0.45 * sin(t + 6.2831 * o); float d = length(g + o - f); if (d < d1){ d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return d2 - d1; }
// worley F1: round cells -> bubbles
float cellF1(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){ vec2 g = vec2(x, y); d = min(d, length(g + hash22(i + g) - f)); }
  return d; }
`;

const OCEAN_GLSL_COMMON = /* glsl */ `
uniform float uTime; uniform mat4 uBoatInv; uniform float uBoatWater; uniform float uSpeedF; uniform float uRootX;
uniform sampler2D uWakeMap; uniform vec2 uWakeCenter; uniform float uWakeExtent; uniform float uSnow; uniform float uTnow;
const float ARM_TAN = ${WAKE.armTan.toFixed(5)};
${HULL_GLSL}
vec4 wakeSample(vec2 p){ vec2 uv = (p - uWakeCenter) / uWakeExtent + 0.5;
  vec4 w = texture(uWakeMap, uv); w.xyz /= max(w.w, 1e-4); w.w = smoothstep(0.2, 0.9, w.w);
  float edge = smoothstep(0.0, 0.04, min(min(uv.x, uv.y), min(1.0 - uv.x, 1.0 - uv.y)));
  w.w *= edge; return w; }
// wake surface height (m) from a wake sample
float wakeHeight(vec4 w){
  if (w.w <= 0.001) return 0.0;
  float d = max(uSnow - w.y, 0.0), age = max(uTnow - w.z, 0.0), y = abs(w.x);
  float wc = 1.4 + 0.055 * d;
  float mound = 0.2 * smoothstep(0.0, 3.0, d) * exp(-d / 7.0) * exp(-pow(y / (wc * 1.2), 2.0));
  float yA = 1.7 + ARM_TAN * (d + 7.5), q = yA - y;
  float arm = 0.22 * exp(-age / 12.0) * exp(-max(q, 0.0) / 4.0) * cos(q * 6.2831 / 5.0) * exp(min(q, 0.0) * 1.6) * smoothstep(-2.0, 0.0, q + 2.0);
  float cent = 0.08 * exp(-age / 10.0) * cos(d * 0.55) * exp(-pow(y / (wc * 1.6), 2.0));   // transverse waves
  return (mound + arm + cent) * w.w;
}
`;

const vert = (sea) => /* glsl */ `
${wavesGLSL(sea)}
${OCEAN_GLSL_COMMON}
uniform vec3 uCenter;
varying vec3 vWorld; varying vec2 vP; varying float vLift;
void main(){
  vec2 p = uCenter.xz + position.xz;
  float r = length(position.xz), spacing = max(r * 0.016, 0.03);
  vec3 lp = (uBoatInv * vec4(p.x, uBoatWater, p.y, 1.0)).xyz;
  float imm = immersion(lp.x, lp.y);
  float s = abs(lp.z) - beamAt(lp.x, lp.y);
  float inX = smoothstep(-1.5, 0.0, lp.x) * smoothstep(13.5, 11.5, lp.x);
  float inside = smoothstep(1.8, -0.2, abs(lp.z) - max(beamAt(lp.x, lp.y + 0.3), 0.6)) * inX;
  vec3 d = gerstner(p, uTime, spacing, 1.0 - 0.9 * inside);
  vec3 w = vec3(p.x + d.x, mix(d.y, uBoatWater, inside), p.y + d.z);
  // wake + hull bow wave (white water climbing the side, peeling off aft)
  vec4 wk = wakeSample(p);
  float lift = wakeHeight(wk) * uSpeedF;
  float bw = smoothstep(0.0, 0.25, imm) * smoothstep(-0.5, 1.5, lp.x) * exp(-max(s, 0.0) / 0.9);
  lift += 0.11 * bw * uSpeedF;
  w.y += lift;
  vWorld = w; vP = p; vLift = lift;
  gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
}`;

const frag = (sea) => /* glsl */ `
${wavesGLSL(sea)}
${OCEAN_GLSL_COMMON}
${SKY_GLSL}
${NOISE_GLSL}
#define FOAM_DETAIL ${QUALITY.foamDetail}
uniform vec3 uCamPos; uniform vec3 uSunDir; uniform vec3 uSunIrr; uniform vec3 uSkyRad; uniform vec2 uWind;
uniform sampler2D uRefl; uniform mat4 uReflMat; uniform vec3 uDeep; uniform vec3 uScatter; uniform float uFogDist; uniform float uFoamGain; uniform float uGlitter;
uniform float uCapTh;
varying vec3 vWorld; varying vec2 vP; varying float vLift;
float D_GGX(float NoH, float a){ float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
float G1(float x, float a){ return 2.0 * x / (x + sqrt(a * a + (1.0 - a * a) * x * x)); }
void main(){
  vec3 V = uCamPos - vWorld; float dist = length(V); V /= dist;
  vec2 dp = fwidth(vP); float fp = max(max(dp.x, dp.y), 0.002);
  vec3 lp = (uBoatInv * vec4(vWorld, 1.0)).xyz;
  float imm = immersion(lp.x, lp.y);
  float s = abs(lp.z) - beamAt(lp.x, lp.y);
  vec4 wk = wakeSample(vP);
  float wd = max(uSnow - wk.y, 0.0), age = max(uTnow - wk.z, 0.0), wy = abs(wk.x);
  float wc = 1.5 + 0.06 * wd;
  float scar = exp(-pow(wy / (wc * 1.5), 2.0)) * exp(-age / 30.0) * wk.w;
  // ---- multi-scale structure: wind streaks (long along the wind) and gust patches modulate the fine waves ----
  vec2 wn = vec2(-uWind.y, uWind.x);
  vec2 q = vec2(dot(vP, uWind), dot(vP, wn));
  float farK = smoothstep(3.0, 25.0, fp);                                   // beyond: noise would alias
  float streakN = fbm(vec2(q.x * 0.005, q.y * 0.05) + vec2(uTime * 0.004, 0.0));
  float gustN = fbm(vP * 0.011 + uWind * uTime * 0.04 + 11.0);
  float ruff = mix(0.42, 1.22, smoothstep(0.36, 0.62, streakN)) * mix(0.72, 1.28, smoothstep(0.32, 0.68, gustN));
  ruff = mix(ruff, 0.95, farK);
  float calm = 1.0 - 0.55 * scar * uSpeedF;
  vec3 sl = seaSlope(vP, uTime, fp, calm, ruff);
  // wake / bow-wave slope via finite differences of the analytic wake height
  float e = max(fp, 0.15);
  float h0 = wakeHeight(wk), hx = wakeHeight(wakeSample(vP + vec2(e, 0.0))), hz = wakeHeight(wakeSample(vP + vec2(0.0, e)));
  sl.xy += vec2(hx - h0, hz - h0) / e * uSpeedF;
  vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y));
  float subVar = 0.003 * ruff * ruff * calm;                                // capillaries below the smallest modelled wave
  float alpha = clamp(sqrt(0.0012 + subVar + sl.z), 0.035, 0.65);
  float NoV = max(dot(N, V), 0.001);
  float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
  vec3 L = normalize(uSunDir);
  // water body: navy upwelling lit by the (mostly de-saturated) sky, turquoise scatter in backlit crests
  float skyL = dot(uSkyRad, vec3(0.2126, 0.7152, 0.0722));
  vec3 skyN = mix(vec3(skyL), uSkyRad, 0.3);
  float crest = clamp(vWorld.y * 1.4 + 0.4, 0.0, 1.6);
  float back = pow(max(dot(-V, normalize(vec3(L.x, 0.0, L.z))), 0.0), 3.0);
  vec3 body = uDeep * (skyN + uSunIrr * 0.05 * max(L.y, 0.03)) + uScatter * uSunIrr * 0.01 * crest * (0.25 + back);
  body += vec3(0.02, 0.09, 0.085) * scar * (skyN + uSunIrr * 0.1) * uSpeedF * 0.6;     // aerated water under the wake
  // reflection: blur matches the GGX lobe; facets that reflect below the horizon see the next wave, not sky
  vec3 R = reflect(-V, N);
  float lod = clamp(log2(alpha / 0.0031), 0.0, 9.0);
  vec3 refl = skyRefl(R, lod);
  refl = mix(refl, body * 3.0 + hazeColor(R) * 0.12, smoothstep(0.01, -0.06, R.y));
  vec4 rc = uReflMat * vec4(vWorld.x, uBoatWater, vWorld.z, 1.0);
  vec4 br = texture(uRefl, rc.xy / rc.w + N.xz * 0.12);
  float boatHit = br.a * (1.0 - smoothstep(0.25, 0.6, alpha));
  refl = mix(refl, br.rgb / max(br.a, 1e-3), boatHit);
  // sun glitter: GGX + Smith masking, footprint-filtered alpha softens it toward the horizon
  vec3 H = normalize(L + V);
  float NoL = max(dot(N, L), 0.0), NoH = max(dot(N, H), 0.0), VoH = max(dot(V, H), 0.0);
  float Fs = 0.02 + 0.98 * pow(1.0 - VoH, 5.0);
  float spec = D_GGX(NoH, alpha) * Fs * G1(NoV, alpha) * G1(NoL, alpha) / (4.0 * NoV + 1e-3);
  spec *= smoothstep(-0.01, 0.02, L.y) * uGlitter * (1.0 - boatHit);   // the hull hides the sun's mirror image
  // contact darkening where the hull hides the sky
  float inX = smoothstep(-0.8, 0.5, lp.x) * smoothstep(0.0, 0.3, imm + 0.3);
  float ao = mix(1.0, mix(0.35, 1.0, smoothstep(-0.05, 1.6, s)), inX);
  vec3 col = mix(body, refl * ao, F) * mix(1.0, ao, 0.6);
  // ---- white water sources ----
  float sf = uSpeedF;
  // along the wetted hull: starts at the spray root (shallow immersion), widens aft, ends past the transom
  float bowBand = 0.0;
  if (lp.x < 0.0) { imm = lp.y - keelY(0.0); s = abs(lp.z) - beamAt(0.0, lp.y); }
  if (imm > -0.05 && lp.x > -10.0) {
    float root = smoothstep(-0.05, 0.1, imm);
    float aft = clamp(uRootX - lp.x, 0.0, 15.0);                       // metres behind the spray root
    float wb = 0.45 + 0.3 * aft;
    float sheet = exp(-max(s, 0.0) / wb);
    float rootLine = exp(-pow(max(s, 0.0) / 0.5, 2.0)) * (1.0 - smoothstep(0.0, 0.5, imm));
    float slz = 0.8 + 0.34 * aft, wl = 0.5 + 0.16 * aft;           // where the thrown sheet lands
    float landing = exp(-pow((s - slz) / wl, 2.0)) * smoothstep(0.2, 1.5, aft);
    bowBand = pow(max(max(sheet, rootLine), landing) * root * smoothstep(-10.0, -1.5, lp.x), 0.5);
  }
  float yA = 1.7 + ARM_TAN * (wd + 7.5);
  float armF = exp(-pow((wy - yA) / (0.8 + 0.05 * wd), 2.0)) * exp(-age / 3.5) * wk.w;
  float armOld = exp(-pow((wy - yA) / (1.4 + 0.09 * wd), 2.0)) * exp(-age / 14.0) * wk.w;
  // jet wash: sharp-edged turbulent band, widening aft
  vec2 fw = vWorld.xz;
  float ww = 1.3 + 0.05 * wd;
  float edgeN = fbm(fw * 0.8) - 0.5;
  float washBand = (1.0 - smoothstep(ww * 0.78, ww * 1.05, wy + edgeN * (0.6 + 0.04 * wd))) * wk.w;
  float wash = washBand * exp(-age / 6.0) * smoothstep(-1.0, 0.3, wd);
  float washOld = exp(-pow(wy / (ww * 1.35), 2.0)) * wk.w * exp(-age / 18.0);
  float fresh = clamp(max(max(bowBand, wash * 1.25), armF) * sf, 0.0, 1.0);
  float old = clamp(max(washOld * 0.85, armOld * 0.75) * sf, 0.0, 1.0);
  // whitecaps: crests where the Gerstner Jacobian folds; foam stays with the water and fades over ~2 s
  float cap = 0.0;
  if (fp < 4.0) {
    for (int i = 0; i < 4; i++) { float lag = float(i) * 0.6;
      cap = max(cap, smoothstep(uCapTh, uCapTh - 0.07, seaJacobian(vP, uTime - lag)) * exp(-lag / 1.5)); }
    cap *= smoothstep(0.3, 0.6, gustN) * (1.0 - smoothstep(1.0, 4.0, fp)) * (1.0 - 0.8 * scar);
  }
  // ---- foam texture ----
  vec2 wq = fw * 0.35 + vec2(fbm(fw * 0.21 + 3.1), fbm(fw * 0.21 - 7.7)) * 1.7;
  float f1 = fbm(wq * 2.2 + uTime * 0.06);
  float f2 = fbm(wq * 7.5 - f1 * 2.0);
  float streak = fbm(vec2(wk.y * 0.11, wk.x * 0.9) + f1 * 0.9);                // rooster-tail: streaks along the track
  float churn = clamp((0.5 * f1 + 0.25 * f2 + 0.45 * mix(f1, streak, wk.w) - 0.32) / 0.5, 0.0, 1.0);
  float Df = smoothstep(1.0 - fresh - 0.08, 1.0 - fresh + 0.14, churn);
  Df = max(Df, smoothstep(0.7, 1.0, fresh) * (0.8 + 0.2 * f2));
  float lw = 0.03 + 0.24 * old;                                                  // lace lines thicken with density
  float lace1 = 1.0 - smoothstep(lw * 0.5, lw, lace(wq * 2.6, uTime * 0.25));
  float lace2 = 1.0 - smoothstep(lw * 0.35, lw * 0.85, lace(fw * 3.1 + f1 * 1.5, uTime * 0.4 + 2.0));
  float Do = max(lace1, lace2 * 0.8) * smoothstep(0.02, 0.3, old) * smoothstep(0.3, 0.6, f1 + old * 0.35);
  float Dc = smoothstep(1.0 - cap, 1.0 - cap + 0.25, churn * 0.65 + lace1 * 0.45);
  float D = clamp(max(max(Df, Do * 0.85), Dc * 0.9), 0.0, 1.0);
  float cov = clamp(max(max(fresh * 0.85, old * 0.3), cap * 0.35), 0.0, 1.0);   // what D averages to from far away
  D = mix(D, cov, smoothstep(0.06, 0.4, fp));
  // close up: bubbles (bright cells, dark rims) and thickness (foam as a height field -> bump normal)
  float bub = 1.0;
#if FOAM_DETAIL
  float bk = 1.0 - smoothstep(0.006, 0.025, fp);
  if (bk > 0.0 && D > 0.02) {
    float b1 = cellF1(fw * 13.0), b2 = cellF1(fw * 34.0 + 5.3);
    bub = mix(1.0, 0.7 + 0.22 * smoothstep(0.1, 0.6, b1) + 0.16 * smoothstep(0.1, 0.55, b2), bk);
  }
#endif
  float fh = D * (0.55 + 0.45 * churn) * 0.07 + bub * 0.004;
  vec3 Nb = normalize(N + vec3(0.0, 1.5, 0.0));
  vec3 dpx = dFdx(vWorld), dpy = dFdy(vWorld);
  vec3 r1 = cross(dpy, Nb), r2 = cross(Nb, dpx); float det = dot(dpx, r1);
  vec3 Nf = normalize(abs(det) * Nb - sign(det) * (dFdx(fh) * r1 + dFdy(fh) * r2));
  float wrap = max(dot(Nf, L) * 0.8 + 0.2, 0.0);
  vec3 skyF = mix(uSkyRad, skyN, 0.5);
  vec3 foamCol = 0.86 * (uSunIrr * wrap * 0.34 + skyF * 1.12 * (0.7 + 0.3 * Nf.y)) * bub;
  foamCol *= mix(1.0, ao, 0.7) * mix(0.8, 1.0, smoothstep(0.2, 0.9, D));          // thin foam is greyer
  // under thin foam you see aerated, turquoise water
  float aerK = smoothstep(0.0, 0.6, max(fresh, old * 0.8));
  col = mix(col, body + vec3(0.03, 0.13, 0.12) * (skyN + uSunIrr * 0.08), 0.55 * aerK * (1.0 - F));
  float opac = clamp(D * (0.65 + 0.35 * smoothstep(0.2, 0.8, D)) * uFoamGain, 0.0, 1.0);
  col = mix(col, foamCol, opac);
  col += spec * uSunIrr * (1.0 - opac);
  // horizon haze / aerial perspective
  float fog = 1.0 - exp(-dist / uFogDist);
  col = mix(col, hazeColor(-V), fog);
  gl_FragColor = vec4(col, 1.0);
}`;

function radialGrid(rings, seg, r0, ratio) {
  const R = [0]; let r = r0; for (let i = 0; i < rings; i++) { R.push(r); r *= ratio; }
  const pos = new Float32Array(R.length * seg * 3);
  R.forEach((rr, i) => { for (let j = 0; j < seg; j++) { const a = (j / seg) * Math.PI * 2, k = (i * seg + j) * 3; pos[k] = Math.cos(a) * rr; pos[k + 2] = Math.sin(a) * rr; } });
  const idx = new Uint32Array((R.length - 1) * seg * 6); let o = 0;
  for (let i = 0; i < R.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = i * seg + j, b = i * seg + ((j + 1) % seg), c = a + seg, d = b + seg;
    idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = b; idx[o++] = d; idx[o++] = c;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function createOcean(sea, skyShared, { seg = QUALITY.oceanSeg, ratio = QUALITY.oceanRatio, maxR = 9000 } = {}) {
  const rings = Math.ceil(Math.log(maxR / 0.04) / Math.log(ratio));
  const uniforms = {
    ...waveUniforms(sea), ...skyShared,          // uSunDir / uSunIrr / uSkyRad come from skyShared (shared with the dome)
    uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uCamPos: { value: new THREE.Vector3() },
    uBoatInv: { value: new THREE.Matrix4() }, uBoatWater: { value: 0 }, uSpeedF: { value: 1 }, uRootX: { value: 8 },
    uWakeMap: { value: null }, uWakeCenter: { value: new THREE.Vector2() }, uWakeExtent: { value: WAKE.extent },
    uSnow: { value: 0 }, uTnow: { value: 0 }, uWind: { value: sea.wind.clone() },
    uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uDeep: { value: new THREE.Vector3(0.008, 0.024, 0.052) }, uScatter: { value: new THREE.Vector3(0.04, 0.2, 0.19) },
    uFogDist: { value: 2500 }, uFoamGain: { value: 1 }, uGlitter: { value: 1 }, uCapTh: { value: 0.855 },
  };
  for (const k of ["uSunDir", "uSunIrr", "uSkyRad"]) if (!uniforms[k]) uniforms[k] = { value: new THREE.Vector3() };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert(sea), fragmentShader: frag(sea) });
  const mesh = new THREE.Mesh(radialGrid(rings, seg, 0.04, ratio), mat);
  mesh.frustumCulled = false;
  function update(st) {
    const u = uniforms;
    u.uTime.value = st.time;
    u.uCenter.value.set(st.camPos.x, 0, st.camPos.z);
    u.uCamPos.value.copy(st.camPos);
    u.uBoatInv.value.copy(st.boatInv); u.uBoatWater.value = st.boatWater; u.uSpeedF.value = st.speedF; u.uRootX.value = st.rootX;
    u.uWakeMap.value = st.wakeTex; u.uWakeCenter.value.copy(st.wakeCenter);
    u.uSnow.value = st.s; u.uTnow.value = st.time;
  }
  return { mesh, uniforms, update };
}
