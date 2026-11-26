// TOMRIS engine: owns renderer, scene and modules. It knows nothing about the film timeline.
// Drive it with renderFrame(t, stateAt, opts):  stateAt(time) -> { time, boat, trail, camera, look }
//   boat   = { x, z, heading, speed, yawRate, s }      (s = odometer, metres along the track)
//   trail  = (tau) => boat state tau seconds ago        (film: analytic track; realtime: recorded history)
//   camera = { pos: Vector3, target: Vector3, lensMm, fstop, roll, focus? }
//   look   = { sky, sunAz, exposure, ... }              (see looks.js LOOKS)
// Film mode calls it from hf-seek with 5 sub-frames; a realtime loop calls it once per rAF with subframes = 1.
import * as THREE from "three";
import { createSea, setQuality, QUALITY } from "./waves.js";
import { loadSky, skyUniforms, createSkyDome } from "./sky.js";
import { createOcean } from "./ocean.js";
import { createWake, createTrailTexture } from "./wake.js";
import { createSpray } from "./spray.js";
import { loadBoat, boatPose, applyBoat } from "./boat.js";
import { createPost } from "./post.js";

const SENSOR_W = 36;

// quality: "film" (default; offline frames on any machine) | "realtime" (playable build on a real GPU at 60 fps:
// coarser ocean grid, smaller tiles / shadow / reflection, no foam micro-detail, fewer particles, one sub-frame).
// Omitted: keeps whatever waves.js already selected (?quality= in the page URL, globalThis.TOMRIS_QUALITY, else film).
export async function createEngine(canvas, { width = 1920, height = 804, base = "assets/", skies = {}, quality } = {}) {
  if (quality) setQuality(quality);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(1); renderer.setSize(width, height, false);
  renderer.autoClear = false;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;

  const sea = createSea({ windDir: 0.6, hs: 0.8 });
  const skyShared = skyUniforms();
  const loaded = {};
  for (const [k, url] of Object.entries(skies)) loaded[k] = await loadSky(base + url, renderer);
  const boat = await loadBoat(base + "tomris.glb", renderer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.2, 12000);
  scene.add(createSkyDome(skyShared));
  const ocean = createOcean(sea, skyShared, { renderer }); scene.add(ocean.mesh);
  scene.add(boat.root);
  const wake = createWake(renderer);
  const trailTex = createTrailTexture();
  const spray = createSpray(sea, trailTex.tex); scene.add(spray.mesh);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.castShadow = true; sun.shadow.mapSize.set(QUALITY.shadow, QUALITY.shadow); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 200 }); sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun, sun.target);
  const post = createPost(renderer, width, height, skyShared);

  // planar reflection of the boat (layer 1) in the mean water plane, sampled by the ocean with normal distortion
  boat.root.traverse((o) => o.layers.enable(1)); sun.layers.enable(1);
  const reflRT = new THREE.WebGLRenderTarget(Math.round(width * QUALITY.refl), Math.round(height * QUALITY.refl), { type: THREE.HalfFloatType, samples: QUALITY.msaa ? 2 : 0 });
  const reflCam = new THREE.PerspectiveCamera();
  reflCam.layers.set(1);
  const reflPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const reflMat = ocean.uniforms.uReflMat.value; ocean.uniforms.uRefl.value = reflRT.texture;
  const _rot = new THREE.Matrix4(), _look = new THREE.Vector3(), _bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  function renderReflection(h0) {
    const n = new THREE.Vector3(0, 1, 0);
    reflCam.position.copy(camera.position); reflCam.position.y = 2 * h0 - camera.position.y;
    _rot.extractRotation(camera.matrixWorld);
    _look.set(0, 0, -1).applyMatrix4(_rot).add(camera.position); _look.y = 2 * h0 - _look.y;
    reflCam.up.set(0, 1, 0).applyMatrix4(_rot).reflect(n);
    reflCam.lookAt(_look); reflCam.updateMatrixWorld();
    reflCam.projectionMatrix.copy(camera.projectionMatrix); reflCam.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
    reflMat.copy(_bias).multiply(reflCam.projectionMatrix).multiply(reflCam.matrixWorldInverse);
    reflPlane.constant = -h0 + 0.02;
    const prevClip = renderer.clippingPlanes, auto = renderer.shadowMap.autoUpdate;
    renderer.clippingPlanes = [reflPlane]; renderer.shadowMap.autoUpdate = false;
    renderer.setRenderTarget(reflRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, true, false);
    renderer.render(scene, reflCam);
    renderer.clippingPlanes = prevClip; renderer.shadowMap.autoUpdate = auto; renderer.setClearColor(0x000000, 1);
  }

  const v3 = new THREE.Vector3();
  function applyLook(look) {
    const sky = loaded[look.sky];
    const rot = look.sunAz - Math.atan2(sky.sunDirTex.z, sky.sunDirTex.x);    // world azimuth of the sun = texture azimuth + rot
    skyShared.uSkyFull.value = sky.full; skyShared.uSkyClamp.value = sky.clamp; skyShared.uSkyRot.value = rot; skyShared.uSkyGain.value = look.skyGain ?? 1;
    scene.environment = sky.env; scene.environmentRotation.set(0, -rot, 0); scene.environmentIntensity = (look.envGain ?? 1) * (look.skyGain ?? 1);
    const c = Math.cos(-rot), s = Math.sin(-rot), d = sky.sunDirTex;
    const sunDir = new THREE.Vector3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z).normalize();
    if (look.sunElev !== undefined) { const h = Math.hypot(sunDir.x, sunDir.z); sunDir.set(sunDir.x / h * Math.cos(look.sunElev), Math.sin(look.sunElev), sunDir.z / h * Math.cos(look.sunElev)); }
    const irr = new THREE.Vector3(...(look.sunColor || [1, 0.7, 0.45])).multiplyScalar(look.sunGain ?? 0);
    const skyRad = sky.skyRad.clone().multiplyScalar(look.skyGain ?? 1);
    for (const u of [ocean.uniforms, spray.uniforms]) { u.uSunDir.value.copy(sunDir); u.uSunIrr.value.copy(irr); u.uSkyRad.value.copy(skyRad); }
    const m = Math.max(irr.x, irr.y, irr.z, 1e-6);
    sun.color.setRGB(irr.x / m, irr.y / m, irr.z / m, THREE.LinearSRGBColorSpace); sun.intensity = m * (look.keyGain ?? 1);
    ocean.uniforms.uFogDist.value = look.fogDist ?? 2500; ocean.uniforms.uGlitter.value = look.glitter ?? 1;
    ocean.uniforms.uFoamGain.value = look.foamGain ?? 1; ocean.uniforms.uCapGain.value = look.capGain ?? 1; ocean.uniforms.uSubsurf.value = look.subsurf ?? 1; spray.uniforms.uGain.value = look.sprayGain ?? 1;
    ocean.uniforms.uDeep.value.set(...(look.deep || [0.009, 0.026, 0.055]));      // always set: frames render out of order
    return sunDir;
  }

  const prevCam = new THREE.PerspectiveCamera();
  function aimCamera(c, cam) {
    c.position.copy(cam.pos); c.up.set(0, 1, 0); c.lookAt(cam.target);
    if (cam.roll) c.rotateZ(cam.roll);
    c.updateMatrixWorld();
  }
  function setup(st, shutterSub, prevSt, tFrame) {
    const look = st.look, b = st.boat, t = st.time;
    const sunDir = applyLook(look);
    const pose = boatPose(b, sea, t);
    applyBoat(boat, b, pose, t, look);
    // camera
    const cam = st.camera;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan((SENSOR_W / camera.aspect) / (2 * cam.lensMm)));
    aimCamera(camera, cam); camera.updateProjectionMatrix();
    aimCamera(prevCam, (prevSt || st).camera);
    const focus = cam.focus ?? cam.pos.distanceTo(cam.target);
    const f = cam.lensMm, S = Math.max(focus * 1000, f * 1.5);
    const cocK = cam.fstop ? (f * f) / (cam.fstop * (S - f)) / SENSOR_W * width : 0;
    // shadows follow the boat
    const ctr = v3.set(5.5, 1.5, 0).applyMatrix4(boat.root.matrixWorld);
    sun.target.position.copy(ctr); sun.position.copy(ctr).addScaledVector(sunDir.y > 0.02 ? sunDir : new THREE.Vector3(sunDir.x, 0.02, sunDir.z).normalize(), 80);
    sun.target.updateMatrixWorld(); sun.updateMatrixWorld();
    // wake & trail
    wake.update(st.trail, b);
    trailTex.update(st.trail);
    ocean.bake(renderer, tFrame ?? t);                // fine-wave tiles: once per frame (not per sub-frame)
    ocean.update({ time: t, camPos: camera.position, boatInv: new THREE.Matrix4().copy(boat.root.matrixWorld).invert(), boatWater: pose.water,
      speedF: pose.speedF, rootX: pose.rootX, wakeTex: wake.rt.texture, wakeCenter: wake.center, s: b.s });
    renderReflection(pose.water);
    const su = spray.uniforms;
    su.uTime.value = t; su.uRootX.value = pose.rootX; su.uTrimTan.value = pose.trimTan; su.uLift.value = pose.lift; su.uStreak.value = shutterSub; su.uPrevView.value.copy(prevCam.matrixWorldInverse); su.uSpeedF.value = pose.speedF;
    su.uFocalPx.value = (height / 2) / Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    su.uFocus.value = focus; su.uCocK.value = cocK;
    return { scene, camera, focus, cocK, look };
  }

  return {
    renderer, scene, camera, boat, sea, skies: loaded, wake, ocean, spray, post, quality: QUALITY.name,
    compile() { renderer.compile(scene, camera); },
    // t: frame time; stateAt: time -> state; subframes over a 180-degree shutter at fps
    renderFrame(t, stateAt, { subframes = 1, fps = 30, shutter = 0.5, frame = 0 } = {}) {
      subframes = Math.min(subframes, QUALITY.maxSub ?? subframes);
      const span = shutter / fps;
      const sub = span / Math.max(subframes, 1);
      // stratified sub-frame times with a deterministic jitter: stepping turns into fine noise
      const jit = (i) => { const x = Math.sin((frame + 1) * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
      // film quality has no MSAA (software GL shades every sample): the sub-frames carry a sub-pixel camera jitter
      // instead, so 4-8 sub-frames are also 4-8x supersampling (edges, glitter and foam), at no extra cost
      const aaJit = subframes > 1 && !QUALITY.msaa;
      const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
      const rot = [halton(frame + 1, 5), halton(frame + 1, 7)];
      post.render((off, i) => {
        const ts = t + (subframes > 1 ? off + jit(i) / subframes : 0) * span;
        const res = setup(stateAt(ts, t), sub, stateAt(ts - sub, t), t);
        if (aaJit) {
          const jx = ((halton(i + 1, 2) + rot[0]) % 1) - 0.5, jy = ((halton(i + 1, 3) + rot[1]) % 1) - 0.5;
          const e = camera.projectionMatrix.elements; e[8] += (jx * 2.2) / width; e[9] += (jy * 2.2) / height;
          camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
        }
        return res;
      }, subframes, frame);
    },
  };
}
