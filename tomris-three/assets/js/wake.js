// Wake: the boat's recent track (any shape) is drawn as a wide ribbon into a top-down float map.
// Each texel stores (lateral offset from the track, absolute track distance S, emission time, speed factor),
// so the ocean shader can build Kelvin arms / jet wash / aerated scar in world space for curved tracks too.
// Input is a trail sampler: trail(tau) -> boat state tau seconds ago ({x, z, heading, speed, s, time}).
import * as THREE from "three";

export const WAKE = { extent: 480, res: 1024, points: 200, dtau: 0.14, armTan: Math.tan((13 * Math.PI) / 180) };

export function createWake(renderer) {
  const N = WAKE.points;
  const rt = new THREE.WebGLRenderTarget(WAKE.res, WAKE.res, {
    type: THREE.FloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, generateMipmaps: false,
  });
  const pos = new Float32Array(N * 2 * 3), data = new Float32Array(N * 2 * 4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute("wk", new THREE.BufferAttribute(data, 4).setUsage(THREE.DynamicDrawUsage));
  const idx = [];
  for (let k = 0; k < N - 1; k++) { const a = 2 * k, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  geo.setIndex(idx);
  const uniforms = { uCenter: { value: new THREE.Vector2() }, uExtent: { value: WAKE.extent }, uDmax: { value: 1 } };
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, uniforms, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `precision highp float;
      in vec3 position; in vec4 wk; uniform vec2 uCenter; uniform float uExtent; uniform float uDmax; out vec4 vWk;
      void main(){ vWk = wk; gl_Position = vec4((position.xz - uCenter) / (0.5 * uExtent), position.y / uDmax * 2.0 - 1.0, 1.0); }`,
    fragmentShader: /* glsl */ `precision highp float; in vec4 vWk; out vec4 o; void main(){ o = vWk; }`,
  });
  const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.Camera();
  const clear = new THREE.Color(0, 0, 0);

  function update(trail, now) {
    // ribbon from the transom backwards; y carries track distance d for the depth test (newest wins)
    let dmax = 1;
    for (let k = 0; k < N; k++) {
      const s = trail(k * WAKE.dtau);
      const d = Math.max(0, now.s - s.s);
      const w = 4 + WAKE.armTan * (d + 8) * 1.25 + 6;
      const sx = Math.sin(s.heading), sz = Math.cos(s.heading);          // starboard (+local z) in world
      const sf = Math.min(1, Math.max(0, (s.speed - 3) / 12));
      for (let j = 0; j < 2; j++) {
        const lat = j ? w : -w, i = 2 * k + j;
        pos[i * 3] = s.x + sx * lat; pos[i * 3 + 1] = d; pos[i * 3 + 2] = s.z + sz * lat;
        data.set([lat, s.s, s.time, sf], i * 4);
      }
      dmax = Math.max(dmax, d);
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.wk.needsUpdate = true;
    // map centred behind the boat, snapped to texels so it does not shimmer
    const fx = Math.cos(now.heading), fz = -Math.sin(now.heading), texel = WAKE.extent / WAKE.res;
    const cx = Math.round((now.x - fx * WAKE.extent * 0.3) / texel) * texel, cz = Math.round((now.z - fz * WAKE.extent * 0.3) / texel) * texel;
    uniforms.uCenter.value.set(cx, cz); uniforms.uDmax.value = dmax * 1.001;
    const prevTarget = renderer.getRenderTarget(), prevClear = renderer.getClearAlpha(), prevColor = renderer.getClearColor(new THREE.Color());
    renderer.setRenderTarget(rt); renderer.setClearColor(clear, 0); renderer.clear(true, true, false);
    renderer.render(scene, cam);
    renderer.setRenderTarget(prevTarget); renderer.setClearColor(prevColor, prevClear);
  }
  return { rt, update, center: uniforms.uCenter.value };
}

// Particle emission history: boat state at fixed time steps into a float texture (x, z, heading, speed).
export const TRAIL_TEX = { n: 160, dt: 1 / 40 };
export function createTrailTexture() {
  const arr = new Float32Array(TRAIL_TEX.n * 4);
  const tex = new THREE.DataTexture(arr, TRAIL_TEX.n, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
  function update(trail) {
    for (let i = 0; i < TRAIL_TEX.n; i++) { const s = trail(i * TRAIL_TEX.dt); arr.set([s.x, s.z, s.heading, s.speed], i * 4); }
    tex.needsUpdate = true;
  }
  return { tex, update };
}
