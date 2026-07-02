import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { Wireframe } from 'three/addons/lines/Wireframe.js'
import { WireframeGeometry2 } from 'three/addons/lines/WireframeGeometry2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { buildRibbonGeometry } from './ribbonGeometry.js'
import { FilterShader } from './filterPass.js'

/* RibbonEngine — a single hero glass ribbon (the joe_ryba "Puddle" look). One
 * swept-ribbon mesh on a black stage with RoomEnvironment IBL; the form turns on
 * its own axis (playhead-driven, so a webm loop closes seamlessly). Glass uses
 * MeshPhysicalMaterial transmission + dispersion (three r0.166+) for the rainbow
 * IOR edges; a post chain (bloom → chromatic-aberration/grain/vignette, the same
 * FilterShader as the Optic Scene) pushes the edges. Chrome is the metal variant.
 *
 * The React page owns all state and pushes it via update(); seek()/onProgress
 * feed the scrubber. Exports: exportBlobAt() (PNG @Nx) + recordLoop() (webm).
 */

const STROKE_TO_WORLD = 0.004

export default class RibbonEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.autoLoop = autoLoop
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color('#000000'), 1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    this.camera.position.set(0, 0, 6)
    this.camera.lookAt(0, 0, 0)

    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 2.5
    this.controls.maxDistance = 18

    // Lights — soft fill + two keys for the chrome highlights (glass leans on IBL).
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25))
    const key = new THREE.DirectionalLight(0xffffff, 2.2)
    key.position.set(4, 5, 3)
    this.scene.add(key)
    const rim = new THREE.DirectionalLight(0x88aaff, 1.0)
    rim.position.set(-4, -2, -3)
    this.scene.add(rim)

    // Procedural environment IBL — always on; glass/chrome both need reflections.
    this.pmrem = new THREE.PMREMGenerator(this.renderer)
    this.envTex = this.pmrem.fromScene(new RoomEnvironment(), 0.01).texture
    this.scene.environment = this.envTex

    // The spinning group holds the ribbon + its wireframe sibling.
    this.group = new THREE.Group()
    this.scene.add(this.group)

    this.matType = 'glass'
    this.color = '#cfe0ff'
    this.roughness = 0.06
    this.metalness = 1
    this.ior = 1.55
    this.dispersion = 10
    this.material = this.makeMaterial('glass')
    this.lineMat = new LineMaterial({ color: 0x9fb2d6, linewidth: 2.5 * STROKE_TO_WORLD, worldUnits: true })

    this.geomParams = { seed: 3, loops: 3, height: 2.2, gap: 0.92, depth: 0.35, curl: 1, width: 0.5, ribbonThickness: 0.12, corner: 0.045 }
    this.geom = buildRibbonGeometry(this.geomParams)
    this.wireGeom = new WireframeGeometry2(this.geom)
    this.mesh = new THREE.Mesh(this.geom, this.material)
    this.wire = new Wireframe(this.wireGeom, this.lineMat)
    this.wire.visible = false
    this.group.add(this.mesh)
    this.group.add(this.wire)

    // Post pipeline: render → bloom → chromatic-aberration/grain/vignette.
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.0, 0.7, 0.85)
    this.composer.addPass(this.bloom)
    this.filter = new ShaderPass(FilterShader)
    this.composer.addPass(this.filter)

    this.dur = 12
    this.accum = 0
    this.last = performance.now()
    this.recording = false
    this._recStop = null
    this.globals = {
      paused: true, loop: true, speed: 1, duration: 12,
      flow: 0.6, cameraOrbit: false, orbitSpeed: 0.6, fov: 36,
      materialType: 'glass', color: '#cfe0ff', roughness: 0.05, metalness: 1, ior: 1.55, dispersion: 10,
      background: '#000000', wireframe: false, strokeWidth: 2.5,
      aberration: 1.0, bloom: 0.0, vignette: 0.35, grain: 0.0,
    }
    this.onProgress = null
    if (this.autoLoop) this.raf = requestAnimationFrame(this.loop)
  }

  makeMaterial(type) {
    const color = new THREE.Color(this.color)
    if (type === 'chrome') {
      // Liquid chrome — mirror-smooth physical metal with clearcoat for that
      // wet-highlight specular on top of the IBL reflection.
      return new THREE.MeshPhysicalMaterial({
        color, metalness: 1, roughness: this.roughness,
        clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 2.2,
      })
    }
    // glass — transmission + high dispersion = rainbow IOR edge fringing.
    return new THREE.MeshPhysicalMaterial({
      color, metalness: 0, roughness: this.roughness,
      transmission: 1, thickness: 1.4, ior: this.ior, dispersion: this.dispersion,
      envMapIntensity: 1.8, clearcoat: 0.5, clearcoatRoughness: 0.06,
    })
  }

  setMaterialType(type) {
    if (type === this.matType) return
    this.matType = type
    const old = this.material
    this.material = this.makeMaterial(type)
    this.mesh.material = this.material
    old.dispose()
  }

  applyMaterialProps() {
    const m = this.material
    m.color.set(this.color)
    m.roughness = this.roughness
    if (this.matType === 'chrome') { m.metalness = this.metalness }
    else { m.ior = this.ior; m.dispersion = this.dispersion }
    this.lineMat.color.set(this.color)
  }

  rebuildGeometry() {
    const old = this.geom
    const oldWire = this.wireGeom
    this.geom = buildRibbonGeometry(this.geomParams)
    this.wireGeom = new WireframeGeometry2(this.geom)
    this.mesh.geometry = this.geom
    this.wire.geometry = this.wireGeom
    old.dispose()
    oldWire.dispose()
  }

  update({ globals, geom } = {}) {
    let geomDirty = false
    if (geom) {
      for (const k in geom) {
        if (geom[k] !== this.geomParams[k]) { this.geomParams = { ...this.geomParams, ...geom }; geomDirty = true; break }
      }
    }
    if (globals) {
      this.globals = globals
      this.color = globals.color || this.color
      this.roughness = globals.roughness ?? this.roughness
      this.metalness = globals.metalness ?? this.metalness
      this.ior = globals.ior ?? this.ior
      this.dispersion = globals.dispersion ?? this.dispersion
      this.setMaterialType(globals.materialType || 'glass')
      this.applyMaterialProps()
      if (globals.duration) this.dur = globals.duration
      if (globals.fov != null && globals.fov !== this.camera.fov) { this.camera.fov = globals.fov; this.camera.updateProjectionMatrix() }
      const wf = !!globals.wireframe
      this.mesh.visible = !wf
      this.wire.visible = wf
      this.lineMat.linewidth = (globals.strokeWidth ?? 2.5) * STROKE_TO_WORLD
      this.bloom.strength = globals.bloom ?? 0
      this.filter.uniforms.uAberration.value = globals.aberration ?? 0
      this.filter.uniforms.uVignette.value = globals.vignette ?? 0
      this.filter.uniforms.uGrain.value = globals.grain ?? 0
    }
    if (geomDirty) this.rebuildGeometry()
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.composer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.lineMat.resolution.set(w, h)
    this.w = w
    this.h = h
  }

  seek(frac) { this.accum = Math.max(0, Math.min(1, frac)) * this.dur }

  setBackground(hex) { this.renderer.setClearColor(new THREE.Color(hex), 1) }

  resetCamera() {
    this.camera.position.set(0, 0, 6)
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

    // Spine draw-on: playhead controls ONLY how much of the ribbon is visible.
    // The form holds still — camera spin is a completely separate control below.
    const flow = Math.max(0, Math.min(0.95, g.flow ?? 0))
    const ud = this.geom.userData
    if (flow > 0 && u < 1) {
      const grow = Math.min(u / flow, 1)
      if (grow < 1) {
        const rings = Math.max(1, Math.round(grow * ud.tubularSegments))
        this.geom.setDrawRange(0, rings * ud.ringIndexCount)
      } else {
        this.geom.setDrawRange(0, ud.totalIndexCount)
      }
    } else {
      this.geom.setDrawRange(0, ud.totalIndexCount)
    }

    // Camera orbit — independent of the playhead; runs continuously when on.
    this.controls.autoRotate = !this.recording && !!g.cameraOrbit
    this.controls.autoRotateSpeed = g.orbitSpeed ?? 0.6

    this.filter.uniforms.uTime.value = t
    this.controls.update()
    if (this.w && this.h) this.composer.render()

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
    this.composer.setSize(w, h)
    this.lineMat.resolution.set(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.composer.render()
    return new Promise((resolve) => {
      this.canvas.toBlob((b) => {
        this.renderer.setPixelRatio(pr)
        this.renderer.setSize(ow, oh, false)
        this.composer.setSize(ow, oh)
        this.lineMat.resolution.set(ow, oh)
        this.camera.aspect = ow / oh
        this.camera.updateProjectionMatrix()
        this.composer.render()
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
    this.composer.setSize(w, h)
    this.lineMat.resolution.set(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()

    const stream = this.canvas.captureStream(fps)
    const ok = (type) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(type)
    const mime = ok('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : ok('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm'
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
        this.composer.setSize(ow, oh)
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
    this.geom.dispose()
    this.wireGeom.dispose()
    this.bloom.dispose()
    this.composer.dispose?.()
    this.envTex.dispose()
    this.pmrem.dispose()
    this.renderer.dispose()
  }
}
