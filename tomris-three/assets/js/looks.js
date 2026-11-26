// Looks: engine + post parameters per lighting setup. Owned by the water/sky/grade workstream.
// ---- looks (engine + post parameters) ----
export const LOOKS = {
  sunset: { sky: "sunset", exposure: 0.39, skyGain: 1, sunGain: 9, sunColor: [1.0, 0.62, 0.36], envGain: 1.4, keyGain: 1, fogDist: 2200, glitter: 1, bloom: 0.08, bloomThresh: 1.5,
    navEmissive: 2, navLight: 0.2, navGlow: 0.15, grain: 0.03, vignette: 0.32, sat: 1.0, contrast: 1.06,
    teal: [-0.014, 0.006, 0.02], orange: [0.035, 0.01, -0.03], lampGain: 0.25, fogDensity: 0, fogTint: [1.0, 0.85, 0.75],
    wb: [0.92, 1.0, 1.08], hazeDist: 1500, hazeH: 500, flare: 0.12 },
  // harbour departure (setup B): calm sea, sun ~1 deg dead astern, shooting into it. Richer golden-hour
  // contrast: thinner haze (cranes/hills read as layered silhouettes, near darker than far), lower exposure so the
  // sun is a disc + glow rather than a white-out, deep reflective water with a clear glitter path.
  harbour: { sky: "sunset", exposure: 0.25, skyGain: 1, sunGain: 9, sunColor: [1.0, 0.62, 0.36], envGain: 1.4, keyGain: 1, fogDist: 3500, glitter: 1, bloom: 0.06, bloomThresh: 2.2,
    navEmissive: 2, navLight: 0.2, navGlow: 0.15, grain: 0.03, vignette: 0.34, sat: 1.1, contrast: 1.18, lift: -0.01,
    teal: [-0.014, 0.006, 0.02], orange: [0.035, 0.01, -0.03], lampGain: 0.25, fogDensity: 0, fogTint: [1.0, 0.85, 0.75],
    wb: [0.9, 1.0, 1.1], hazeDist: 6000, hazeH: 150, flare: 0.1, deep: [0.006, 0.018, 0.04] },
  bluehour: { sky: "dusk", exposure: 0.62, wb: [1, 1, 1], hazeDist: 1300, hazeH: 500, flare: 0.08, deep: [0.016, 0.04, 0.085], skyGain: 1, sunGain: 0.0, envGain: 1, keyGain: 1, fogDist: 1800, glitter: 0, bloom: 0.14, bloomThresh: 1.0,
    navEmissive: 60, navLight: 0.6, navGlow: 1.0, grain: 0.04, vignette: 0.38, sat: 1.0, contrast: 1.06,
    teal: [-0.01, 0.006, 0.03], orange: [0.02, 0.005, -0.02], lampGain: 1.2, fogDensity: 0, fogTint: [0.8, 0.9, 1.1] },
  studio: { sky: "sunset", exposure: 0.7, skyGain: 1, sunGain: 8, sunColor: [1.0, 0.95, 0.9], envGain: 0.32, keyGain: 1, fogDist: 2000, glitter: 0, bloom: 0.06, bloomThresh: 1.6,
    navEmissive: 0, navLight: 0, navGlow: 0, grain: 0.035, vignette: 0.5, sat: 0.95, contrast: 1.1,
    teal: [-0.01, 0.004, 0.016], orange: [0.02, 0.006, -0.016], haze: false },
  wireframe: { sky: "dusk", exposure: 1.0, skyGain: 1, sunGain: 6, sunColor: [1, 1, 1], envGain: 0.05, keyGain: 1, fogDist: 2000, glitter: 0, bloom: 0.3, bloomThresh: 0.55,
    navEmissive: 0, navLight: 0, navGlow: 0, grain: 0.03, vignette: 0.5, sat: 1.0, contrast: 1.05, teal: [0, 0, 0], orange: [0, 0, 0], haze: false },
};
