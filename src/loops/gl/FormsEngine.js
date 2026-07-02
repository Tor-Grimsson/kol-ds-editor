import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { formCount, writePositions, writeVParam } from './formsShapes.js'

/* FormsEngine — parametric point-cloud forms (helix + creatures) as a real 3D
 * THREE.Points cloud: the de-lofi'd cousin of the interfaces lofi widgets. The
 * shape is a pure fn sampled into a BufferGeometry each frame over a looping
 * playhead u∈[0,1] (phase = u·TAU·cycles → seamless webm). Round anti-aliased
 * points (sprite + sizeAttenuation), depth via fog, colour a theme fg↔accent
 * gradient along the form. Mirrors PrimitiveEngine's camera / clock / export /
 * record contract so the page reuses Scrubber + TransportBar + ExportPanel.
 */

const TAU = Math.PI * 2
const BG = '#0b0b0e'

function roundSprite() {
  const s = 64
  const cv = document.createElement('canvas')
  cv.width = cv.height = s
  const ctx = cv.getContext('2d')
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(cv)
  tex.needsUpdate = true
  return tex
}

export default class FormsEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.autoLoop = autoLoop
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color(BG), 1)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(new THREE.Color(BG), 3.2, 9.5)
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    this.camera.position.set(0, 0.4, 4.4)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 2
    this.controls.maxDistance = 14

    this.sprite = roundSprite()
    this.material = new THREE.PointsMaterial({
      map: this.sprite, vertexColors: true, size: 0.05,
      sizeAttenuation: true, transparent: true, alphaTest: 0.4, depthWrite: true,
    })
    this.geometry = new THREE.BufferGeometry()
    this.points = new THREE.Points(this.geometry, this.material)
    this.scene.add(this.points)

    this.form = 'helix'
    this.samples = 30
    this.colFg = '#e5dfcf'
    this.colAccent = '#8b8fd6'
    this.posArr = null
    this.colArr = null
    this.vparArr = null
    this.count = 0
    this._rebuild()

    this.dur = 8
    this.accum = 0
    this.last = performance.now()
    this.recording = false
    this._recStop = null
    this.globals = {
      form: 'helix', samples: 30, cycles: 2, amp: 0.35, pointSize: 0.05,
      turns: 2.5, radius: 0.85, height: 2.4,
      spin: false, spinSpeed: 1, fov: 40, loop: true, duration: 8, paused: true, speed: 1,
      color: '#e5dfcf', accent: '#8b8fd6',
    }
    this.onProgress = null
    if (this.autoLoop) this.raf = requestAnimationFrame(this.loop)
  }

  // Allocate buffers for the current form/density and seed colours; positions are
  // refilled each frame.
  _rebuild() {
    this.count = formCount(this.form, this.samples)
    this.posArr = new Float32Array(this.count * 3)
    this.colArr = new Float32Array(this.count * 3)
    this.vparArr = new Float32Array(this.count)
    writeVParam(this.form, this.samples, this.vparArr)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3))
    const old = this.geometry
    this.geometry = geo
    this.points.geometry = geo
    old.dispose()
    this._recolor()
  }

  // Per-point colour = lerp(accent → fg) by the form's gradient parameter.
  _recolor() {
    const fg = new THREE.Color(this.colFg)
    const ac = new THREE.Color(this.colAccent)
    const c = this.colArr
    for (let i = 0; i < this.count; i++) {
      const v = this.vparArr[i]
      c[i * 3] = ac.r + (fg.r - ac.r) * v
      c[i * 3 + 1] = ac.g + (fg.g - ac.g) * v
      c[i * 3 + 2] = ac.b + (fg.b - ac.b) * v
    }
    if (this.geometry.attributes.color) this.geometry.attributes.color.needsUpdate = true
  }

  update({ form, globals } = {}) {
    let rebuild = false
    if (form && form !== this.form) { this.form = form; rebuild = true }
    if (globals) {
      this.globals = globals
      if (globals.samples && globals.samples !== this.samples) { this.samples = globals.samples; rebuild = true }
      this.material.size = globals.pointSize ?? this.material.size
      if (globals.fov != null && globals.fov !== this.camera.fov) { this.camera.fov = globals.fov; this.camera.updateProjectionMatrix() }
      if (globals.duration) this.dur = globals.duration
      let recolor = false
      if (globals.color && globals.color !== this.colFg) { this.colFg = globals.color; recolor = true }
      if (globals.accent && globals.accent !== this.colAccent) { this.colAccent = globals.accent; recolor = true }
      if (rebuild) { this._rebuild() } else if (recolor) { this._recolor() }
    } else if (rebuild) {
      this._rebuild()
    }
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.w = w; this.h = h
  }

  seek(frac) { this.accum = Math.max(0, Math.min(1, frac)) * this.dur }

  setBackground(hex) {
    const c = new THREE.Color(hex)
    this.renderer.setClearColor(c, 1)
    if (this.scene.fog) this.scene.fog.color.copy(c)
  }

  resetCamera() {
    this.camera.position.set(0, 0.4, 4.4)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  /* One externally-driven step (dt seconds) — the loop body minus RAF
   * (editor port: the loop-layer host drives frame(dt)/seek(u)). */
  frame(dt) { this.step(dt) }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    this.step(dt)
  }

  step = (dt) => {
    const g = this.globals

    // Playhead: recording sweeps u 0→1 once at realtime; otherwise wrap (loop) or
    // hold at the end.
    let t
    if (this.recording) {
      this.accum += dt
      t = Math.min(this.accum, this.dur)
    } else {
      if (!g.paused) this.accum += dt * (g.speed ?? 1)
      t = g.loop ? this.accum % this.dur : Math.min(this.accum, this.dur)
    }
    if (this.onProgress) this.onProgress({ t, dur: this.dur })
    const u = this.dur > 0 ? t / this.dur : 0
    const ph = u * TAU * (g.cycles ?? 2)

    writePositions(this.form, this.samples, ph, { amp: g.amp ?? 0.35, turns: g.turns, radius: g.radius, height: g.height }, this.posArr)
    this.geometry.attributes.position.needsUpdate = true

    this.controls.autoRotate = !this.recording && !!g.spin && !g.paused
    this.controls.autoRotateSpeed = 2 * (g.spinSpeed ?? 1)
    this.controls.update()

    if (this.w && this.h) this.renderer.render(this.scene, this.camera)

    if (this.recording && this.accum >= this.dur && this._recStop) {
      const stop = this._recStop
      this._recStop = null
      stop()
    }
  }

  exportBlob() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  exportBlobAt(w, h) {
    const pr = this.renderer.getPixelRatio()
    const ow = this.w, oh = this.h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    return new Promise((resolve) => {
      this.canvas.toBlob((b) => {
        this.renderer.setPixelRatio(pr)
        this.renderer.setSize(ow, oh, false)
        this.camera.aspect = ow / oh
        this.camera.updateProjectionMatrix()
        this.renderer.render(this.scene, this.camera)
        resolve(b)
      }, 'image/png')
    })
  }

  recordLoop(w, h, fps = 30) {
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) return Promise.resolve(null)
    w = w || this.w; h = h || this.h
    const pr = this.renderer.getPixelRatio()
    const ow = this.w, oh = this.h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    const stream = this.canvas.captureStream(fps)
    const ok = (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000 })
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data) }

    this.accum = 0
    this.recording = true

    return new Promise((resolve) => {
      rec.onstop = () => {
        this.recording = false
        this.accum = 0
        this.renderer.setPixelRatio(pr)
        this.renderer.setSize(ow, oh, false)
        this.camera.aspect = ow / oh
        this.camera.updateProjectionMatrix()
        resolve(new Blob(chunks, { type: 'video/webm' }))
      }
      this._recStop = () => rec.stop()
      rec.start()
    })
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    this.material.dispose()
    this.sprite.dispose()
    this.geometry.dispose()
    this.renderer.dispose()
  }
}
