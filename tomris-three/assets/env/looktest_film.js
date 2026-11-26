// Frozen copy of the 12 s look-test film (4 shots) used only by assets/env/looktest.html for water before/after.
// Film mode: the only module that knows the timeline. Track, shots, looks -> stateAt(t) for the engine.
// Everything is a pure function of t (track is integrated once into a table at load, deterministically).
import * as THREE from "three";

const D2R = Math.PI / 180;
export const DURATION = 12;

// ---- boat track: 35 kn, straight, then an easy starboard turn (shows the wake follows any track) ----
const V = 18.0;
const T0 = -40, T1 = 80, DT = 1 / 240;
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const yawRate = (t) => -0.075 * (smooth(3.2, 5.0, t) - smooth(8.6, 10.2, t));
const speedAt = (t) => V;
const N = Math.ceil((T1 - T0) / DT) + 1;
const TX = new Float64Array(N), TZ = new Float64Array(N), TH = new Float64Array(N), TS = new Float64Array(N);
{
  let x = 0, z = 0, h = 0, s = 0;
  // integrate forward from t = 0 and backward to T0 so that the boat is at the origin at t = 0
  const i0 = Math.round(-T0 / DT);
  TX[i0] = 0; TZ[i0] = 0; TH[i0] = 0; TS[i0] = 0;
  for (let i = i0 + 1; i < N; i++) {
    const t = T0 + i * DT, v = speedAt(t);
    h += yawRate(t - DT / 2) * DT; x += Math.cos(h) * v * DT; z -= Math.sin(h) * v * DT; s += v * DT;
    TX[i] = x; TZ[i] = z; TH[i] = h; TS[i] = s;
  }
  x = 0; z = 0; h = 0; s = 0;
  for (let i = i0 - 1; i >= 0; i--) {
    const t = T0 + i * DT, v = speedAt(t);
    x -= Math.cos(h) * v * DT; z += Math.sin(h) * v * DT; s -= v * DT; h -= yawRate(t + DT / 2) * DT;
    TX[i] = x; TZ[i] = z; TH[i] = h; TS[i] = s;
  }
}
export function track(t) {
  const f = Math.min(N - 1.001, Math.max(0, (t - T0) / DT)), i = Math.floor(f), k = f - i;
  const L = (A) => A[i] + (A[i + 1] - A[i]) * k;
  return { x: L(TX), z: L(TZ), heading: L(TH), speed: speedAt(t), yawRate: yawRate(t), s: L(TS), time: t };
}

// ---- looks ----
export const LOOKS = {
  sunset: { sky: "sunset", exposure: 0.42, skyGain: 1, sunGain: 9, sunColor: [1.0, 0.62, 0.36], envGain: 1.4, keyGain: 1, fogDist: 2200, glitter: 1, bloom: 0.08, bloomThresh: 1.5,
    navEmissive: 2, navLight: 0.2, navGlow: 0.15, grain: 0.03, vignette: 0.32, sat: 1.0, contrast: 1.06,
    teal: [-0.014, 0.006, 0.02], orange: [0.035, 0.01, -0.03] },
  dusk: { sky: "dusk", exposure: 0.34, wb: [0.66, 0.88, 1.4], skyGain: 1, sunGain: 0.0, envGain: 1, keyGain: 1, fogDist: 1800, glitter: 0, bloom: 0.12, bloomThresh: 1.0,
    navEmissive: 60, navLight: 0.6, navGlow: 1.0, grain: 0.04, vignette: 0.38, sat: 1.0, contrast: 1.05,
    teal: [-0.01, 0.006, 0.03], orange: [0.02, 0.005, -0.02] },
};

// ---- shots (hard cuts). Rig offsets are in the boat's heading frame: x fwd, y up, z starboard ----
const SHOTS = [
  { name: "a_side_chase", start: 0, dur: 3, look: "sunset", sunRel: -35, lens: 32, fstop: 2.8,
    rig: (u) => ({ cam: [6.2 + 0.25 * u, 3.1, -15.5], tgt: [6.0, 1.15, 0] }), bob: 1 },
  { name: "b_front_hero", start: 3, dur: 3, look: "sunset", sunRel: -150, lens: 50, fstop: 2.0,
    rig: (u) => ({ cam: [27 - 2.2 * u, 0.75, 9.5 - 0.5 * u], tgt: [7.8, 1.0, 0.2] }), bob: 1 },
  { name: "c_drone_wake", start: 6, dur: 3, look: "sunset", sunRel: 35, lens: 24, fstop: 0,
    rig: (u) => ({ cam: [-14 + 1.5 * u, 42 - 1.0 * u, -30], tgt: [-14, 0, 2] }), bob: 0 },
  { name: "d_stern_bluehour", start: 9, dur: 3, look: "dusk", sunRel: 30, lens: 40, fstop: 2.2,
    rig: (u) => ({ cam: [-8.5 + 0.4 * u, 2.7, -6.8], tgt: [3.3, 3.4, 0], focus: [3.0, 4.1, 0] }), bob: 1 },
];
export const SHOT_LIST = SHOTS.map((s) => ({ name: s.name, start: s.start, dur: s.dur }));

function shotAt(t) { let s = SHOTS[0]; for (const x of SHOTS) if (t >= x.start - 1e-6) s = x; return s; }
const toWorld = (b, p) => { const c = Math.cos(b.heading), s = Math.sin(b.heading);
  return new THREE.Vector3(b.x + c * p[0] + s * p[2], p[1], b.z - s * p[0] + c * p[2]); };
// deterministic handheld / chase-boat motion: incommensurate sines
const wob = (t, f, p) => Math.sin(t * f + p) * 0.6 + Math.sin(t * f * 2.31 + p * 1.7) * 0.3 + Math.sin(t * f * 5.13 + p * 0.3) * 0.1;

export function makeStateAt(sea) {
  return function stateAt(t, frameT = t) {
    const shot = shotAt(frameT);              // sub-frames keep the shot of their frame (no blur across a cut)
    const u = Math.min(1, Math.max(0, (t - shot.start) / shot.dur));
    const b = track(t);
    const mid = track(shot.start + shot.dur / 2);
    const r = shot.rig(u);
    const pos = toWorld(b, r.cam), tgt = toWorld(b, r.tgt);
    if (shot.bob) {
      pos.y += 0.55 * sea.heightLong(pos.x, pos.z, t) + 0.08 * wob(t, 1.3, 0.4);
      pos.x += 0.10 * wob(t, 0.9, 2.0); pos.z += 0.12 * wob(t, 0.7, 4.1);
      tgt.y += 0.06 * wob(t, 1.7, 1.2); tgt.x += 0.08 * wob(t, 1.1, 3.3);
    } else {
      pos.x += 0.25 * wob(t, 0.35, 0.2); pos.y += 0.15 * wob(t, 0.3, 1.0);
    }
    const look = { ...LOOKS[shot.look], sunAz: (-mid.heading * 180 / Math.PI + shot.sunRel) * D2R };
    return {
      time: t, boat: b, trail: (tau) => track(t - tau), look, shot: shot.name,
      camera: { pos, target: tgt, lensMm: shot.lens, fstop: shot.fstop, roll: shot.bob ? 0.004 * wob(t, 0.8, 5.0) : 0.002 * wob(t, 0.4, 2.2),
        focus: r.focus ? pos.distanceTo(toWorld(b, r.focus)) : undefined },
    };
  };
}
