import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { Wireframe } from 'three/addons/lines/Wireframe.js'
import { WireframeGeometry2 } from 'three/addons/lines/WireframeGeometry2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { PRESETS, DURATION } from './primitivePresets.js'
import { sampleKeyframes } from './primitiveKeyframes.js'
import { layout } from './primitiveComposition.js'

/* PrimitiveEngine — a small 3D motion studio. N instanced items (shared geometry
 * + material + wireframe) are placed by an arrangement and animated by a preset
 * or keyframe track (both pure fns of u∈[0,1]) over a looping timeline, with a
 * per-item phase stagger. The camera is an OrbitControls rig that can auto-rotate.
 * The React page owns all state and pushes it via update(); seek()/onProgress
 * feed the scrubber (scrubbing works while paused — the loop always renders).
 *
 * - Geometry is procedural (built per primitive + params; rebuilt on change).
 * - Material type is swappable; colour/roughness/metalness/flat apply where the
 *   type supports them. Environment = a procedural RoomEnvironment IBL (no asset).
 * - Wireframe is a real fat-line overlay (worldUnits) — WebGL gl.lineWidth is
 *   locked to 1. Each item carries a wire sibling that mirrors its transform.
 * - Audio (optional) scales every item by the live level.
 * - Exports: exportBlobAt() (PNG @Nx) + recordLoop() (one seamless webm loop).
 */

const BG = '#0b0b0e'
const STROKE_TO_WORLD = 0.004 // maps the 1–10 stroke slider onto world-unit linewidth
const MAX_ITEMS = 24

export default class PrimitiveEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.canvas = canvas
    this.autoLoop = autoLoop
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color(BG), 1)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    this.camera.position.set(0, 0.6, 4)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 2
    this.controls.maxDistance = 14

    // Lights — key / fill / ambient + hemisphere for a soft graded look.
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35))
    this.scene.add(new THREE.HemisphereLight(0xccd6ff, 0x202028, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(3, 4, 2)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight(0x99aaff, 0.5)
    fill.position.set(-3, -1, -2)
    this.scene.add(fill)

    // Procedural environment IBL (built lazily on first enable).
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = null

    // Material state (read by makeMaterial — set before first call).
    this.color = '#b9c2d0'
    this.roughness = 0.38
    this.metalness = 0.18
    this.flat = false
    this.matType = 'standard'
    this.material = this.makeMaterial('standard')
    this.lineMat = new LineMaterial({ color: 0xb9c2d0, linewidth: 3 * STROKE_TO_WORLD, worldUnits: true })

    // Geometry (procedural; one shared instance for all items).
    this.primId = 'box'
    this.params = { tube: 0.32, p: 2, q: 3, detail: 0 }
    this.rounding = 0.22
    this.activeGeom = this.buildGeometry(this.primId)
    this.wireGeom = new WireframeGeometry2(this.activeGeom)

    // Item pool (shared geom/material/wireGeom/lineMat).
    this.items = []
    this.layoutPos = [[0, 0, 0]]
    this.setCount(1)

    // XYZ axes (red/green/blue). Scaled by axisLength; toggled via update().
    this.axes = new THREE.AxesHelper(1)
    this.axes.material.transparent = true
    this.axes.material.opacity = 0.7
    this.axes.visible = false
    this.scene.add(this.axes)

    this.presets = Object.fromEntries(PRESETS.map((p) => [p.id, p.sample]))
    this.dur = DURATION
    this.accum = 0
    this.last = performance.now()
    this.recording = false
    this._recStop = null
    this.globals = {
      preset: 'spin', animMode: 'preset', keyframes: [], loop: true, paused: true, speed: 1, duration: DURATION,
      count: 1, arrangement: 'single', spread: 2.2, objectSize: 1, stagger: 0,
      cameraMotion: false, orbitSpeed: 1, fov: 38,
      wireframe: false, strokeWidth: 3, materialType: 'standard', environment: false,
      roughness: 0.38, metalness: 0.18, color: '#b9c2d0', flatShading: false,
      showAxis: false, axisLength: 1.5, axisOpacity: 0.7,
    }
    this.onProgress = null
    /* editor port: host drives via frame(dt); pass {autoLoop:true} for the
     * original self-running behavior. */
    if (this.autoLoop) this.raf = requestAnimationFrame(this.loop)
  }

  buildGeometry(id) {
    const p = this.params
    switch (id) {
      case 'box': {
        const r = Math.min(Math.max(this.rounding, 0), 0.7)
        return r > 0 ? new RoundedBoxGeometry(1.5, 1.5, 1.5, 6, r) : new THREE.BoxGeometry(1.5, 1.5, 1.5)
      }
      case 'sphere': return new THREE.SphereGeometry(1, 64, 48)
      case 'torus': return new THREE.TorusGeometry(0.78, p.tube ?? 0.32, 48, 96)
      case 'torusKnot': return new THREE.TorusKnotGeometry(0.7, 0.26, 160, 32, p.p ?? 2, p.q ?? 3)
      case 'cone': return new THREE.ConeGeometry(0.95, 1.7, 64)
      case 'cylinder': return new THREE.CylinderGeometry(0.8, 0.8, 1.6, 64)
      case 'icosahedron': return new THREE.IcosahedronGeometry(1.1, p.detail ?? 0)
      case 'octahedron': return new THREE.OctahedronGeometry(1.15, p.detail ?? 0)
      case 'dodecahedron': return new THREE.DodecahedronGeometry(1.05, p.detail ?? 0)
      default: return new THREE.BoxGeometry(1.5, 1.5, 1.5)
    }
  }

  rebuildGeometry() {
    const oldGeom = this.activeGeom
    const oldWire = this.wireGeom
    this.activeGeom = this.buildGeometry(this.primId)
    this.wireGeom = new WireframeGeometry2(this.activeGeom)
    for (const it of this.items) {
      it.mesh.geometry = this.activeGeom
      it.wire.geometry = this.wireGeom
    }
    oldGeom.dispose()
    oldWire.dispose()
  }

  makeMaterial(type) {
    const color = new THREE.Color(this.color)
    switch (type) {
      case 'normal': return new THREE.MeshNormalMaterial({ flatShading: this.flat })
      case 'phong': return new THREE.MeshPhongMaterial({ color, flatShading: this.flat, shininess: 60 })
      case 'toon': return new THREE.MeshToonMaterial({ color })
      case 'glass': return new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: this.roughness, transmission: 1, thickness: 0.6, ior: 1.4, flatShading: this.flat })
      // chromatic dispersion (three r0.166+): light splits into rainbow through the IOR — the joe_ryba "Puddle" glass.
      case 'dispersion': return new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: this.roughness, transmission: 1, thickness: 0.8, ior: 1.5, dispersion: 6, flatShading: this.flat })
      default: return new THREE.MeshStandardMaterial({ color, roughness: this.roughness, metalness: this.metalness, flatShading: this.flat })
    }
  }

  setMaterialType(type) {
    if (type === this.matType) return
    const old = this.material
    this.matType = type
    this.material = this.makeMaterial(type)
    for (const it of this.items) it.mesh.material = this.material
    old.dispose()
  }

  applyMaterialProps() {
    const m = this.material
    if (m.color && this.matType !== 'normal') m.color.set(this.color)
    if ('roughness' in m) m.roughness = this.roughness
    if ('metalness' in m && this.matType !== 'glass' && this.matType !== 'dispersion') m.metalness = this.metalness
    if ('flatShading' in m && m.flatShading !== this.flat) { m.flatShading = this.flat; m.needsUpdate = true }
    this.lineMat.color.set(this.color)
  }

  setCount(n) {
    n = Math.max(1, Math.min(MAX_ITEMS, Math.round(n)))
    while (this.items.length < n) {
      const mesh = new THREE.Mesh(this.activeGeom, this.material)
      const wire = new Wireframe(this.wireGeom, this.lineMat)
      wire.visible = false
      this.scene.add(mesh)
      this.scene.add(wire)
      this.items.push({ mesh, wire })
    }
    while (this.items.length > n) {
      const it = this.items.pop()
      this.scene.remove(it.mesh)
      this.scene.remove(it.wire)
      // geometry + material are shared — never disposed here
    }
  }

  ensureEnv() {
    if (!this.envTex) this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    return this.envTex
  }

  update({ globals, primitive, params } = {}) {
    let geomDirty = false
    if (primitive && primitive !== this.primId) { this.primId = primitive; geomDirty = true }
    if (params) { this.params = { ...this.params, ...params }; geomDirty = true }

    if (globals) {
      this.globals = globals
      // Material.
      this.color = globals.color || this.color
      this.roughness = globals.roughness ?? this.roughness
      this.metalness = globals.metalness ?? this.metalness
      this.flat = !!globals.flatShading
      this.setMaterialType(globals.materialType || 'standard')
      this.applyMaterialProps()
      // Wireframe.
      const wf = !!globals.wireframe
      for (const it of this.items) { it.mesh.visible = !wf; it.wire.visible = wf }
      this.lineMat.linewidth = (globals.strokeWidth ?? 3) * STROKE_TO_WORLD
      // Rounding (cube only).
      if (globals.rounding != null && globals.rounding !== this.rounding) {
        this.rounding = globals.rounding
        if (this.primId === 'box') geomDirty = true
      }
      // Composition.
      this.setCount(globals.count ?? 1)
      this.layoutPos = layout(globals.arrangement || 'single', globals.count ?? 1, globals.spread ?? 2.2)
      // Loop length + camera.
      if (globals.duration) this.dur = globals.duration
      if (globals.fov != null && globals.fov !== this.camera.fov) {
        this.camera.fov = globals.fov
        this.camera.updateProjectionMatrix()
      }
      // Environment IBL.
      this.scene.environment = globals.environment ? this.ensureEnv() : null
      // XYZ axes.
      this.axes.visible = !!globals.showAxis
      this.axes.scale.setScalar(globals.axisLength ?? 1.5)
      this.axes.material.opacity = globals.axisOpacity ?? 0.7
    }

    if (geomDirty) this.rebuildGeometry()
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.lineMat.resolution.set(w, h)
    this.w = w
    this.h = h
  }

  seek(frac) {
    this.accum = Math.max(0, Math.min(1, frac)) * this.dur
  }

  setBackground(hex) {
    this.renderer.setClearColor(new THREE.Color(hex), 1)
  }

  resetCamera() {
    this.camera.position.set(0, 0.6, 4)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  poseAt(u) {
    const g = this.globals
    return g.animMode === 'keyframe'
      ? sampleKeyframes(g.keyframes, u)
      : (this.presets[g.preset] || this.presets.spin)(u)
  }

  // Live-apply the continuous material/camera params (called per frame only when
  // an expression is active). Geometry-rebuild params (count/detail/knot) and the
  // colour hex are NOT here — they're applied in update().
  _applyLive(g) {
    const m = this.material
    if (Number.isFinite(g.roughness) && 'roughness' in m) m.roughness = g.roughness
    if (Number.isFinite(g.metalness) && 'metalness' in m && this.matType !== 'glass' && this.matType !== 'dispersion') m.metalness = g.metalness
    if (Number.isFinite(g.strokeWidth)) this.lineMat.linewidth = g.strokeWidth * STROKE_TO_WORLD
    if (Number.isFinite(g.fov) && g.fov !== this.camera.fov) { this.camera.fov = g.fov; this.camera.updateProjectionMatrix() }
    if (Number.isFinite(g.axisLength)) this.axes.scale.setScalar(g.axisLength)
    if (Number.isFinite(g.axisOpacity)) this.axes.material.opacity = g.axisOpacity
  }

  /* One externally-driven step (dt seconds) — the loop body minus RAF. */
  frame(dt) { this.step(dt) }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    this.step(dt)
  }

  step = (dt) => {
    const rawG = this.globals

    // Playhead. While recording, sweep u 0→1 once at realtime (seamless loop);
    // otherwise wrap when looping, hold at the end when not. Speed may be an
    // expression — resolve it to a finite rate so the playhead never goes NaN.
    let t
    if (this.recording) {
      this.accum += dt
      t = Math.min(this.accum, this.dur)
    } else {
      if (!rawG.paused) this.accum += dt * (Number(rawG.speed) || 1)
      t = rawG.loop ? this.accum % this.dur : Math.min(this.accum, this.dur)
    }
    if (this.onProgress) this.onProgress({ t, dur: this.dur })
    const u = this.dur > 0 ? t / this.dur : 0

    const g = rawG  /* expression params stripped in the editor port */

    // Per-item transform: base layout + animated pose (with phase stagger), all
    // scaled by objectSize and the live audio level.
    const n = this.items.length
    const stagger = g.stagger ?? 0
    const objScale = g.objectSize ?? 1
    const lvl = 0  /* audio reactivity stripped in the editor port */
    const audioScale = 1 + lvl * (g.audioAmount ?? 1)
    for (let i = 0; i < n; i++) {
      const it = this.items[i]
      const ui = n > 1 ? (u + (i / n) * stagger) % 1 : u
      const tr = this.poseAt(ui)
      const rot = tr.rot || [0, 0, 0]
      const pos = tr.pos || [0, 0, 0]
      const base = this.layoutPos[i] || [0, 0, 0]
      it.mesh.position.set(base[0] + pos[0], base[1] + pos[1], base[2] + pos[2])
      it.mesh.rotation.set(rot[0], rot[1], rot[2])
      it.mesh.scale.setScalar(objScale * (tr.scale ?? 1) * audioScale)
      if (it.wire.visible) {
        it.wire.position.copy(it.mesh.position)
        it.wire.rotation.copy(it.mesh.rotation)
        it.wire.scale.copy(it.mesh.scale)
      }
    }

    // Camera: auto-orbit (drag-able) when motion on + playing; frozen during
    // recording so the loop's only motion is the periodic object anim.
    this.controls.autoRotate = !this.recording && !!g.cameraMotion && !g.paused
    this.controls.autoRotateSpeed = 2 * (g.orbitSpeed ?? 1)
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
    const ow = this.w
    const oh = this.h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.lineMat.resolution.set(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    return new Promise((resolve) => {
      this.canvas.toBlob((b) => {
        this.renderer.setPixelRatio(pr)
        this.renderer.setSize(ow, oh, false)
        this.lineMat.resolution.set(ow, oh)
        this.camera.aspect = ow / oh
        this.camera.updateProjectionMatrix()
        this.renderer.render(this.scene, this.camera)
        resolve(b)
      }, 'image/png')
    })
  }

  recordLoop(w, h, fps = 30) {
    if (typeof MediaRecorder === 'undefined' || !this.canvas.captureStream) return Promise.resolve(null)
    w = w || this.w
    h = h || this.h
    const pr = this.renderer.getPixelRatio()
    const ow = this.w
    const oh = this.h
    this.renderer.setPixelRatio(1)
    this.renderer.setSize(w, h, false)
    this.lineMat.resolution.set(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    const stream = this.canvas.captureStream(fps)
    const ok = (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8'
        : 'video/webm'
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
        this.lineMat.resolution.set(ow, oh)
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
    this.lineMat.dispose()
    this.activeGeom.dispose()
    this.wireGeom.dispose()
    this.axes.geometry.dispose()
    this.axes.material.dispose()
    this.envTex?.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
  }
}
