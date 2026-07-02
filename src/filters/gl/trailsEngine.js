import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Trails — recursive video feedback ("70s video studio" / color-trail). Each
 * frame composites the source over a decayed, transformed copy of the previous
 * frame (ping-pong RTs). Per-channel decay + a chroma uv offset give the colour
 * trail; the feedback transform (zoom/rotate) induces motion on a STILL source
 * (the infinity-mirror tunnel). Ported from kol-labs-single radar/effects/synth. */

// 4-head tape echo on the feedback buffer (Strymon Magneto, in raster). Each of
// the 4 playback heads re-reads last frame transformed `gap` steps back —
// rotated, zoomed, radially drifted — and tinted its head colour (R · G · B ·
// amber = the 70s chromatic convergence). Averaged so loop gain stays ≈ decay.
const FB_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform sampler2D uImage;
  uniform vec2 uScale;
  uniform vec2 uOffset;
  uniform float uDecay;
  uniform float uTaps;    // active heads (1..4)
  uniform float uZoom;    // per-step feedback zoom
  uniform float uRot;     // per-step rotation, rad
  uniform float uDrift;   // per-step radial offset (chromatic convergence)
  uniform float uChroma;  // per-head colour amount (0 = mono, 1 = full tint)
  uniform float uMix;     // live source contribution (0 = pure feedback)
  uniform vec4 uGap;      // per-head spacing multipliers (even/triplet/shift)
  uniform vec2 uOrigin;   // feedback transform centre (the tunnel vanishing point)

  vec3 head(float g, vec3 tint, float on) {
    vec2 c = vUv - uOrigin;
    float a = uRot * g;
    float s = sin(a), co = cos(a);
    c = mat2(co, -s, s, co) * c;
    c *= pow(uZoom, g);
    c += normalize(c + 1e-4) * (uDrift * g);
    vec3 col = texture2D(uPrev, c + uOrigin).rgb;
    return mix(col, col * tint, uChroma) * on;
  }

  void main() {
    vec3 fbk = vec3(0.0);
    fbk += head(uGap.x, vec3(1.0, 0.25, 0.20), step(0.5, uTaps));
    fbk += head(uGap.y, vec3(0.30, 1.0, 0.35), step(1.5, uTaps));
    fbk += head(uGap.z, vec3(0.35, 0.50, 1.0), step(2.5, uTaps));
    fbk += head(uGap.w, vec3(1.0, 0.72, 0.25), step(3.5, uTaps));
    fbk = fbk / max(1.0, uTaps) * uDecay;
    vec3 src = texture2D(uImage, vUv * uScale + uOffset).rgb;
    gl_FragColor = vec4(clamp(max(fbk, src * uMix), 0.0, 1.0), 1.0);
  }
`

const COPY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uTime;
  uniform float uSat;    // saturation boost (1 = none)
  uniform float uLock;   // 70s palette colorize mix (0 = off)
  uniform float uHue;    // hue cycle speed (0 = off)
  uniform float uGain;   // output brightness (1 = none)
  vec3 satBoost(vec3 c, float s) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return clamp(mix(vec3(l), c, s), 0.0, 1.0); }
  mat3 hueRot(float a) {
    float c = cos(a), s = sin(a);
    mat3 w = mat3(0.299, 0.299, 0.299, 0.587, 0.587, 0.587, 0.114, 0.114, 0.114);
    mat3 u = mat3(0.701, -0.299, -0.300, -0.587, 0.413, -0.588, -0.114, -0.114, 0.886);
    mat3 v = mat3(0.168, -0.328, 1.250, 0.330, 0.035, -1.050, -0.497, 0.292, -0.203);
    return w + u * c + v * s;
  }
  // Map luma → a vintage 70s ramp: rust · ochre · cream · teal · blue.
  vec3 pal70(float t) {
    t = clamp(t, 0.0, 1.0) * 4.0;
    vec3 a = vec3(0.75, 0.22, 0.17), b = vec3(0.88, 0.54, 0.12), c = vec3(0.95, 0.91, 0.84), d = vec3(0.16, 0.62, 0.56), e = vec3(0.17, 0.37, 0.54);
    if (t < 1.0) return mix(a, b, t);
    if (t < 2.0) return mix(b, c, t - 1.0);
    if (t < 3.0) return mix(c, d, t - 2.0);
    return mix(d, e, t - 3.0);
  }
  void main() {
    vec3 col = texture2D(uTex, vUv).rgb;
    if (uHue > 0.001) col = clamp(hueRot(uTime * uHue) * col, 0.0, 1.0);
    col = satBoost(col, uSat);
    col = mix(col, pal70(dot(col, vec3(0.299, 0.587, 0.114))), uLock);
    col = clamp(col * uGain, 0.0, 1.0);
    gl_FragColor = vec4(col, 1.0);
  }
`

const RT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }

export default class TrailsEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.rtA = new THREE.WebGLRenderTarget(2, 2, RT_OPTS)
    this.rtB = new THREE.WebGLRenderTarget(2, 2, RT_OPTS)
    this.fbMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FB_FRAG,
      uniforms: {
        uPrev: { value: null }, uImage: { value: null },
        uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) },
        uDecay: { value: 0.92 }, uTaps: { value: 3 }, uZoom: { value: 1 }, uRot: { value: 0 },
        uDrift: { value: 0.02 }, uChroma: { value: 0.6 }, uMix: { value: 1 },
        uGap: { value: new THREE.Vector4(1, 2, 3, 4) }, uOrigin: { value: new THREE.Vector2(0.5, 0.5) },
      },
    })
    this.copyMat = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: COPY_FRAG, uniforms: { uTex: { value: null }, uTime: { value: 0 }, uSat: { value: 1 }, uLock: { value: 0 }, uHue: { value: 0 }, uGain: { value: 1 } } })
    this.quad = new THREE.Mesh(this.geo, this.fbMat)
    this.scene.add(this.quad)
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    this.fbMat.uniforms.uScale.value.set(sx, sy)
    this.fbMat.uniforms.uOffset.value.set(ox, oy)
  }

  _onImage() { this._applyFit() }

  _onParams() {
    const p = this.params
    const u = this.fbMat.uniforms
    u.uDecay.value = p.decay ?? 0.92
    u.uTaps.value = p.taps ?? 3
    u.uZoom.value = p.zoom ?? 1
    u.uRot.value = p.rotate ?? 0
    u.uDrift.value = p.drift ?? 0.02
    u.uChroma.value = p.chroma ?? 0.6
    u.uMix.value = p.mix ?? 1
    // HEADS spacing: even (linear) · triplet (grouped) · shift (octave-ish).
    const GAPS = { even: [1, 2, 3, 4], triplet: [1, 1.5, 2.5, 4], shift: [1, 2, 4, 8] }
    const g = GAPS[p.spacing] || GAPS.even
    u.uGap.value.set(g[0], g[1], g[2], g[3])
    u.uOrigin.value.set(p.originX ?? 0.5, p.originY ?? 0.5)
    this.copyMat.uniforms.uSat.value = p.sat ?? 1
    this.copyMat.uniforms.uLock.value = p.palette ?? 0
    this.copyMat.uniforms.uHue.value = p.hue ?? 0
    this.copyMat.uniforms.uGain.value = p.gain ?? 1
  }

  _resize(w, h) {
    this.rtA.setSize(w, h)
    this.rtB.setSize(w, h)
    this.renderer.setRenderTarget(this.rtA); this.renderer.clear()
    this.renderer.setRenderTarget(this.rtB); this.renderer.clear()
    this.renderer.setRenderTarget(null)
    this._applyFit()
  }

  _reset() {
    this.renderer.setRenderTarget(this.rtA); this.renderer.clear()
    this.renderer.setRenderTarget(this.rtB); this.renderer.clear()
    this.renderer.setRenderTarget(null)
  }

  _frame() {
    if (!this.tex) { this.renderer.setRenderTarget(null); this.renderer.clear(); return }
    // Feedback pass: rtA (prev) → rtB, then swap.
    this.quad.material = this.fbMat
    this.fbMat.uniforms.uPrev.value = this.rtA.texture
    this.fbMat.uniforms.uImage.value = this.tex
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.render(this.scene, this.camera)
    const tmp = this.rtA; this.rtA = this.rtB; this.rtB = tmp
    // Display the accumulated buffer.
    this.quad.material = this.copyMat
    this.copyMat.uniforms.uTex.value = this.rtA.texture
    this.copyMat.uniforms.uTime.value = this.time
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() {
    this.rtA.dispose(); this.rtB.dispose()
    this.fbMat.dispose(); this.copyMat.dispose(); this.geo.dispose()
  }
}
