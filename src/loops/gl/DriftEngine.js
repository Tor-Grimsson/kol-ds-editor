// Drift engine — ONE fullscreen-quad engine rendering seamless motion loops.
// Three families share the same loop machinery; each supplies a fragment shader
// (a field + a shading model). The engine is constructed with a `family` and
// picks the matching shader; everything else (lifecycle, loop, export) is shared.
//
// SEAMLESS LOOP: time never enters the visible field linearly. Detail noise is
// sampled on a CIRCLE in two extra dimensions (looped 4-D simplex), and every
// wave/sway uses an integer number of cycles per loop (`TAU*phase*n`). At
// phase 0 and phase 1 every sample coincides → frame-0 == frame-N with full
// detail and no cross-dissolve ghosting. The live view is already a perfect
// loop of length `period` seconds; the phase-3 recorder just steps phase 0→1.

import * as THREE from 'three'
import { PALETTES, paletteBy } from './driftPalettes.js'

export { PALETTES }

// Field code-paths per family. A preset picks one + tunes params; the editor
// also exposes it as the Style dropdown. The int is the within-family index the
// fragment shader switches on (uStyle).
export const STYLES = {
  air: [
    { value: 'clouds', label: 'Clouds' },
    { value: 'cirrus', label: 'Cirrus' },
    { value: 'aurora', label: 'Aurora' },
  ],
  water: [
    { value: 'waves', label: 'Waves' },
    { value: 'ripples', label: 'Ripples' },
    { value: 'caustics', label: 'Caustics' },
  ],
  cloth: [
    { value: 'folds', label: 'Folds' },
    { value: 'flag', label: 'Flag' },
    { value: 'drape', label: 'Drape' },
  ],
}
const STYLE_INT = {
  clouds: 0, cirrus: 1, aurora: 2,
  waves: 0, ripples: 1, caustics: 2,
  folds: 0, flag: 1, drape: 2,
}

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const HEAD = `
  precision highp float;
  varying vec2 vUv;
  uniform float uPhase, uAspect;
  uniform float uScale, uWarp, uEvolve, uGust, uContrast, uCoverage, uSoft, uSheen, uGrain;
  uniform float uAmp, uChop, uFoam, uFold, uDrape, uSway;
  uniform vec2  uFlow, uLight;   // direction vectors (unit)
  uniform int   uStyle;
  uniform vec3  uColors[5];
  uniform vec3  uBase;
`

// 4-D simplex noise — Ashima Arts / Stefan Gustavson (webgl-noise, MIT).
const SNOISE4 = `
  vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
  float mod289(float x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  float permute(float x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314*r; }
  float taylorInvSqrt(float r){ return 1.79284291400159 - 0.85373472095314*r; }
  vec4 grad4(float j, vec4 ip){
    const vec4 ones = vec4(1.0, 1.0, 1.0, -1.0);
    vec4 p, s;
    p.xyz = floor( fract(vec3(j) * ip.xyz) * 7.0) * ip.z - 1.0;
    p.w = 1.5 - dot(abs(p.xyz), ones.xyz);
    s = vec4(lessThan(p, vec4(0.0)));
    p.xyz = p.xyz + (s.xyz*2.0 - 1.0) * s.www;
    return p;
  }
  float snoise(vec4 v){
    const vec4 C = vec4(0.138196601125011, 0.276393202250021, 0.414589803375032, -0.447213595499958);
    vec4 i  = floor(v + dot(v, vec4(0.309016994374947451)) );
    vec4 x0 = v - i + dot(i, C.xxxx);
    vec4 i0;
    vec3 isX  = step(x0.yzw, x0.xxx);
    vec3 isYZ = step(x0.zww, x0.yyz);
    i0.x = isX.x + isX.y + isX.z;
    i0.yzw = 1.0 - isX;
    i0.y += isYZ.x + isYZ.y;
    i0.zw += 1.0 - isYZ.xy;
    i0.z += isYZ.z;
    i0.w += 1.0 - isYZ.z;
    vec4 i3 = clamp(i0, 0.0, 1.0);
    vec4 i2 = clamp(i0 - 1.0, 0.0, 1.0);
    vec4 i1 = clamp(i0 - 2.0, 0.0, 1.0);
    vec4 x1 = x0 - i1 + C.xxxx;
    vec4 x2 = x0 - i2 + C.yyyy;
    vec4 x3 = x0 - i3 + C.zzzz;
    vec4 x4 = x0 + C.wwww;
    i = mod289(i);
    float j0 = permute(permute(permute(permute(i.w) + i.z) + i.y) + i.x);
    vec4 j1 = permute(permute(permute(permute(
                i.w + vec4(i1.w, i2.w, i3.w, 1.0))
              + i.z + vec4(i1.z, i2.z, i3.z, 1.0))
              + i.y + vec4(i1.y, i2.y, i3.y, 1.0))
              + i.x + vec4(i1.x, i2.x, i3.x, 1.0));
    vec4 ip = vec4(1.0/294.0, 1.0/49.0, 1.0/7.0, 0.0);
    vec4 p0 = grad4(j0,   ip);
    vec4 p1 = grad4(j1.x, ip);
    vec4 p2 = grad4(j1.y, ip);
    vec4 p3 = grad4(j1.z, ip);
    vec4 p4 = grad4(j1.w, ip);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    p4 *= taylorInvSqrt(dot(p4,p4));
    vec3 m0 = max(0.6 - vec3(dot(x0,x0), dot(x1,x1), dot(x2,x2)), 0.0);
    vec2 m1 = max(0.6 - vec2(dot(x3,x3), dot(x4,x4)), 0.0);
    m0 = m0*m0; m1 = m1*m1;
    return 49.0 * ( dot(m0*m0, vec3(dot(p0,x0), dot(p1,x1), dot(p2,x2)))
                  + dot(m1*m1, vec2(dot(p3,x3), dot(p4,x4))) );
  }
`

// Shared helpers used by every family's main().
const SHARED = `
  const float TAU = 6.28318530718;
  ${SNOISE4}
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  // noise sampled on a circle in (z,w) → perfectly periodic in phase.
  float loopNoise(vec2 p, float ph, float r){
    float a = TAU * ph;
    return snoise(vec4(p, r * cos(a), r * sin(a)));
  }
  float lfbm(vec2 p, float ph, float r){
    float v = 0.0, amp = 0.5;
    for (int i = 0; i < 4; i++){ v += amp * loopNoise(p, ph, r); p *= 2.02; amp *= 0.5; r *= 1.7; }
    return v;
  }
  vec3 ramp(float t){
    float ft = clamp(t, 0.0, 1.0) * 4.0;     // 5 stops → 4 segments
    int i = int(floor(ft));
    vec3 a = uColors[i];
    vec3 b = uColors[i + 1 < 5 ? i + 1 : 4];
    return mix(a, b, fract(ft));
  }
  // loop-safe grain: seeded off the same phase circle so it closes too.
  float grain(float ph){ return hash(vUv * vec2(1920.0, 1080.0) + (0.5 + 0.5*cos(TAU*ph)) * 13.0) - 0.5; }
`

// ── Air ──────────────────────────────────────────────────────────────────────
const AIR = `
  void main(){
    vec2 p = vUv * 2.0 - 1.0;  p.x *= uAspect;
    float ph = uPhase;
    vec2 gust = uFlow * sin(TAU * ph) * uGust;   // directional sway, loop-safe

    float f; float sheen = 0.0;
    if (uStyle == 1) {
      vec2 ps = vec2(p.x * 0.28 + p.y * 0.22, p.y * 1.25) * uScale + gust;   // cirrus
      f = lfbm(ps, ph, uEvolve);
    } else if (uStyle == 2) {
      vec2 sp = p * uScale + gust;                                            // aurora
      float band = sp.x * 1.6 + 0.6 * lfbm(vec2(sp.y * 1.2, 0.0), ph, uEvolve);
      f = sin(band * 3.14159) * 0.5 + 0.4 * lfbm(sp, ph, uEvolve);
    } else {
      vec2 sp = p * 0.62 * uScale + gust;                                     // clouds (domain-warped)
      vec2 q = vec2(lfbm(sp + vec2(0.0, 1.3), ph, uEvolve), lfbm(sp + vec2(5.2, 1.3), ph, uEvolve));
      vec2 r = vec2(lfbm(sp + uWarp * q + vec2(1.7, 9.2), ph, uEvolve),
                    lfbm(sp + uWarp * q + vec2(8.3, 2.8), ph, uEvolve));
      f = lfbm(sp + uWarp * r, ph, uEvolve);
      sheen = pow(clamp(length(r) * 0.6, 0.0, 1.0), 3.0);
    }

    float d = clamp(f * 0.5 + 0.5, 0.0, 1.0);
    vec3 cloudCol = ramp(d);
    float edge = mix(0.04, 0.6, uSoft);
    float lo = 1.0 - uCoverage;
    float cov = smoothstep(lo, lo + edge, d);
    vec3 col = mix(uBase, cloudCol, cov);
    col += sheen * uSheen * 0.18 * cov;
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    col += grain(ph) * uGrain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

// ── Water ────────────────────────────────────────────────────────────────────
const WATER = `
  // height field — directional swells (integer cycles/loop) + looped ripple.
  float waterH(vec2 p, float ph, float scl){
    vec2 d1 = normalize(uFlow + vec2(0.0001));
    vec2 d2 = normalize(vec2(-d1.y, d1.x) * 0.7 + d1 * 0.3);
    float k = uScale * scl;
    float a = uAmp;
    float v = 0.0;
    v += a       * sin(dot(p, d1) * 2.2 * k + TAU * ph * 2.0);
    v += a * 0.55 * sin(dot(p, d2) * 3.6 * k + TAU * ph * 3.0);
    v += a * 0.30 * sin(dot(p, normalize(d1 + d2)) * 6.0 * k + TAU * ph * 5.0);
    v += uChop * 0.35 * lfbm(p * 3.0 * k, ph, uEvolve);
    return v;
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;  p.x *= uAspect;
    float ph = uPhase;

    if (uStyle == 2) {   // caustics — ridged looped-noise veins over deep water
      float c = pow(1.0 - abs(lfbm(p * 2.4 * uScale, ph, uEvolve)), 6.0)
              + 0.6 * pow(1.0 - abs(lfbm(p * 4.8 * uScale + vec2(3.0), ph, uEvolve)), 8.0);
      c *= uChop + 0.5;
      vec3 col = ramp(clamp(0.3 + c * 0.7, 0.0, 1.0));
      col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
      col += grain(ph) * uGrain;
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      return;
    }

    float scl = (uStyle == 1) ? 2.2 : 1.0;   // ripples = higher frequency
    float e = 0.0022;
    float hC = waterH(p, ph, scl);
    float hX = waterH(p + vec2(e, 0.0), ph, scl);
    float hY = waterH(p + vec2(0.0, e), ph, scl);
    vec3 n = normalize(vec3(hC - hX, hC - hY, e * 8.0));

    vec3 L = normalize(vec3(normalize(uLight + vec2(0.0001)) * 0.8, 0.6));
    vec3 V = vec3(0.0, 0.0, 1.0);
    float spec = pow(max(dot(reflect(-L, n), V), 0.0), 40.0) * uSheen;
    float fres = pow(1.0 - max(n.z, 0.0), 3.0);

    float t = clamp(0.5 + hC * 0.6, 0.0, 1.0);
    vec3 col = mix(ramp(t), uBase, fres * 0.6);   // sky reflection at grazing
    col += spec;
    float slope = clamp(length(vec2(hC - hX, hC - hY)) * 120.0, 0.0, 1.0);
    float foam = smoothstep(1.0 - uFoam, 1.0, max(slope, t * 0.8));
    col = mix(col, vec3(0.95), foam * uFoam);
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    col += grain(ph) * uGrain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

// ── Cloth ────────────────────────────────────────────────────────────────────
const CLOTH = `
  float clothH(vec2 p, float ph){
    vec2 fd = normalize(uFlow + vec2(0.0001));   // fold direction
    vec2 pd = vec2(-fd.y, fd.x);
    float k = uScale;
    float sway = uSway * sin(TAU * ph);
    float v = uFold * sin(dot(p, pd) * 5.0 * k + sway * 2.0 + 0.6 * lfbm(p * 1.5 * k, ph, uEvolve));
    if (uStyle == 1) v += uFold * 0.7 * sin(dot(p, fd) * 4.0 * k + TAU * ph * 2.0);          // flag travel
    if (uStyle == 2) v += uDrape * sin(p.y * 3.0 * k + TAU * ph) * (0.5 + 0.5 * p.y);        // drape sag
    v += uDrape * 0.30 * lfbm(p * 4.0 * k, ph, uEvolve);                                     // wrinkle
    return v;
  }
  void main(){
    vec2 p = vUv * 2.0 - 1.0;  p.x *= uAspect;
    float ph = uPhase;
    float e = 0.0025;
    float hC = clothH(p, ph);
    float hX = clothH(p + vec2(e, 0.0), ph);
    float hY = clothH(p + vec2(0.0, e), ph);
    vec3 n = normalize(vec3(hC - hX, hC - hY, e * 6.0));

    vec3 L = normalize(vec3(normalize(uLight + vec2(0.0001)) * 0.9, 0.5));
    float diff = 0.5 + 0.5 * dot(n, L);
    float sheen = pow(1.0 - abs(dot(n, L)), 3.0) * uSheen;   // anisotropic satin rim
    vec3 col = ramp(clamp(diff, 0.0, 1.0));
    col += sheen * 0.5;
    col *= mix(1.0, 0.7, smoothstep(0.0, -uFold, hC));        // valley self-shadow
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
    col += grain(ph) * uGrain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

const FRAGS = {
  air: HEAD + SHARED + AIR,
  water: HEAD + SHARED + WATER,
  cloth: HEAD + SHARED + CLOTH,
}

const toVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class DriftEngine {
  constructor(family = 'air') {
    this.family = family
    this.renderer = null
    this.time = 0
    this.period = 8
    this.playing = true
    this.speed = 1
  }

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam = new THREE.Camera()
    const pal = PALETTES[this.family][0]
    this.uniforms = {
      uPhase: { value: 0 },
      uAspect: { value: 1 },
      uScale: { value: 1 },
      uWarp: { value: 1.6 },
      uEvolve: { value: 0.16 },
      uGust: { value: 0.25 },
      uContrast: { value: 1.1 },
      uCoverage: { value: 0.6 },
      uSoft: { value: 0.6 },
      uSheen: { value: 0.6 },
      uGrain: { value: 0.03 },
      uAmp: { value: 0.8 },
      uChop: { value: 0.5 },
      uFoam: { value: 0.3 },
      uFold: { value: 0.7 },
      uDrape: { value: 0.5 },
      uSway: { value: 0.5 },
      uFlow: { value: new THREE.Vector2(1, 0) },
      uLight: { value: new THREE.Vector2(0.7, 0.7) },
      uStyle: { value: 0 },
      uColors: { value: pal.cols.map(toVec3) },
      uBase: { value: toVec3(pal.base) },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAGS[this.family], uniforms: this.uniforms })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))
  }

  resize(w, h) {
    if (!this.renderer) return
    this.renderer.setSize(w, h, false)
    this.uniforms.uAspect.value = w / h
  }

  setParams(p) {
    if (!this.uniforms) return
    const u = this.uniforms
    if (p.freq != null) u.uScale.value = p.freq
    if (p.warp != null) u.uWarp.value = p.warp
    if (p.evolve != null) u.uEvolve.value = p.evolve
    if (p.wind != null) u.uGust.value = p.wind
    if (p.contrast != null) u.uContrast.value = p.contrast
    if (p.coverage != null) u.uCoverage.value = p.coverage
    if (p.soft != null) u.uSoft.value = p.soft
    if (p.sheen != null) u.uSheen.value = p.sheen
    if (p.grain != null) u.uGrain.value = p.grain
    if (p.amp != null) u.uAmp.value = p.amp
    if (p.chop != null) u.uChop.value = p.chop
    if (p.foam != null) u.uFoam.value = p.foam
    if (p.fold != null) u.uFold.value = p.fold
    if (p.drape != null) u.uDrape.value = p.drape
    if (p.sway != null) u.uSway.value = p.sway
    if (p.direction != null) {
      const a = (p.direction * Math.PI) / 180
      u.uFlow.value.set(Math.cos(a), Math.sin(a))
    }
    if (p.light != null) {
      const a = (p.light * Math.PI) / 180
      u.uLight.value.set(Math.cos(a), Math.sin(a))
    }
    if (p.period != null) this.period = p.period
    if (p.speed != null) this.speed = p.speed
    if (p.style != null) u.uStyle.value = STYLE_INT[p.style] ?? 0
    if (p.palette != null) {
      const pal = paletteBy(this.family, p.palette)
      u.uColors.value = pal.cols.map(toVec3)
      u.uBase.value = toVec3(pal.base)
    }
  }

  setPlaying(v) { this.playing = v }

  frame(dt) {
    if (!this.renderer) return
    if (this.playing) this.time += dt * this.speed
    const T = this.period || 8
    let ph = (this.time % T) / T
    if (ph < 0) ph += 1
    this.uniforms.uPhase.value = ph
    this.renderer.render(this.scene, this.cam)
  }

  resetTime() { this.time = 0; this.uniforms.uPhase.value = 0; if (this.renderer) this.renderer.render(this.scene, this.cam) }

  // Render one explicit phase (0..1) — used by the seamless-loop recorder so the
  // export steps phase deterministically instead of riding the wall clock.
  renderAtPhase(ph) {
    if (!this.renderer) return
    let p = ph % 1
    if (p < 0) p += 1
    this.uniforms.uPhase.value = p
    this.renderer.render(this.scene, this.cam)
  }

  exportBlob(w, h) {
    return new Promise((res) => {
      if (!this.renderer) return res(null)
      const prev = { w: this.renderer.domElement.width, h: this.renderer.domElement.height }
      this.resize(w, h)
      this.renderer.render(this.scene, this.cam)
      this.renderer.domElement.toBlob((b) => { this.resize(prev.w, prev.h); res(b) }, 'image/png')
    })
  }

  destroy() {
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
