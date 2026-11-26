// Post: sub-frame accumulation (true motion blur), depth-of-field gather, restrained bloom, red halation,
// anamorphic horizontal streaks (only very bright sources: sun disc, nav lights), ACES, teal-orange grade that
// leaves neutral greys alone, vignette, luminance-shaped two-scale film grain. Linear HDR in, display sRGB out.
// Deterministic (grain seeded by frame index).
import * as THREE from "three";
import { QUALITY } from "./waves.js";
import { SKY_GLSL } from "./sky.js";

const FS_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// skyShared: the sky uniforms (equirect maps + rotation) so the aerial haze takes the horizon colour of the
// direction it looks in. Haze is applied per sub-frame in the accumulation pass, from that sub-frame's depth, to
// everything opaque that does not haze itself (the ocean writes alpha 0; sky = depth 1). Height falloff: the haze
// thins with altitude (scale height look.hazeH), so distant hill tops keep more contrast than their feet.
export function createPost(renderer, W, H, skyShared = null) {
  const rtOpts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false };
  const sceneRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, samples: QUALITY.msaa, depthBuffer: true });
  sceneRT.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
  const accumRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: false });
  const dofRT = new THREE.WebGLRenderTarget(W, H, { ...rtOpts, depthBuffer: false });
  const half = new THREE.WebGLRenderTarget(W >> 1, H >> 1, { ...rtOpts, depthBuffer: false });
  const q1 = new THREE.WebGLRenderTarget(W >> 2, H >> 2, { ...rtOpts, depthBuffer: false });
  const q1b = q1.clone(), q2 = new THREE.WebGLRenderTarget(W >> 3, H >> 3, { ...rtOpts, depthBuffer: false }), q2b = q2.clone();
  const q3 = new THREE.WebGLRenderTarget(W >> 4, H >> 4, { ...rtOpts, depthBuffer: false }), q3b = q3.clone();
  const fHalf = half.clone(), fA = q1.clone(), fB = q1.clone();       // anamorphic streak chain

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quad.frustumCulled = false;
  const qs = new THREE.Scene(); qs.add(quad); const qc = new THREE.Camera();
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(qs, qc); };

  const sky = skyShared || { uSkyFull: { value: null }, uSkyClamp: { value: null }, uSkyRot: { value: 0 }, uSkyGain: { value: 1 } };
  const accumMat = new THREE.ShaderMaterial({
    uniforms: { ...sky, tSrc: { value: null }, tDepth: { value: null }, uW: { value: 1 }, uProjInv: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
      uCamPos: { value: new THREE.Vector3() }, uHazeDist: { value: 2500 }, uHazeH: { value: 400 }, uHazeOn: { value: 0 } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `${SKY_GLSL}
      uniform sampler2D tSrc; uniform sampler2D tDepth; uniform float uW; uniform mat4 uProjInv; uniform mat4 uCamWorld; uniform vec3 uCamPos;
      uniform float uHazeDist, uHazeH, uHazeOn; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tSrc, vUv); vec3 c = s.rgb;
        if (uHazeOn > 0.5 && s.a > 0.002) {
          float d = texture2D(tDepth, vUv).r;
          if (d < 0.999999) {
            vec4 vp = uProjInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); vp.xyz /= vp.w;
            vec3 wp = (uCamWorld * vec4(vp.xyz, 1.0)).xyz; vec3 rd = wp - uCamPos; float dist = length(rd); rd /= max(dist, 1e-4);
            float y0 = max(uCamPos.y, 0.0), y1 = max(wp.y, 0.0), dy = y1 - y0;
            float hk = abs(dy) < 1.0 ? exp(-0.5 * (y0 + y1) / uHazeH) : uHazeH * (exp(-y0 / uHazeH) - exp(-y1 / uHazeH)) / dy;
            float fog = (1.0 - exp(-dist / uHazeDist * hk)) * min(s.a, 1.0);
            c = mix(c, hazeColor(rd), fog);
          }
        }
        gl_FragColor = vec4(c * uW, uW);
      }`,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false,
  });
  const dofMat = new THREE.ShaderMaterial({
    uniforms: { tColor: { value: null }, tDepth: { value: null }, uNear: { value: 0.1 }, uFar: { value: 10000 }, uFocus: { value: 20 }, uCocK: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tColor; uniform sampler2D tDepth; uniform float uNear, uFar, uFocus, uCocK; uniform vec2 uRes; varying vec2 vUv;
      float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
      float coc(float z){ return min(uCocK * abs(1.0 - uFocus / z), 18.0); }
      void main(){
        float zc = lin(texture2D(tDepth, vUv).r); float cc = coc(zc);
        vec3 acc = texture2D(tColor, vUv).rgb; float wsum = 1.0;
        if (uCocK > 0.01) {
          const int N = 48; float ga = 2.39996;
          for (int i = 1; i < N; i++) {
            float r = sqrt(float(i) / float(N)) * 18.0; float a = float(i) * ga;
            vec2 o = vec2(cos(a), sin(a)) * r;
            vec2 uv = vUv + o / uRes;
            float zn = lin(texture2D(tDepth, uv).r); float cn = coc(zn);
            float cEff = zn < zc ? cn : min(cn, cc);
            float w = clamp(cEff - r + 1.0, 0.0, 1.0) / max(cEff * cEff, 1.0);
            acc += texture2D(tColor, uv).rgb * w; wsum += w;
          }
        }
        gl_FragColor = vec4(acc / wsum, 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  const brightMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uThresh: { value: 1.0 }, uTexel: { value: new THREE.Vector2(1 / W, 1 / H) } }, vertexShader: FS_VERT,
    fragmentShader: `uniform sampler2D tSrc; uniform float uThresh; uniform vec2 uTexel; varying vec2 vUv;
      void main(){ vec3 c = (texture2D(tSrc, vUv + uTexel * vec2(-0.5,-0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5,-0.5)).rgb
        + texture2D(tSrc, vUv + uTexel * vec2(-0.5,0.5)).rgb + texture2D(tSrc, vUv + uTexel * vec2(0.5,0.5)).rgb) * 0.25;
        float l = max(max(c.r, c.g), c.b); c *= max(l - uThresh, 0.0) / max(l, 1e-4); gl_FragColor = vec4(min(c, vec3(60.0)), 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const blurMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } }, vertexShader: FS_VERT,
    fragmentShader: `uniform sampler2D tSrc; uniform vec2 uDir; varying vec2 vUv;
      void main(){ vec3 c = texture2D(tSrc, vUv).rgb * 0.2270;
        c += (texture2D(tSrc, vUv + uDir * 1.3846).rgb + texture2D(tSrc, vUv - uDir * 1.3846).rgb) * 0.3162;
        c += (texture2D(tSrc, vUv + uDir * 3.2308).rgb + texture2D(tSrc, vUv - uDir * 3.2308).rgb) * 0.0703;
        gl_FragColor = vec4(c, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  // horizontal-only exponential kernel; run at growing steps it gives a long streak with a hot core
  const streakMat = new THREE.ShaderMaterial({
    uniforms: { tSrc: { value: null }, uStep: { value: 1 / W } }, vertexShader: FS_VERT,
    fragmentShader: `uniform sampler2D tSrc; uniform float uStep; varying vec2 vUv;
      void main(){ vec3 c = vec3(0.0); float ws = 0.0;
        for (int i = -7; i <= 7; i++){ float w = exp(-abs(float(i)) * 0.38); c += texture2D(tSrc, vUv + vec2(uStep * float(i), 0.0)).rgb * w; ws += w; }
        gl_FragColor = vec4(c / ws, 1.0); }`,
    depthTest: false, depthWrite: false,
  });
  const finalMat = new THREE.ShaderMaterial({
    uniforms: {
      tSrc: { value: null }, tB1: { value: q1.texture }, tB2: { value: q2.texture }, tB3: { value: q3.texture }, tFlare: { value: fA.texture },
      uFlare: { value: 0.5 }, uFlareTint: { value: new THREE.Vector3(0.55, 0.75, 1.0) }, uHal: { value: 0.35 },
      uExposure: { value: 1 }, uBloom: { value: 0.06 }, uFrame: { value: 0 }, uRes: { value: new THREE.Vector2(W, H) },
      uGrain: { value: 0.035 }, uVignette: { value: 0.35 }, uTeal: { value: new THREE.Vector3(-0.012, 0.004, 0.018) }, uOrange: { value: new THREE.Vector3(0.03, 0.008, -0.03) },
      uSat: { value: 1.0 }, uContrast: { value: 1.05 }, uLift: { value: 0.0 }, uWB: { value: new THREE.Vector3(1, 1, 1) }, uDemag: { value: 0.5 },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSrc, tB1, tB2, tB3, tFlare; uniform float uExposure, uBloom, uFrame, uGrain, uVignette, uSat, uContrast, uLift, uFlare, uHal, uDemag; uniform vec2 uRes;
      uniform vec3 uTeal, uOrange, uWB, uFlareTint; varying vec2 vUv;
      vec3 aces(vec3 v){
        const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        v = I * v; v = (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.4329510) + 0.238081); return clamp(O * v, 0.0, 1.0); }
      float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        vec3 c = texture2D(tSrc, vUv).rgb;
        vec3 b1 = texture2D(tB1, vUv).rgb;
        vec3 b = b1 * 0.5 + texture2D(tB2, vUv).rgb * 0.3 + texture2D(tB3, vUv).rgb * 0.2;
        vec3 fl = texture2D(tFlare, vUv).rgb;
        float fll = dot(fl, vec3(0.333));
        c = c + b * uBloom + b1 * vec3(1.0, 0.3, 0.12) * uBloom * uHal          // halation: red fringe around highlights
          + (fl * 0.35 + uFlareTint * fll) * uFlare;                              // anamorphic streak, cool-tinted
        c *= uExposure * uWB;
        c = aces(c);
        // grade in display space
        c = pow(c, vec3(1.0 / 2.2));
        // no magenta/purple cast (twilight skies, HDRI clouds): green is lifted toward the lower of red/blue
        c.g += max(min(c.r, c.b) - c.g, 0.0) * uDemag;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        float mx = max(max(c.r, c.g), c.b), sat = (mx - min(min(c.r, c.g), c.b)) / max(mx, 1e-3);
        float keep = smoothstep(0.04, 0.2, sat);                                   // neutral greys (the hull) stay neutral
        c += uTeal * (1.0 - smoothstep(0.05, 0.55, l)) * mix(0.35, 1.0, keep) + uOrange * smoothstep(0.35, 0.95, l) * mix(0.2, 1.0, keep);
        float wv = c.r - c.b;                                                      // warm hues toward amber, cool toward teal
        c += (vec3(0.05, 0.012, -0.04) * max(wv, 0.0) + vec3(-0.03, 0.02, 0.015) * max(-wv, 0.0)) * keep;
        c = mix(vec3(l), c, uSat);
        c = (c - 0.5) * uContrast + 0.5 + uLift;
        vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
        c *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(q));
        // grain: a fine and a 2-px clumped layer, strongest in the mid-tones, faintly chromatic
        vec2 gp = vUv * uRes; float fo = fract(uFrame * 0.6180339) * 917.0;
        float gf = h(gp + fo) + h(gp * 1.37 + uFrame * 3.17) - 1.0;
        vec2 gc = floor(gp * 0.5);
        float gk = h(gc + fo * 1.3) + h(gc * 1.21 + uFrame * 1.91) - 1.0;
        float g = gf * 0.6 + gk * 0.55;
        vec3 gcol = vec3(1.0) + 0.25 * vec3(h(gp + fo + 17.0) - 0.5, 0.0, h(gp + fo + 41.0) - 0.5);
        c += g * gcol * uGrain * (0.45 + 2.2 * l * (1.0 - l)) * 1.15;
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
    depthTest: false, depthWrite: false,
  });

  // render N sub-frames; the centre one last so its depth drives the DOF
  function render(drawScene, n, frame) {
    const order = [];
    for (let i = 0; i < n; i++) order.push(i);
    if (n > 1) { const mid = (n - 1) >> 1; order.splice(mid, 1); order.push(mid); }
    renderer.setRenderTarget(accumRT); renderer.setClearColor(0x000000, 0); renderer.clear(true, false, false);
    let cam;
    for (const i of order) {
      cam = drawScene(n > 1 ? (i + 0.5) / n - 0.5 : 0, i);
      renderer.setRenderTarget(sceneRT); renderer.clear(true, true, false);
      renderer.render(cam.scene, cam.camera);
      const au = accumMat.uniforms, lk = cam.look;
      au.tSrc.value = sceneRT.texture; au.tDepth.value = sceneRT.depthTexture; au.uW.value = 1 / n;
      au.uProjInv.value.copy(cam.camera.projectionMatrixInverse); au.uCamWorld.value.copy(cam.camera.matrixWorld); au.uCamPos.value.copy(cam.camera.position);
      au.uHazeOn.value = lk.haze === false || !skyShared ? 0 : 1; au.uHazeDist.value = lk.hazeDist ?? lk.fogDist ?? 2500; au.uHazeH.value = lk.hazeH ?? 400;
      pass(accumMat, accumRT);
    }
    const look = cam.look, du = dofMat.uniforms;
    du.tColor.value = accumRT.texture; du.tDepth.value = sceneRT.depthTexture;
    du.uNear.value = cam.camera.near; du.uFar.value = cam.camera.far; du.uFocus.value = cam.focus; du.uCocK.value = cam.cocK;
    pass(dofMat, dofRT);
    brightMat.uniforms.tSrc.value = dofRT.texture; brightMat.uniforms.uThresh.value = look.bloomThresh ?? 1.2; pass(brightMat, half);
    const blur = (src, tmp, dst, w, h) => {
      blurMat.uniforms.tSrc.value = src; blurMat.uniforms.uDir.value.set(1 / w, 0); pass(blurMat, tmp);
      blurMat.uniforms.tSrc.value = tmp.texture; blurMat.uniforms.uDir.value.set(0, 1 / h); pass(blurMat, dst);
    };
    blur(half.texture, q1b, q1, W >> 2, H >> 2);
    blur(q1.texture, q2b, q2, W >> 3, H >> 3);
    blur(q2.texture, q3b, q3, W >> 4, H >> 4);
    // anamorphic streak: only what is far above display white (sun disc, nav lights)
    brightMat.uniforms.tSrc.value = dofRT.texture; brightMat.uniforms.uThresh.value = (look.flareThresh ?? 14) / Math.max(look.exposure, 1e-3); pass(brightMat, fHalf);
    streakMat.uniforms.tSrc.value = fHalf.texture; streakMat.uniforms.uStep.value = 1 / (W >> 2); pass(streakMat, fA);
    streakMat.uniforms.tSrc.value = fA.texture; streakMat.uniforms.uStep.value = 6 / (W >> 2); pass(streakMat, fB);
    streakMat.uniforms.tSrc.value = fB.texture; streakMat.uniforms.uStep.value = 30 / (W >> 2); pass(streakMat, fA);
    const f = finalMat.uniforms;
    f.tSrc.value = dofRT.texture; f.uExposure.value = look.exposure; f.uBloom.value = look.bloom ?? 0.06; f.uFrame.value = frame;
    f.uFlare.value = look.flare ?? 0.5; f.uHal.value = look.halation ?? 0.35; f.uDemag.value = look.demag ?? 0.5;
    for (const k of ["grain", "vignette", "sat", "contrast", "lift"]) if (look[k] !== undefined) f["u" + k[0].toUpperCase() + k.slice(1)].value = look[k];
    f.uWB.value.set(...(look.wb || [1, 1, 1])); if (look.teal) f.uTeal.value.set(...look.teal); if (look.orange) f.uOrange.value.set(...look.orange);
    pass(finalMat, null);
  }
  return { render, sceneRT };
}
