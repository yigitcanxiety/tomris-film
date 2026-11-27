// TOMRİS play: a small real-time driving + photo build on top of the film's engine (tomris-three/assets/js).
// The film module (film.js) is not used: this file owns a free-running clock, the boat handling model (sim.js),
// the cameras (cameras.js), input (input.js) and the Turkish UI. The engine runs in "realtime" quality.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { createEngine } from "../../tomris-three/assets/js/engine.js";
import { LOOKS } from "../../tomris-three/assets/js/looks.js";
import { boatPose } from "../../tomris-three/assets/js/boat.js";
import { createSim, KN, bearingDeg, compassLetter } from "./sim.js";
import { createCameras, lensFor } from "./cameras.js";
import { createInput } from "./input.js";

const q = new URLSearchParams(location.search);
const TEST = q.get("test") === "1";
const DEBUG = q.get("debug") === "1";
const FIXED_SCALE = q.get("scale") ? Math.max(0.2, +q.get("scale")) : null;
const ASSETS = "../tomris-three/assets/";
const D2R = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const canvas = $("gl");

// time of day: the film's looks with the sun of its setups (shots.json) and the film's sea state per setup
const LOOKSET = {
  sunset: { look: "sunset", az: 225, elev: 3, sea: 1.0 },
  harbour: { look: "harbour", az: 270, elev: 1, sea: 0.25 },
  bluehour: { look: "bluehour", az: 235, elev: -4, sea: 0.75 },
};
const START_HEADING = 163 * D2R;          // sun a little off the bow, low over the water ahead of the chase camera

// ---------------------------------------------------------------------------------------------------------
const loading = $("loading"), lmsg = $("lmsg"), lfill = $("lfill");
function fail(msg) { loading.classList.add("err"); loading.classList.remove("gone"); lmsg.innerHTML = msg; }
function webgl2Ok() {
  try {
    const c = document.createElement("canvas"), gl = c.getContext("webgl2");
    if (!gl) return "nogl";
    if (!gl.getExtension("EXT_color_buffer_float")) return "nofloat";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return "ok";
  } catch (e) { return "nogl"; }
}

async function main() {
  const ok = webgl2Ok();
  if (ok !== "ok") {
    fail(ok === "nogl"
      ? "Bu tarayıcı ya da cihaz <b>WebGL2</b> desteklemiyor.<br>Güncel bir Chrome, Edge, Firefox ya da Safari ile deneyin;<br>donanım hızlandırmanın açık olduğundan emin olun."
      : "Bu cihazın grafik birimi gereken kayan noktalı çizim desteğini vermiyor.<br>Başka bir tarayıcı ya da cihazla deneyin.");
    return;
  }
  const touch = q.get("touch") === "1" || (q.get("touch") !== "0" && (matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0));
  document.body.classList.toggle("touch", touch);

  // ---- loading progress (engine + buoys go through three's default loading manager) ----
  let lastTotal = 1;
  THREE.DefaultLoadingManager.onProgress = (url, n, total) => {
    lastTotal = Math.max(lastTotal, total);
    lfill.style.width = `${Math.round((n / Math.max(total, 3)) * 85)}%`;
    const name = /\.glb$/.test(url) ? "tekne modeli" : /\.hdr$/.test(url) ? "gökyüzü" : "dokular";
    lmsg.textContent = `Yükleniyor… ${name}`;
  };

  // ---- render size (adaptive) ----
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const RS_MAX = Math.min(dpr, 1.5), RS_MIN = 0.35;
  let rs = FIXED_SCALE ?? Math.min(RS_MAX, 1);
  const sizeFor = (s) => {
    let W = Math.round(innerWidth * s), H = Math.round(innerHeight * s);
    const cap = 2.4e6; if (W * H > cap) { const k = Math.sqrt(cap / (W * H)); W = Math.round(W * k); H = Math.round(H * k); }
    return [Math.max(W, 64), Math.max(H, 64)];
  };
  let [W, H] = sizeFor(rs);

  const engine = await createEngine(canvas, {
    width: W, height: H, base: ASSETS, quality: q.get("quality") || "realtime",
    skies: { sunset: "hdri/belfast_sunset_puresky_2k.hdr", dusk: "hdri/qwantani_dusk_2_puresky_2k.hdr" },
  });
  lmsg.textContent = "Hazırlanıyor…"; lfill.style.width = "90%";
  const { sea, renderer, boat } = engine;
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fail("Grafik bağlamı kayboldu.<br>Sayfayı yenileyin."); });

  // ---- sea amplitude per time of day (the film scales the engine's wave set the same way) ----
  const waveTables = [];
  {
    const cpu = [...sea.geo, ...(sea.fine || [])], A0 = cpu.map((w) => w.A);
    waveTables.push((k) => cpu.forEach((w, i) => { w.A = A0[i] * k; }));
    for (const u of [engine.ocean.uniforms, engine.spray.uniforms]) for (const key of ["uGeoA", "uFineA"]) {
      const arr = u[key] && u[key].value; if (!Array.isArray(arr)) continue;
      const a0 = arr.map((v) => v.w); waveTables.push((k) => arr.forEach((v, i) => { v.w = a0[i] * k; }));
    }
  }
  let seaK = -1;
  const setSea = (k) => { if (k !== seaK) { seaK = k; waveTables.forEach((f) => f(k)); } };

  // ---- buoys: a sparse field of channel buoys for a sense of speed (tiled around the boat) ----
  const buoys = [];
  try {
    const g = (await new GLTFLoader().loadAsync(ASSETS + "props/buoy.glb")).scene;
    const tpl = [g.getObjectByName("buoy_port_red"), g.getObjectByName("buoy_starboard_green")];
    const lampMats = [];
    for (const t of tpl) { t.position.set(0, 0, 0); t.traverse((o) => { if (!o.isMesh) return; o.castShadow = o.receiveShadow = false;
      for (const m of [].concat(o.material)) if (/^light_buoy/.test(m.name) && !lampMats.includes(m)) { m.userData.e0 = m.emissiveIntensity; lampMats.push(m); } }); }
    for (let i = 0; i < 9; i++) { const o = tpl[i % 2].clone(true); o.visible = false; engine.scene.add(o); buoys.push(o); }
    buoys.lampMats = lampMats;
  } catch (e) { console.warn("buoys unavailable", e); }
  const CELL = 240;
  const hash = (i, j, k) => { const s = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return s - Math.floor(s); };
  function updateBuoys(b, t, look) {
    if (!buoys.length) return;
    const ci = Math.floor(b.x / CELL), cj = Math.floor(b.z / CELL);
    let n = 0;
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const i = ci + di, j = cj + dj, o = buoys[n++];
      const x = (i + 0.2 + 0.6 * hash(i, j, 1)) * CELL, z = (j + 0.2 + 0.6 * hash(i, j, 2)) * CELL;
      const h = sea.heightLong(x, z, t), e = 1.5;
      const sx = (sea.heightLong(x + e, z, t) - sea.heightLong(x - e, z, t)) / (2 * e), sz = (sea.heightLong(x, z + e, t) - sea.heightLong(x, z - e, t)) / (2 * e);
      o.position.set(x, h - 0.05, z); o.rotation.set(sz * 0.8, hash(i, j, 4) * 6.28, -sx * 0.8); o.visible = true;
    }
    const lampK = (look.lampGain ?? 0.25) * 3;
    for (const m of buoys.lampMats) { const per = /red/.test(m.name) ? 3 : 4, ph = (t % per) / per; m.emissiveIntensity = m.userData.e0 * lampK * (ph < 0.17 ? 1 : 0.04); }
  }

  // ---- state ----
  const sim = createSim({ heading: START_HEADING });
  const cams = createCameras(sea);
  let camMode = "chase", camBeforePhoto = "chase", photo = false, paused = false, bars = false, lookKey = LOOKSET[q.get("look")] ? q.get("look") : "sunset";
  const LENSES = [24, 35, 50, 85]; let lensIdx = 1;
  let lastCam = null, frameNo = 0, needRender = true;
  const perf = { emaMs: 0, scale: rs, frames: 0 };
  const flags = { camSwitched: false, photoEntered: false, rudderT: 0 };

  function lookFor() {
    const L = LOOKSET[lookKey];
    const look = { ...LOOKS[L.look], sunAz: L.az * D2R, sunElev: L.elev * D2R };
    if (lookKey === "harbour") { look.navEmissive = 16; look.navGlow = 0.52; look.navLight = 0.5; }   // as the film's harbour, lamps on
    if (!photo) { look.grain = (look.grain ?? 0.03) * 0.5; look.vignette = (look.vignette ?? 0.3) * 0.75; look.flare = (look.flare ?? 0.1) * 0.6; }
    return look;
  }

  function updateCamera(dt) {
    const t = sim.st.time, b = sim.boat();
    setSea(LOOKSET[lookKey].sea);
    const pose = boatPose(b, sea, t);
    const c = camMode === "chase" ? cams.chaseUpdate(dt, b, pose, t, innerWidth < innerHeight) : cams.orbitUpdate(dt, b, pose, t);
    c.lensMm = lensFor(c.lensMm, W / H);
    lastCam = c;
  }
  function renderNow() {
    if (!lastCam) updateCamera(0);
    const t = sim.st.time, b = sim.boat(), look = lookFor();
    setSea(LOOKSET[lookKey].sea);
    updateBuoys(b, t, look);
    const st = { time: t, boat: b, trail: sim.trail, camera: lastCam, look };
    engine.renderFrame(t, () => st, { subframes: 1, fps: 60, shutter: 0.5, frame: frameNo });
    needRender = false;
  }
  function resize(s) {
    const [w, h] = sizeFor(s);
    if (w === W && h === H) return;
    W = w; H = h; engine.resize(W, H); needRender = true; layoutBars();
  }
  addEventListener("resize", () => { resize(rs); });

  // ---- UI ----
  const ui = { lever: $("lever"), leverKnob: $("leverKnob"), pad: $("pad"), padKnob: $("padKnob") };
  const input = createInput({
    canvas, ui,
    onAction: action,
    onOrbitDrag: (dx, dy) => { if (camMode === "orbit") { cams.orbitDrag(dx, dy); needRender = true; } },
    onOrbitZoom: (f) => { if (camMode === "orbit") { cams.orbitZoom(f); needRender = true; } },
  });
  function action(a) {
    if (a === "camera") {
      if (photo) return;
      if (camMode === "chase") { if (lastCam) cams.orbitFrom(lastCam, sim.boat()); camMode = "orbit"; } else { camMode = "chase"; cams.resetChase(); }
      flags.camSwitched = true; needRender = true;
    } else if (a === "photo") setPhoto(!photo);
    else if (a === "hud") document.body.classList.toggle("nohud");
    else if (a === "reset") { sim.reset(); input.reset(); cams.resetChase(); lastCam = null; needRender = true; }
    else if (a === "help") toggleHelp();
    else if (a === "escape") { if (!$("help").hidden) toggleHelp(false); else if (photo) setPhoto(false); }
    hudNow();
  }
  function toggleHelp(on = $("help").hidden) { $("help").hidden = !on; }
  $("helpBtn").onclick = () => toggleHelp(); $("helpClose").onclick = () => toggleHelp(false);
  $("bCam").onclick = () => action("camera"); $("bPhoto").onclick = () => action("photo");

  function setPhoto(on) {
    if (on === photo) return;
    photo = on; paused = on;
    document.body.classList.toggle("photo", on); $("photo").hidden = !on;
    if (on) {
      camBeforePhoto = camMode;
      if (camMode === "chase" && lastCam) cams.orbitFrom(lastCam, sim.boat());
      camMode = "orbit"; flags.photoEntered = true; cams.orbit.lens = LENSES[lensIdx];
    } else {
      camMode = camBeforePhoto; if (camMode === "chase") cams.resetChase(); cams.orbit.lens = 35;
      setBars(false);
    }
    syncPhotoUi(); needRender = true;
  }
  function setLook(k) { if (!LOOKSET[k]) return; lookKey = k; syncPhotoUi(); needRender = true; }
  function setBars(on) { bars = on; layoutBars(); syncPhotoUi(); }
  function layoutBars() { const h = bars ? Math.max(0, (innerHeight - innerWidth / 2.39) / 2) : 0; $("barT").style.height = $("barB").style.height = `${h}px`; }
  function syncPhotoUi() {
    for (const b of document.querySelectorAll("#looks button")) b.classList.toggle("on", b.dataset.look === lookKey);
    $("pBars").classList.toggle("on", bars); $("pLens").textContent = `${LENSES[lensIdx]} mm`;
  }
  for (const b of document.querySelectorAll("#looks button")) b.onclick = () => setLook(b.dataset.look);
  $("pBars").onclick = () => setBars(!bars);
  $("pLens").onclick = () => { lensIdx = (lensIdx + 1) % LENSES.length; cams.orbit.lens = LENSES[lensIdx]; syncPhotoUi(); needRender = true; };
  $("pExit").onclick = () => setPhoto(false);
  $("pSave").onclick = () => savePhoto();
  syncPhotoUi();

  // photo: re-render at a larger size (long side >= 1920 px), capture in the same task, crop to 2.39:1 if the
  // bars are on, then go back to the play size. preserveDrawingBuffer is on in the engine, so the canvas is readable.
  let saving = false;
  function capture() {
    const long = Math.max(innerWidth, innerHeight), s = Math.max(rs, Math.min(3200, Math.max(1920, long * rs)) / long);
    const prev = [W, H]; resize(s);
    updateCamera(0); renderNow();
    let src = canvas;
    if (bars) {
      const ch = Math.min(canvas.height, Math.round(canvas.width / 2.39));
      src = document.createElement("canvas"); src.width = canvas.width; src.height = ch;
      src.getContext("2d").drawImage(canvas, 0, (canvas.height - ch) / 2, canvas.width, ch, 0, 0, canvas.width, ch);
    }
    const p = new Promise((res) => src.toBlob(res, "image/png"));
    const size = [src.width, src.height];
    if (prev[0] !== W || prev[1] !== H) { W = prev[0]; H = prev[1]; engine.resize(W, H); }
    needRender = true;
    return { blob: p, size };
  }
  async function savePhoto() {
    if (saving) return; saving = true;
    try {
      const { blob, size } = capture();
      const b = await blob;
      const d = new Date(), pad = (n) => String(n).padStart(2, "0");
      const name = `tomris-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.png`;
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      const f = $("flash"); f.style.transition = "none"; f.style.opacity = 0.55; requestAnimationFrame(() => { f.style.transition = ""; f.style.opacity = 0; });
      toast("FOTOĞRAF KAYDEDİLDİ");
      return { name, bytes: b.size, size };
    } finally { saving = false; }
  }
  let toastT = 0;
  function toast(s) { const t = $("toast"); t.textContent = s; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 1800); }

  // ---- HUD ----
  const vSpeed = $("vSpeed"), vHead = $("vHead"), vComp = $("vComp"), vThr = $("vThr"), vCam = $("vCam");
  let hudT = 0;
  function hudNow() {
    const st = sim.st, b = bearingDeg(st.heading);
    vSpeed.textContent = (Math.abs(st.v) / KN).toFixed(1);
    vHead.textContent = `${String(Math.round(b) % 360).padStart(3, "0")}°`; vComp.textContent = compassLetter(b);
    const th = Math.round(input.state.throttle * 100);
    vThr.textContent = th < 0 ? `GERİ %${-th}` : `%${th}`;
    vCam.textContent = photo ? "FOTOĞRAF" : camMode === "chase" ? "TAKİP" : "SERBEST";
  }

  // ---- guided intro ----
  const STEPS = [
    { t: "GAZ VER", h: touch ? "Soldaki <b>GAZ</b> kolunu yukarı it." : "<b>W</b> ya da <b>↑</b> ile gazı aç.", done: () => input.state.throttle >= 0.5 },
    { t: "DÜMEN KIR", h: touch ? "Sağdaki <b>DÜMEN</b> alanında parmağını yana kaydır." : "<b>A</b> / <b>D</b> ya da <b>←</b> <b>→</b> ile dümen kır.", done: () => flags.rudderT > 0.5 },
    { t: "KAMERAYI DEĞİŞTİR", h: touch ? "<b>Kamera</b> düğmesine dokun; sonra ekranı sürükleyip döndür." : "<b>C</b> ile serbest kameraya geç; fareyle sürükleyip döndür.", done: () => flags.camSwitched },
    { t: "FOTOĞRAF MODU", h: touch ? "<b>Foto</b> düğmesine dokun." : "<b>P</b> ile fotoğraf moduna gir.", done: () => flags.photoEntered },
  ];
  const FINAL = { t: "İYİ SEYİRLER", h: "Saati seç, kadrajı kur, <b>Kaydet</b>. Tuşların listesi <b>?</b> altında." };
  let introStep = -1, introDoneT = 0;
  const introEl = $("intro");
  let introSeen = false; try { introSeen = localStorage.getItem("tomris-play-intro") === "1"; } catch (e) {}
  function introShow(i) {
    introStep = i;
    const s = i < STEPS.length ? STEPS[i] : FINAL;
    $("iStep").textContent = i < STEPS.length ? `${i + 1} / ${STEPS.length}` : "TAMAM";
    $("iTitle").textContent = s.t; $("iHint").innerHTML = s.h;
    introEl.classList.toggle("done", i >= STEPS.length); introEl.hidden = false;
    $("iSkip").hidden = i >= STEPS.length;
    if (i >= STEPS.length) { introEl.style.opacity = 1; introEl.style.pointerEvents = "auto"; }
  }
  function introEnd() { introStep = -2; introEl.hidden = true; try { localStorage.setItem("tomris-play-intro", "1"); } catch (e) {} }
  $("iSkip").onclick = introEnd;
  function introTick(dt) {
    if (Math.abs(input.state.rudder) > 0.6) flags.rudderT += dt;
    if (introStep < 0) return;
    if (introStep < STEPS.length) { if (STEPS[introStep].done()) introShow(introStep + 1); }
    else if ((introDoneT += dt) > 7) introEnd();
  }

  // ---- debug readout ----
  let dbg = null; if (DEBUG) { dbg = document.createElement("div"); dbg.style.cssText = "position:fixed;left:28px;top:52px;font:600 10px 'JetBrains Mono',monospace;letter-spacing:.1em;color:#ADA396;z-index:50"; document.body.appendChild(dbg); }

  // ---- first frame, then hand over ----
  updateCamera(0); renderNow(); hudNow();
  lfill.style.width = "100%";
  loading.classList.add("gone"); setTimeout(() => { loading.hidden = true; }, 900);
  if (!(introSeen && !TEST) && q.get("intro") !== "0") introShow(0);

  // ---- test hook: deterministic stepping without real time ----
  const boatCtr = new THREE.Vector3();
  function getState() {
    const st = sim.st, c = engine.camera;
    boatCtr.set(6.3, 1.3, 0).applyMatrix4(boat.root.matrixWorld);
    const ndc = boatCtr.clone().project(c);
    const water = sea.height(c.position.x, c.position.z, st.time);
    return {
      t: st.time, speedKn: st.v / KN, topKn: st.topKn, planedAt: st.planedAt, throttle: input.state.throttle, thrust: st.thrust, rudder: st.rudder,
      bearing: bearingDeg(st.heading), headingRad: st.heading, yawRateDps: st.yawRate / D2R, heelDeg: st.heel / D2R, trimDeg: st.trim / D2R, liftM: st.lift,
      x: st.x, z: st.z, camMode, photo, look: lookKey, bars, size: [W, H], introStep, perf: { ...perf },
      cam: { x: c.position.x, y: c.position.y, z: c.position.z, waterY: water, clearance: c.position.y - water, lensMm: lastCam && lastCam.lensMm,
        // the camera the next frame will use (updated every step, also without rendering)
        nextClearance: lastCam ? lastCam.pos.y - sea.height(lastCam.pos.x, lastCam.pos.z, st.time) : null },
      boatNdc: [ndc.x, ndc.y, ndc.z], boatInView: Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1,
      hud: { speed: vSpeed.textContent, head: vHead.textContent + " " + vComp.textContent, thr: vThr.textContent, cam: vCam.textContent },
    };
  }
  function stepAll(dt) {
    const n = Math.max(1, Math.ceil(dt / (1 / 30))), h = dt / n;
    for (let i = 0; i < n; i++) {
      input.update(h);
      if (!paused) sim.step(h, input.state);
      updateCamera(h); introTick(h);
    }
    hudNow(); needRender = true;
  }
  window.__play = {
    ready: true, sim, engine, cams,
    step: (dt) => { stepAll(dt); return getState(); },
    setInput: (o) => { input.state.override = o ? { ...o } : null; if (o && o.throttle !== undefined) input.state.throttle = o.throttle; },
    getState,
    render: () => { const t0 = performance.now(); renderNow(); const gl = renderer.getContext(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4)); return performance.now() - t0; },
    action, setPhoto, setLook, setBars, savePhoto,
    setOrbit: (o) => { Object.assign(cams.orbit, o); if (o.yaw !== undefined) cams.orbit.tYaw = o.yaw; if (o.pitch !== undefined) cams.orbit.tPitch = o.pitch; if (o.dist !== undefined) cams.orbit.tDist = o.dist; },
    reset: () => action("reset"),
  };
  if (TEST) return;

  // ---- real-time loop ----
  let last = performance.now(), ema = 16, evalT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const raw = (now - last) / 1000; last = now;
    const dt = Math.min(raw, 0.1), dtUi = Math.min(raw, 0.25);      // sim: at most 0.1 s per frame; keys / cameras: real time
    input.update(dtUi);
    if (!paused) { sim.step(dt, input.state); needRender = true; frameNo++; }
    const before = lastCam && lastCam.pos.clone();
    updateCamera(dtUi); introTick(dtUi);
    if (before && before.distanceToSquared(lastCam.pos) > 1e-8) needRender = true;
    if (needRender) renderNow();
    if ((hudT += dt) > 0.1) { hudT = 0; hudNow(); }
    // adaptive resolution: frame time high -> fewer pixels; headroom -> more (hysteresis, at most once a second)
    if (raw > 0) ema += (Math.min(raw, 1) * 1000 - ema) * 0.15;
    if (!FIXED_SCALE && !paused && (evalT += Math.min(raw, 1)) > 1) {
      evalT = 0;
      if (ema > 24 && rs > RS_MIN) { rs = Math.max(RS_MIN, rs * 0.84); resize(rs); }
      else if (ema < 14.5 && rs < RS_MAX) { rs = Math.min(RS_MAX, rs * 1.1); resize(rs); }
    }
    perf.emaMs = ema; perf.scale = rs; perf.frames++;
    if (dbg) dbg.textContent = `${ema.toFixed(1)} ms · ölçek ${rs.toFixed(2)} · ${W}×${H}`;
  }
  requestAnimationFrame(frame);
}

main().catch((e) => {
  console.error(e);
  fail(`Yüklenirken bir sorun oluştu.<br><span style="font-size:12px;color:#ADA396">${String(e && e.message || e).replace(/</g, "&lt;")}</span>`);
});
