// TOMRİS play: keyboard + touch + mouse. Produces { throttle (lever, -0.3..1), rudder (-1 port .. 1 starboard) } and
// fires named actions (camera, photo, hud, reset, help). Throttle is a lever: W/S move it and it stays; the rudder
// springs back to centre when released.
const THR_MIN = -0.3, THR_MAX = 1;

export function createInput({ canvas, ui, onAction, onOrbitDrag, onOrbitZoom }) {
  const state = { throttle: 0, rudder: 0, touchRudder: 0, keyRudder: 0, override: null };
  const held = new Set();
  let detent = false;                                    // lever stops at 0 on the way down until the key is pressed again

  const KEYMAP = { KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down", KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right" };
  addEventListener("keydown", (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = KEYMAP[e.code];
    if (k) { if (!held.has(k) && (k === "down" || k === "up")) detent = false; held.add(k); e.preventDefault(); return; }
    if (e.repeat) return;
    const act = { KeyC: "camera", KeyP: "photo", KeyH: "hud", KeyR: "reset", Escape: "escape", Slash: "help", F1: "help" }[e.code]
      || (e.key === "?" ? "help" : null);
    if (act) { e.preventDefault(); onAction(act); }
  });
  addEventListener("keyup", (e) => { const k = KEYMAP[e.code]; if (k) held.delete(k); });
  addEventListener("blur", () => held.clear());

  // ---- touch: throttle lever (left) ----
  const lever = ui.lever, knob = ui.leverKnob;
  let leverId = null;
  const leverSet = (clientY) => {
    const r = lever.getBoundingClientRect();
    const f = 1 - Math.min(1, Math.max(0, (clientY - r.top) / r.height));      // 0 bottom .. 1 top
    let th = THR_MIN + f * (THR_MAX - THR_MIN);
    if (Math.abs(th) < 0.05) th = 0;                                           // a detent at idle
    state.throttle = th;
  };
  lever.addEventListener("pointerdown", (e) => { leverId = e.pointerId; lever.setPointerCapture(e.pointerId); leverSet(e.clientY); e.preventDefault(); });
  lever.addEventListener("pointermove", (e) => { if (e.pointerId === leverId) leverSet(e.clientY); });
  const leverUp = (e) => { if (e.pointerId === leverId) leverId = null; };
  lever.addEventListener("pointerup", leverUp); lever.addEventListener("pointercancel", leverUp);

  // ---- touch: steering pad (right): horizontal drag from where the finger landed ----
  const pad = ui.pad, padKnob = ui.padKnob;
  let padId = null, padX0 = 0;
  pad.addEventListener("pointerdown", (e) => { padId = e.pointerId; pad.setPointerCapture(e.pointerId); padX0 = e.clientX; state.touchRudder = 0; e.preventDefault(); });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId !== padId) return;
    const r = pad.getBoundingClientRect();
    state.touchRudder = Math.max(-1, Math.min(1, (e.clientX - padX0) / (r.width * 0.36)));
  });
  const padUp = (e) => { if (e.pointerId === padId) { padId = null; state.touchRudder = 0; } };
  pad.addEventListener("pointerup", padUp); pad.addEventListener("pointercancel", padUp);

  // ---- canvas: orbit drag (mouse / one finger), pinch + wheel zoom ----
  const ptrs = new Map(); let pinch0 = 0;
  canvas.addEventListener("pointerdown", (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); canvas.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
  canvas.addEventListener("pointermove", (e) => {
    const p = ptrs.get(e.pointerId); if (!p) return;
    if (ptrs.size === 1) onOrbitDrag(e.clientX - p.x, e.clientY - p.y);
    p.x = e.clientX; p.y = e.clientY;
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0 && d > 0) onOrbitZoom(pinch0 / d); pinch0 = d;
    }
  });
  const cup = (e) => { ptrs.delete(e.pointerId); pinch0 = 0; };
  canvas.addEventListener("pointerup", cup); canvas.addEventListener("pointercancel", cup);
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); onOrbitZoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  function update(dt) {
    if (held.has("up")) state.throttle = Math.min(THR_MAX, state.throttle + 0.55 * dt);
    if (held.has("down") && !detent) {
      const n = Math.max(THR_MIN, state.throttle - 0.55 * dt);
      if (state.throttle > 0 && n <= 0) { state.throttle = 0; detent = true; } else state.throttle = n;
    }
    state.keyRudder = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    state.rudder = state.keyRudder || state.touchRudder;
    if (state.override) { state.throttle = state.override.throttle ?? state.throttle; state.rudder = state.override.rudder ?? state.rudder; }
    // lever / pad visuals
    knob.style.bottom = `${((state.throttle - THR_MIN) / (THR_MAX - THR_MIN)) * 100}%`;
    padKnob.style.transform = `translate(calc(-50% + ${state.rudder * 38}px), -50%)`;
  }
  function reset() { state.throttle = 0; state.rudder = 0; state.touchRudder = 0; held.clear(); }
  return { state, update, reset };
}
