import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Symmetry — a club-visual fragment post over the source: a mirror/kaleidoscope
 * with full per-axis transform (origin · zoom XY · pan XY · rotate · twist),
 * animated movement (spin · drift XY · pulse) and a colour stage (hue cycle ·
 * saturation · posterize · strobe · 70s palette). Time-driven, no feedback.
 * Ported from kol-labs-single radar/effects/synth. */

const FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uScale, uOffset;
  uniform float uTime;
  uniform vec2 uOrigin, uZoomV, uPan, uDrift;
  uniform float uRot, uSpin, uTwist, uSeg;
  uniform int uMirror;          // 0 none · 1 kaleido · 2 mirror X · 3 mirror Y · 4 quad
  uniform float uPulse, uPulseRate;
  uniform float uHue, uPost, uStrobe, uSat, uLock;

  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  vec3 satBoost(vec3 c, float s) { float l = dot(c, vec3(0.299, 0.587, 0.114)); return clamp(mix(vec3(l), c, s), 0.0, 1.0); }
  vec3 pal70(float t) {
    t = clamp(t, 0.0, 1.0) * 4.0;
    vec3 a = vec3(0.75, 0.22, 0.17), b = vec3(0.88, 0.54, 0.12), c = vec3(0.95, 0.91, 0.84), d = vec3(0.16, 0.62, 0.56), e = vec3(0.17, 0.37, 0.54);
    if (t < 1.0) return mix(a, b, t);
    if (t < 2.0) return mix(b, c, t - 1.0);
    if (t < 3.0) return mix(c, d, t - 2.0);
    return mix(d, e, t - 3.0);
  }
  mat3 hueRot(float a) {
    float c = cos(a), s = sin(a);
    mat3 w = mat3(0.299, 0.299, 0.299, 0.587, 0.587, 0.587, 0.114, 0.114, 0.114);
    mat3 u = mat3(0.701, -0.299, -0.300, -0.587, 0.413, -0.588, -0.114, -0.114, 0.886);
    mat3 v = mat3(0.168, -0.328, 1.250, 0.330, 0.035, -1.050, -0.497, 0.292, -0.203);
    return w + u * c + v * s;
  }

  void main() {
    vec2 uv = vUv - uOrigin;
    float pulse = 1.0 + uPulse * sin(uTime * uPulseRate * 6.2831853);
    uv /= max(vec2(0.05), uZoomV * pulse);
    uv = rot(uRot + uTime * uSpin) * uv;
    uv = rot(uTwist * length(uv)) * uv;
    if (uMirror == 1) {
      float ang = atan(uv.y, uv.x);
      float rad = length(uv);
      float seg = 6.2831853 / max(1.0, uSeg);
      ang = abs(mod(ang, seg) - seg * 0.5);
      uv = vec2(cos(ang), sin(ang)) * rad;
    } else if (uMirror == 2) { uv.x = abs(uv.x); }
    else if (uMirror == 3) { uv.y = abs(uv.y); }
    else if (uMirror == 4) { uv = abs(uv); }
    uv += uOrigin + uPan + uTime * uDrift;
    vec3 col = texture2D(uImage, fract(uv) * uScale + uOffset).rgb;
    col = clamp(hueRot(uTime * uHue) * col, 0.0, 1.0);
    col = satBoost(col, uSat);
    col = mix(col, pal70(dot(col, vec3(0.299, 0.587, 0.114))), uLock);
    if (uPost > 1.5) col = floor(col * uPost) / uPost;
    if (uStrobe > 0.01) { float f = step(0.5, fract(uTime * uStrobe)); col *= mix(1.0, f, 0.7); }
    gl_FragColor = vec4(col, 1.0);
  }
`

const MIRROR = { none: 0, kaleido: 1, mirrorX: 2, mirrorY: 3, quad: 4 }

export default class DiscoEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FRAG,
      uniforms: {
        uImage: { value: null },
        uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) },
        uTime: { value: 0 },
        uOrigin: { value: new THREE.Vector2(0.5, 0.5) }, uZoomV: { value: new THREE.Vector2(1, 1) },
        uPan: { value: new THREE.Vector2(0, 0) }, uDrift: { value: new THREE.Vector2(0, 0) },
        uRot: { value: 0 }, uSpin: { value: 0.1 }, uTwist: { value: 0 }, uSeg: { value: 6 },
        uMirror: { value: 1 }, uPulse: { value: 0 }, uPulseRate: { value: 0.5 },
        uHue: { value: 0.3 }, uPost: { value: 0 }, uStrobe: { value: 0 }, uSat: { value: 1 }, uLock: { value: 0 },
      },
    })
    this.quad = new THREE.Mesh(this.geo, this.mat)
    this.scene.add(this.quad)
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    this.mat.uniforms.uScale.value.set(sx, sy)
    this.mat.uniforms.uOffset.value.set(ox, oy)
  }

  _onImage() { this.mat.uniforms.uImage.value = this.tex; this._applyFit() }

  _onParams() {
    const p = this.params
    const u = this.mat.uniforms
    u.uMirror.value = MIRROR[p.mirror] ?? 1
    u.uSeg.value = p.segments ?? 6
    u.uTwist.value = p.twist ?? 0
    u.uOrigin.value.set(p.originX ?? 0.5, p.originY ?? 0.5)
    u.uZoomV.value.set(p.zoomX ?? 1, p.zoomY ?? 1)
    u.uPan.value.set(p.panX ?? 0, p.panY ?? 0)
    u.uDrift.value.set(p.driftX ?? 0, p.driftY ?? 0)
    u.uRot.value = p.rotate ?? 0
    u.uSpin.value = p.spin ?? 0.1
    u.uPulse.value = p.pulse ?? 0
    u.uPulseRate.value = p.pulseRate ?? 0.5
    u.uHue.value = p.hue ?? 0.3
    u.uPost.value = p.posterize ?? 0
    u.uStrobe.value = p.strobe ?? 0
    u.uSat.value = p.sat ?? 1
    u.uLock.value = p.palette ?? 0
  }

  _resize() { this._applyFit() }

  _frame() {
    this.renderer.setRenderTarget(null)
    if (!this.tex) { this.renderer.clear(); return }
    this.mat.uniforms.uImage.value = this.tex
    this.mat.uniforms.uTime.value = this.time
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() { this.mat.dispose(); this.geo.dispose() }
}
