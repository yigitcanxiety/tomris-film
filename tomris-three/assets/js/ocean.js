// Ocean. Geometry: a screen-projected grid (vertices only where the camera looks, a few pixels apart, extended
// below the frame to the nadir so low cameras never see holes, clamped at the horizon) displaced by Gerstner
// waves + wake waves; whitecaps (Gerstner Jacobian with a short foam memory) are evaluated per vertex.
// Shading: per-pixel slope = analytic long waves (footprint filtered) + two baked periodic fine-wave slope tiles
// (re-baked once per frame from the same wave table, mip-mapped together with |slope|^2 so every mip level knows
// the slope variance it averaged away -> GGX roughness; LEAN-style). Each tile is sampled twice at an
// incommensurate scale/rotation, so no tiling shows and the glitter breaks into sparkles near the camera and
// widens into a soft column toward the horizon instead of forming metal-sheet stripes. Wind streaks / gust
// patches modulate the fine waves; fresnel sky reflection (below-horizon facets see the sea); deep navy body with
// back-lit crest scatter; hull white water / jet wash / Kelvin arms / lacy old foam from the wake map; whitecaps;
// contact darkening; horizon haze. Foam noise comes from a baked periodic fbm texture (4 channels).
// State comes in through update(state) / bake(t); no timeline knowledge; everything is a function of t.
import * as THREE from "three";
import { wavesGLSL, waveUniforms, QUALITY } from "./waves.js";
import { SKY_GLSL } from "./sky.js";
import { WAKE } from "./wake.js";
import { HULL_GLSL } from "./boat.js";

const G = 9.81;

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
uniform mat4 uInvVP; uniform vec3 uCamPos; uniform vec4 uGrid; uniform vec3 uGrid2; uniform vec2 uStep; uniform float uMaxR; uniform float uCapTh;
varying vec3 vWorld; varying vec2 vP; varying float vLift; varying float vCap;
// uGrid = (ndc x min, x max, y min, y max); uGrid2 = (fraction of rows below the frame, how far toward the nadir, plane y)
vec3 ndcDir(vec2 n){ vec4 a = uInvVP * vec4(n, -1.0, 1.0); return normalize(a.xyz / a.w - uCamPos); }
vec3 gridDir(vec2 uv){
  float x = mix(uGrid.x, uGrid.y, uv.x);
  if (uv.y >= uGrid2.x) return ndcDir(vec2(x, mix(uGrid.z, uGrid.w, (uv.y - uGrid2.x) / (1.0 - uGrid2.x))));
  vec3 d0 = ndcDir(vec2(x, uGrid.z));
  float s = (1.0 - uv.y / uGrid2.x) * uGrid2.y;
  return normalize(mix(d0, vec3(0.0, -1.0, 0.0), s));
}
vec2 project(vec3 d){
  vec2 dh = d.xz / max(length(d.xz), 1e-6);
  if (d.y > -1e-5) return uCamPos.xz + dh * uMaxR;
  vec2 o = d.xz * ((uCamPos.y - uGrid2.z) / -d.y);
  float r = length(o);
  return uCamPos.xz + (r > uMaxR ? o / r * uMaxR : o);
}
void main(){
  vec2 uv = position.xy;
  vec2 p = project(gridDir(uv));
  float su = length(project(gridDir(uv + vec2(uStep.x, 0.0))) - p);
  float sv = length(project(gridDir(uv + vec2(0.0, uStep.y))) - p);
  float spacing = max(max(su, sv), 0.01);
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
  // whitecaps: crests where the Gerstner Jacobian folds; the foam stays with the water and fades over ~2 s
  float cap = 0.0;
  if (uCapTh > 0.0 && spacing < 6.0) {
    for (int i = 0; i < 4; i++) { float lag = float(i) * 0.6;
      cap = max(cap, smoothstep(uCapTh, uCapTh - 0.07, seaJacobian(p, uTime - lag)) * exp(-lag / 1.5)); }
  }
  vWorld = w; vP = p; vLift = lift; vCap = cap;
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
uniform float uCapGain; uniform float uSubsurf;
uniform sampler2D uFineTA; uniform sampler2D uFineTB; uniform float uLA; uniform float uLB; uniform sampler2D uNoise;
varying vec3 vWorld; varying vec2 vP; varying float vLift; varying float vCap;
float D_GGX(float NoH, float a){ float a2 = a * a; float d = NoH * NoH * (a2 - 1.0) + 1.0; return a2 / (3.14159 * d * d); }
float G1(float x, float a){ return 2.0 * x / (x + sqrt(a * a + (1.0 - a * a) * x * x)); }
// periodic 4-channel fbm (same statistics as fbm()), 16 units per tile
vec4 nT(vec2 p){ return texture(uNoise, p * 0.0625); }
// long (geometric) waves: analytic slope, footprint filtered; removed variance in .z
vec3 geoSlope(vec2 p, float t, float fp, float flatK) {
  vec3 s = vec3(0.0);
  for (int i = 0; i < NGEO; i++) {
    vec4 a = uGeoA[i]; vec4 b = uGeoB[i];
    float keep = 1.0 - smoothstep(b.w * 0.25, b.w * 1.0, fp);
    float ka = a.z * a.w * flatK;
    float th = a.z * dot(a.xy, p) - b.x * t + b.y;
    s.xy += keep * ka * cos(th) * a.xy;
    s.z += (1.0 - keep) * ka * ka * 0.5;
  }
  return s;
}
// baked fine waves: two looks into the same periodic tile (rotated 37 deg, scaled 1/0.73) -> slope + variance
const mat2 ROT = mat2(0.7986, 0.6018, -0.6018, 0.7986);
vec3 fineTile(sampler2D tx, vec2 p, float L){
  vec4 a = texture(tx, p / L);
  vec4 b = texture(tx, (ROT * p) / (L * 0.73) + 0.37);
  float va = max(a.z - dot(a.xy, a.xy), 0.0), vb = max(b.z - dot(b.xy, b.xy), 0.0);
  return vec3((a.xy + transpose(ROT) * b.xy) * 0.70711, 0.5 * (va + vb));
}
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
  float streakN = nT(vec2(q.x * 0.005, q.y * 0.05) + vec2(uTime * 0.004, 0.0)).r;
  float gustN = nT(vP * 0.011 + uWind * uTime * 0.04 + 11.0).g;
  float ruff = mix(0.5, 1.2, smoothstep(0.36, 0.62, streakN)) * mix(0.72, 1.25, smoothstep(0.32, 0.68, gustN));
  float calm = 1.0 - 0.55 * scar * uSpeedF;
  vec3 sl = geoSlope(vP, uTime, fp, calm);
  float fk = mix(1.0, calm, 0.6) * ruff;
  vec3 fa = fineTile(uFineTA, vP, uLA), fb = fineTile(uFineTB, vP, uLB);
  sl.xy += (fa.xy + fb.xy) * fk; sl.z += (fa.z + fb.z) * fk * fk;
  // wake / bow-wave slope via finite differences of the analytic wake height
  if (wk.w > 0.001) {
    float e = max(fp, 0.15);
    float h0 = wakeHeight(wk), hx = wakeHeight(wakeSample(vP + vec2(e, 0.0))), hz = wakeHeight(wakeSample(vP + vec2(0.0, e)));
    sl.xy += vec2(hx - h0, hz - h0) / e * uSpeedF;
  }
  vec3 N = normalize(vec3(-sl.x, 1.0, -sl.y));
  float subVar = 0.002 * ruff * ruff * calm;                                // capillaries below the smallest modelled wave
  float alpha = clamp(sqrt(0.0008 + subVar + sl.z), 0.03, 0.6);
  float NoV = max(dot(N, V), 0.001);
  float F = 0.02 + 0.98 * pow(1.0 - NoV, 5.0);
  vec3 L = normalize(uSunDir);
  // water body: deep navy upwelling lit by the (mostly de-saturated) sky; sun light scattered through the thin,
  // back-lit crests (subsurface tint: blue-green, not turquoise neon)
  float skyL = dot(uSkyRad, vec3(0.2126, 0.7152, 0.0722));
  vec3 skyN = mix(vec3(skyL), uSkyRad, 0.3);
  float crest = clamp((vWorld.y - vLift) * 1.6 + 0.25, 0.0, 1.6);
  float back = pow(max(dot(-V, normalize(vec3(L.x, 0.0, L.z))), 0.0), 3.0);
  float thin = pow(clamp(1.0 - N.y + 0.04, 0.0, 1.0), 0.5);                     // steep faces are thin enough to glow
  vec3 body = uDeep * (skyN + uSunIrr * 0.05 * max(L.y, 0.03))
            + uScatter * uSunIrr * 0.012 * uSubsurf * crest * (0.2 + 1.4 * back * thin);
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
  // sun glitter: GGX + Smith masking with the filtered (variance-carrying) roughness
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
  vec2 fw = vWorld.xz;
  float ww = 1.3 + 0.05 * wd;
  float washOld = exp(-pow(wy / (ww * 1.35), 2.0)) * wk.w * exp(-age / 18.0);
  float old = clamp(max(washOld * 0.85, armOld * 0.75) * sf, 0.0, 1.0);
  float cap = vCap * smoothstep(0.3, 0.6, gustN) * (1.0 - smoothstep(1.0, 4.0, fp)) * (1.0 - 0.8 * scar) * uCapGain;
  float opac = 0.0; vec3 foamCol = vec3(0.0);
  float washPre = wk.w * exp(-age / 6.0);
  if (max(max(bowBand, washPre), armF) * sf > 0.002 || old > 0.002 || cap > 0.002) {
    // jet wash: sharp-edged turbulent band, widening aft
    float edgeN = nT(fw * 0.8 + 3.7).b - 0.5;
    float washBand = (1.0 - smoothstep(ww * 0.78, ww * 1.05, wy + edgeN * (0.6 + 0.04 * wd))) * wk.w;
    float wash = washBand * exp(-age / 6.0) * smoothstep(-1.0, 0.3, wd);
    float fresh = clamp(max(max(bowBand, wash * 1.25), armF) * sf, 0.0, 1.0);
    // ---- foam texture ----
    vec2 wq = fw * 0.35 + nT(fw * 0.21 + 3.1).rg * 1.7;
    vec4 n1 = nT(wq * 2.2 + uTime * 0.06);
    float f1 = n1.b;
    float f2 = nT(wq * 7.5 - f1 * 2.0).a;
    float streak = nT(vec2(wk.y * 0.11, wk.x * 0.9) + f1 * 0.9).r;                // rooster-tail: streaks along the track
    float churn = clamp((0.5 * f1 + 0.25 * f2 + 0.45 * mix(f1, streak, wk.w) - 0.32) / 0.5, 0.0, 1.0);
    float Df = smoothstep(1.0 - fresh - 0.08, 1.0 - fresh + 0.14, churn);
    Df = max(Df, smoothstep(0.7, 1.0, fresh) * (0.8 + 0.2 * f2));
    float lw = 0.03 + 0.24 * old;                                                  // lace lines thicken with density
    float lace1 = 1.0, lace2 = 0.0;
    if (fp < 1.5 && (old > 0.01 || cap > 0.01)) {
      lace1 = 1.0 - smoothstep(lw * 0.5, lw, lace(wq * 2.6, uTime * 0.25));
      lace2 = 1.0 - smoothstep(lw * 0.35, lw * 0.85, lace(fw * 3.1 + f1 * 1.5, uTime * 0.4 + 2.0));
    }
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
    // foam: sun (wrapped) + sky, plus light that went through the bubbly layer toward a low sun behind it
    foamCol = 0.86 * (uSunIrr * (wrap * 0.34 + 0.06 * back) + skyF * 1.12 * (0.7 + 0.3 * Nf.y)) * bub;
    foamCol *= mix(1.0, ao, 0.7) * mix(0.8, 1.0, smoothstep(0.2, 0.9, D));          // thin foam is greyer
    // under thin foam you see aerated, blue-green water
    float aerK = smoothstep(0.0, 0.6, max(fresh, old * 0.8));
    col = mix(col, body + vec3(0.03, 0.12, 0.12) * (skyN + uSunIrr * 0.08), 0.55 * aerK * (1.0 - F));
    opac = clamp(D * (0.65 + 0.35 * smoothstep(0.2, 0.8, D)) * uFoamGain, 0.0, 1.0);
    col = mix(col, foamCol, opac);
  }
  col += spec * uSunIrr * (1.0 - opac);
  // horizon haze / aerial perspective
  float fog = 1.0 - exp(-dist / uFogDist);
  col = mix(col, hazeColor(-V), fog);
  gl_FragColor = vec4(col, 1.0);
}`;

// ---- fine-wave tiles: periodic (wave vectors snapped to the tile lattice), baked from the shared wave table ----
const BAKE_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const bakeFrag = (nfine, i0, i1) => /* glsl */ `
#define NFINE ${nfine}
uniform vec4 uFineA[NFINE]; uniform vec4 uLat[NFINE]; uniform float uT; uniform float uL; varying vec2 vUv;
void main(){
  vec2 x = vUv * uL; vec2 s = vec2(0.0);
  for (int i = ${i0}; i < ${i1}; i++) { vec4 l = uLat[i]; s += uFineA[i].w * cos(dot(l.xy, x) - l.z * uT + l.w) * l.xy; }
  gl_FragColor = vec4(s, dot(s, s), 1.0);
}`;

function snapLattice(waves, L, used) {
  return waves.map((w) => {
    let n = Math.round((L * w.k * w.dx) / (2 * Math.PI)), m = Math.round((L * w.k * w.dz) / (2 * Math.PI));
    for (let tries = 0; (used.has(n + "," + m) || (n === 0 && m === 0)) && tries < 8; tries++) { if (tries & 1) m += 1; else n += 1; }
    used.add(n + "," + m);
    const kx = (2 * Math.PI * n) / L, kz = (2 * Math.PI * m) / L, k = Math.hypot(kx, kz);
    return new THREE.Vector4(kx, kz, Math.sqrt(G * k + 7.4e-5 * k * k * k), w.ph);
  });
}

// periodic fbm noise, 4 independent channels, `cells` lattice cells per tile at the base octave
function makeNoiseTexture(N = 512, cells = 16) {
  const hash = (x, y, s) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const data = new Uint16Array(N * N * 4);
  const tmp = new Float32Array(N * N);
  for (let ch = 0; ch < 4; ch++) {
    tmp.fill(0);
    for (let o = 0, a = 0.5; o < 4; o++, a *= 0.5) {
      const per = cells << o, seed = ch * 17 + o * 5 + 1, step = per / N;
      for (let j = 0; j < N; j++) {
        const fy = j * step, iy = Math.floor(fy), ty = fy - iy, uy = ty * ty * (3 - 2 * ty), y0 = iy % per, y1 = (iy + 1) % per;
        for (let i = 0; i < N; i++) {
          const fx = i * step, ix = Math.floor(fx), tx = fx - ix, ux = tx * tx * (3 - 2 * tx), x0 = ix % per, x1 = (ix + 1) % per;
          const v = (hash(x0, y0, seed) * (1 - ux) + hash(x1, y0, seed) * ux) * (1 - uy) + (hash(x0, y1, seed) * (1 - ux) + hash(x1, y1, seed) * ux) * uy;
          tmp[j * N + i] += a * v;
        }
      }
    }
    for (let p = 0; p < N * N; p++) data[p * 4 + ch] = THREE.DataUtils.toHalfFloat(tmp[p]);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.colorSpace = THREE.NoColorSpace; tex.needsUpdate = true;
  return tex;
}

function gridGeometry(nu, nv) {
  const pos = new Float32Array(nu * nv * 3);
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const k = (j * nu + i) * 3; pos[k] = i / (nu - 1); pos[k + 1] = j / (nv - 1); }
  const idx = new Uint32Array((nu - 1) * (nv - 1) * 6); let o = 0;
  for (let j = 0; j < nv - 1; j++) for (let i = 0; i < nu - 1; i++) {
    const a = j * nu + i, b = a + 1, c = a + nu, d = c + 1;
    idx[o++] = a; idx[o++] = b; idx[o++] = c; idx[o++] = b; idx[o++] = d; idx[o++] = c;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}

export function createOcean(sea, skyShared, { renderer = null, maxR = 9000 } = {}) {
  const Q = QUALITY;
  const nu = Q.gridU ?? 360, nv = Q.gridV ?? 240, belowRows = 0.12;
  const LA = 16, LB = 1.0;
  const nFineA = Q.nFine, nFine = sea.fine.length;
  const uniforms = {
    ...waveUniforms(sea), ...skyShared,          // uSunDir / uSunIrr / uSkyRad come from skyShared (shared with the dome)
    uTime: { value: 0 }, uCamPos: { value: new THREE.Vector3() },
    uInvVP: { value: new THREE.Matrix4() }, uGrid: { value: new THREE.Vector4(-1.15, 1.15, -1, 1) }, uGrid2: { value: new THREE.Vector3(belowRows, 1, 0) },
    uStep: { value: new THREE.Vector2(1 / (nu - 1), 1 / (nv - 1)) }, uMaxR: { value: maxR },
    uBoatInv: { value: new THREE.Matrix4() }, uBoatWater: { value: 0 }, uSpeedF: { value: 1 }, uRootX: { value: 8 },
    uWakeMap: { value: null }, uWakeCenter: { value: new THREE.Vector2() }, uWakeExtent: { value: WAKE.extent },
    uSnow: { value: 0 }, uTnow: { value: 0 }, uWind: { value: sea.wind.clone() },
    uRefl: { value: null }, uReflMat: { value: new THREE.Matrix4() }, uDeep: { value: new THREE.Vector3(0.006, 0.018, 0.042) }, uScatter: { value: new THREE.Vector3(0.05, 0.2, 0.17) },
    uFogDist: { value: 2500 }, uFoamGain: { value: 1 }, uGlitter: { value: 1 }, uCapTh: { value: 0.855 }, uCapGain: { value: 1 }, uSubsurf: { value: 1 },
    uFineTA: { value: null }, uFineTB: { value: null }, uLA: { value: LA }, uLB: { value: LB }, uNoise: { value: makeNoiseTexture() },
  };
  for (const k of ["uSunDir", "uSunIrr", "uSkyRad"]) if (!uniforms[k]) uniforms[k] = { value: new THREE.Vector3() };
  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: vert(sea), fragmentShader: frag(sea) });
  const mesh = new THREE.Mesh(gridGeometry(nu, nv), mat);
  mesh.frustumCulled = false;

  // ---- fine-wave tiles ----
  const used = new Set();
  const lat = [...snapLattice(sea.fine.slice(0, nFineA), LA, used), ...snapLattice(sea.fine.slice(nFineA), LB, new Set())];
  const rtOpts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, wrapS: THREE.RepeatWrapping, wrapT: THREE.RepeatWrapping,
    minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: true, depthBuffer: false };
  const rtA = new THREE.WebGLRenderTarget(Q.tileA ?? 512, Q.tileA ?? 512, rtOpts);
  const rtB = new THREE.WebGLRenderTarget(Q.tileB ?? 256, Q.tileB ?? 256, rtOpts);
  uniforms.uFineTA.value = rtA.texture; uniforms.uFineTB.value = rtB.texture;
  const bakeU = (L) => ({ uFineA: uniforms.uFineA, uLat: { value: lat }, uT: { value: 0 }, uL: { value: L } });   // uFineA shared: sea-state scaling applies
  const matA = new THREE.ShaderMaterial({ uniforms: bakeU(LA), vertexShader: BAKE_VERT, fragmentShader: bakeFrag(nFine, 0, nFineA), depthTest: false, depthWrite: false });
  const matB = new THREE.ShaderMaterial({ uniforms: bakeU(LB), vertexShader: BAKE_VERT, fragmentShader: bakeFrag(nFine, nFineA, nFine), depthTest: false, depthWrite: false });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const bs = new THREE.Scene(); bs.add(quad); const bc = new THREE.Camera();
  let bakedKey = "";
  function bake(r, t) {
    const key = t + ":" + uniforms.uFineA.value.reduce((a, v) => a + v.w, 0);
    if (key === bakedKey || !r) return; bakedKey = key;
    const prev = r.getRenderTarget();
    for (const [m, rt] of [[matA, rtA], [matB, rtB]]) { m.uniforms.uT.value = t; quad.material = m; r.setRenderTarget(rt); r.render(bs, bc); }
    r.setRenderTarget(prev);
  }

  // ---- projected grid: per camera, before drawing ----
  const _m = new THREE.Matrix4(), _v = new THREE.Vector4(), _d = new THREE.Vector3();
  function onWater(cam, x, y) {          // does the ray through NDC (x, y) hit the sea within maxR?
    _v.set(x, y, -1, 1).applyMatrix4(_m); _d.set(_v.x / _v.w, _v.y / _v.w, _v.z / _v.w).sub(cam.position).normalize();
    if (_d.y > -1e-5) return false;
    const h = cam.position.y - uniforms.uGrid2.value.z;
    return (h / -_d.y) * Math.hypot(_d.x, _d.z) < maxR;
  }
  mesh.onBeforeRender = (r, scene, cam) => {
    _m.multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
    uniforms.uInvVP.value.copy(_m); uniforms.uCamPos.value.copy(cam.position);
    uniforms.uGrid2.value.z = Math.min(0, cam.position.y - 0.4);           // projection plane stays below the camera
    const g = uniforms.uGrid.value;
    let top = -1;
    for (const x of [g.x, 0, g.y]) {
      if (onWater(cam, x, 1.08)) { top = 1.08; break; }
      if (!onWater(cam, x, -1)) continue;
      let lo = -1, hi = 1.08;
      for (let k = 0; k < 18; k++) { const mid = 0.5 * (lo + hi); if (onWater(cam, x, mid)) lo = mid; else hi = mid; }
      top = Math.max(top, lo);
    }
    g.w = Math.min(1.08, top + 0.03); g.z = -1.04;
    // rows below the frame: reach toward the nadir only while the frame bottom is not already looking down steeply
    _v.set(0, -1, -1, 1).applyMatrix4(_m); _d.set(_v.x / _v.w, _v.y / _v.w, _v.z / _v.w).sub(cam.position).normalize();
    uniforms.uGrid2.value.y = THREE.MathUtils.clamp((1 + _d.y / 0.85) * 1.2, 0.05, 1.0);
  };

  function update(st) {
    const u = uniforms;
    u.uTime.value = st.time;
    u.uBoatInv.value.copy(st.boatInv); u.uBoatWater.value = st.boatWater; u.uSpeedF.value = st.speedF; u.uRootX.value = st.rootX;
    u.uWakeMap.value = st.wakeTex; u.uWakeCenter.value.copy(st.wakeCenter);
    u.uSnow.value = st.s; u.uTnow.value = st.time;
  }
  return { mesh, uniforms, update, bake };
}
