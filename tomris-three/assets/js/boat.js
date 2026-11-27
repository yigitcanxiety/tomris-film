// TOMRIS boat: GLB + baked AO atlas + PBR materials (naval matte paint with panel/roughness variation, seams,
// orange peel, non-skid, wet lower hull, glass, rubber, metals), shader-cloth flag with transmission,
// nav lights with COLREG arcs, instrument glow, and the pose function (waves + planing trim + bank).
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const NOISE = /* glsl */ `
float bh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bh(i), bh(i + vec3(1,0,0)), f.x), mix(bh(i + vec3(0,1,0)), bh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(bh(i + vec3(0,0,1)), bh(i + vec3(1,0,1)), f.x), mix(bh(i + vec3(0,1,1)), bh(i + vec3(1,1,1)), f.x), f.y), f.z); }
// bump from a world-space height (metres): un-normalised derivatives give the true slope at any distance
vec3 bumpN(vec3 sp, vec3 n, float h, float fd){
  vec3 sx = dFdx(sp), sy = dFdy(sp); vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1) * fd; vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g); }
// anti-aliased thin line at fract-periodic positions: returns coverage 0..1
float seam(float x, float period, float off, float w){
  float d = abs(fract((x - off) / period + 0.5) - 0.5) * period, fw = max(fwidth(x), 1e-5);
  return (1.0 - smoothstep(0.0, w * 0.5 + fw, d)) * min(1.0, w / fw); }
`;

// Hull lines (same numbers as tomris-blender/build.py): boat frame x fwd from transom, y up from DWL, z beam.
// beamAt(x, y) = half-breadth of the hull at height y; immersion(x, y) > 0 where that height is below the hull.
export const HULL_GLSL = /* glsl */ `
float keelY(float x){
  if (x < 4.5) return -0.70; if (x < 6.5) return mix(-0.70, -0.67, (x - 4.5) / 2.0);
  if (x < 8.5) return mix(-0.67, -0.57, (x - 6.5) / 2.0); if (x < 9.8) return mix(-0.57, -0.44, (x - 8.5) / 1.3);
  if (x < 10.8) return mix(-0.44, -0.27, (x - 9.8) / 1.0); if (x < 11.6) return mix(-0.27, 0.0, (x - 10.8) / 0.8);
  return mix(0.0, 1.73, (x - 11.6) / 1.4); }
vec2 chineZY(float x){ float t = clamp((x - 4.5) / 7.8, 0.0, 1.0); return vec2(1.62 * (1.0 - t * t), 0.02 + 0.845 * pow(t, 1.8)); }
float beamAt(float x, float y){
  if (x < 0.0 || x > 13.0) return 0.0;
  float k = keelY(x); vec2 c = chineZY(x);
  if (y <= k) return 0.0;
  float f = (y - k) / max(c.y - k, 1e-3);
  return f <= 1.0 ? f * c.x : c.x + (y - c.y) * 0.1; }
float immersion(float x, float y){ return (x < 0.0 || x > 12.5) ? -1.0 : y - keelY(x); }
`;

// shared uniforms: boat frame, wetness, time, wind; uHold keeps the grey paint reading grey under a saturated key;
// uAoDirect lets the baked AO also darken direct light a little (micro-occlusion in seams and under fittings)
export const boatShared = { uBoatInv: { value: new THREE.Matrix4() }, uWet: { value: 1 }, uTime: { value: 0 }, uWind: { value: 1 },
  uHold: { value: 0 }, uAoDirect: { value: 0.45 }, uFlagWB: { value: new THREE.Vector3(1, 1, 1) } };

// weld/plate seams in the boat frame (x fwd, y up, z stbd). Returns 0..1 seam coverage at boat point p,
// AA'd by the caller's footprint w; "hull": vertical butt welds every 2.4 m; "super": wheelhouse side plates.
const SEAMS = {
  hull: `float seamAt(vec3 p, float w){ float d = abs(fract((p.x - 2.6) / 2.4 + 0.5) - 0.5) * 2.4;
    return (1.0 - smoothstep(0.0, w, d)) * step(-0.3, p.y); }`,
  super: `float seamAt(vec3 p, float w){ float side = step(0.8, abs(p.z));
    float v = min(abs(p.x - 3.55), abs(p.x - 6.95)), h = abs(p.y - 2.86);
    float gv = (1.0 - smoothstep(0.0, w, v)) * step(1.3, p.y) * step(p.y, 2.95);
    float gh = (1.0 - smoothstep(0.0, w, h)) * step(3.0, p.x) * step(p.x, 7.0);
    return max(gv, gh) * side; }`,
};
// GLSL of build.py hb_sheer(): half-breadth at the sheer (for the non-skid margin along the bulwark)
const DECK_GLSL = `float hbSheer(float x){ if (x <= 5.5) return 1.66 + 0.04 * min(x, 1.0);
  float t = min((x - 5.5) / 7.5, 1.0); return 1.70 * (1.0 - pow(t, 2.2)); }`;

// one builder for every opaque boat surface. kind: "paint" | "deck" | "plain"; opts: wet, seams ("hull"|"super"), peel
function surface(name, params, { kind = "plain", wet = false, seams = "", peel = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ metalness: 0, ...params });
  m.name = name;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, boatShared);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform mat4 uBoatInv; varying vec3 vBoatP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvBoatP = (uBoatInv * modelMatrix * vec4(transformed, 1.0)).xyz;");
    let f = sh.fragmentShader.replace("#include <common>", `#include <common>\nuniform float uWet, uHold, uAoDirect; varying vec3 vBoatP;\n${NOISE}
      ${seams ? SEAMS[seams] : ""}\n${kind === "deck" ? DECK_GLSL : ""}`);
    if (kind !== "plain") {
      f = f.replace("#include <color_fragment>", `#include <color_fragment>
        // plate/panel cells: each panel has its own slight tone and sheen (paint applied per panel)
        vec2 cell = floor(vec2((vBoatP.x - 2.6) / 2.4, vBoatP.y / 0.9 + step(0.0, vBoatP.z) * 7.0));
        float pr = bh(vec3(cell, 3.1)), pr2 = bh(vec3(cell, 7.7));
        diffuseColor.rgb *= 0.985 + 0.03 * pr2 + 0.02 * (bn(vBoatP * 0.6) - 0.5);
        float pfw = length(fwidth(vBoatP));
        float sm = 0.0;
        ${seams ? "sm = seamAt(vBoatP, 0.006 + pfw) * min(1.0, 0.006 / max(pfw, 1e-5));" : ""}
        diffuseColor.rgb *= 1.0 - 0.28 * sm;
        float pad = 0.0;
        ${kind === "deck" ? `{ // non-skid pads with smooth painted margins: along the bulwark, a centre strip, a strip every 1.6 m,
          // and around every fitting / wall (where the baked AO says something stands close by)
          float edge = hbSheer(max(vBoatP.x, 0.0)) - 0.06 - abs(vBoatP.z);
          float sx = abs(fract((vBoatP.x - 0.4) / 1.6 + 0.5) - 0.5) * 1.6;
          pad = smoothstep(0.07, 0.10, edge) * smoothstep(0.022, 0.04, sx) * smoothstep(0.022, 0.04, abs(vBoatP.z));
          #ifdef USE_AOMAP
            pad *= smoothstep(0.70, 0.86, texture2D(aoMap, vAoMapUv).r);
          #endif
          float gfw = length(fwidth(vBoatP * 220.0)); float gk = 1.0 - smoothstep(0.4, 1.2, gfw);
          diffuseColor.rgb *= mix(1.04, 0.9 * mix(1.0, 0.84 + 0.3 * bn(vBoatP * 220.0), gk), pad); }` : ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor *= 0.93 + 0.14 * pr + 0.08 * (bn(vBoatP * 2.3) - 0.5);
        roughnessFactor = min(1.0, roughnessFactor + 0.25 * sm);
        ${kind === "deck" ? "roughnessFactor = mix(0.6, 0.96, pad);" : ""}
        ${wet ? `float wl = 0.32 + 0.10 * bn(vec3(vBoatP.x * 1.3, 0.0, vBoatP.z)) + 0.25 * smoothstep(5.0, 9.0, vBoatP.x) * bn(vBoatP * vec3(0.8, 3.0, 0.8));
        float wetk = (1.0 - smoothstep(wl - 0.06, wl + 0.06, vBoatP.y)) * uWet;
        roughnessFactor = mix(roughnessFactor, 0.12, wetk);` : "float wetk = 0.0;"}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          ${kind === "deck"
            ? "vec3 q = vBoatP * 220.0; float a = 0.0007 * pad * (1.0 - smoothstep(0.4, 1.2, length(fwidth(q))));"
            : `vec3 q = vBoatP * 85.0; float a = ${peel.toFixed(6)} * (1.0 - smoothstep(0.35, 1.0, length(fwidth(q))));`}
          float hgt = a * (bn(q) + 0.5 * bn(q * 2.13 + 4.0));
          // plated surfaces are never perfectly flat: very gentle large-scale waviness (~2 mm over ~0.5 m)
          hgt += 0.0022 * bn(vBoatP * 1.9 + 3.7);
          ${seams ? `{ // weld seam: shallow groove with a raised bead, faded out where it would alias
            float ff = 1.0 - smoothstep(0.002, 0.006, pfw);
            float g = seamAt(vBoatP, 0.007);
            hgt += ff * 0.0005 * (g - 1.6 * g * g * g); }` : ""}
          normal = bumpN(-vViewPosition, normal, hgt, faceDirection);
        }`)
      .replace("#include <lights_fragment_begin>", `${wet ? "diffuseColor.rgb *= mix(1.0, 0.62, wetk);" : ""}\n#include <lights_fragment_begin>`);
    }
    f = f.replace("#include <aomap_fragment>", `#include <aomap_fragment>
      #ifdef USE_AOMAP
        reflectedLight.directDiffuse *= mix(1.0, ambientOcclusion, uAoDirect);
        reflectedLight.directSpecular *= mix(1.0, ambientOcclusion, uAoDirect);
      #endif
      { float l = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722));
        reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, l * vec3(0.97, 1.0, 1.04), uHold);
        float li = dot(reflectedLight.indirectDiffuse, vec3(0.2126, 0.7152, 0.0722));
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, li * vec3(0.97, 1.0, 1.04), 0.6 * uHold); }`);
    sh.fragmentShader = f;
  };
  m.customProgramCacheKey = () => `tomris-${kind}${wet ? "W" : ""}${seams}${peel}`;
  return m;
}

// Turkish flag. Cloth: soft folds whose crests run diagonally from the hoist and travel to the fly; lazy and
// drooping at harbour speed, streaming with fly-end flutter at 35 kn (uWind). Deterministic in uTime.
// Shading: fine wrinkles + weave by normal perturbation, two-sided transmission, and the colour is held at
// flag red whatever the key light / white balance does (uFlagWB pre-compensates the grade's white balance).
function flagMaterial(map) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.82, side: THREE.DoubleSide, name: "turkish_flag" });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, boatShared);
    const CLOTH = `
      const float FW = 0.84, FH = 0.56;
      float gustK(){ return smoothstep(0.35, 0.95, uWind); }
      float flagZ(float u, float v){
        float g = gustK(), t = uTime;
        float w = mix(3.2, 14.0, g);                                         // rad/s: lazy roll .. streaming
        float A = mix(0.075, 0.042, g) * pow(smoothstep(0.0, 0.75, u), 0.8) * (0.45 + 0.55 * u);
        float p1 = 6.2832 * 1.25 * (u - 0.45 * v) - w * t;                    // main fold, crest slanted from the hoist
        float p2 = 6.2832 * 2.05 * (u + 0.25 * v) - w * 1.31 * t + 1.7;       // secondary, crossing slant
        float p3 = 6.2832 * 4.2 * (u - 0.2 * v) - w * 1.9 * t + 0.6;          // fly-end flutter (streaming only)
        return A * (sin(p1) + 0.38 * sin(p2) + 0.22 * g * smoothstep(0.45, 1.0, u) * sin(p3))
             + 0.02 * (1.0 - g) * u * sin(6.2832 * 0.55 * v - 0.9 * t + 2.0 * u); }`;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
      uniform float uTime; uniform float uWind;${CLOTH}`)
      .replace("#include <beginnormal_vertex>", `
        float fu = uv.x, fv = uv.y, e = 0.004;
        float dz = flagZ(fu, fv);
        float dzdu = (flagZ(fu + e, fv) - flagZ(fu - e, fv)) / (2.0 * e);
        float dzdv = (flagZ(fu, fv + e) - flagZ(fu, fv - e)) / (2.0 * e);
        // local frame: x = -u * FW (flies aft), y = v * FH
        vec3 objectNormal = normalize(vec3(dzdu / FW, -dzdv / FH, 1.0));`)
      .replace("#include <begin_vertex>", `vec3 transformed = vec3(position);
        float gk = gustK();
        transformed.z += dz;
        float ak = mix(0.075, 0.042, gk) * 6.2832 * 1.25 / FW;
        transformed.x += FW * 0.22 * ak * ak * fu * fu;                               // cloth taken up by the folds
        transformed.y -= (0.11 * (1.0 - gk) + 0.012) * fu * fu * (1.0 - 0.45 * fv);   // the fly droops when the wind is light
        transformed.x += 0.05 * (1.0 - gk) * fu * fu;`);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
      uniform float uHold, uTime, uWind; uniform vec3 uFlagWB;\n${NOISE}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
        // weave: fine crossing threads (~0.6 mm), only where a pixel is small enough to resolve them
        { vec2 th = vMapUv * vec2(FW_ * 1650.0, FH_ * 1650.0); float wf = 1.0 - smoothstep(0.3, 0.8, length(fwidth(th)));
          float wv = 0.5 + 0.5 * sin(th.x * 6.2832) * sin(th.y * 6.2832);
          diffuseColor.rgb *= mix(1.0, 0.9 + 0.1 * wv, wf); }`.replace(/FW_/g, "0.84").replace(/FH_/g, "0.56"))
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        { // fine wrinkles near the hoist and in the folds (metres), fading with distance
          vec2 q = vMapUv * vec2(0.84, 0.56);
          float wfw = length(fwidth(q * 30.0)); float wk = 1.0 - smoothstep(0.35, 0.9, wfw);
          float hw = 0.0005 * wk * ((bn(vec3(q * vec2(14.0, 24.0), uTime * 0.5)) - 0.5) + 0.5 * (bn(vec3(q * vec2(31.0, 47.0), 3.0)) - 0.5))
                   * (1.2 - 0.5 * vMapUv.x);
          normal = bumpN(-vViewPosition, normal, hw, faceDirection); }`)
      .replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        { // soft transmission through the bunting when the key is behind it
          float bl = max(-dot(normal, directionalLights[0].direction), 0.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * directionalLights[0].color * (0.18 + 0.5 * bl) * bl * 0.6; }
      #endif
      { // hold the flag's own colour: keep how much light arrives, drop the light's hue
        vec3 W = vec3(0.2126, 0.7152, 0.0722); float al = max(dot(diffuseColor.rgb, W), 1e-3);
        float ld = dot(reflectedLight.directDiffuse, W) / al, li = dot(reflectedLight.indirectDiffuse, W) / al;
        reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, ld * diffuseColor.rgb, 0.9);
        reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, li * diffuseColor.rgb, 0.9);
        // bunting has almost no sheen: a weak, neutral specular (a warm sun glint would turn the red salmon)
        reflectedLight.directSpecular = vec3(dot(reflectedLight.directSpecular, W)) * 0.35;
        reflectedLight.indirectSpecular = vec3(dot(reflectedLight.indirectSpecular, W)) * 0.5; }`)
      .replace("#include <opaque_fragment>", `outgoingLight *= uFlagWB;
        { // keep saturated bunting out of the tone curve's shoulder (where red would bleach toward orange/pink)
          float mx = max(outgoingLight.r, max(outgoingLight.g, outgoingLight.b));
          float sat = 1.0 - min(diffuseColor.g, diffuseColor.b) / max(diffuseColor.r, 1e-3);
          float K = 1.1; outgoingLight *= mix(1.0, K / max(K, mx), smoothstep(0.5, 0.9, sat)); }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => "tomris-flag4";
  return m;
}

// instrument displays: chart plotter (blue water, land, track), radar PPI, engine page
function screenTexture() {
  const c = document.createElement("canvas"); c.width = 768; c.height = 256; const g = c.getContext("2d");
  g.fillStyle = "#020306"; g.fillRect(0, 0, 768, 256);
  const pane = (x, fn) => { g.save(); g.translate(x + 8, 10); g.beginPath(); g.rect(0, 0, 240, 236); g.clip(); fn(); g.restore(); };
  pane(0, () => { g.fillStyle = "#0b2a48"; g.fillRect(0, 0, 240, 236); g.fillStyle = "#3a3a22";
    g.beginPath(); g.moveTo(0, 0); g.lineTo(150, 0); g.bezierCurveTo(120, 50, 60, 70, 0, 90); g.fill();
    g.strokeStyle = "#e07a1a"; g.lineWidth = 3; g.beginPath(); g.moveTo(40, 220); g.lineTo(120, 120); g.lineTo(200, 60); g.stroke();
    g.fillStyle = "#9fd3ff"; g.font = "16px monospace"; g.fillText("35.2 kn  284°", 10, 228); });
  pane(256, () => { g.fillStyle = "#010a04"; g.fillRect(0, 0, 240, 236); g.strokeStyle = "#1f8f3a"; g.lineWidth = 1.5;
    for (const r of [30, 60, 90, 112]) { g.beginPath(); g.arc(120, 118, r, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = "#3cff6a"; for (let i = 0; i < 40; i++) { const a = i * 2.39, r = 20 + (i * 37) % 90; g.fillRect(120 + Math.cos(a) * r, 118 + Math.sin(a) * r, 3, 2); } });
  pane(512, () => { g.fillStyle = "#06080c"; g.fillRect(0, 0, 240, 236); g.strokeStyle = "#e0a020"; g.lineWidth = 6;
    for (const [x, v] of [[60, 0.78], [180, 0.74]]) { g.beginPath(); g.arc(x, 90, 44, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * v)); g.stroke(); }
    g.fillStyle = "#cfd8e0"; g.font = "18px monospace"; g.fillText("2140 rpm  2150", 30, 190); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function planarUV(geo) {                                         // screen quads have atlas UVs; give them 0..1
  geo.computeBoundingBox(); const b = geo.boundingBox, s = new THREE.Vector3(); b.getSize(s);
  const ax = [0, 1, 2].sort((i, j) => s.getComponent(j) - s.getComponent(i));
  const p = geo.attributes.position, uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    uv[2 * i] = (p.getComponent(i, ax[0]) - b.min.getComponent(ax[0])) / s.getComponent(ax[0]);
    uv[2 * i + 1] = (p.getComponent(i, ax[1]) - b.min.getComponent(ax[1])) / s.getComponent(ax[1]);
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}

// nav lamp arcs (boat frame: x fwd, z starboard). Returns visibility 0..1 for a direction from lamp to viewer.
const D = Math.PI / 180;
const ARCS = {
  NavRed: (a) => sstep(-4 * D, 1 * D, a.port) * (1 - sstep(110 * D, 115 * D, a.port)),       // ahead to 22.5 deg abaft port beam
  NavGreen: (a) => sstep(-4 * D, 1 * D, a.stbd) * (1 - sstep(110 * D, 115 * D, a.stbd)),
  MastheadLens: (a) => 1 - sstep(110 * D, 115 * D, Math.abs(a.bow)),                          // 225 deg forward
  NavStern: (a) => sstep(110 * D, 115 * D, Math.abs(a.bow)),                                  // 135 deg aft
};
function sstep(a, b, x) { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); }

export async function loadBoat(url, renderer) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const root = gltf.scene.getObjectByName("TOMRIS");
  root.quaternion.identity(); root.position.set(0, 0, 0);
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const ao = await new THREE.TextureLoader().loadAsync(url.replace(/[^/]*$/, "boat/ao.jpg")).catch(() => null);
  if (ao) { ao.flipY = false; ao.colorSpace = THREE.NoColorSpace; ao.anisotropy = Math.min(8, aniso); }
  const A = ao ? { aoMap: ao, aoMapIntensity: 1 } : {};
  // albedo from master_varA: hull/sky ratio gives a slightly cool mid grey (sRGB ~ 124/130/138)
  const M = {
    hull_grey: surface("hull_grey", { color: 0x7c828a, roughness: 0.58, ...A }, { kind: "paint", wet: true, seams: "hull", peel: 0.00006 }),
    super_grey: surface("super_grey", { color: 0x80868d, roughness: 0.57, ...A }, { kind: "paint", seams: "super", peel: 0.00006 }),
    deck_antiskid: surface("deck_antiskid", { color: 0x6c7177, roughness: 0.86, ...A }, { kind: "deck" }),
    weapon_grey: surface("weapon_grey", { color: 0x6f747a, roughness: 0.55, ...A }, { kind: "paint", peel: 0.00004 }),
    missile_grey: surface("missile_grey", { color: 0x9a9fa4, roughness: 0.42, ...A }, { kind: "paint", peel: 0.00003 }),
    interior_grey: surface("interior_grey", { color: 0x3a3e43, roughness: 0.75, ...A }),
    rubrail_black: surface("rubrail_black", { color: 0x131416, roughness: 0.74, ...A }),
    gunmetal: surface("gunmetal", { color: 0x2a2c2f, roughness: 0.42, metalness: 0.55, ...A }),
    stainless: surface("stainless", { color: 0xc3c6ca, roughness: 0.24, metalness: 1, ...A }),
    waterjet_metal: surface("waterjet_metal", { color: 0x4a4d51, roughness: 0.48, metalness: 0.6, ...A }),
    dark_fittings: surface("dark_fittings", { color: 0x1b1c1e, roughness: 0.55, ...A }),
    halyard: surface("halyard", { color: 0x2a2a28, roughness: 0.85 }),
    letter_white: surface("letter_white", { color: 0xe4e5e2, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...A }),
    beacon_amber: new THREE.MeshPhysicalMaterial({ name: "beacon_amber", color: 0xb8761c, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.2 }),
    glass_tinted: new THREE.MeshPhysicalMaterial({ name: "glass_tinted", color: 0x0b0d10, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.64, specularIntensity: 1, ior: 1.52, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02 }),
    seeker_glass: new THREE.MeshPhysicalMaterial({ name: "seeker_glass", color: 0x0a0e12, roughness: 0.03, clearcoat: 1, iridescence: 0.5, iridescenceIOR: 1.6, envMapIntensity: 1.4 }),
    sensor_lens: new THREE.MeshPhysicalMaterial({ name: "sensor_lens", color: 0x07060b, roughness: 0.03, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.5, envMapIntensity: 1.5 }),
    led_green: new THREE.MeshStandardMaterial({ name: "led_green", color: 0x041a08, roughness: 0.3, emissive: 0x30ff70, emissiveIntensity: 0.6 }),
    led_amber: new THREE.MeshStandardMaterial({ name: "led_amber", color: 0x1a0c02, roughness: 0.3, emissive: 0xffa020, emissiveIntensity: 0.6 }),
    led_cabin: new THREE.MeshStandardMaterial({ name: "led_cabin", color: 0x101418, roughness: 0.4, emissive: 0x9fc8ff, emissiveIntensity: 0.2 }),
    screen_dim: new THREE.MeshStandardMaterial({ name: "screen_dim", color: 0x050608, roughness: 0.15, emissive: 0xffffff, emissiveMap: screenTexture(), emissiveIntensity: 0.05 }),
  };
  // lens colours: COLREG red, (bluish) green, LED white
  const LENS = { nav_red: [0x3a0603, [1, 0.06, 0.03]], nav_green: [0x032a14, [0.05, 1, 0.42]], nav_white: [0x8a8a86, [1, 0.94, 0.84]] };
  let flagMesh = null; const navMeshes = [], screens = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    const name = o.material.name;
    if (name === "turkish_flag") {
      const map = o.material.map; map.anisotropy = aniso; map.colorSpace = THREE.SRGBColorSpace;
      o.material = flagMaterial(map); flagMesh = o; o.frustumCulled = false;
    } else if (LENS[name]) {
      const [c, e] = LENS[name];                   // one material per lamp: each has its own visibility arc
      o.material = new THREE.MeshStandardMaterial({ name, color: c, roughness: 0.15, emissive: new THREE.Color(...e), emissiveIntensity: 2 });
      navMeshes.push(o); o.castShadow = false;
    } else if (M[name]) o.material = M[name];
    if (name === "screen_dim") { planarUV(o.geometry); screens.push(o); o.castShadow = false; }
    if (name === "glass_tinted") o.castShadow = false;
  });
  // nav lights: point light + glow sprite at each lamp, faded by the lamp's arc as seen from the camera
  const glowTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.15, "rgba(255,255,255,0.55)"); gr.addColorStop(0.5, "rgba(255,255,255,0.08)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  })();
  const lamps = [];
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const _v = new THREE.Vector3(), _c = new THREE.Vector3();
  for (const m of navMeshes) {
    const box = new THREE.Box3().setFromObject(m); const c = box.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    const col = m.material.emissive.clone();
    const light = new THREE.PointLight(col, 0, 6, 2); light.position.copy(c); root.add(light);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.position.copy(c); sp.scale.setScalar(0.45); root.add(sp);
    const arc = ARCS[Object.keys(ARCS).find((k) => m.name.startsWith(k))] || (() => 1);
    const lamp = { light, sprite: sp, mat: m.material, pos: c, arc, emit: 0, glow: 0 };
    const vis = (camera) => {                       // direction lamp -> camera in the boat frame
      _c.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(boatShared.uBoatInv.value).sub(c);
      const bow = Math.atan2(_c.z, _c.x);
      return arc({ bow, stbd: bow, port: -bow });
    };
    m.onBeforeRender = (r, s, camera) => { m.material.emissiveIntensity = lamp.emit * vis(camera); };
    sp.onBeforeRender = (r, s, camera) => { sp.material.opacity = lamp.glow * vis(camera); };
    lamps.push(lamp);
  }
  // faint cyan/amber glow of the instruments on the console and the cabin interior
  const instr = new THREE.PointLight(new THREE.Color(0.55, 0.75, 1.0), 0, 3.2, 2);
  instr.position.set(6.25, 2.15, 0); root.add(instr);
  const pivots = {};
  for (const n of ["gun_az", "gun_el", "launcher_el", "eoir_az", "eoir_el", "radar_spin", "flag_hoist", "jet_L", "jet_R", "spray_L", "spray_R"]) {
    const o = root.getObjectByName(n); if (o) pivots[n] = { obj: o, q0: o.quaternion.clone() };
  }
  return { root, pivots, lamps, materials: M, flagMesh, instr };
}

// ---- pose: pure function of boat state + sea + time ----
const KEEL = [[0, -0.7], [4.5, -0.7], [6.5, -0.67], [8.5, -0.57], [9.8, -0.44], [10.8, -0.27], [11.6, 0], [13, 1.73]];
function keelY(x) { for (let i = 1; i < KEEL.length; i++) if (x <= KEEL[i][0]) { const [x0, y0] = KEEL[i - 1], [x1, y1] = KEEL[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return 1.73; }
const _e = new THREE.Euler(0, 0, 0, "YZX");
export function boatPose(st, sea, t, out = {}) {
  const c = Math.cos(st.heading), s = Math.sin(st.heading);
  const at = (lx, lz) => sea.heightLong(st.x + c * lx + s * lz, st.z - s * lx + c * lz, t);
  const hb = at(10.5, 0), hs = at(0.5, 0), hp = at(5, -1.6), hst = at(5, 1.6), hm = at(5.5, 0);
  const V = st.speed;
  const plan = THREE.MathUtils.smoothstep(V, 4, 14);
  const water = (hb + hs + hp + hst + 2 * hm) / 6;
  // optional overrides (realtime play build: tomris-play/); the film never sets them, so its path is unchanged
  const trim = st.trim !== undefined ? st.trim : THREE.MathUtils.degToRad(2.6) * plan;
  const pitch = Math.atan2(hb - hs, 10) * (1 - 0.45 * plan) + trim;
  const roll = Math.atan2(hp - hst, 3.2) * 0.6 - (st.heel !== undefined ? -st.heel : THREE.MathUtils.clamp((st.yawRate || 0) * V * 0.05, -0.18, 0.18))
    + 0.006 * Math.sin(t * 2.3 + 1.1) * plan;                 // hull chatter at speed
  const lift = st.lift !== undefined ? st.lift : 0.1 * plan;
  const y = water + lift + 0.012 * Math.sin(t * 3.1) * plan;
  // spray root: forward end of the wetted bottom for this trim (where the waterline meets the keel)
  let root = 0; for (let x = 12; x > 0; x -= 0.05) if (-lift - x * Math.tan(trim) > keelY(x)) { root = x; break; }
  out.rootX = root; out.trimTan = Math.tan(trim); out.lift = lift;
  out.position = new THREE.Vector3(st.x, y, st.z);
  _e.set(roll, st.heading, pitch, "YZX");
  out.quaternion = new THREE.Quaternion().setFromEuler(_e);
  out.water = water; out.speedF = plan;
  return out;
}

export function applyBoat(boat, st, pose, t, look) {
  boat.root.position.copy(pose.position); boat.root.quaternion.copy(pose.quaternion);
  boat.root.updateMatrixWorld(true);
  boatShared.uBoatInv.value.copy(boat.root.matrixWorld).invert();
  boatShared.uTime.value = t;
  boatShared.uWind.value = THREE.MathUtils.clamp((st.speed + 4) / 20, 0, 1);
  // grey hold only under a strong, saturated key (sunset); none at blue hour
  boatShared.uHold.value = 0.62 * THREE.MathUtils.clamp((look.sunGain ?? 0) / 9, 0, 1);
  const r = boat.pivots.radar_spin; if (r) r.obj.quaternion.copy(r.q0).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), t * 2.5));
  for (const l of boat.lamps) {
    l.emit = look.navEmissive; l.light.intensity = look.navLight * 6;
    l.glow = look.navGlow; l.sprite.visible = look.navGlow > 0.01;
  }
  // instruments: off-looking by day, a faint glow once the key light is gone
  const night = THREE.MathUtils.clamp(1 - (look.sunGain ?? 0) / 3, 0, 1);
  boat.materials.screen_dim.emissiveIntensity = 0.05 + 0.9 * night;
  boat.instr.intensity = 0.25 + 0.9 * night;
  boat.materials.led_green.emissiveIntensity = boat.materials.led_amber.emissiveIntensity = 0.6 + 3.5 * night;
  boat.materials.led_cabin.emissiveIntensity = 0.15 + 0.9 * night;
  // flag: undo the grade's white balance on the flag only (keeps it flag-red at blue hour)
  const wb = look.wb || [1, 1, 1], c = wb.map((x) => 1 / x), n = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  boatShared.uFlagWB.value.set(...c.map((x) => THREE.MathUtils.lerp(1, x / n, 0.65)));
}
