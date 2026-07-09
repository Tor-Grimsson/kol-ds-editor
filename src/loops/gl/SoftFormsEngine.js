// Soft Forms engine — the Apple-wallpaper look: clean SDF forms on black, shaded
// with a procedural MATCAP (color read off the surface normal, not concentric
// distance-rings like /gradients) + a coloured fresnel RIM + a soft subsurface
// glow. Up to 5 forms are painter-composited front-to-back in one fullscreen
// ShaderMaterial, so where two forms kiss each one's bright rim meets across a
// thin dark seam — the signature Apple "contact" highlight, for free.
//
// Same engine contract as IridescentEngine (init/resize/setParams/frame/…), and
// it reuses that page's palettes + backdrops (one colour model for the family).

import * as THREE from 'three'
import { GRAD_PALETTES, BACKDROPS } from './IridescentEngine.js'

export { GRAD_PALETTES, BACKDROPS }

const MAX_FORMS = 5

// Form type → shader id. orb is an alias of dome (a round ellipse).
export const FORM_TYPES = { teardrop: 0, pill: 1, dome: 2, super: 3, orb: 2 }

const VERT = `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uAspect, uCount;
  uniform float uHue, uIrid, uSheen, uGloss, uRim, uRimPow, uRimShift, uSSS;
  uniform float uBulge, uRelief, uMotion, uGrain, uSpectral, uEdge;
  uniform vec2  uDir, uBgFade;
  uniform vec3  uBg;
  uniform vec3  uColors[5];
  uniform float uType[5];
  uniform vec2  uPos[5];
  uniform vec2  uScale[5];
  uniform float uRot[5];
  uniform float uHueOff[5];

  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }

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

  vec2 rot2(vec2 v, float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c) * v; }

  // Signed-ish distance for each form (negative inside). q is form-local
  // (centred, unrotated, divided by the form's scale → "radius 1" forms).
  float formDist(float ty, vec2 q){
    if (ty < 0.5) {                          // teardrop — ellipse tapered toward +y
      float taper = mix(1.0, 0.36, clamp(q.y * 0.5 + 0.5, 0.0, 1.0));
      return length(vec2(q.x / taper, q.y)) - 1.0;
    } else if (ty < 1.5) {                   // pill — horizontal capsule
      vec2 d = q; d.x = max(abs(d.x) - 0.58, 0.0);
      return length(d) - 0.5;
    } else if (ty < 2.5) {                   // dome / orb — ellipse
      return length(q) - 1.0;
    }
    vec2 e = pow(abs(q), vec2(3.4));         // superellipse — soft-cornered lozenge
    return pow(e.x + e.y, 1.0/3.4) - 1.0;
  }

  // Inside a form (d<0) the surface bulges up; sqrt gives spherical edge falloff.
  float heightOf(float d){ float t = clamp(-d / uBulge, 0.0, 1.0); return sqrt(t * (2.0 - t)); }

  // Procedural matcap: hue swept across the surface normal (the broad gradient
  // that flows over the volume) + baked soft key light + glossy hotspot +
  // coloured fresnel rim + a touch of subsurface glow at thin edges.
  vec3 shade(vec3 n, float hueOff, float h){
    float ci = uHue + hueOff + uIrid * (dot(n.xy, uDir) * 0.5 + 0.5);
    vec3 base = tint(ci);
    vec3 L = normalize(vec3(-0.35, 0.55, 0.85));
    float key = 0.5 + 0.5 * dot(n, L);
    base *= mix(0.6, 1.18, key);
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    base += pow(max(dot(n, H), 0.0), uGloss) * uSheen;
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), uRimPow);
    base += tint(ci + uRimShift) * fres * uRim;
    base += base * (1.0 - clamp(h, 0.0, 1.0)) * uSSS;
    return base;
  }

  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uAspect;
    vec3 col = uBg;
    const float E = 0.012;

    for (int i = 0; i < 5; i++){
      if (float(i) >= uCount) break;
      vec2 pos = uPos[i] + uMotion * vec2(sin(uTime*0.40 + float(i)*1.7),
                                          cos(uTime*0.33 + float(i)*2.1)) * 0.05;
      float ty = uType[i];
      vec2 sc = uScale[i];
      float rt = uRot[i];

      vec2 q  = rot2(p - pos, -rt) / sc;
      vec2 qx = rot2(p + vec2(E, 0.0) - pos, -rt) / sc;
      vec2 qy = rot2(p + vec2(0.0, E) - pos, -rt) / sc;
      float d  = formDist(ty, q);
      float h  = heightOf(d);
      vec2 g = vec2(heightOf(formDist(ty, qx)) - h,
                    heightOf(formDist(ty, qy)) - h) / E;
      vec3 n = normalize(vec3(-g * uRelief, 1.0));

      float a = smoothstep(uEdge, -uEdge, d);
      col = mix(col, shade(n, uHueOff[i], h), a);
    }

    col *= mix(1.0, smoothstep(uBgFade.y, uBgFade.x, length(p)), 0.18); // soft vignette
    col += (hash(vUv * vec2(1920.0, 1080.0) + uTime) - 0.5) * uGrain;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

const toVec3 = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export class SoftFormsEngine {
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
      uCount: { value: 3 },
      uHue: { value: 0 },
      uIrid: { value: 1.0 },
      uSheen: { value: 0.35 },
      uGloss: { value: 32 },
      uRim: { value: 0.7 },
      uRimPow: { value: 2.6 },
      uRimShift: { value: 0.12 },
      uSSS: { value: 0.25 },
      uBulge: { value: 0.55 },
      uRelief: { value: 1.0 },
      uMotion: { value: 0.0 },
      uGrain: { value: 0.02 },
      uSpectral: { value: 0 },
      uEdge: { value: 0.02 },
      uDir: { value: new THREE.Vector2(0.3, 0.95) },
      uBgFade: { value: new THREE.Vector2(0.2, 1.9) },
      uBg: { value: toVec3('#000000') },
      uColors: { value: GRAD_PALETTES[0].cols.map(toVec3) },
      uType: { value: new Array(MAX_FORMS).fill(2) },
      uPos: { value: Array.from({ length: MAX_FORMS }, () => new THREE.Vector2()) },
      uScale: { value: Array.from({ length: MAX_FORMS }, () => new THREE.Vector2(0.6, 0.6)) },
      uRot: { value: new Array(MAX_FORMS).fill(0) },
      uHueOff: { value: new Array(MAX_FORMS).fill(0) },
    }
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms })
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.scene.add(new THREE.Mesh(this.geo, this.mat))
  }

  resize(w, h) {
    if (!this.renderer) return
    this.renderer.setSize(w, h, false)
    this.uniforms.uAspect.value = w / h
  }

  setForms(forms) {
    if (!this.uniforms || !forms) return
    const u = this.uniforms
    const f = forms.slice(0, MAX_FORMS)
    u.uCount.value = f.length || 1
    for (let i = 0; i < MAX_FORMS; i++) {
      const o = f[i] || f[f.length - 1] || {}
      u.uType.value[i] = FORM_TYPES[o.t] ?? 2
      u.uPos.value[i].set(o.x ?? 0, o.y ?? 0)
      const sx = o.sx ?? 0.6
      u.uScale.value[i].set(sx, o.sy ?? sx)
      u.uRot.value[i] = ((o.rot ?? 0) * Math.PI) / 180
      u.uHueOff.value[i] = o.hue ?? 0
    }
  }

  setParams(p) {
    if (!this.uniforms) return
    const u = this.uniforms
    const num = {
      hue: 'uHue', irid: 'uIrid', sheen: 'uSheen', gloss: 'uGloss', rim: 'uRim',
      rimPow: 'uRimPow', rimShift: 'uRimShift', sss: 'uSSS',
      relief: 'uRelief', motion: 'uMotion', grain: 'uGrain', edge: 'uEdge',
    }
    for (const k in num) if (p[k] != null) u[num[k]].value = p[k]
    /* bulge is off-schema (only sf-lava sets it) — map missing → uniform
     * default so a preset switch on the live engine can't inherit it. */
    u.uBulge.value = p.bulge ?? 0.55
    if (p.spectral != null) u.uSpectral.value = p.spectral ? 1 : 0
    if (p.sweep != null) {
      const a = (p.sweep * Math.PI) / 180
      u.uDir.value.set(Math.sin(a), Math.cos(a))
    }
    if (p.speed != null) this.speed = p.speed
    if (p.forms) this.setForms(p.forms)
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
    this.mat?.dispose()
    this.geo?.dispose()
    if (this.renderer) { this.renderer.dispose(); this.renderer = null }
  }
}
