import * as THREE from 'three'
import SynthEngine from './synthBase.js'
import { orbitEye } from './orbit.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

/* Scan — a Rutt/Etra-style scan processor (the Steina & Woody Vasulka lineage).
 * A grid of horizontal scanlines (LineSegments) samples the source; each vertex
 * is pushed along z by the pixel's luminance (vertex texture fetch), producing
 * the signature pleated 3D raster. An orbit camera explores it — manual
 * (yaw/pitch/distance) or a motion preset (orbit/spin/rock/rise/push/pull),
 * which advances on the engine time clock so the transport pauses/resets it.
 * Ported from kol-labs-single radar/effects/synth. Ref: readymade-ui/rutt-etra. */

const VERT = `
  uniform sampler2D uImage;
  uniform float uDisplace;
  varying vec3 vColor;
  varying float vLuma;
  void main() {
    vec3 c = texture2D(uImage, uv).rgb;
    float luma = dot(c, vec3(0.299, 0.587, 0.114));
    vColor = c;
    vLuma = luma;
    vec3 p = position;
    p.z += (luma - 0.5) * uDisplace;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

const FRAG = `
  precision highp float;
  varying vec3 vColor;
  varying float vLuma;
  uniform float uMono;
  uniform float uOpacity;
  uniform vec3 uTint;
  void main() {
    vec3 col = mix(vColor, uTint * (0.25 + vLuma), uMono);
    gl_FragColor = vec4(col, uOpacity);
  }
`

const TAU = Math.PI * 2

export default class ScanEngine extends SynthEngine {
  _setup() {
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
    const [ix, iy, iz] = orbitEye(0, 0.4, 3)
    this.camera.position.set(ix, iy, iz)
    // Standard three.js scene controls — drag to orbit, wheel to zoom.
    this.controls = new OrbitControls(this.camera, this.canvas)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enablePan = false
    this.controls.minDistance = 1.5
    this.controls.maxDistance = 8
    this.controls.target.set(0, 0, 0)
    this.controls.update()
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      uniforms: {
        uImage: { value: null },
        uDisplace: { value: 1.0 },
        uMono: { value: 0 },
        uOpacity: { value: 1 },
        uTint: { value: new THREE.Color('#9fe7ff') },
      },
    })
    this.mesh = null
    this.rows = 140
    this.cols = 220
    this._camKey = ''
    this._bg = new THREE.Color('#0b0e13')
    this._buildMesh()
  }

  _buildMesh() {
    const cols = Math.max(8, Math.round(this.cols))
    const rows = Math.max(8, Math.round(this.rows))
    const a = this.imageAspect || 1
    const pos = new Float32Array(cols * rows * 3)
    const uvs = new Float32Array(cols * rows * 2)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c
        const u = c / (cols - 1)
        const v = r / (rows - 1)
        pos[i * 3] = (u - 0.5) * 2 * a
        pos[i * 3 + 1] = (0.5 - v) * 2
        pos[i * 3 + 2] = 0
        uvs[i * 2] = u
        uvs[i * 2 + 1] = 1 - v
      }
    }
    const idx = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) idx.push(r * cols + c, r * cols + c + 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
    g.setIndex(idx)
    if (this.mesh) { this.scene.remove(this.mesh); this.mesh.geometry.dispose() }
    this.mesh = new THREE.LineSegments(g, this.mat)
    this.scene.add(this.mesh)
  }

  _onImage() {
    this.mat.uniforms.uImage.value = this.tex
    this._buildMesh()
  }

  _onParams() {
    const p = this.params
    this.mat.uniforms.uDisplace.value = p.displace ?? 1.0
    this.mat.uniforms.uMono.value = p.mono ? 1 : 0
    this.mat.uniforms.uOpacity.value = p.opacity ?? 1
    if (p.tint) this.mat.uniforms.uTint.value.set(p.tint)
    const rows = Math.round(p.lines ?? 140)
    const cols = Math.round(p.cols ?? 220)
    if (rows !== this.rows || cols !== this.cols) { this.rows = rows; this.cols = cols; this._buildMesh() }
    const fov = p.fov ?? 45
    if (fov !== this.camera.fov) { this.camera.fov = fov; this.camera.updateProjectionMatrix() }
    if (p.bg) this._bg.set(p.bg)
    // Manual yaw/pitch/distance snap the orbit rig; the mouse drags on from
    // there. Keyed on the slider values so a param push won't reset it.
    if (!p.cameraMotion) {
      const key = `${p.yaw}|${p.pitch}|${p.dist}`
      if (key !== this._camKey) {
        this._camKey = key
        const [ex, ey, ez] = orbitEye(p.yaw ?? 0, p.pitch ?? 0.4, p.dist ?? 3)
        this.camera.position.set(ex, ey, ez)
        this.controls.target.set(0, 0, 0)
        this.controls.update()
      }
    }
  }

  _resize(w, h) {
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }

  // Orbit pose — manual (yaw/pitch/dist) or a time-driven preset.
  resolveCam() {
    const p = this.params
    let yaw = p.yaw ?? 0
    let pitch = p.pitch ?? 0.4
    let dist = p.dist ?? 3
    if (p.cameraMotion) {
      const w = this.time * (p.motionSpeed ?? 0.3)
      const osc = Math.sin(w * TAU)
      switch (p.motionPreset) {
        case 'spin': yaw = w * 2.2; break
        case 'rock': yaw += osc * 0.7; break
        case 'rise': pitch += osc * 0.6; break
        case 'push': dist *= 1 - 0.35 * (0.5 + 0.5 * osc); break
        case 'pull': dist *= 1 + 0.6 * (0.5 + 0.5 * osc); break
        case 'orbit':
        default: yaw = w; break
      }
    }
    pitch = Math.max(-1.4, Math.min(1.4, pitch))
    return { yaw, pitch, dist }
  }

  _frame() {
    this.renderer.setRenderTarget(null)
    this.renderer.setClearColor(this._bg, this.params.bgAlpha ?? 1)
    if (!this.tex || !this.mesh) { this.renderer.clear(); return }
    if (this.params.cameraMotion) {
      // A motion preset drives the camera; mouse control yields to it.
      this.controls.enabled = false
      const { yaw, pitch, dist } = this.resolveCam()
      const [ex, ey, ez] = orbitEye(yaw, pitch, dist)
      this.camera.position.set(ex, ey, ez)
      this.camera.lookAt(0, 0, 0)
    } else {
      this.controls.enabled = true
      this.controls.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  _dispose() {
    this.controls.dispose()
    if (this.mesh) this.mesh.geometry.dispose()
    this.mat.dispose()
  }
}
