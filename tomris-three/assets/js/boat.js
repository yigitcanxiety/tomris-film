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
  uHold: { value: 0 }, uAoDirect: { value: 0.45 } };

// one builder for every opaque boat surface. kind: "paint" | "deck" | "plain"; opts: wet, seams, peel
function surface(name, params, { kind = "plain", wet = false, seams = false, peel = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ metalness: 0, ...params });
  m.name = name;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, boatShared);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform mat4 uBoatInv; varying vec3 vBoatP;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvBoatP = (uBoatInv * modelMatrix * vec4(transformed, 1.0)).xyz;");
    let f = sh.fragmentShader.replace("#include <common>", `#include <common>\nuniform float uWet, uHold, uAoDirect; varying vec3 vBoatP;\n${NOISE}`);
    if (kind !== "plain") {
      f = f.replace("#include <color_fragment>", `#include <color_fragment>
        // plate/panel cells: each panel has its own slight tone and sheen (paint applied per panel)
        vec2 cell = floor(vec2((vBoatP.x - 2.6) / 2.4, vBoatP.y / 0.9 + step(0.0, vBoatP.z) * 7.0));
        float pr = bh(vec3(cell, 3.1)), pr2 = bh(vec3(cell, 7.7));
        diffuseColor.rgb *= 0.985 + 0.03 * pr2 + 0.02 * (bn(vBoatP * 0.6) - 0.5);
        float sm = 0.0;
        ${seams ? "sm = seam(vBoatP.x, 2.4, 2.6, 0.006) * step(-0.3, vBoatP.y);" : ""}
        diffuseColor.rgb *= 1.0 - 0.28 * sm;
        ${kind === "deck" ? `float gfw = length(fwidth(vBoatP * 260.0)); float gk = 1.0 - smoothstep(0.4, 1.2, gfw);
        diffuseColor.rgb *= mix(1.0, 0.86 + 0.28 * bn(vBoatP * 260.0), gk);` : ""}`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor *= 0.93 + 0.14 * pr + 0.08 * (bn(vBoatP * 2.3) - 0.5);
        roughnessFactor = min(1.0, roughnessFactor + 0.25 * sm);
        ${wet ? `float wl = 0.32 + 0.10 * bn(vec3(vBoatP.x * 1.3, 0.0, vBoatP.z)) + 0.25 * smoothstep(5.0, 9.0, vBoatP.x) * bn(vBoatP * vec3(0.8, 3.0, 0.8));
        float wetk = (1.0 - smoothstep(wl - 0.06, wl + 0.06, vBoatP.y)) * uWet;
        roughnessFactor = mix(roughnessFactor, 0.12, wetk);` : "float wetk = 0.0;"}`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        {
          ${kind === "deck"
            ? "vec3 q = vBoatP * 260.0; float a = 0.00035 * (1.0 - smoothstep(0.4, 1.2, length(fwidth(q))));"
            : `vec3 q = vBoatP * 85.0; float a = ${peel.toFixed(6)} * (1.0 - smoothstep(0.35, 1.0, length(fwidth(q))));`}
          float hgt = a * (bn(q) + 0.5 * bn(q * 2.13 + 4.0));
          ${seams ? `{ // weld seam: shallow groove with a raised bead, faded out where it would alias
            float sx = abs(fract((vBoatP.x - 2.6) / 2.4 + 0.5) - 0.5) * 2.4;
            float ff = 1.0 - smoothstep(0.002, 0.006, length(fwidth(vBoatP)));
            float g = (1.0 - smoothstep(0.0, 0.007, sx)) * step(-0.3, vBoatP.y);
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
  m.customProgramCacheKey = () => `tomris-${kind}${wet ? "W" : ""}${seams ? "S" : ""}${peel}`;
  return m;
}

function flagMaterial(map) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.78, side: THREE.DoubleSide, name: "turkish_flag" });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, boatShared);
    // cloth: travelling waves along the fly with amplitude growing from the hoist, diagonal folds,
    // fly-end flutter, sag and fore-aft shortening where the cloth folds. Normal by finite differences.
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>
      uniform float uTime; uniform float uWind;
      const float FW = 0.84, FH = 0.56;
      float flagZ(float u, float v){
        float w = mix(7.0, 24.0, uWind), t = uTime;
        float A = mix(0.055, 0.04, uWind) * pow(u + 0.05, 1.2);
        float p1 = 6.2832 * 1.9 * u - w * t + 1.1 * v;                        // main travelling fold (~0.44 m)
        float p2 = 6.2832 * 3.3 * u - w * 1.33 * t - 2.2 * v + 1.3;           // secondary, slanted the other way
        float p3 = 6.2832 * 6.0 * u - w * 2.1 * t + 3.0 * v + 0.4;            // fly-end flutter
        float p4 = 6.2832 * 0.7 * v - w * 0.5 * t + 1.7 * u;                  // slow diagonal billow
        return A * (sin(p1) + 0.35 * sin(p2) + 0.18 * smoothstep(0.4, 1.0, u) * sin(p3)) + 0.012 * u * sin(p4); }`)
      .replace("#include <beginnormal_vertex>", `
        float fu = uv.x, fv = uv.y, e = 0.004;
        float dz = flagZ(fu, fv);
        float dzdu = (flagZ(fu + e, fv) - flagZ(fu - e, fv)) / (2.0 * e);
        float dzdv = (flagZ(fu, fv + e) - flagZ(fu, fv - e)) / (2.0 * e);
        // local frame: x = -u * FW (flies aft), y = v * FH
        vec3 objectNormal = normalize(vec3(dzdu / FW, -dzdv / FH, 1.0));`)
      .replace("#include <begin_vertex>", `vec3 transformed = vec3(position);
        transformed.z += dz;
        float ak = mix(0.055, 0.04, uWind) * 6.2832 * 1.9 / FW;
        transformed.x += FW * 0.22 * ak * ak * fu * fu;                              // cloth length taken up by the folds
        transformed.y -= (0.06 * (1.0 - uWind) + 0.012) * fu * fu * (1.0 - 0.5 * fv);   // slight sag of the fly`);
    // two-sided: light transmitted through the bunting when the sun is behind the flag; uHold keeps it red, not orange
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uHold;").replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        { float bl = max(-dot(normal, directionalLights[0].direction), 0.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * diffuseColor.rgb * directionalLights[0].color * bl * 0.55; }
      #endif
      { float l = dot(reflectedLight.directDiffuse, vec3(0.2126, 0.7152, 0.0722)) / max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 1e-3);
        reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, l * diffuseColor.rgb, 0.5 * uHold); }`);
  };
  m.customProgramCacheKey = () => "tomris-flag";
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
    hull_grey: surface("hull_grey", { color: 0x7c828a, roughness: 0.58, ...A }, { kind: "paint", wet: true, seams: true, peel: 0.00006 }),
    super_grey: surface("super_grey", { color: 0x80868d, roughness: 0.57, ...A }, { kind: "paint", peel: 0.00006 }),
    deck_antiskid: surface("deck_antiskid", { color: 0x6c7177, roughness: 0.86, ...A }, { kind: "deck" }),
    weapon_grey: surface("weapon_grey", { color: 0x6f747a, roughness: 0.55, ...A }, { kind: "paint", peel: 0.00004 }),
    missile_grey: surface("missile_grey", { color: 0x9a9fa4, roughness: 0.42, ...A }, { kind: "paint", peel: 0.00003 }),
    interior_grey: surface("interior_grey", { color: 0x26282b, roughness: 0.75, ...A }),
    rubrail_black: surface("rubrail_black", { color: 0x131416, roughness: 0.74, ...A }),
    gunmetal: surface("gunmetal", { color: 0x2a2c2f, roughness: 0.42, metalness: 0.55, ...A }),
    stainless: surface("stainless", { color: 0xc3c6ca, roughness: 0.24, metalness: 1, ...A }),
    waterjet_metal: surface("waterjet_metal", { color: 0x4a4d51, roughness: 0.48, metalness: 0.6, ...A }),
    dark_fittings: surface("dark_fittings", { color: 0x1b1c1e, roughness: 0.55, ...A }),
    halyard: surface("halyard", { color: 0x2a2a28, roughness: 0.85 }),
    letter_white: surface("letter_white", { color: 0xe4e5e2, roughness: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, ...A }),
    beacon_amber: new THREE.MeshPhysicalMaterial({ name: "beacon_amber", color: 0xb8761c, roughness: 0.18, clearcoat: 1, envMapIntensity: 1.2 }),
    glass_tinted: new THREE.MeshPhysicalMaterial({ name: "glass_tinted", color: 0x0b0d10, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.86, specularIntensity: 1, ior: 1.52, envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.02 }),
    seeker_glass: new THREE.MeshPhysicalMaterial({ name: "seeker_glass", color: 0x0a0e12, roughness: 0.03, clearcoat: 1, iridescence: 0.5, iridescenceIOR: 1.6, envMapIntensity: 1.4 }),
    sensor_lens: new THREE.MeshPhysicalMaterial({ name: "sensor_lens", color: 0x07060b, roughness: 0.03, clearcoat: 1, iridescence: 0.7, iridescenceIOR: 1.5, envMapIntensity: 1.5 }),
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
  const instr = new THREE.PointLight(new THREE.Color(0.55, 0.75, 1.0), 0, 2.2, 2);
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
  const trim = THREE.MathUtils.degToRad(2.6) * plan;
  const pitch = Math.atan2(hb - hs, 10) * (1 - 0.45 * plan) + trim;
  const roll = Math.atan2(hp - hst, 3.2) * 0.6 - THREE.MathUtils.clamp((st.yawRate || 0) * V * 0.05, -0.18, 0.18)
    + 0.006 * Math.sin(t * 2.3 + 1.1) * plan;                 // hull chatter at speed
  const lift = 0.1 * plan;
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
  boat.instr.intensity = 0.35 * night;
}
