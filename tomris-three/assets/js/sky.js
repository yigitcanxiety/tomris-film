// Sky: CC0 HDRI -> (a) background (4K when available, Catmull-Rom sampled, analytic sun disc + aureole on top),
// (b) 2K mip-mapped copy for reflections / haze, (c) PMREM lighting env with a dark-sea lower hemisphere,
// (d) analytic sun direction + mean sky radiance extracted from the 2K map (same export as before).
import * as THREE from "three";
import { HDRLoader } from "three/addons/loaders/HDRLoader.js";
import { QUALITY } from "./waves.js";

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

// Upgrades by file name (relative to assets/): lit = map used for lighting/reflections, bg = visible background.
// The purple-pink qwantani_dusk_2 is replaced by a procedural blue-hour sky (deep blue zenith, pale blue
// horizon, a narrow warm band under the set sun, a few thin low stratus streaks); proc = generated, not loaded.
const UPGRADE = {
  "belfast_sunset_puresky_2k.hdr": { bg: "env/belfast_sunset_puresky_4k.hdr" },
  "qwantani_dusk_2_puresky_2k.hdr": { proc: "bluehour" },
  "qwantani_dusk_1_puresky_2k.hdr": { bg: "env/qwantani_dusk_1_puresky_4k.hdr" },
};

function toHalfTexture(f32, w, h) {
  const half = new Uint16Array(f32.length);
  for (let i = 0; i < f32.length; i++) half[i] = THREE.DataUtils.toHalfFloat(Math.min(f32[i], 65000));
  const tex = new THREE.DataTexture(half, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.LinearSRGBColorSpace;
  tex.flipY = true;                         // row 0 (top of file) ends up at v = 1, three's equirect convention
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// direction of pixel (i, j) with j counted from the top row; matches three's equirectUv
function pixDir(i, j, w, h) {
  const u = (i + 0.5) / w, v = 1 - (j + 0.5) / h;
  const phi = (u - 0.5) * 2 * Math.PI, lat = (v - 0.5) * Math.PI;
  return [Math.cos(lat) * Math.cos(phi), Math.sin(lat), Math.cos(lat) * Math.sin(phi), Math.cos(lat)];
}

// Procedural blue hour, linear RGB, equirect (three's convention, row 0 = zenith). The set sun sits at texture
// azimuth 0 (+x), 4 deg below the horizon. Colours follow real twilight: orange -> pale yellow -> pale cyan ->
// deep blue, never through pink (the warm band is kept narrow and the transition layer carries green).
function blueHourSky(w = 2048, h = 1024) {
  const data = new Float32Array(w * h * 4);
  const hash = (x, y) => { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const vn = (x, y, px) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const a = hash(((ix % px) + px) % px, iy), b = hash((((ix + 1) % px) + px) % px, iy), c = hash(((ix % px) + px) % px, iy + 1), d = hash((((ix + 1) % px) + px) % px, iy + 1);
    return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy; };
  const Z = [0.035, 0.105, 0.42], M = [0.12, 0.29, 0.78], Hz = [0.36, 0.55, 0.92];
  const mix = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI, e = Math.max(lat, 0);
    for (let i = 0; i < w; i++) {
      const u = (i + 0.5) / w, phi = (u - 0.5) * 2 * Math.PI, cphi = Math.cos(phi);
      let c = e < 0.35 ? mix(Hz, M, ss(0, 0.35, e)) : mix(M, Z, Math.pow((e - 0.35) / (Math.PI / 2 - 0.35), 0.8));
      const g = Math.exp(-(1 - cphi) / 0.45), gw = Math.exp(-(1 - cphi) / 0.22);
      const band = gw * Math.exp(-e / 0.028), glow = g * Math.exp(-e / 0.13);
      c = [c[0] + 2.1 * band + 0.55 * glow, c[1] + 0.82 * band + 0.5 * glow, c[2] + 0.2 * band + 0.18 * glow];
      // thin low stratus streaks: darker than the sky, warm underside toward the set sun
      const x = u * 64, y = lat * 260;
      const n = vn(x, y, 64) * 0.55 + vn(x * 2.3, y * 2.1 + 7, 147) * 0.3 + vn(x * 5.1, y * 4.3 + 3, 326) * 0.15;
      const dens = ss(0.56, 0.74, n) * ss(0.012, 0.03, e) * (1 - ss(0.07, 0.13, e)) * 0.85;
      const cc = [0.11 + 0.9 * gw * 0.6, 0.15 + 0.35 * gw * 0.6, 0.26 + 0.08 * gw * 0.6];
      c = mix(c, cc, dens);
      if (lat < 0) { const k = 1 - 0.5 * ss(0, 0.1, -lat); c = [c[0] * k, c[1] * k, c[2] * k]; }
      const p = (j * w + i) * 4; data[p] = c[0]; data[p + 1] = c[1]; data[p + 2] = c[2]; data[p + 3] = 1;
    }
  }
  return { width: w, height: h, data, sunDir: new THREE.Vector3(1, -0.07, 0).normalize() };
}

export async function loadSky(url, renderer) {
  const name = url.slice(url.lastIndexOf("/") + 1), root = url.replace(/(hdri|env)\/[^/]+$/, "");
  const up = UPGRADE[name] || {};
  const litUrl = up.lit ? root + up.lit : url;
  const tex = up.proc ? { image: blueHourSky(), dispose() {} } : await new HDRLoader().setDataType(THREE.FloatType).loadAsync(litUrl);
  const { width: w, height: h, data } = tex.image;
  const full = data;
  // The 2K sunset maps have a hazy, low-dynamic-range sun (peak ~25x sky), so the sun is not cut out of
  // the map; its direction is the centroid of the brightest pixels and its strength is set per look.
  const L = new Float32Array(w * h); let maxL = 0;
  for (let p = 0; p < w * h; p++) { L[p] = lum(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]); if (L[p] > maxL) maxL = L[p]; }
  const dOm = (2 * Math.PI / w) * (Math.PI / h);
  const dir = [0, 0, 0], sky = [0, 0, 0];
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const p = j * w + i, d = pixDir(i, j, w, h), om = dOm * d[3];
    if (L[p] > maxL * 0.85) { const wgt = (L[p] - maxL * 0.85) * om; dir[0] += d[0] * wgt; dir[1] += d[1] * wgt; dir[2] += d[2] * wgt; }
    if (d[1] > 0) for (let c = 0; c < 3; c++) sky[c] += full[p * 4 + c] * d[1] * om;   // cos-weighted irradiance (horizontal)
  }
  const sun = [0, 0, 0];
  const sunDir = tex.image.sunDir ? tex.image.sunDir.clone() : new THREE.Vector3(...dir).normalize();
  if (!isFinite(sunDir.x)) sunDir.set(0, 0.05, -1).normalize();
  // lighting env: the "puresky" maps continue the sky below the horizon, which would light hull bottoms
  // like a sky. Replace the lower hemisphere with dark sea (8% of the horizon colour, fading in over ~6 deg).
  const lit = new Float32Array(full);
  for (let j = 0; j < h; j++) {
    const lat = (0.5 - (j + 0.5) / h) * Math.PI;
    if (lat > 0.02) continue;
    const k = Math.min(1, (0.02 - lat) / 0.1), jh = Math.floor(h * 0.5) - 2;
    for (let i = 0; i < w; i++) for (let c = 0; c < 3; c++) {
      const p = (j * w + i) * 4 + c, hz = full[(jh * w + i) * 4 + c];
      lit[p] = full[p] * (1 - k) + hz * 0.08 * k;
    }
  }
  const clampTex = toHalfTexture(full, w, h);
  tex.dispose();
  const litTex = toHalfTexture(lit, w, h);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(litTex).texture;
  pmrem.dispose(); litTex.dispose();
  // visible background: the 4K map straight from the loader as half floats (no CPU copies), no mips
  let bgTex = clampTex;
  if (up.bg && QUALITY.bg4k) {
    try {
      bgTex = await new HDRLoader().setDataType(THREE.HalfFloatType).loadAsync(root + up.bg);
      bgTex.mapping = THREE.EquirectangularReflectionMapping; bgTex.colorSpace = THREE.LinearSRGBColorSpace;
      bgTex.generateMipmaps = false; bgTex.minFilter = THREE.LinearFilter; bgTex.magFilter = THREE.LinearFilter;
      bgTex.wrapS = THREE.RepeatWrapping; bgTex.wrapT = THREE.ClampToEdgeWrapping; bgTex.needsUpdate = true;
    } catch (e) { console.warn("4K sky background missing, using the 2K map", e); bgTex = clampTex; }
  }
  bgTex.userData.sunPeak = maxL; bgTex.userData.sunDirTex = sunDir.clone();
  return {
    full: bgTex, clamp: clampTex, env,
    sunDirTex: sunDir,                                   // in texture space (before rotation)
    sunIrr: new THREE.Vector3(...sun),                   // W/m^2-like, linear RGB
    skyRad: new THREE.Vector3(...sky).multiplyScalar(1 / Math.PI),   // mean sky radiance on a horizontal surface
    stats: { maxL, w, h },
  };
}

// shared GLSL: rotated equirect lookup with explicit LOD (no seam), horizon haze colour
export const SKY_GLSL = /* glsl */ `
uniform sampler2D uSkyFull; uniform sampler2D uSkyClamp; uniform float uSkyRot; uniform float uSkyGain;
vec2 skyUv(vec3 d) {
  float c = cos(uSkyRot), s = sin(uSkyRot);
  d = vec3(c * d.x + s * d.z, d.y, -s * d.x + c * d.z);          // inverse rotation about Y
  return vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
}
vec3 skyRefl(vec3 d, float lod) { d.y = max(d.y, 0.002); return textureLod(uSkyClamp, skyUv(d), lod).rgb * uSkyGain; }
// background: Catmull-Rom (9 bilinear taps) so a magnified 4K map stays crisp instead of bilinear-soft
vec3 skyBg(vec3 d) {
  vec2 res = vec2(textureSize(uSkyFull, 0));
  vec2 uv = skyUv(d) * res, tc = floor(uv - 0.5) + 0.5, f = uv - tc;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f)), w1 = 1.0 + f * f * (-2.5 + 1.5 * f), w2 = f * (0.5 + f * (2.0 - 1.5 * f)), w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2, o12 = w2 / w12;
  vec2 t0 = (tc - 1.0) / res, t3 = (tc + 2.0) / res, t12 = (tc + o12) / res;
  vec3 c = textureLod(uSkyFull, vec2(t0.x, t0.y), 0.0).rgb * w0.x * w0.y + textureLod(uSkyFull, vec2(t12.x, t0.y), 0.0).rgb * w12.x * w0.y + textureLod(uSkyFull, vec2(t3.x, t0.y), 0.0).rgb * w3.x * w0.y
         + textureLod(uSkyFull, vec2(t0.x, t12.y), 0.0).rgb * w0.x * w12.y + textureLod(uSkyFull, vec2(t12.x, t12.y), 0.0).rgb * w12.x * w12.y + textureLod(uSkyFull, vec2(t3.x, t12.y), 0.0).rgb * w3.x * w12.y
         + textureLod(uSkyFull, vec2(t0.x, t3.y), 0.0).rgb * w0.x * w3.y + textureLod(uSkyFull, vec2(t12.x, t3.y), 0.0).rgb * w12.x * w3.y + textureLod(uSkyFull, vec2(t3.x, t3.y), 0.0).rgb * w3.x * w3.y;
  return max(c, vec3(0.0)) * uSkyGain;
}
vec3 hazeColor(vec3 d) { vec3 h = normalize(vec3(d.x, 0.0, d.z) + vec3(0.0, 0.03, 0.0)); return textureLod(uSkyClamp, skyUv(h), 5.0).rgb * uSkyGain; }
`;

// uSunDir / uSunIrr / uSkyRad live here so the ocean (which spreads these uniforms) and the dome share them;
// the engine writes them through ocean.uniforms exactly as before.
export function skyUniforms() {
  return { uSkyFull: { value: null }, uSkyClamp: { value: null }, uSkyRot: { value: 0 }, uSkyGain: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uSunIrr: { value: new THREE.Vector3(1, 1, 1) }, uSkyRad: { value: new THREE.Vector3(0.1, 0.1, 0.1) } };
}

// background dome: real HDRI above the horizon, haze below it (ocean covers almost all of that),
// plus the sun disc (limb-darkened, 0.53 deg) and aureole, gated by how bright the HDRI is there (clouds hide it)
export function createSkyDome(shared) {
  const uniforms = { ...shared, uSunPeak: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */ `${SKY_GLSL} varying vec3 vDir; uniform vec3 uSunDir; uniform vec3 uSunIrr; uniform float uSunPeak;
      void main(){ vec3 d = normalize(vDir);
        vec3 c = d.y > 0.0 ? skyBg(d) : hazeColor(d);
        float hz = smoothstep(0.0, 0.02, d.y); c = mix(hazeColor(d), c, mix(0.35, 1.0, hz));
        vec3 sd = normalize(uSunDir);
        float th = acos(clamp(dot(d, sd), -1.0, 1.0));
        if (th < 0.4 && dot(uSunIrr, uSunIrr) > 1e-6) {
          float hl = dot(textureLod(uSkyClamp, skyUv(sd), 3.0).rgb, vec3(0.2126, 0.7152, 0.0722));
          float vis = mix(0.45, 1.0, smoothstep(0.3, 0.75, hl / max(uSunPeak, 1e-4)));                     // cloud cover in front of the sun
          float r = 0.0046, x = clamp(th / r, 0.0, 1.0);
          float disc = (1.0 - smoothstep(0.85, 1.0, th / r)) * (1.0 - 0.55 * (1.0 - sqrt(1.0 - x * x)));
          vec3 warm = uSunIrr * vec3(1.0, 0.92, 0.85);
          c += vis * (warm * 60.0 * disc + uSunIrr * (0.35 * exp(-th / 0.01) + 0.04 * exp(-th / 0.06)));
          c *= mix(1.0, smoothstep(-0.004, 0.004, d.y), disc);                               // disc set behind the horizon
        }
        gl_FragColor = vec4(c, 1.0); }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), mat);
  dome.frustumCulled = false; dome.renderOrder = -10;
  dome.onBeforeRender = (r, s, cam) => {
    dome.position.copy(cam.position); dome.scale.setScalar(cam.far * 0.9); dome.updateMatrixWorld();
    const ud = shared.uSkyFull.value && shared.uSkyFull.value.userData;
    uniforms.uSunPeak.value = ud && ud.sunPeak ? ud.sunPeak : 1;
  };
  return dome;
}
