import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { writePositions, writeVParam, buildIndex, isWrapped } from './envScenes.js'

/* EnvironmentEngine — abstract mood scenes (mountain / ocean / tunnel) as a
 * single displaced grid mesh. Mirrors FormsEngine's contract (camera / clock /
 * export / record) so the page reuses Scrubber + TransportBar + ExportPanel.
 * Unlit vertex-coloured material — no lights, shading comes from the height/
 * depth gradient (same trick as Forms' point cloud).
 */

const TAU = Math.PI * 2
const BG = '#0b0b0e'

const CAMERA_BY_ID = {
  mountain: { pos: [0, 2.6, 6.2], target: [0, 0, 0], fov: 45 },
  ocean: { pos: [0, 1.4, 5.6], target: [0, 0, 0], fov: 42 },
  tunnel: { pos: [0, 0, 0], target: [0, 0, -3], fov: 70 },
}

export default class EnvironmentEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.autoLoop = autoLoop
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color(BG), 1)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(new THREE.Color(BG), 3, 11)
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.minDistance = 0.1
    this.controls.maxDistance = 16

    this.material = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
    this.geometry = new THREE.BufferGeometry()
    this.mesh = new THREE.Mesh(this.geometry, this.material)
    this.scene.add(this.mesh)

    this.env = 'mountain'
    this.samples = 48
    this.colFg = '#e5dfcf'
    this.colAccent = '#8b8fd6'
    this.posArr = null
    this.colArr = null
    this.vparArr = null
    this._rebuild()
    this.resetCamera()

    this.dur = 8
    this.accum = 0
    this.last = performance.now()
    this.recording = false
    this._recStop = null
    this.globals = {
      env: 'mountain', samples: 48, cycles: 2, amp: 0.5, fov: 45,
      spin: false, spinSpeed: 1, loop: true, duration: 8, paused: true, speed: 1,
      color: '#e5dfcf', accent: '#8b8fd6',
    }
    this.onProgress = null
    if (this.autoLoop) this.raf = requestAnimationFrame(this.loop)
  }

  _rebuild() {
    const n = this.samples * this.samples
    this.posArr = new Float32Array(n * 3)
    this.colArr = new Float32Array(n * 3)
    this.vparArr = new Float32Array(n)
    writeVParam(this.env, this.samples, this.vparArr)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 3))
    geo.setIndex(new THREE.BufferAttribute(buildIndex(this.env, this.samples), 1))
    const old = this.geometry
    this.geometry = geo
    this.mesh.geometry = geo
    old.dispose()
    this._recolor()
  }

  _recolor() {
    const fg = new THREE.Color(this.colFg)
    const ac = new THREE.Color(this.colAccent)
    const c = this.colArr
    const n = this.samples * this.samples
    for (let i = 0; i < n; i++) {
      const v = this.vparArr[i]
      c[i * 3] = ac.r + (fg.r - ac.r) * v
      c[i * 3 + 1] = ac.g + (fg.g - ac.g) * v
      c[i * 3 + 2] = ac.b + (fg.b - ac.b) * v
    }
    if (this.geometry.attributes.color) this.geometry.attributes.color.needsUpdate = true
  }

  update({ env, globals } = {}) {
    let rebuild = false
    if (env && env !== this.env) { this.env = env; rebuild = true; this.resetCamera() }
    if (globals) {
      this.globals = globals
      if (globals.samples && globals.samples !== this.samples) { this.samples = globals.samples; rebuild = true }
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
    const cam = CAMERA_BY_ID[this.env] || CAMERA_BY_ID.mountain
    this.camera.position.set(...cam.pos)
    this.camera.fov = this.globals?.fov ?? cam.fov
    this.camera.updateProjectionMatrix()
    this.controls.target.set(...cam.target)
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

    writePositions(this.env, this.samples, ph, { amp: g.amp ?? 0.5 }, this.posArr)
    this.geometry.attributes.position.needsUpdate = true
    this.geometry.computeVertexNormals()

    this.controls.autoRotate = !this.recording && !!g.spin && !g.paused && !isWrapped(this.env)
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
    this.geometry.dispose()
    this.renderer.dispose()
  }
}
