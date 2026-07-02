import * as THREE from 'three'
import SynthEngine, { FULLSCREEN_VERT } from './synthBase.js'

/* Slitscan — time-displacement of a live frame. A scan head sweeps across the
 * image; the columns it passes are refreshed to "now", the rest stay frozen at
 * whenever the head last crossed them — so one axis becomes TIME. Two modes:
 *
 *   chop    — each column shows its OWN content from a different moment, so the
 *             picture stays recognizable, sheared in time (the classic slit-scan;
 *             it CHOPS the original, doesn't replace it). Default.
 *   finish  — a single FIXED slit line is stacked over time (strip / photo-finish
 *             photography): the spatial image is gone, the slit's history scrolls.
 *
 * Ported from kol-labs-single radar/effects/synth. Refs: yitzilitt/Slitscanner,
 * jkriege2/SlitScanGenerator, andrewringler/video-2-slit-scan, zzkt/slitscan.
 * speed × scroll = sweep speed; pause freezes the capture. Smooth blurs along
 * the time axis; Original blends the live source back over the top. NOTE: a
 * temporally-changing source shows the effect best — a static still yields a
 * (mostly) static result once the head has swept it. */

const SCROLL_PXPS = 160 // strip columns swept per second at speed 1 × scroll 1

// chop write: the whole live frame (scissor limits it to the head's columns).
const WRITE_SRC_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uScale, uOffset;
  void main() { gl_FragColor = texture2D(uImage, vUv * uScale + uOffset); }
`

// finish write: a single fixed slit line, splatted across the head's columns.
const WRITE_SLIT_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform vec2 uScale, uOffset;
  uniform float uSlit;
  uniform int uAxis;
  void main() {
    float cross = (uAxis == 0) ? vUv.y : vUv.x;
    vec2 suv = (uAxis == 0) ? vec2(uSlit, cross) : vec2(cross, uSlit);
    gl_FragColor = texture2D(uImage, suv * uScale + uOffset);
  }
`

// Display: chop reads the strip directly (recognizable); finish scrolls it
// head-relative. Both blur along time (Smooth) and blend the source (Original).
const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uStrip, uImage;
  uniform vec2 uScale, uOffset;
  uniform float uHead, uDir, uOrig, uSmooth;
  uniform int uAxis, uMode;          // uMode 0 = chop, 1 = finish
  vec2 sUV(float pos, float cross) { return (uAxis == 0) ? vec2(pos, cross) : vec2(cross, pos); }
  float toPos(float along) {
    if (uMode == 1) { float t = (uDir > 0.0) ? along : 1.0 - along; return fract(uHead - t); }
    return (uDir > 0.0) ? along : 1.0 - along;
  }
  void main() {
    float along = (uAxis == 0) ? vUv.x : vUv.y;
    float cross = (uAxis == 0) ? vUv.y : vUv.x;
    float r = uSmooth * 0.03;
    vec4 e = texture2D(uStrip, sUV(toPos(along), cross)) * 0.383
      + (texture2D(uStrip, sUV(toPos(along + r), cross)) + texture2D(uStrip, sUV(toPos(along - r), cross))) * 0.242
      + (texture2D(uStrip, sUV(toPos(along + 2.0 * r), cross)) + texture2D(uStrip, sUV(toPos(along - 2.0 * r), cross))) * 0.0665;
    vec4 s = texture2D(uImage, vUv * uScale + uOffset);
    gl_FragColor = mix(e, s, uOrig);
  }
`

const RT_OPTS = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false }

export default class SlitscanEngine extends SynthEngine {
  _setup() {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)
    this.quad = new THREE.Mesh(this.geo, null)
    this.scene.add(this.quad)

    this.scrollMul = 1
    this._acc = 0
    this.headPx = 0
    this.strip = null

    const src = () => ({ uImage: { value: null }, uScale: { value: new THREE.Vector2(1, 1) }, uOffset: { value: new THREE.Vector2(0, 0) } })
    this.srcMat = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: WRITE_SRC_FRAG, uniforms: src() })
    this.slitMat = new THREE.ShaderMaterial({ vertexShader: FULLSCREEN_VERT, fragmentShader: WRITE_SLIT_FRAG, uniforms: { ...src(), uSlit: { value: 0.5 }, uAxis: { value: 0 } } })
    this.dispMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT, fragmentShader: DISPLAY_FRAG,
      uniforms: { uStrip: { value: null }, ...src(), uHead: { value: 0 }, uDir: { value: 1 }, uOrig: { value: 0 }, uSmooth: { value: 0 }, uAxis: { value: 0 }, uMode: { value: 0 } },
    })
  }

  _makeRT(w, h) { return new THREE.WebGLRenderTarget(Math.max(2, w), Math.max(2, h), RT_OPTS) }

  _clearRT(rt) {
    this.renderer.setRenderTarget(rt)
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.clear()
    this.renderer.setRenderTarget(null)
  }

  _build() {
    if (this.w < 2 || this.h < 2) return
    this.strip?.dispose()
    this.strip = this._makeRT(this.w, this.h)
    this._clearRT(this.strip)
    this._acc = 0
    this.headPx = 0
  }

  _applyFit() {
    const { sx, sy, ox, oy } = this.coverFit()
    for (const m of [this.srcMat, this.slitMat, this.dispMat]) {
      m.uniforms.uScale.value.set(sx, sy); m.uniforms.uOffset.value.set(ox, oy)
    }
  }

  _onImage() { this._applyFit() }

  _onParams() {
    const p = this.params
    const ax = p.axis === 'vertical' ? 1 : 0
    this.scrollMul = Math.max(0, p.scroll ?? 1)
    this.slitMat.uniforms.uSlit.value = Math.max(0, Math.min(1, p.slit ?? 0.5))
    this.slitMat.uniforms.uAxis.value = ax
    const u = this.dispMat.uniforms
    u.uAxis.value = ax
    u.uMode.value = p.mode === 'finish' ? 1 : 0
    u.uDir.value = p.invert ? -1 : 1
    u.uOrig.value = Math.max(0, Math.min(1, p.orig ?? 0))
    u.uSmooth.value = Math.max(0, Math.min(1, p.smooth ?? 0))
  }

  _resize(w, h) {
    this.w = w; this.h = h
    this._build()
    this._applyFit()
  }

  _reset() { this._build() }

  _advance(dt) {
    const speed = this.params.speed ?? 1
    if (!this.paused) this._acc += dt * speed * this.scrollMul * SCROLL_PXPS
    let adv = Math.floor(this._acc)
    if (adv > 0) this._acc -= adv
    return Math.min(adv, Math.floor(Math.max(this.w, this.h) / 2))
  }

  _frame(dt) {
    if (!this.strip) this._build()
    if (!this.tex || !this.strip) { this.renderer.setRenderTarget(null); this.renderer.setClearColor(0x000000, 0); this.renderer.clear(); return }
    const adv = this._advance(dt)
    const finish = this.params.mode === 'finish'
    const ax = this.dispMat.uniforms.uAxis.value
    if (adv > 0) {
      const dim = ax === 0 ? this.w : this.h
      const writeMat = finish ? this.slitMat : this.srcMat
      writeMat.uniforms.uImage.value = this.tex
      this.quad.material = writeMat
      this.renderer.setRenderTarget(this.strip)
      this.renderer.setScissorTest(true)
      let start = this.headPx
      let rem = Math.min(adv, dim)
      while (rem > 0) {
        const wseg = Math.min(rem, dim - start)
        if (ax === 0) this.renderer.setScissor(start, 0, wseg, this.h)
        else this.renderer.setScissor(0, start, this.w, wseg)
        this.renderer.render(this.scene, this.camera)
        start = (start + wseg) % dim
        rem -= wseg
      }
      this.renderer.setScissorTest(false)
      this.headPx = (this.headPx + adv) % dim
      this.dispMat.uniforms.uHead.value = this.headPx / dim
    }
    this.dispMat.uniforms.uStrip.value = this.strip.texture
    this.dispMat.uniforms.uImage.value = this.tex
    this.quad.material = this.dispMat
    this.renderer.setRenderTarget(null)
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() {
    this.strip?.dispose()
    for (const m of [this.srcMat, this.slitMat, this.dispMat]) m.dispose()
    this.geo.dispose()
  }
}
