// TOMRİS play: chase and orbit cameras. Output is the engine's camera state { pos, target, lensMm, fstop, roll, focus }.
// Neither camera ever goes below the sea surface (full wave height under the lens + a margin).
import * as THREE from "three";

const MID = 6.3, MID_Y = 1.3;                                   // boat centre in the GLB frame (x fwd from transom)
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (k, dt) => 1 - Math.exp(-k * dt);
const fwd = (h) => new THREE.Vector3(Math.cos(h), 0, -Math.sin(h));

// lens for this aspect: the engine keeps the horizontal field for a given focal length, so a portrait screen would
// get a very tall view; lengthen the lens there (between "same width" and "same height")
export function lensFor(mm, aspect) { return mm * Math.max(1, Math.sqrt((16 / 9) / aspect)); }

export function createCameras(sea) {
  const WATER_MARGIN = 0.9;
  const above = (p, t) => { const h = sea.height(p.x, p.z, t); if (p.y < h + WATER_MARGIN) p.y = h + WATER_MARGIN; return p; };

  // ---- chase: behind and above, looking ahead of the bow; its heading lags the boat's (swings out in turns);
  //      the offset from the boat is a damped spring in the world frame (no lag from the boat's own speed) ----
  const chase = { yaw: 0, off: new THREE.Vector3(), offV: new THREE.Vector3(), init: false, lens: 28 };
  function chaseUpdate(dt, b, pose, t, portrait) {
    const v = Math.abs(b.speed);
    if (!chase.init) { chase.yaw = b.heading; }
    chase.yaw += wrapPi(b.heading - chase.yaw) * damp(2.2, dt);
    const dist = (portrait ? 21 : 21) + 0.25 * v, height = (portrait ? 7 : 5.2) + 0.08 * v;
    const want = fwd(chase.yaw).multiplyScalar(-dist).add(new THREE.Vector3(0, height, 0)).add(fwd(b.heading).multiplyScalar(MID));
    if (!chase.init) { chase.off.copy(want); chase.offV.set(0, 0, 0); chase.init = true; }
    // critically damped spring, omega 3.5
    const w = 3.5, h = Math.min(dt, 1 / 30); let n = Math.ceil(dt / h);
    while (n-- > 0) {
      const acc = want.clone().sub(chase.off).multiplyScalar(w * w).addScaledVector(chase.offV, -2 * w);
      chase.offV.addScaledVector(acc, h); chase.off.addScaledVector(chase.offV, h);
    }
    const base = new THREE.Vector3(b.x, 0, b.z);
    const pos = base.clone().add(chase.off); pos.y += 0.5 * pose.position.y;             // rides a little with the heave
    above(pos, t);
    const target = base.clone().add(fwd(b.heading).multiplyScalar(MID + (portrait ? 3 + 0.25 * v : 6 + 0.35 * v))); target.y = (portrait ? 0.6 : 1.4) + 0.6 * pose.position.y;
    return { pos, target, lensMm: chase.lens, fstop: 0, roll: 0, focus: pos.distanceTo(base.clone().add(fwd(b.heading).multiplyScalar(MID))) };
  }

  // ---- orbit: yaw relative to the boat's heading, pitch, distance; all smoothed toward the user's targets ----
  const orbit = { yaw: 2.4, pitch: 0.28, dist: 30, tYaw: 2.4, tPitch: 0.28, tDist: 30, lens: 35, fstop: 0 };
  function orbitUpdate(dt, b, pose, t) {
    const k = damp(10, dt);
    orbit.yaw += (orbit.tYaw - orbit.yaw) * k; orbit.pitch += (orbit.tPitch - orbit.pitch) * k; orbit.dist += (orbit.tDist - orbit.dist) * k;
    const c = Math.cos(b.heading), s = Math.sin(b.heading);
    const target = new THREE.Vector3(b.x + c * MID, MID_Y + pose.position.y, b.z - s * MID);
    const a = b.heading + orbit.yaw;                           // yaw 0 = looking from dead ahead... measured in the boat frame
    const dir = new THREE.Vector3(Math.cos(a) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), -Math.sin(a) * Math.cos(orbit.pitch));
    const pos = target.clone().addScaledVector(dir, orbit.dist);
    above(pos, t);
    return { pos, target, lensMm: orbit.lens, fstop: orbit.fstop, roll: 0, focus: pos.distanceTo(target) };
  }
  function orbitDrag(dx, dy) {
    orbit.tYaw -= dx * 0.006;
    orbit.tPitch = THREE.MathUtils.clamp(orbit.tPitch + dy * 0.004, -0.02, 1.45);
  }
  function orbitZoom(f) { orbit.tDist = THREE.MathUtils.clamp(orbit.tDist * f, 8, 140); }
  function orbitFrom(camState, b) {              // start the orbit where the current view is (no jump on C / P)
    const c = Math.cos(b.heading), s = Math.sin(b.heading);
    const tx = b.x + c * MID, tz = b.z - s * MID;
    const d = new THREE.Vector3(camState.pos.x - tx, camState.pos.y - MID_Y, camState.pos.z - tz);
    const L = d.length(); if (L < 1e-3) return;
    const a = Math.atan2(-d.z, d.x);
    orbit.yaw = orbit.tYaw = wrapPi(a - b.heading);
    orbit.pitch = orbit.tPitch = THREE.MathUtils.clamp(Math.asin(d.y / L), -0.02, 1.45);
    orbit.dist = orbit.tDist = THREE.MathUtils.clamp(L, 8, 140);
  }
  return { chase, orbit, chaseUpdate, orbitUpdate, orbitDrag, orbitZoom, orbitFrom, resetChase() { chase.init = false; } };
}
