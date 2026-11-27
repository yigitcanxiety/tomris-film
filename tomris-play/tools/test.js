#!/usr/bin/env node
// TOMRİS play: headless checks (Playwright + a local `python3 -m http.server`), deterministic through ?test=1.
//   node tomris-play/tools/test.js [--out DIR] [--scale 0.75] [--only load,speed,turn,cams,photo,touch,live]
// Prints the measured numbers as JSON at the end; screenshots go to --out (default: <tmp>/tomris-play-test).
// Software GL is slow: renders are serialised machine-wide with the same lock as tomris-three/tools/shot.js.
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs"), path = require("path"), net = require("net");
const a = process.argv.slice(2), arg = (k, d) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const root = path.resolve(__dirname, "..", "..");
const out = path.resolve(arg("out", path.join(require("os").tmpdir(), "tomris-play-test")));
const scale = arg("scale", "0.75"), only = arg("only", "load,speed,turn,cams,photo,touch,live").split(",");
const LOCK = "/tmp/tomris-gl.lock";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise((r) => { const s = net.createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

(async () => {
  for (;;) { try { fs.mkdirSync(LOCK); break; } catch { try { if (Date.now() - fs.statSync(LOCK).mtimeMs > 30 * 60e3) fs.rmdirSync(LOCK); } catch {} await sleep(3000); } }
  const touchLock = () => { try { fs.utimesSync(LOCK, new Date(), new Date()); } catch {} };
  const port = await freePort();
  const srv = spawn("python3", ["-m", "http.server", String(port), "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  const unlock = () => { try { srv.kill(); } catch {} try { fs.rmdirSync(LOCK); } catch {} };
  process.on("exit", unlock); process.on("SIGINT", () => process.exit(1)); process.on("SIGTERM", () => process.exit(1));
  await sleep(800);
  fs.mkdirSync(out, { recursive: true });
  const R = {}, errors = [];
  const b = await chromium.launch();

  async function open(viewport, extra = "", ctxOpts = {}) {
    const ctx = await b.newContext({ viewport, acceptDownloads: true, ...ctxOpts });
    const p = await ctx.newPage();
    p.on("console", (m) => { if (m.type() === "error" && !/GL_INVALID_OPERATION/.test(m.text())) errors.push(m.text().slice(0, 300)); });
    p.on("pageerror", (e) => errors.push("PAGE ERROR: " + String(e).slice(0, 400)));
    const t0 = Date.now();
    await p.goto(`http://127.0.0.1:${port}/tomris-play/?test=1${/scale=/.test(extra) ? "" : "&scale=" + scale}${extra}`);
    await p.waitForFunction(() => window.__play && window.__play.ready, null, { timeout: 900000 });
    return { p, ctx, loadS: (Date.now() - t0) / 1000 };
  }
  const shot = async (p, name) => { touchLock(); const ms = await p.evaluate(() => window.__play.render()); await sleep(500); const f = path.join(out, name + ".jpg");
    await p.screenshot({ path: f, type: "jpeg", quality: 82 }); console.log(`${f}  render ${ms.toFixed(0)} ms`); return ms; };
  const step = (p, dt) => p.evaluate((dt) => window.__play.step(dt), dt);

  // ---------------- desktop ----------------
  const { p, loadS } = await open({ width: 1280, height: 720 });
  R.loadSeconds = loadS;
  if (only.includes("load")) {
    const ms = [];
    for (let i = 0; i < 4; i++) ms.push(await p.evaluate(() => { window.__play.step(1 / 60); return window.__play.render(); }));   // time moves: full frame (tiles re-baked)
    R.frameMs = { size: (await p.evaluate(() => window.__play.getState())).size, samples: ms.map((x) => Math.round(x)) };
    await shot(p, "01-start");
    R.introAtStart = (await p.evaluate(() => window.__play.getState())).introStep;
  }
  if (only.includes("speed")) {
    await p.evaluate(() => window.__play.setInput({ throttle: 1, rudder: 0 }));
    const trace = []; let trimPeak = { deg: 0, kn: 0, t: 0 };
    for (let i = 0; i < 80; i++) {
      const s = await step(p, 0.5);
      trace.push([+s.t.toFixed(1), +s.speedKn.toFixed(2), +s.trimDeg.toFixed(2)]);
      if (s.trimDeg > trimPeak.deg) trimPeak = { deg: +s.trimDeg.toFixed(2), kn: +s.speedKn.toFixed(1), t: +s.t.toFixed(1) };
    }
    const first = (k) => (trace.find((r) => r[1] >= k) || [null])[0];
    const s = await p.evaluate(() => window.__play.getState());
    R.speed = { topKn: +s.topKn.toFixed(3), finalKn: +s.speedKn.toFixed(3), t10: first(10), t20_plane: first(20), t30: first(30), t34: first(34), t34_5: first(34.5),
      trimPeak, trimAtTop: +s.trimDeg.toFixed(2), introStep: s.introStep, hud: s.hud };
    R.speedTrace = trace.filter((r, i) => i % 4 === 3);
    await shot(p, "02-chase-35kn");
  }
  if (only.includes("turn")) {
    // high speed: already at 35 kn; full starboard rudder
    await p.evaluate(() => window.__play.setInput({ throttle: 1, rudder: 1 }));
    const h0 = (await p.evaluate(() => window.__play.getState())).headingRad;
    let s; for (let i = 0; i < 6; i++) s = await step(p, 0.5);
    await shot(p, "03-chase-turn");
    for (let i = 0; i < 16; i++) s = await step(p, 0.5);
    const radius = (st) => Math.abs((st.speedKn * 0.514444) / (st.yawRateDps * Math.PI / 180));
    R.turnHigh = { entryKn: 35, turnKn: +s.speedKn.toFixed(1), yawDps: +s.yawRateDps.toFixed(2), radiusM: +radius(s).toFixed(1), heelDeg: +s.heelDeg.toFixed(2),
      headingChangeDeg: +(((h0 - s.headingRad) * 180) / Math.PI).toFixed(1), bearing: +s.bearing.toFixed(1) };
    // port too: heel must flip sign (inward on both sides)
    await p.evaluate(() => window.__play.setInput({ throttle: 1, rudder: -1 }));
    for (let i = 0; i < 16; i++) s = await step(p, 0.5);
    R.turnHighPort = { yawDps: +s.yawRateDps.toFixed(2), heelDeg: +s.heelDeg.toFixed(2), radiusM: +radius(s).toFixed(1) };
    // low speed
    await p.evaluate(() => { window.__play.reset(); window.__play.setInput({ throttle: 0.2, rudder: 0 }); });
    for (let i = 0; i < 40; i++) s = await step(p, 0.5);
    const entry = s.speedKn;
    await p.evaluate(() => window.__play.setInput({ throttle: 0.2, rudder: 1 }));
    for (let i = 0; i < 20; i++) s = await step(p, 0.5);
    R.turnLow = { entryKn: +entry.toFixed(1), turnKn: +s.speedKn.toFixed(1), yawDps: +s.yawRateDps.toFixed(2), radiusM: +radius(s).toFixed(1), heelDeg: +s.heelDeg.toFixed(2) };
  }
  if (only.includes("cams")) {
    await p.evaluate(() => { window.__play.reset(); window.__play.setInput({ throttle: 0.75, rudder: 0 }); });
    let s; for (let i = 0; i < 30; i++) s = await step(p, 0.5);
    await p.evaluate(() => window.__play.render());
    s = await p.evaluate(() => window.__play.getState());
    R.chase = { kn: +s.speedKn.toFixed(1), boatNdc: s.boatNdc.map((x) => +x.toFixed(3)), inView: s.boatInView, clearanceM: +s.cam.clearance.toFixed(2) };
    await p.evaluate(() => window.__play.action("camera"));
    await p.evaluate(() => window.__play.setOrbit({ yaw: 1.2, pitch: 0.22, dist: 26 }));
    s = await step(p, 1.0);
    await shot(p, "04-orbit");
    s = await p.evaluate(() => window.__play.getState());
    R.orbit = { camMode: s.camMode, boatNdc: s.boatNdc.map((x) => +x.toFixed(3)), inView: s.boatInView, clearanceM: +s.cam.clearance.toFixed(2) };
    // worst case: lowest pitch, closest distance, sweep all the way round over the waves
    let minClear = 1e9;
    for (let k = 0; k < 24; k++) {
      await p.evaluate((k) => window.__play.setOrbit({ yaw: k * 0.2618, pitch: -0.02, dist: 8 }), k);
      s = await step(p, 0.5); await p.evaluate(() => window.__play.render());
      s = await p.evaluate(() => window.__play.getState());
      minClear = Math.min(minClear, s.cam.clearance, s.cam.nextClearance);
    }
    R.orbitLowSweepMinClearanceM = +minClear.toFixed(2);
    await p.evaluate(() => window.__play.action("camera"));
    let minC = 1e9;
    await p.evaluate(() => window.__play.setInput({ throttle: 1, rudder: 1 }));
    for (let i = 0; i < 40; i++) { s = await step(p, 0.5); minC = Math.min(minC, s.cam.nextClearance); }
    R.chaseTurnMinClearanceM = +minC.toFixed(2);
  }
  if (only.includes("photo")) {
    await p.evaluate(() => { window.__play.reset(); window.__play.setInput({ throttle: 1, rudder: 0 }); });
    let s; for (let i = 0; i < 40; i++) s = await step(p, 0.5);
    await p.evaluate(() => window.__play.setInput({ throttle: 1, rudder: 0.5 }));
    for (let i = 0; i < 4; i++) s = await step(p, 0.5);
    await p.evaluate(() => { window.__play.setPhoto(true); window.__play.setOrbit({ yaw: 0.75, pitch: 0.12, dist: 30 }); });
    s = await step(p, 1.0);
    const tPaused = s.t; s = await step(p, 2.0);
    R.photoPaused = Math.abs(s.t - tPaused) < 1e-9;
    await shot(p, "05-photo-sunset");
    await p.evaluate(() => { window.__play.setLook("bluehour"); window.__play.setBars(true); });
    await shot(p, "06-photo-bluehour-bars");
    const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 600000 }), p.evaluate(() => window.__play.savePhoto())]);
    const f = path.join(out, "saved-" + dl.suggestedFilename()); await dl.saveAs(f);
    R.savedPng = { file: f, bytes: fs.statSync(f).size };
    await p.evaluate(() => { window.__play.setLook("harbour"); window.__play.setBars(false); });
    await shot(p, "07-photo-harbour");
    s = await p.evaluate(() => window.__play.getState());
    R.photoState = { introStep: s.introStep, camMode: s.camMode };
  }
  // ---------------- phone ----------------
  if (only.includes("touch")) {
    const { p: m } = await open({ width: 390, height: 844 }, "&touch=1&scale=1.5", { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await m.evaluate(() => window.__play.setInput({ throttle: 0.8, rudder: 0 }));
    for (let i = 0; i < 24; i++) await step(m, 0.5);
    await m.evaluate(() => window.__play.setInput(null));
    await shot(m, "08-touch-390x844");
    // drive the lever with a real touch: tap near the top of the GAZ track
    const box = await m.locator("#lever").boundingBox();
    await m.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.1);
    const s = await step(m, 0.1);
    R.touch = { leverTapThrottle: +s.throttle.toFixed(2), hud: s.hud, boatInView: s.boatInView };
  }
  // ---------------- live: the real rAF loop with real keys (slow here: software GL) ----------------
  if (only.includes("live")) {
    const { p: l } = await open({ width: 1280, height: 720 }, "&live=1");
    await l.evaluate(() => { const u = new URL(location.href); u.searchParams.delete("test"); u.searchParams.delete("scale"); history.replaceState(null, "", u); });
    await l.goto(`http://127.0.0.1:${port}/tomris-play/?intro=1`);
    await l.waitForFunction(() => window.__play && window.__play.ready, null, { timeout: 900000 });
    const s0 = await l.evaluate(() => window.__play.getState());
    await l.keyboard.down("KeyW"); await sleep(4000); await l.keyboard.up("KeyW");
    await l.keyboard.down("KeyD"); await sleep(3000); await l.keyboard.up("KeyD");
    await l.keyboard.press("KeyC"); await sleep(1500);
    await l.mouse.move(640, 400); await l.mouse.down(); await l.mouse.move(520, 380, { steps: 5 }); await l.mouse.up();
    await l.mouse.wheel(0, 300); await sleep(1500);
    const s1 = await l.evaluate(() => window.__play.getState());
    await l.keyboard.press("KeyP"); await sleep(1500);
    const s2 = await l.evaluate(() => window.__play.getState());
    await sleep(2000);
    const s3 = await l.evaluate(() => window.__play.getState());
    await l.keyboard.press("KeyP"); await l.keyboard.press("KeyH"); await l.keyboard.press("KeyR"); await sleep(1500);
    const s4 = await l.evaluate(() => window.__play.getState());
    R.live = { startSize: s0.size, afterSize: s1.size, perf: s1.perf, throttleAfterW: +s1.throttle.toFixed(2), speedKn: +s1.speedKn.toFixed(2), rudderSeen: s1.bearing !== s0.bearing,
      camAfterC: s1.camMode, introAfter: s1.introStep, photoOnP: s2.photo, photoFrozen: s2.t === s3.t, afterReset: { photo: s4.photo, speedKn: s4.speedKn, x: s4.x } };
    await l.screenshot({ path: path.join(out, "live.jpg"), type: "jpeg", quality: 80 });
  }
  R.consoleErrors = errors;
  console.log(JSON.stringify(R, null, 1));
  await b.close(); unlock(); process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
