import * as THREE from 'three'

/* SynthEngine — shared base for the "Synth" image-effect family (analog
 * video-synthesis lineage: trails, slitscan, Rutt-Etra scan, disco). Ported
 * from kol-labs-single radar/effects/synth/synthBase.js for the design editor:
 *   - expression params stripped to plain numerics (same as PrimitiveEngine)
 *   - source = a CANVAS the editor has already fitted (THREE.CanvasTexture,
 *     uploaded once on swap — stills need no per-frame needsUpdate)
 *   - video-element handling dropped
 *   - self-RAF gated on { autoLoop }; the host drives frame(dt) otherwise
 *
 * The base owns the renderer, source texture, time clock, params and export.
 * Subclasses implement the render pipeline:
 *
 *   _setup()        build scene/camera/material(s)/render-targets
 *   _onImage()      source texture (re)assigned       (optional)
 *   _onParams()     params changed → push to uniforms  (optional)
 *   _resize(w,h)    canvas resized → size RTs/camera    (optional)
 *   _frame(dt)      render one frame to the screen      (REQUIRED)
 *   _reset()        clear accumulation buffers          (optional)
 *   _dispose()      free subclass GPU resources         (optional)
 *
 * preserveDrawingBuffer is on so exportPNG()'s toBlob can read the canvas back.
 * The base is render-target-agnostic — quad effects use an ortho quad, the scan
 * effect uses a perspective line mesh; each builds its own scene in _setup(). */

export const FULLSCREEN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

export default class SynthEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.canvas = canvas
    this.autoLoop = autoLoop
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setClearColor(0x000000, 0) // transparent → the stage bg shows through
    this.params = {}        // plain numerics/strings (no expression resolve)
    this.time = 0
    this.last = performance.now()
    this.tex = null
    this.imageAspect = 1
    this.w = 1
    this.h = 1
    this._raf = null
    this.paused = false
    this._setup()
    if (this.autoLoop) this.start()
  }

  /* Source = a fitted canvas from the editor. The texture uploads once on
   * swap; call touchSource() after redrawing INTO the same canvas. */
  setSource(source) {
    if (this.tex) this.tex.dispose()
    const tex = new THREE.CanvasTexture(source)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    this.tex = tex
    this.imageAspect = (source.width || 1) / (source.height || 1)
    this._onImage?.()
  }

  // The editor redrew the same source canvas → re-upload next render.
  touchSource() {
    if (this.tex) this.tex.needsUpdate = true
  }

  setParams(p) {
    Object.assign(this.params, p)
    this._onParams?.()
  }

  // Transport: pause freezes the time clock; reset returns the clock to 0 and
  // clears any subclass buffers (_reset).
  setPaused(p) { this.paused = !!p }

  reset() {
    this.time = 0
    this._reset?.()
  }

  resize(w, h) {
    if (w < 1 || h < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.w = w
    this.h = h
    this._resize?.(w, h)
  }

  // Cover-fit scale/offset for a fullscreen quad sampling the source (maps output
  // uv → source uv, centre-cropping the longer axis).
  coverFit() {
    const ca = this.w / this.h
    let sx
    let sy
    if (this.imageAspect > ca) { sx = ca / this.imageAspect; sy = 1 } else { sx = 1; sy = this.imageAspect / ca }
    return { sx, sy, ox: (1 - sx) / 2, oy: (1 - sy) / 2 }
  }

  // Externally-driven step: advance the clock by dt (scaled by params.speed,
  // 1 = realtime) and render. The host passes dt=0 while paused so param edits
  // still repaint the held frame.
  step(dt) {
    if (!this.paused) this.time += dt * (this.params.speed ?? 1)
    this._frame(dt)
  }

  frame(dt) { this.step(dt) }

  // Self-RAF — only when constructed with { autoLoop: true } (the original
  // labs behavior); the editor host drives frame(dt) instead.
  start() {
    if (!this.autoLoop || this._raf) return
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000) // clamp huge gaps (tab switch)
      this.last = now
      this.step(dt)
    }
    this._raf = requestAnimationFrame(loop)
  }

  // PNG = the current on-screen canvas as-is (preserves the accumulated state of
  // feedback effects; @Nx retarget would reset their buffers — deferred).
  exportPNG() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  // webm = capture the live canvas for `seconds`.
  recordWebm(seconds = 6, fps = 30) {
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) return Promise.resolve(null)
    const stream = this.canvas.captureStream(fps)
    const ok = (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
        : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }
    return new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }))
      rec.start()
      setTimeout(() => { if (rec.state !== 'inactive') rec.stop() }, seconds * 1000)
    })
  }

  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this._dispose?.()
    if (this.tex) this.tex.dispose()
    this.renderer.dispose()
  }
}
