// TOMRİS play: boat handling model. Pure JS (no three.js), deterministic for a given input sequence and step size.
// A planing hull, tuned by feel; the only project number used is the 35 kn top speed from the project plan.
//   - speed: thrust (throttle, spooled) against a resistance curve with a hump around 12-14 kn, normalised so full
//     throttle balances it exactly at 35 kn (asymptote, plus a hard cap); turning adds drag, so speed bleeds in turns
//   - yaw: rate = v / R(v) * rudder, R grows with v^2 (tight at low speed, wide carving at speed), first-order lag
//   - heel: inward, from yaw rate x speed; trim: rises to a hump peak then settles once planing (+ a little squat
//     under acceleration); lift: the stern squats at hump speed, the hull rises on the plane
// World frame as in the engine: forward = (cos h, -sin h) in x/z, starboard (+local z) = (sin h, cos h).
export const KN = 0.514444;
export const VMAX_KN = 35;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hump = (vk) => Math.exp(-(((vk - 13) / 5.5) ** 2));
const approach = (cur, target, dt, tau) => cur + (target - cur) * (1 - Math.exp(-dt / Math.max(tau, 1e-4)));

export const TUNE = {
  accel: 3.4,          // kn/s per unit of (thrust - resistance)
  spool: 0.9,          // throttle lever -> thrust, per second
  reverse: 0.45,       // reverse thrust fraction
  turnDrag: 0.3,       // extra resistance at full rudder (x u^2)
  rMin: 12, rK: 0.33,  // turn radius R(v) = rMin + rK * v^2  (v in m/s)
  heelK: 0.06, heelMax: 0.21,
};

// resistance as a fraction of full thrust; r(35 kn) = 1 exactly when going straight
export function resistance(vk, rudder = 0) {
  const a = Math.abs(vk), u = a / VMAX_KN;
  let r = 0.12 * u + 0.38 * u * u + 0.5 * u ** 8 + 0.22 * hump(a) * ss(0, 4, a) + TUNE.turnDrag * Math.abs(rudder) * u * u;
  if (vk < 0) r *= 3;                     // the hull does not like going backwards
  return Math.sign(vk) * r;
}

export function trimDeg(vk) {             // steady-state running trim
  const a = Math.abs(vk);
  return 2.8 * ss(4, 24, a) + 3.0 * hump(a) * ss(2, 8, a);
}

export function createSim({ x = 0, z = 0, heading = 0 } = {}) {
  const st = {
    x, z, heading, v: 0, yawRate: 0, s: 0, time: 0,
    throttle: 0,        // lever setpoint (-0.3 .. 1)
    thrust: 0,          // spooled
    rudder: 0,          // -1 (port) .. 1 (starboard)
    trim: 0, heel: 0, lift: 0, accel: 0,
    topKn: 0, planedAt: null,
  };
  const start = { x, z, heading };
  // ---- history for the wake / spray trail: fixed-rate samples, unwrapped heading ----
  const DT_REC = 1 / 30, NREC = 30 * 32;
  const hx = new Float64Array(NREC), hz = new Float64Array(NREC), hh = new Float64Array(NREC), hv = new Float64Array(NREC), hs = new Float64Array(NREC);
  let head = -1, count = 0, nextRec = 0;
  function record() {
    head = (head + 1) % NREC; count = Math.min(count + 1, NREC);
    hx[head] = st.x; hz[head] = st.z; hh[head] = st.heading; hv[head] = st.v; hs[head] = st.s;
  }
  function reset() {
    Object.assign(st, { x: start.x, z: start.z, heading: start.heading, v: 0, yawRate: 0, s: 0, throttle: 0, thrust: 0, rudder: 0, trim: 0, heel: 0, lift: 0, accel: 0, topKn: 0, planedAt: null });
    head = -1; count = 0; nextRec = st.time; record(); nextRec = st.time + DT_REC;
  }

  function step(dt, input) {
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let i = 0; i < n; i++) sub(h, input);
  }
  function sub(dt, inp) {
    st.throttle = clamp(inp.throttle, -0.3, 1);
    st.rudder = approach(st.rudder, clamp(inp.rudder, -1, 1), dt, 0.12);
    // spool (slower to wind up than to cut)
    const tgt = st.throttle < 0 ? st.throttle * TUNE.reverse : st.throttle;
    const rate = TUNE.spool * (Math.abs(tgt) > Math.abs(st.thrust) ? 1 : 2.5);
    st.thrust += clamp(tgt - st.thrust, -rate * dt, rate * dt);
    // speed
    const vk0 = st.v / KN;
    let a = TUNE.accel * (st.thrust - resistance(vk0, st.rudder));          // kn/s
    let vk = vk0 + a * dt;
    if (Math.abs(st.thrust) < 0.02 && Math.abs(vk) < 0.05) vk = 0;
    vk = clamp(vk, -VMAX_KN, VMAX_KN);
    st.accel = approach(st.accel, (vk - vk0) / dt, dt, 0.4);
    st.v = vk * KN;
    const av = Math.abs(st.v);
    // yaw: waterjet steering also works at (almost) zero speed, a little
    const R = TUNE.rMin + TUNE.rK * av * av;
    const yawT = -st.rudder * (st.v / R) - st.rudder * 0.12 * Math.abs(st.thrust) * (1 - ss(0, 3, av));
    st.yawRate = approach(st.yawRate, yawT, dt, 0.35 + 0.035 * av);
    st.heading += st.yawRate * dt;
    // attitude
    const heelT = clamp(-st.yawRate * av * TUNE.heelK, -TUNE.heelMax, TUNE.heelMax) * ss(1.5, 7, av);
    st.heel = approach(st.heel, heelT, dt, 0.55);
    const trimT = (trimDeg(vk) + clamp(st.accel * 0.35, -0.8, 1.2) * ss(1, 6, Math.abs(vk))) * D2R;
    st.trim = approach(st.trim, trimT, dt, 0.7);
    const liftT = -0.06 * hump(Math.abs(vk)) * ss(2, 8, Math.abs(vk)) + 0.12 * ss(16, 32, Math.abs(vk));
    st.lift = approach(st.lift, liftT, dt, 0.8);
    // position
    st.x += Math.cos(st.heading) * st.v * dt; st.z += -Math.sin(st.heading) * st.v * dt; st.s += av * dt;
    st.time += dt;
    st.topKn = Math.max(st.topKn, Math.abs(vk));
    if (st.planedAt === null && Math.abs(vk) >= 20) st.planedAt = st.time;
    while (st.time >= nextRec) { record(); nextRec += DT_REC; }
  }

  // engine boat state (see engine.js header) + the optional attitude overrides boatPose() understands
  function boat() {
    return { x: st.x, z: st.z, heading: st.heading, speed: st.v, yawRate: st.yawRate, s: st.s, time: st.time,
      trim: st.trim, heel: st.heel, lift: st.lift };
  }
  // trail(tau): boat state tau seconds ago. Recorded samples; older than the record -> extrapolated straight back.
  function trail(tau) {
    const T = st.time - tau;
    if (tau <= 0 || count === 0) return boat0(st.x, st.z, st.heading, st.v, st.s, st.time);
    const lastT = nextRec - DT_REC;               // time of the newest record
    if (T >= lastT) {
      const k = (T - lastT) / Math.max(st.time - lastT, 1e-6);
      return lerpS(hx[head], hz[head], hh[head], hv[head], hs[head], st.x, st.z, st.heading, st.v, st.s, k, T);
    }
    const back = (lastT - T) / DT_REC, i0 = Math.floor(back), f = back - i0;
    if (i0 + 1 >= count) {                         // before the record: straight line at the oldest speed
      const o = (head - (count - 1) + NREC) % NREC, dtb = T - (lastT - (count - 1) * DT_REC), hd = hh[o];
      return boat0(hx[o] + Math.cos(hd) * hv[o] * dtb, hz[o] - Math.sin(hd) * hv[o] * dtb, hd, hv[o], hs[o] + Math.abs(hv[o]) * dtb, T);
    }
    const a = (head - i0 + NREC) % NREC, b = (head - i0 - 1 + NREC) % NREC;
    return lerpS(hx[a], hz[a], hh[a], hv[a], hs[a], hx[b], hz[b], hh[b], hv[b], hs[b], f, T);
  }
  const boat0 = (x, z, heading, speed, s, time) => ({ x, z, heading, speed: Math.abs(speed), s, time });
  const lerpS = (x0, z0, h0, v0, s0, x1, z1, h1, v1, s1, k, T) =>
    boat0(x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, h0 + (h1 - h0) * k, v0 + (v1 - v0) * k, s0 + (s1 - s0) * k, T);

  reset();
  return { st, step, reset, boat, trail, setStart(p) { Object.assign(start, p); } };
}

// compass: bearing 0 = world +x (north), clockwise seen from above (turning to starboard increases it)
export function bearingDeg(heading) { let b = (-heading / D2R) % 360; if (b < 0) b += 360; return b; }
export function compassLetter(b) { return ["K", "D", "G", "B"][Math.round(b / 90) % 4]; }
