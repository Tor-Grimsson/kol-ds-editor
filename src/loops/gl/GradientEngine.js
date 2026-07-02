import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { gradientVertex, gradientFragment, bgVertex, bgFragment } from './gradientShaders.js'

/* GradientEngine — one renderer, one WebGL context. Grid mode renders every
 * variation into its own scissored viewport (the three.js multi-scene
 * technique — N separate contexts would hit browser limits); single mode
 * renders one variation full-canvas. The React shell resolves variation specs
 * (shape/colors/driver/distort per seed) and pushes them via update().
 * preserveDrawingBuffer is on so exportBlob() can read the canvas back. */

const BG = '#0b0b0e'
const GAP = 14
const MAX_COLORS = 5

const makeGlowTexture = () => {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.25)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default class GradientEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.autoLoop = autoLoop
    this.canvas = canvas
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    this.renderer.setClearColor(new THREE.Color(BG), 1)
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50)
    this.camera.position.set(0, 0.15, 4.2)
    this.camera.lookAt(0, 0, 0)
    // One camera, one orbit — in grid mode all tiles share the view, so a drag
    // orbits the whole set; clicks (no drag) still select tiles.
    this.controls = new OrbitControls(this.camera, canvas)
    this.controls.enableDamping = true
    this.controls.enablePan = false
    this.controls.minDistance = 1.6
    this.controls.maxDistance = 12
    this.glowTex = makeGlowTexture()
    // background field: a shared fullscreen quad + dummy camera; each tile owns
    // its own bg material (its palette). The bg shader is camera-independent.
    this.bgGeo = new THREE.PlaneGeometry(2, 2)
    this.bgCam = new THREE.Camera()
    this.bgBase = new THREE.Color(BG)
    this.geoms = {
      sphere: new THREE.SphereGeometry(1.02, 96, 96),
      plane: new THREE.PlaneGeometry(2.1, 1.5, 128, 96),
    }
    this.tiles = []
    this.rects = []
    this.mode = 'grid'
    this.idx = 0
    this.globals = { glow: 0.6, grain: 0.06, speed: 1, paused: false, bg: 0.85, bgStyle: 0 }
    this.time = 0
    this.last = performance.now()
    if (this.autoLoop) this.raf = requestAnimationFrame(this.loop)
  }

  buildTile(spec) {
    const scene = new THREE.Scene()
    const material = new THREE.ShaderMaterial({
      vertexShader: gradientVertex,
      fragmentShader: gradientFragment,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uDistort: { value: 0 },
        uSeedOffset: { value: 0 },
        uColors: { value: Array.from({ length: MAX_COLORS }, () => new THREE.Color()) },
        uCount: { value: 2 },
        uDriver: { value: 0 },
        uGlow: { value: 0.6 },
        uGrain: { value: 0.06 },
      },
    })
    const mesh = new THREE.Mesh(this.geoms[spec.shape], material)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.3,
    }))
    glow.position.set(0, -0.5, -1.2)
    glow.scale.set(3.6, 3.6, 1)
    scene.add(glow)
    scene.add(mesh)
    // background field for this tile (its own palette uniforms)
    const bgMaterial = new THREE.ShaderMaterial({
      vertexShader: bgVertex,
      fragmentShader: bgFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uColors: { value: Array.from({ length: MAX_COLORS }, () => new THREE.Color()) },
        uCount: { value: 2 },
        uSeedOffset: { value: 0 },
        uIntensity: { value: 0.75 },
        uStyle: { value: 0 },
        uBase: { value: this.bgBase },
      },
    })
    const bgScene = new THREE.Scene()
    bgScene.add(new THREE.Mesh(this.bgGeo, bgMaterial))
    return { scene, mesh, material, glow, bgScene, bgMaterial, spec }
  }

  applySpec(tile, spec) {
    const u = tile.material.uniforms
    tile.mesh.geometry = this.geoms[spec.shape]
    tile.mesh.rotation.set(spec.shape === 'plane' ? -0.35 : 0.12, 0, 0)
    u.uDistort.value = spec.distort
    u.uSeedOffset.value = spec.seed % 977
    u.uDriver.value = spec.driver
    u.uCount.value = Math.min(spec.colors.length, MAX_COLORS)
    spec.colors.slice(0, MAX_COLORS).forEach((hex, i) => u.uColors.value[i].set(hex))
    tile.glow.material.color.set(spec.colors[Math.floor(spec.colors.length / 2)])
    // background shares the tile's palette + seed
    const b = tile.bgMaterial.uniforms
    b.uCount.value = Math.min(spec.colors.length, MAX_COLORS)
    spec.colors.slice(0, MAX_COLORS).forEach((hex, i) => b.uColors.value[i].set(hex))
    b.uSeedOffset.value = spec.seed % 977
    tile.spec = spec
  }

  update({ specs, mode, idx, globals }) {
    if (specs) {
      while (this.tiles.length < specs.length) this.tiles.push(this.buildTile(specs[this.tiles.length]))
      specs.forEach((spec, i) => this.applySpec(this.tiles[i], spec))
    }
    if (mode) this.mode = mode
    if (idx != null) this.idx = idx
    if (globals) this.globals = globals
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false)
    this.w = w
    this.h = h
  }

  tileAt(x, y) {
    return this.rects.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)
  }

  renderTile(tile, rect) {
    // setViewport/setScissor take logical units; three applies the pixel ratio.
    const r = this.renderer
    r.setViewport(rect.x, this.h - rect.y - rect.h, rect.w, rect.h)
    r.setScissor(rect.x, this.h - rect.y - rect.h, rect.w, rect.h)
    // background pass — autoClear wipes the rect (colour + depth); the bg quad
    // writes no depth, so the shape pass gets a clean depth buffer over it.
    r.autoClear = true
    r.render(tile.bgScene, this.bgCam)
    r.autoClear = false
    this.camera.aspect = rect.w / rect.h
    this.camera.updateProjectionMatrix()
    r.render(tile.scene, this.camera)
    r.autoClear = true
  }

  /* One externally-driven step (editor port: host drives frame(dt)). */
  frame(dt) { this.step(dt) }

  loop = () => {
    this.raf = requestAnimationFrame(this.loop)
    const now = performance.now()
    const dt = (now - this.last) / 1000
    this.last = now
    this.step(dt)
  }

  step = (dt) => {
    // Resolve any expression-valued globals at the current playhead (speed first
    // — it drives the accumulator, so it must never be NaN).
    if (!this.globals.paused) this.time += dt * (Number(this.globals.speed) || 1)
    const g = this.globals  /* expression params stripped in the editor port */
    this.controls.update()
    if (!this.w || !this.h || this.tiles.length === 0) return

    for (const tile of this.tiles) {
      const u = tile.material.uniforms
      u.uTime.value = this.time
      u.uGlow.value = g.glow
      u.uGrain.value = g.grain
      const b = tile.bgMaterial.uniforms
      b.uTime.value = this.time
      b.uIntensity.value = g.bg
      b.uStyle.value = g.bgStyle
      tile.glow.material.opacity = 0.18 + g.glow * 0.3
      const plane = tile.spec.shape === 'plane'
      tile.mesh.rotation.y = tile.spec.phase + this.time * tile.spec.rotSpeed * (plane ? 0.3 : 1)
    }

    this.renderer.setScissorTest(false)
    this.renderer.setViewport(0, 0, this.w, this.h)
    this.renderer.clear()
    this.renderer.setScissorTest(true)

    if (this.mode === 'single') {
      const rect = { x: 0, y: 0, w: this.w, h: this.h }
      this.rects = [rect]
      this.renderTile(this.tiles[this.idx], rect)
    } else {
      const n = this.tiles.length
      const cols = 3
      const rows = Math.ceil(n / cols)
      const tw = (this.w - GAP * (cols + 1)) / cols
      const th = (this.h - GAP * (rows + 1)) / rows
      this.rects = this.tiles.map((_, i) => ({
        x: GAP + (i % cols) * (tw + GAP),
        y: GAP + Math.floor(i / cols) * (th + GAP),
        w: tw,
        h: th,
      }))
      this.tiles.forEach((tile, i) => this.renderTile(tile, this.rects[i]))
    }
    this.renderer.setScissorTest(false)
  }

  setBackground(hex) {
    this.renderer.setClearColor(new THREE.Color(hex), 1)
    this.bgBase.set(hex)
  }

  resetCamera() {
    this.camera.position.set(0, 0.15, 4.2)
    this.controls.target.set(0, 0, 0)
    this.controls.update()
  }

  resetTime() {
    this.time = 0
  }

  exportBlob() {
    return new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'))
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    this.controls.dispose()
    for (const tile of this.tiles) {
      tile.material.dispose()
      tile.glow.material.dispose()
      tile.bgMaterial.dispose()
    }
    for (const g of Object.values(this.geoms)) g.dispose()
    this.bgGeo.dispose()
    this.glowTex.dispose()
    this.renderer.dispose()
  }
}
