// Iridescent gradient engine — one fullscreen ShaderMaterial covering 12 gradient
// explorations across 3 category branches (uCat) × 4 sub-types (uType):
//
//   Field  (0)  linear · stripe · radial · conic      — flat colour gradients
//   Pole   (1)  monopole · multipole · mesh · aurora  — influence fields
//   Volume (2)  blobs · spiral · dome · ripple         — glossy 3D-reading forms
//
// All share one palette / spectral / iridescence / surface model. three.js.

import * as THREE from 'three'

// 5-stop palettes for the "Ramp" colour mode ("Spectral" sweeps a cosine rainbow).
export { GRAD_PALETTES, BACKDROPS } from './gradEnums.js'
import { GRAD_PALETTES, BACKDROPS, GRAD_LOOKS } from './gradEnums.js'

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uAspect, uSize, uSpread, uIrid, uHue, uSheen, uGloss;
  uniform float uRelief, uWarp, uGrain, uSpectral, uAngle, uFreq;
  uniform float uWinds, uPitch, uPetals, uSpin, uMouth;
  uniform int uCat, uType, uCount;
  uniform vec3 uBg;
  uniform vec3 uColors[5];

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),
               mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x), u.y);
  }
  float fbm(vec2 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }

  vec3 spectral(float t){
    t = fract(t);
    return 0.5 + 0.5*cos(6.28318*(t + vec3(0.0, 0.33, 0.67)));
  }
  vec3 ramp(float t){
    t = fract(t) * 4.0;
    int i = int(floor(t));
    vec3 a = uColors[i];
    vec3 b = uColors[i + 1 < 5 ? i + 1 : 4];
    return mix(a, b, fract(t));
  }
  vec3 tint(float ci){ return mix(ramp(fract(ci)), spectral(ci), uSpectral); }
  vec3 poleColor(int i){
    int idx = i < 5 ? i : 4;
    return mix(uColors[idx], spectral(uHue + float(i) * 0.18), uSpectral);
  }

  // Shared surface lighting: soft key light + broad glossy specular + rim lift.
  vec3 applyLight(vec3 col, vec3 n){
    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 L = normalize(vec3(0.35, 0.55, 0.85));
    vec3 H = normalize(L + viewDir);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
    col *= 0.58 + 0.42 * max(dot(n, L), 0.0);
    col += pow(max(dot(n, H), 0.0), uGloss) * uSheen;
    col += col * fres * 0.35;
    return col;
  }

  vec2 blobPos(int i){
    float fi = float(i);
    return vec2(sin(uTime*0.30 + fi*2.10)*uSpread,
                cos(uTime*0.26 + fi*1.70)*uSpread*0.82);
  }
  float field(vec2 q){
    float s = 0.0;
    for(int i=0;i<6;i++){
      if(i>=uCount) break;
      vec2 d = q - blobPos(i);
      s += (uSize*uSize) / (dot(d,d) + 0.0009);
    }
    return s;
  }
  float heightOf(float v){ return smoothstep(0.65, 3.2, v); }

  vec4 blobLayer(vec2 q){
    float e = 0.014;
    float h  = heightOf(field(q));
    float hx = heightOf(field(q + vec2(e, 0.0)));
    float hy = heightOf(field(q + vec2(0.0, e)));
    vec2 g = vec2(hx - h, hy - h) / e;
    vec3 n = normalize(vec3(-g * uRelief, 1.0));
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
    float ci = uHue + uIrid * (fres * 1.25 + (n.x * 0.5 + 0.5) * 0.55 + h * 0.45) + uTime * 0.018;
    return vec4(applyLight(tint(ci), n), smoothstep(0.015, 0.22, h));
  }

  vec3 coreGlow(vec2 q){
    float d = length(q);
    float m = smoothstep(uMouth * 1.25, 0.0, d);
    vec3 n = normalize(vec3(-q * 1.6, 1.0));
    float ci = uHue + uIrid * ((q.x * 0.5 + 0.5) * 0.6 + d * 0.6) + uTime * 0.05;
    return applyLight(tint(ci), n) * m;
  }

  vec3 spiralLayer(vec2 c){
    float r = length(c) + 1e-4;
    float ang = atan(c.y, c.x);
    float scallop = 0.07 * sin(ang * uPetals + uTime * 0.1);
    float sp = ang * (uWinds * 0.159155) + log(r) * uPitch + scallop - uTime * 0.15 * uSpin;
    float cell = fract(sp);
    float fid = floor(sp);
    float bump = sin(cell * 3.14159);
    float seam = smoothstep(0.0, 0.10, cell) * smoothstep(1.0, 0.90, cell);
    vec2 gdir = (uWinds * 0.159155) * vec2(-c.y, c.x) / (r * r) + uPitch * c / (r * r);
    float slope = cos(cell * 3.14159) * 3.14159;
    vec3 n = normalize(vec3(-gdir * slope * uRelief * 0.05, 1.0));
    float ci = uHue + uIrid * 0.5 * (fid * 0.10 + (n.x * 0.5 + 0.5) * 0.5);
    vec3 plate = applyLight(tint(ci), n) * (0.35 + 0.65 * bump);
    plate = mix(uBg, plate, seam);
    float mouth = smoothstep(0.0, uMouth, r);
    return mix(uBg, plate, mouth) + coreGlow(c) * (1.0 - mouth * 0.6);
  }

  // ── Field — flat colour gradients ──
  vec3 fieldCol(vec2 q, vec2 p){
    float s;
    vec2 dir = vec2(cos(uAngle), sin(uAngle));
    if (uType == 0) s = clamp(dot(q, dir) * 0.6 + 0.5, 0.0, 1.0);                 // linear
    else if (uType == 1) { float x = dot(q, dir) * uFreq - uTime * 0.1 * uSpin; s = abs(fract(x) * 2.0 - 1.0); } // stripe
    else if (uType == 2) s = clamp(length(q) * uFreq * 0.6, 0.0, 1.0);           // radial
    else s = fract(atan(q.y, q.x) * 0.159155 + 0.5 + uAngle * 0.159155 - uTime * 0.05 * uSpin); // conic
    vec3 col = tint(uHue + s * uIrid);
    col *= mix(1.0, smoothstep(1.75, 0.1, length(p)), 0.22); // soft vignette
    return col;
  }

  // ── Pole — influence fields ──
  vec3 poleCol(vec2 q){
    if (uType == 0) { // monopole
      vec2 src = vec2(sin(uTime * 0.2) * uSpread, cos(uTime * 0.17) * uSpread);
      float d = length(q - src);
      float infl = 1.0 / (1.0 + d * d * uFreq * 1.5);
      return tint(uHue + (1.0 - infl) * uIrid) + infl * infl * uSheen * 0.4;
    } else if (uType == 1) { // multipole (inverse-distance blend)
      vec3 acc = vec3(0.0); float wsum = 0.0;
      for (int i = 0; i < 5; i++) {
        if (i >= uCount) break;
        vec2 pp = blobPos(i);
        float d = distance(q, pp);
        float w = 1.0 / (d * d + 0.02);
        acc += poleColor(i) * w; wsum += w;
      }
      vec3 col = acc / max(wsum, 1e-4);
      float sh = pow(max(0.0, 0.5 + 0.5 * sin((q.x + q.y) * 3.1416 - uTime * 0.2)), 3.0);
      return col + sh * uSheen * 0.2;
    } else if (uType == 2) { // bilinear mesh (4 palette corners)
      vec2 g = clamp(q * 0.5 + 0.5, 0.0, 1.0);
      return mix(mix(poleColor(0), poleColor(1), g.x), mix(poleColor(2), poleColor(3), g.x), g.y);
    } else { // aurora — domain-warped fbm
      vec2 sp = q * 0.7;
      vec2 a = vec2(fbm(sp + vec2(0.0, uTime * 0.08)), fbm(sp + vec2(5.2, 1.3) - uTime * 0.08));
      vec2 b = vec2(fbm(sp + 1.6 * a + uTime * 0.06), fbm(sp + 1.6 * a + vec2(8.3, 2.8) - uTime * 0.06));
      float f = fbm(sp + 2.2 * b);
      return tint(uHue + (f * 0.5 + 0.5) * uIrid);
    }
  }

  // ── Volume — glossy 3D-reading forms ──
  vec3 volumeCol(vec2 q, vec2 p){
    if (uType == 0) { vec4 bl = blobLayer(q); return mix(uBg, bl.rgb, bl.a); }
    if (uType == 1) return spiralLayer(q);
    if (uType == 2) { // dome — glossy iridescent orb
      float R = uSize * 1.6;
      float rr = length(q) / R;
      vec3 col = uBg;
      if (rr < 1.0) {
        float h = sqrt(max(0.0, 1.0 - rr * rr));
        vec3 n = normalize(vec3(q / R, h));
        float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 2.4);
        float ci = uHue + uIrid * (fres * 1.1 + (n.x * 0.5 + 0.5) * 0.5 + h * 0.4) + uTime * 0.05;
        col = applyLight(tint(ci), n);
      }
      return mix(uBg, col, smoothstep(1.02, 0.96, rr));
    }
    // ripple — concentric glossy ridges
    float e = 0.01;
    float k = uFreq * 3.0; float ph = uTime * uSpin * 1.5;
    float hC = 0.5 + 0.5 * sin(length(q) * k - ph);
    float hX = 0.5 + 0.5 * sin(length(q + vec2(e, 0.0)) * k - ph);
    float hY = 0.5 + 0.5 * sin(length(q + vec2(0.0, e)) * k - ph);
    vec2 gg = vec2(hX - hC, hY - hC) / e;
    vec3 n = normalize(vec3(-gg * uRelief * 0.15, 1.0));
    float ci = uHue + uIrid * (length(q) * 0.5 + hC * 0.4) + uTime * 0.04;
    vec3 col = applyLight(tint(ci), n);
    return col * mix(1.0, smoothstep(1.75, 0.1, length(p)), 0.3);
  }

  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    vec2 wv = vec2(fbm(p*1.4 + uTime*0.05), fbm(p*1.4 + 7.3 - uTime*0.05));
    vec2 q = p + (wv - 0.5) * uWarp;

    vec3 col;
    if (uCat == 0) col = fieldCol(q, p);
    else if (uCat == 1) col = poleCol(q);
    else col = volumeCol(q, p);

    col += (hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * uGrain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

const toVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class IridescentEngine {
  constructor() {
    this.renderer = null
    this.time = 0
    this.playing = true
    this.speed = 1
  }

  init(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.scene = new THREE.Scene()
    this.cam = new THREE.Camera()
    this.uniforms = {
      uTime: { value: 0 },
      uAspect: { value: 1 },
      uCat: { value: 2 },
      uType: { value: 0 },
      uCount: { value: 3 },
      uSize: { value: 0.62 },
      uSpread: { value: 0.42 },
      uIrid: { value: 1.15 },
      uHue: { value: 0 },
      uSheen: { value: 0.5 },
      uGloss: { value: 24 },
      uRelief: { value: 0.9 },
      uWarp: { value: 0.25 },
      uGrain: { value: 0.03 },
      uSpectral: { value: 1 },
      uAngle: { value: 0 },
      uFreq: { value: 2 },
      uWinds: { value: 5 },
      uPitch: { value: 2.4 },
      uPetals: { value: 9 },
      uSpin: { value: 1 },
      uMouth: { value: 0.5 },
      uBg: { value: toVec3('#000000') },
      uColors: { value: GRAD_PALETTES[0].cols.map(toVec3) },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat))
  }

  resize(w, h) {
    if (!this.renderer) return
    this.renderer.setSize(w, h, false) // exact artboard dims (pixelRatio 1)
    this.uniforms.uAspect.value = w / h
  }

  setParams(p) {
    if (!this.uniforms) return
    /* A named look (GRAD_LOOKS recipe) overrides the manual colour keys on
     * every apply — the catalog hides those knobs unless look === 'custom'. */
    const lk = p.look ? GRAD_LOOKS.find((x) => x.value === p.look) : null
    if (lk?.p) p = { ...p, ...lk.p }
    const u = this.uniforms
    if (p.cat != null) u.uCat.value = Math.round(p.cat)
    if (p.type != null) u.uType.value = Math.round(p.type)
    if (p.count != null) u.uCount.value = Math.max(1, Math.min(6, Math.round(p.count)))
    if (p.size != null) u.uSize.value = p.size
    if (p.spread != null) u.uSpread.value = p.spread
    if (p.irid != null) u.uIrid.value = p.irid
    if (p.hue != null) u.uHue.value = p.hue
    if (p.sheen != null) u.uSheen.value = p.sheen
    if (p.gloss != null) u.uGloss.value = p.gloss
    if (p.relief != null) u.uRelief.value = p.relief
    if (p.warp != null) u.uWarp.value = p.warp
    if (p.grain != null) u.uGrain.value = p.grain
    if (p.spectral != null) u.uSpectral.value = p.spectral ? 1 : 0
    if (p.angle != null) u.uAngle.value = p.angle
    if (p.freq != null) u.uFreq.value = p.freq
    if (p.winds != null) u.uWinds.value = p.winds
    if (p.pitch != null) u.uPitch.value = p.pitch
    if (p.petals != null) u.uPetals.value = p.petals
    if (p.spin != null) u.uSpin.value = p.spin
    if (p.mouth != null) u.uMouth.value = p.mouth
    if (p.speed != null) this.speed = p.speed
    if (p.palette != null) {
      const pal = GRAD_PALETTES.find((x) => x.value === p.palette) || GRAD_PALETTES[0]
      u.uColors.value = pal.cols.map(toVec3)
    }
    if (p.backdrop != null) {
      const bd = BACKDROPS.find((x) => x.value === p.backdrop) || BACKDROPS[0]
      u.uBg.value = toVec3(bd.col)
    }
  }

  setPlaying(v) { this.playing = v }

  frame(dt) {
    if (!this.renderer) return
    if (this.playing) this.time += dt * this.speed
    this.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.cam)
  }

  resetTime() { this.time = 0; this.uniforms.uTime.value = 0 }

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
