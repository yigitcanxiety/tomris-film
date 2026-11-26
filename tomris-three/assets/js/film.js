// Film mode: the only module that knows the timeline. shots.json + the edit below -> stateAt(t) for the engine,
// plus the film-only dressing the engine does not own: props (harbour, coast, buoys), the studio floor and the
// wireframe. Everything is a pure function of t; side effects (visibility, pivots, sea amplitude) are re-applied
// from t on every call, so frames can be rendered in any order and chunked renders match a single pass.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { boatPose } from "./boat.js";

const D2R = Math.PI / 180, KN = 0.514444;
export const FPS = 30, TOTAL_FRAMES = 2100, DURATION = TOTAL_FRAMES / FPS;

// shots.json uses a midship origin; the GLB origin is the transom (x fwd, y up from DWL, z starboard)
const MID = 6.5;
// named points on the boat, GLB frame (node positions in tomris.glb)
const ANCHOR = {
  boat: [6.3, 1.3, 0], eoir: [4.37, 3.5, 0], flag: [2.6, 4.2, 0], stern: [0, 0.7, 0], bow: [12.6, 1.5, 0],
  gun: [9.8, 2.55, 0], launcher: [1.6, 2.1, 0], radar: [4.17, 4.25, 0], mast: [3.35, 4.5, 0], muzzle: [10.95, 2.7, -0.07],
  noses: [2.35, 2.75, 0], wheelhouse_glass: [5.3, 2.45, -1.2], hull_text: [1.41, 0.52, -1.7],
};

// ---------------------------------------------------------------------------------------------------------
// THE EDIT: director's changes on top of the validated shots.json (frame counts of the film stay 2100).
//  - opening overlay is 150 frames (0-150): #2 starts at 150; endcard is 210 frames (1890-2100): #57/#58 shortened
//  - no target beat: #40 #43 #51 become blue-hour beauty shots, #55 loses the lock, launcher stays stowed at sea
//  - explicit look-at points from the plan are re-aimed at the real geometry of tomris.glb (abs = GLB frame)
// ---------------------------------------------------------------------------------------------------------
const STOWED = [{ target: "launcher_el", fromDeg: 0, toDeg: 0 }];
const EDIT = {
  2: { startFrame: 150, frames: 75 },
  5: { target: "mast" },
  6: { target: "wheelhouse_glass" },
  8: { dist: 6.5 },
  13: { target: "hull_text" },
  16: { target: "radar" },
  28: { from: [13.1, 2.95, -2.3], to: [12.9, 2.95, -2.15], abs: true, target: "muzzle" },
  31: { from: [3.45, 3.65, -1.75], to: [3.4, 3.65, -1.65], abs: true, target: "noses",
        rack: [[2.45, 2.75, -0.23], [2.45, 2.75, 0.23]] },
  32: { anim: STOWED }, 34: { anim: STOWED }, 45: { anim: STOWED }, 53: { anim: STOWED, target: [2.0, 2.15, 0] },
  // #40 replaced: the wake from the masthead, flag and mast in the foreground
  40: { setup: "Ap", type: "detail", lens: 24, from: [2.2, 6.1, 0.7], to: [2.0, 6.15, 0.75], abs: true, target: [-40, 0, -2],
        ease: "easeOut", handheld: 0.05, speedKn: 35, headingDeg: 0, anim: [], flag: true, fstop: 0 },
  // #41/#42: turret and gun move as mechanical details only (no target), small arcs
  42: { anim: [{ target: "gun_az", fromDeg: 0, toDeg: -20 }] },
  // #43 replaced: 200 mm compression, the boat against the harbour cranes and coast lights astern
  43: { setup: "Ap", type: "drone", lens: 200, from: [175, 3.2, -16], to: [175, 3.4, -19], abs: true, target: [6.3, 2.2, 0],
        ease: "linear", handheld: 0.06, speedKn: 35, headingDeg: 0, anim: [], flag: true, fstop: 4 },
  // #44: stern chase, launcher stays down (it only rises in the studio)
  44: { anim: STOWED },
  // #51 replaced: radar array turning against the afterglow, from the wheelhouse roof
  51: { setup: "Ap", type: "detail", lens: 40, from: [6.6, 3.45, -1.05], to: [6.5, 3.42, -1.1], abs: true, target: "radar",
        ease: "linear", handheld: 0, speedKn: 35, headingDeg: 0, anim: [], flag: true, fstop: 2.8 },
  46: { dist: 6.5 },
  52: { target: "hull_text" },
  55: { anim: [{ target: "launcher_el", fromDeg: 0, toDeg: 0 }, { target: "gun_az", fromDeg: 0, toDeg: 0 }] },
  57: { frames: 75, anim: STOWED },
  58: { startFrame: 1830, frames: 60 },
};

// ---- looks (engine + post parameters) ----
export const LOOKS = {
  sunset: { sky: "sunset", exposure: 0.42, skyGain: 1, sunGain: 9, sunColor: [1.0, 0.62, 0.36], envGain: 1.4, keyGain: 1, fogDist: 2200, glitter: 1, bloom: 0.08, bloomThresh: 1.5,
    navEmissive: 2, navLight: 0.2, navGlow: 0.15, grain: 0.03, vignette: 0.32, sat: 1.0, contrast: 1.06,
    teal: [-0.014, 0.006, 0.02], orange: [0.035, 0.01, -0.03], lampGain: 0.25, fogDensity: 2.6e-4, fogTint: [1.0, 0.85, 0.75] },
  bluehour: { sky: "dusk", exposure: 0.36, wb: [0.7, 0.9, 1.35], skyGain: 1, sunGain: 0.0, envGain: 1, keyGain: 1, fogDist: 1800, glitter: 0, bloom: 0.14, bloomThresh: 1.0,
    navEmissive: 60, navLight: 0.6, navGlow: 1.0, grain: 0.04, vignette: 0.38, sat: 1.0, contrast: 1.06,
    teal: [-0.01, 0.006, 0.03], orange: [0.02, 0.005, -0.02], lampGain: 1.2, fogDensity: 2.2e-4, fogTint: [0.8, 0.9, 1.1] },
  studio: { sky: "sunset", exposure: 0.55, skyGain: 1, sunGain: 7, sunColor: [1.0, 0.95, 0.9], envGain: 0.05, keyGain: 1, fogDist: 2000, glitter: 0, bloom: 0.06, bloomThresh: 1.6,
    navEmissive: 0, navLight: 0, navGlow: 0, grain: 0.035, vignette: 0.5, sat: 0.95, contrast: 1.1,
    teal: [-0.01, 0.004, 0.016], orange: [0.02, 0.006, -0.016] },
  wireframe: { sky: "dusk", exposure: 1.0, skyGain: 1, sunGain: 6, sunColor: [1, 1, 1], envGain: 0.05, keyGain: 1, fogDist: 2000, glitter: 0, bloom: 0.3, bloomThresh: 0.55,
    navEmissive: 0, navLight: 0, navGlow: 0, grain: 0.03, vignette: 0.5, sat: 1.0, contrast: 1.05, teal: [0, 0, 0], orange: [0, 0, 0] },
};
const SETUP_LOOK = { B: "sunset", A: "sunset", Ap: "bluehour", C: "studio", W: "wireframe" };
const SEA_K = { B: 0.25, A: 1.0, Ap: 0.75, C: 0, W: 0 };     // multiplies the engine sea (built for Hs 0.8 m)
const STUDIO = new Set(["C", "W"]);
const STUDIO_KEY = { az: 315, elev: 38 };                  // single hard key from the port bow, high

// ---- small helpers ----
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const EASE = { linear: (x) => x, easeIn: (x) => x * x, easeOut: (x) => 1 - (1 - x) * (1 - x), easeInOut: smooth };
const lerp3 = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
const xyz = (p) => [p.x, p.y, p.z];
// deterministic handheld: incommensurate sines
const wob = (t, f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.3 + Math.sin(t * f * 5.13 + p * 0.3) * 0.1;

// normalise one shots.json entry (+ edit) into GLB-frame numbers
function normalise(s, setups) {
  const e = EDIT[s.n] || {};
  const c = s.camera || {}, b = s.boat || {};
  const abs = !!e.abs, mid = (p) => (abs ? p : [p.x + MID, p.y, p.z]);
  const f0 = e.startFrame ?? s.startFrame, frames = e.frames ?? s.frames;
  const setup = e.setup ?? s.setup;
  let target = e.target ?? c.lookAt;
  if (target && typeof target === "object" && !Array.isArray(target)) target = [target.x + MID, target.y, target.z];
  const sh = {
    n: s.n, kind: s.kind, f0, f1: f0 + frames, setup,
    type: e.type ?? c.type, lens: e.lens ?? s.lensMm,
    from: e.from ?? (c.from && mid(c.from)), to: e.to ?? (c.to && mid(c.to)), target,
    ease: EASE[e.ease ?? c.ease] || EASE.linear, hh: e.handheld ?? c.handheld ?? 0,
    fstop: e.fstop ?? c.fStop, focusOn: c.focusOn, rack: e.rack, rollDps: c.rollDegPerSec || 0,
    orbit: (e.type ?? c.type) === "orbit" && !e.from, screenOffset: c.screenOffset, dist: e.dist,
    v0: (e.speedKn ?? b.speedKn ?? 0) * KN, v1: (e.speedKn ?? b.speedToKn ?? b.speedKn ?? 0) * KN,
    heading: -(e.headingDeg ?? b.headingDeg ?? 0) * D2R,
    anim: e.anim ?? s.anim ?? [], flag: e.flag ?? s.flagVisible, look: SETUP_LOOK[setup], sea: SEA_K[setup],
    sun: STUDIO.has(setup) ? STUDIO_KEY : setups[setup] ? { az: setups[setup].sunAzimuthDeg, elev: setups[setup].sunElevationDeg } : null,
  };
  if (sh.kind === "3d" && sh.type !== "orbit") {
    // "moving camera always": a locked-off frame gets a slow 4 % push-in
    const d = Math.hypot(sh.to[0] - sh.from[0], sh.to[1] - sh.from[1], sh.to[2] - sh.from[2]);
    if (d < 0.05 && !sh.rollDps) { const T = anchorOf(sh, sh.from); sh.to = lerp3(sh.from, T, 0.04); }
  }
  return sh;
}
function anchorOf(sh, camLocal) {
  const t = sh.target;
  if (Array.isArray(t)) return t;
  if (t === "hull_text") return [ANCHOR.hull_text[0], ANCHOR.hull_text[1], Math.sign(camLocal[2] || -1) * 1.7];
  return ANCHOR[t] || ANCHOR.boat;
}

// ---------------------------------------------------------------------------------------------------------
export async function createFilm(engine, shotsJson, { base = "assets/" } = {}) {
  const { scene, boat, sea, ocean, spray, renderer, camera } = engine;
  const setups = shotsJson.setups;
  const SHOTS = shotsJson.shots.map((s) => normalise(s, setups)).sort((a, b) => a.f0 - b.f0);
  const SHOT3D = SHOTS.filter((s) => s.kind === "3d");
  camera.far = 20000;                                        // coast ridges reach 15.5 km

  // ---- sections: where the boat is in the world. B leaves the harbour (+z), A/Ap run in open sea (+x) ----
  // anchor odometer: every sea shot adds its distance; studio shots add nothing
  let SB = 0, SA = 0;
  for (const s of SHOT3D) {
    const d = ((s.v0 + s.v1) / 2) * (s.f1 - s.f0) / FPS;
    if (s.setup === "B") { s.section = "B"; s.S0 = SB; SB += d; }
    else if (STUDIO.has(s.setup)) { s.section = "S"; s.S0 = 0; }
    else { s.section = "A"; s.S0 = SA; SA += d; }
  }
  const B_START = 40;                                        // boat 40 m out of the harbour frame origin at #2
  const A_START = 1200;                                      // open sea: ~1.2 km past the origin (props.md)

  // ---- props (assets/props/*.glb), one group per section placement; distance haze through scene.fog ----
  const loader = new GLTFLoader();
  const load = (f) => loader.loadAsync(base + "props/" + f).then((g) => g.scene);
  const [harbour, coast, buoys] = await Promise.all([load("harbour.glb"), load("coast.glb"), load("buoy.glb")]);
  const props = new THREE.Group(); props.name = "film_props";
  harbour.position.set(-2000, 0, 0); harbour.rotation.y = Math.PI / 2;
  props.add(harbour, coast);
  // buoys: a gate the boat runs through in the top shot (#7); IALA A: red to starboard leaving harbour
  const red = buoys.getObjectByName("buoy_port_red"), green = buoys.getObjectByName("buoy_starboard_green");
  const s7 = SHOT3D.find((s) => s.n === 7) || SHOT3D[1];
  const gateX = B_START + s7.S0 + 0.5 * (s7.v0 + s7.v1) / 2 * (s7.f1 - s7.f0) / FPS + 9;
  red.position.set(gateX, 0, 13); green.position.set(gateX, 0, -13);
  props.add(red, green);
  const lampMats = [], buoyLamps = [];
  props.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = false; o.receiveShadow = false;
    for (const m of [].concat(o.material)) {
      if (/^light_/.test(m.name) && !lampMats.includes(m)) { m.userData.e0 = m.emissiveIntensity; lampMats.push(m); }
      if (/^light_buoy/.test(m.name)) buoyLamps.push(m);
    }
  });
  scene.add(props);
  const fog = new THREE.FogExp2(0x000000, 0); scene.fog = fog;
  const coastNear = coast.getObjectByName("coast_ridge_near");

  // ---- studio dressing: glossy black floor that mirrors the boat (engine's planar reflection) ----
  const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 96).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    uniforms: { uRefl: ocean.uniforms.uRefl, uReflMat: ocean.uniforms.uReflMat, uCtr: { value: new THREE.Vector2(6.3, 0) } },
    vertexShader: `varying vec3 vW; varying vec4 vR; uniform mat4 uReflMat;
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vR = uReflMat * w; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform sampler2D uRefl; uniform vec2 uCtr; varying vec3 vW; varying vec4 vR;
      void main(){
        vec4 r = texture2DProj(uRefl, vR);
        float d = length(vW.xz - uCtr);
        float pool = exp(-d * d / 180.0);
        vec3 c = r.rgb * r.a * 0.32 * (0.35 + 0.65 * pool) + vec3(0.010, 0.011, 0.013) * pool;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  floor.position.y = 0.0; floor.visible = false; floor.renderOrder = -1; scene.add(floor);

  // ---- wireframe: thin cyan edges on the real meshes, hidden-line removal by a depth-only ghost of the boat ----
  renderer.localClippingEnabled = true;
  const solidClip = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 1e6);   // keep x <= X (real materials)
  const ghostClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), -1e6);   // keep x >= X (depth ghost)
  const lineClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), 1e6);     // keep x >= Xw (lines)
  const boatMats = new Set();
  boat.root.traverse((o) => { if (o.isMesh) for (const m of [].concat(o.material)) boatMats.add(m); });
  for (const m of boatMats) { m.clippingPlanes = [solidClip]; m.needsUpdate = true; }
  const ghost = boat.root.clone(true);
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2, clippingPlanes: [ghostClip], side: THREE.DoubleSide });
  ghost.traverse((o) => { if (o.isMesh) o.material = depthMat; else if (o.isSprite || o.isLight) o.visible = false; });
  ghost.visible = false; scene.add(ghost);
  const lineMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.16, 0.78, 1.0).multiplyScalar(1.7), transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: [lineClip] });
  const lines = [];
  boat.root.traverse((o) => {
    if (!o.isMesh || o === boat.flagMesh || /^nav_|glass/.test(o.material.name || "")) return;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), lineMat);
    l.visible = false; l.raycast = () => {}; o.add(l); lines.push(l);
  });
  const ghostFlag = ghost.getObjectByName(boat.flagMesh?.name || "__none__"); if (ghostFlag) ghostFlag.visible = false;

  const dome = scene.children.find((o) => o.material && o.material.uniforms && o.material.uniforms.uSkyFull);

  // ---- sea amplitude per setup (scales the engine's wave set in place; CPU pose + GPU uniforms) ----
  const waveTables = [];
  if (sea && sea.geo) {
    const cpu = [...sea.geo, ...(sea.fine || [])];
    const A0 = cpu.map((w) => w.A);
    waveTables.push({ apply: (k) => cpu.forEach((w, i) => { w.A = A0[i] * k; }) });
    for (const u of [ocean.uniforms, spray && spray.uniforms]) {
      if (!u) continue;
      for (const key of ["uGeoA", "uFineA"]) {
        const arr = u[key] && u[key].value; if (!Array.isArray(arr)) continue;
        const a0 = arr.map((v) => v.w);
        waveTables.push({ apply: (k) => arr.forEach((v, i) => { v.w = a0[i] * k; }) });
      }
    }
  }
  let seaK = -1;
  const setSea = (k) => { if (k !== seaK) { seaK = k; waveTables.forEach((w) => w.apply(k)); } };

  // ---- per-shot boat kinematics: straight line at the shot heading, smoothstep speed ramp; the line extends
  //      backwards at the start speed, so the wake is fully formed at the first frame of every shot ----
  function boatAt(sh, t) {
    const t0 = sh.f0 / FPS, D = (sh.f1 - sh.f0) / FPS, tau = t - t0, u = tau / D;
    const I = u <= 0 ? 0 : u >= 1 ? 0.5 + (u - 1) : u * u * u - 0.5 * u * u * u * u;
    const s = sh.v0 * tau + (sh.v1 - sh.v0) * D * I;
    const v = sh.v0 + (sh.v1 - sh.v0) * smooth(u);
    let ax, az, dx, dz;
    if (sh.section === "B") { ax = 0; az = B_START + sh.S0; }            // B: harbour frame turned so its +x is world +z
    else if (sh.section === "A") { ax = A_START + sh.S0; az = 0; }
    else { ax = 0; az = 0; }
    dx = Math.cos(sh.heading); dz = -Math.sin(sh.heading);
    return { x: ax + dx * s, z: az + dz * s, heading: sh.heading, speed: v, yawRate: 0, s: sh.S0 + s, time: t };
  }

  function shotAtFrame(fr) { for (const s of SHOTS) if (fr >= s.f0 && fr < s.f1) return s; return null; }

  // ---- scene state for a shot (visibility, props placement, lamps, pivots, clipping) ----
  const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
  function dress(sh, t, u, look) {
    const studio = STUDIO.has(sh.setup), wire = sh.setup === "W";
    setSea(sh.sea);
    ocean.mesh.visible = !studio; if (spray && spray.mesh) spray.mesh.visible = !studio; if (dome) dome.visible = !studio;
    props.visible = !studio; floor.visible = sh.setup === "C";
    // props placement per section
    if (sh.section === "B") { props.rotation.y = -Math.PI / 2; props.position.set(0, 0, 0); coastNear.visible = true; }
    else { props.rotation.y = 0; props.position.set(0, 0, 0); coastNear.visible = true; }
    red.visible = green.visible = sh.section === "B";
    // haze colour follows the sky of the look
    const sky = engine.skies[look.sky];
    if (sky && sky.skyRad && !studio) {
      const k = (look.skyGain ?? 1), tint = look.fogTint || [1, 1, 1];
      fog.color.setRGB(sky.skyRad.x * k * tint[0], sky.skyRad.y * k * tint[1], sky.skyRad.z * k * tint[2], THREE.LinearSRGBColorSpace);
      fog.density = look.fogDensity ?? 2.5e-4;
    } else fog.density = 0;
    for (const m of lampMats) m.emissiveIntensity = m.userData.e0 * (look.lampGain ?? 0);
    for (const m of buoyLamps) {                                   // Fl R 3 s / Fl G 4 s
      const per = /red/.test(m.name) ? 3 : 4, ph = (t % per) / per;
      m.emissiveIntensity = m.userData.e0 * (look.lampGain ?? 0) * 3 * (ph < 0.17 ? 1 : 0.04);
    }
    // wireframe / solid / ghost
    let X = 1e6, Xw = 1e6, showLines = false, showGhost = false;
    if (wire) {
      showLines = true; showGhost = true;
      if (sh.n === 24) { X = -100; Xw = 13.6 - 15 * smooth(u / 0.8); }                 // drawn bow to stern
      else { Xw = -100; X = -1 + 15 * smooth((u - 0.3) / 0.62); }                       // solid sweeps in under the lines
    }
    solidClip.constant = X; ghostClip.constant = -X; lineClip.constant = -Xw;
    ghost.visible = showGhost; for (const l of lines) l.visible = showLines;
    if (boat.flagMesh) boat.flagMesh.visible = !!sh.flag && !wire;
    // pivots: rest pose, then this shot's animation (servo ease); az + = starboard (compass), el + = up
    for (const [name, p] of Object.entries(boat.pivots)) if (name !== "radar_spin" && !/^jet|^spray/.test(name)) p.obj.quaternion.copy(p.q0);
    for (const a of sh.anim) {
      const p = boat.pivots[a.target]; if (!p || a.target === "radar_spin") continue;
      const deg = a.fromDeg + (a.toDeg - a.fromDeg) * smooth(u);
      if (/_az$/.test(a.target)) _ax.set(0, 1, 0); else _ax.set(0, 0, 1);
      p.obj.quaternion.copy(p.q0).multiply(_q.setFromAxisAngle(_ax, (/_az$/.test(a.target) ? -deg : deg) * D2R));
    }
  }

  // ---- camera ----
  const tmpCam = new THREE.PerspectiveCamera();
  function cameraFor(sh, t, u, b, pose) {
    const c = Math.cos(b.heading), s = Math.sin(b.heading);
    const planar = (p) => new THREE.Vector3(b.x + c * p[0] + s * p[2], p[1], b.z - s * p[0] + c * p[2]);
    const rigid = (p) => new THREE.Vector3(...p).applyQuaternion(pose.quaternion).add(pose.position);
    const k = sh.ease(u);
    let local;
    if (sh.orbit) {                                            // orbit points lie on a circle around midship
      const a0 = Math.atan2(sh.from[2], sh.from[0] - MID), a1 = Math.atan2(sh.to[2], sh.to[0] - MID);
      const r0 = Math.hypot(sh.from[0] - MID, sh.from[2]), r1 = Math.hypot(sh.to[0] - MID, sh.to[2]);
      const a = a0 + (a1 - a0) * k, r = r0 + (r1 - r0) * k;
      local = [MID + r * Math.cos(a), sh.from[1] + (sh.to[1] - sh.from[1]) * k, r * Math.sin(a)];
    } else local = lerp3(sh.from, sh.to, k);
    const tgtLocal = anchorOf(sh, local);
    if (sh.dist) {                                             // pull the camera along its line to a set distance
      const d = [local[0] - tgtLocal[0], local[1] - tgtLocal[1], local[2] - tgtLocal[2]], L = Math.hypot(...d);
      local = [tgtLocal[0] + d[0] / L * sh.dist, tgtLocal[1] + d[1] / L * sh.dist, tgtLocal[2] + d[2] / L * sh.dist];
    }
    let pos, tgt;
    const heave = pose.position.y;
    if (sh.type === "detail") { pos = rigid(local); tgt = rigid(tgtLocal); }
    else {
      pos = planar(local); tgt = planar(tgtLocal); tgt.y += 0.6 * heave;
      if (sh.type === "chase") pos.y += 0.45 * sea.heightLong(pos.x, pos.z, t);
      if (sh.type === "waterline") {
        const h = sea.height(pos.x, pos.z, t);
        pos.y = Math.max(local[1] + 0.85 * h, h + 0.2);
      }
    }
    // focus
    let focusP = tgt;
    if (sh.rack) focusP = rigid(lerp3(sh.rack[0], sh.rack[1], smooth((u - 0.25) / 0.5)));
    const focus = pos.distanceTo(focusP);
    // screen offset (subject off-centre): swing the aim the other way
    const fwd = tgt.clone().sub(pos).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const upv = new THREE.Vector3().crossVectors(right, fwd);
    const dist = pos.distanceTo(tgt);
    const hfov2 = Math.atan(18 / sh.lens), vfov2 = Math.atan(18 / 2.39 / sh.lens);
    if (sh.screenOffset) {
      tgt.addScaledVector(right, -sh.screenOffset.x * Math.tan(hfov2) * dist);
      tgt.addScaledVector(upv, -sh.screenOffset.y * Math.tan(vfov2) * dist);
    }
    // handheld: angular jitter, scaled by the plan's handheld value (0.1 ~ a few tenths of a degree)
    let roll = 0;
    const hh = sh.hh + (sh.type === "drone" || sh.type === "orbit" ? 0.03 : 0.015);
    if (hh > 0) {
      const n = sh.n * 1.37;
      tgt.addScaledVector(right, dist * Math.tan(hh * 0.9 * D2R * wob(t, 1.1, n)));
      tgt.addScaledVector(upv, dist * Math.tan(hh * 0.7 * D2R * wob(t, 1.4, n + 2.1)));
      roll += hh * 0.5 * D2R * wob(t, 0.8, n + 4.2);
    }
    roll += sh.rollDps * D2R * (t - sh.f0 / FPS);
    // near-vertical views: keep the bow at the top of the frame (lookAt with world-up would spin)
    const f = tgt.clone().sub(pos).normalize();
    if (Math.abs(f.y) > 0.85) {
      tmpCam.position.copy(pos); tmpCam.up.set(0, 1, 0); tmpCam.lookAt(tgt); tmpCam.updateMatrixWorld();
      const xA = new THREE.Vector3().setFromMatrixColumn(tmpCam.matrixWorld, 0), yA = new THREE.Vector3().setFromMatrixColumn(tmpCam.matrixWorld, 1);
      const d = new THREE.Vector3(c, 0, -s); d.addScaledVector(f, -d.dot(f)).normalize();
      roll += Math.atan2(-d.dot(xA), d.dot(yA));
    }
    const fstop = sh.fstop ?? ({ detail: 2.8, chase: 4, waterline: 2.8, static: 4, drone: 0, orbit: 0 }[sh.type] ?? 0);
    return { pos, target: tgt, lensMm: sh.lens, fstop, roll, focus };
  }

  // ---- stateAt: t = sub-frame time, frameT = the frame it belongs to (sub-frames never cross a cut) ----
  function stateAt(t, frameT = t) {
    const sh = shotAtFrame(Math.round(frameT * FPS));
    if (!sh || sh.kind !== "3d") return null;
    const u = clamp01((t - sh.f0 / FPS) / ((sh.f1 - sh.f0) / FPS));
    const look = { ...LOOKS[sh.look], sunAz: sh.sun.az * D2R, sunElev: sh.sun.elev * D2R };
    // B: lamps come on in #5 (relay click), stay on afterwards
    if (sh.section === "B") {
      const on = sh.n > 5 ? 1 : sh.n === 5 ? (u > 0.35 ? 1 : 0) : 0;
      look.navEmissive = 2 + 14 * on; look.navGlow = 0.12 + 0.4 * on; look.navLight = 0.2 + 0.3 * on;
    }
    dress(sh, t, u, look);
    const b = boatAt(sh, t);
    const pose = boatPose(b, sea, t);
    return {
      time: t, boat: b, trail: (tau) => boatAt(sh, t - tau), look, shot: sh.n,
      camera: cameraFor(sh, t, u, b, pose),
    };
  }

  // one representative time per setup, for shader warm-up
  const warmTimes = [...new Set(SHOT3D.map((s) => s.setup))].map((k) => { const s = SHOT3D.find((x) => x.setup === k); return (s.f0 + 2) / FPS; });
  return { stateAt, shots: SHOTS, shotAtFrame, warmTimes };
}
