import * as THREE from 'three'

/**
 * Chromatic-aberration distortion engine. Ported from kol-labs-single
 * radar/effects/distortion/distortionEngine.js for the design editor:
 *   - expression params stripped to plain numerics
 *   - source = a fitted CANVAS (THREE.CanvasTexture, uploaded on swap)
 *   - self-RAF gated on { autoLoop }; the host drives frame(dt) otherwise
 *   - preserveDrawingBuffer on (export snapshots the live canvas)
 *   - the trail centre comes from setPointer(x, y) OR params {px, py} (0..1,
 *     origin bottom-left) so the editor's param graph can bind mouseX/mouseY;
 *     the auto-path modes (orbit/figure8/lissajous/sweep/spiral) ride the
 *     accumulated time clock.
 *
 * Pipeline (per frame):
 *   1. Trail pass — a feedback render target that fades toward black each frame
 *      (uDecay) and stamps a soft blob at the eased cursor position while the
 *      pointer is moving (uActive decays when it stops → the trail fades out).
 *      Ping-ponged between two RTs.
 *   2. Display pass — samples the image, displaced by the *gradient* of the
 *      trail (a lens-like push around the cursor), and reads the R/G/B channels
 *      at separately offset positions along that gradient (the colour bleed).
 *
 * The image is fit "cover" into the canvas via uImageScale/uImageOffset.
 */

const TAU = Math.PI * 2

// Auto-drive paths for the distortion point — a time-driven modulation source so
// the effect animates hands-free (not pointer-reliant). Centred at (0.5,0.5); a =
// amplitude (half of Size). `off` = no auto motion (the default → pointer only).
const MOTION_PATHS = {
  off: null,
  orbit: (w, a) => [0.5 + a * Math.cos(w), 0.5 + a * Math.sin(w)],
  figure8: (w, a) => [0.5 + a * Math.sin(w), 0.5 + a * Math.sin(2 * w) * 0.5],
  lissajous: (w, a) => [0.5 + a * Math.sin(3 * w), 0.5 + a * Math.sin(2 * w)],
  sweep: (w, a) => [0.5 + a * Math.sin(w), 0.5],
  spiral: (w, a) => { const r = a * (0.55 + 0.45 * Math.sin(w * 0.25)); return [0.5 + r * Math.cos(w), 0.5 + r * Math.sin(w)] },
}

const VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const TRAIL_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform float uRadius;
  uniform float uDecay;
  uniform float uAspect;
  uniform float uActive;
  void main() {
    float prev = texture2D(uPrev, vUv).r;
    vec2 d = vUv - uMouse;
    d.x *= uAspect;
    float blob = smoothstep(uRadius, 0.0, length(d)) * uActive;
    float v = max(prev * uDecay, blob);
    gl_FragColor = vec4(vec3(v), 1.0);
  }
`

const DISPLAY_FRAG = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uImage;
  uniform sampler2D uTrail;
  uniform vec2 uImageScale;
  uniform vec2 uImageOffset;
  uniform float uStrength;
  uniform float uRGBShift;
  uniform vec2 uTexel;
  void main() {
    // Trail intensity at this pixel, plus its gradient (points toward the
    // cursor's bright centre → the refraction direction).
    float t  = texture2D(uTrail, vUv).r;
    float tL = texture2D(uTrail, vUv - vec2(uTexel.x, 0.0)).r;
    float tR = texture2D(uTrail, vUv + vec2(uTexel.x, 0.0)).r;
    float tD = texture2D(uTrail, vUv - vec2(0.0, uTexel.y)).r;
    float tU = texture2D(uTrail, vUv + vec2(0.0, uTexel.y)).r;
    vec2 grad = vec2(tR - tL, tU - tD);
    vec2 dir = length(grad) > 1e-5 ? normalize(grad) : vec2(0.0);

    vec2 disp = grad * uStrength;
    // Chromatic aberration — R/G/B read at positions offset along the trail
    // direction, magnitude = trail intensity x shift.
    vec2 chroma = dir * t * uRGBShift;

    vec2 base = vUv * uImageScale + uImageOffset;
    float r = texture2D(uImage, base + disp + chroma).r;
    float g = texture2D(uImage, base + disp).g;
    float b = texture2D(uImage, base + disp - chroma).b;
    gl_FragColor = vec4(r, g, b, 1.0);
  }
`

const TRAIL_SCALE = 0.5 // trail RT runs at half canvas res — softer + cheaper

export default class DistortionEngine {
  constructor(canvas, { autoLoop = false } = {}) {
    this.canvas = canvas
    this.autoLoop = autoLoop
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setClearColor(0x000000, 0) // transparent → the stage bg shows through

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    this.scene = new THREE.Scene()
    this.geo = new THREE.PlaneGeometry(2, 2)

    this.target = new THREE.Vector2(0.5, 0.5)
    this.eased = new THREE.Vector2(0.5, 0.5)
    this.active = 0
    this.params = { strength: 0.25, radius: 0.18, decay: 0.94, rgbShift: 0.03 }
    this.size = new THREE.Vector2(1, 1)
    this.imageAspect = 1
    this.texture = null
    this._raf = null
    this.paused = false
    this.timeScale = 1
    // Auto-drive modulation: a path that moves the point + an in-place radius
    // pulse. shape 'off' = pointer only.
    this.motion = { shape: 'off', speed: 1, size: 0.6, pulse: 0 }
    this.time = 0
    this.last = performance.now()

    // Cursor record/replay (labs radar/DistortPage:131-165). A recorded gesture
    // is a normalized track [{ t: 0..1, x, y }] (uv, origin bottom-left) plus
    // its wall duration (cursorDur, seconds). Replay steers the point along it
    // hands-free — sampled by the transport-driven clock so it loops cleanly.
    this.cursorPath = []       // normalized track (persisted via params)
    this.cursorDur = 0         // recorded wall duration, seconds
    this.cursorReplay = false  // replay the track instead of the auto path
    this._recording = false
    this._recBuf = null        // raw samples { t(ms), x, y } while recording
    this._recStart = 0
    this._onCanvasMove = null  // own-canvas pointermove listener (self-contained capture)
    this._paramPathRef = undefined // last param-array ref adopted (per-frame clobber guard)
    this.onCursorPath = null   // (path, dur) callback — host persists to layer params

    const rtOpts = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.rtA = new THREE.WebGLRenderTarget(2, 2, rtOpts)
    this.rtB = new THREE.WebGLRenderTarget(2, 2, rtOpts)

    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: TRAIL_FRAG,
      uniforms: {
        uPrev: { value: null },
        uMouse: { value: new THREE.Vector2(0.5, 0.5) },
        uRadius: { value: this.params.radius },
        uDecay: { value: this.params.decay },
        uAspect: { value: 1 },
        uActive: { value: 0 },
      },
    })

    this.displayMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: DISPLAY_FRAG,
      uniforms: {
        uImage: { value: null },
        uTrail: { value: null },
        uImageScale: { value: new THREE.Vector2(1, 1) },
        uImageOffset: { value: new THREE.Vector2(0, 0) },
        uStrength: { value: this.params.strength },
        uRGBShift: { value: this.params.rgbShift },
        uTexel: { value: new THREE.Vector2(0.5, 0.5) },
      },
    })

    this.quad = new THREE.Mesh(this.geo, this.trailMat)
    this.scene.add(this.quad)
    this._clearTargets()
    if (this.autoLoop) this.start()
  }

  _clearTargets() {
    this.renderer.setRenderTarget(this.rtA)
    this.renderer.clear()
    this.renderer.setRenderTarget(this.rtB)
    this.renderer.clear()
    this.renderer.setRenderTarget(null)
  }

  /* Source = a fitted canvas from the editor. Uploaded once on swap; call
   * touchSource() after redrawing INTO the same canvas. */
  setSource(source) {
    if (this.texture) this.texture.dispose()
    const tex = new THREE.CanvasTexture(source)
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.wrapS = THREE.ClampToEdgeWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    this.texture = tex
    this.imageAspect = (source.width || 1) / (source.height || 1)
    this.displayMat.uniforms.uImage.value = tex
    this._updateFit()
  }

  touchSource() {
    if (this.texture) this.texture.needsUpdate = true
  }

  /* Flat params: effect (strength/radius/decay/rgbShift), clock rate (speed),
   * pointer (px/py — bind the editor's mouseX/mouseY here), and the auto-path
   * motion source (motionShape/motionSpeed/motionSize/motionPulse). */
  setParams(p) {
    if (p.strength != null) this.params.strength = p.strength
    if (p.radius != null) this.params.radius = p.radius
    if (p.decay != null) this.params.decay = p.decay
    if (p.rgbShift != null) this.params.rgbShift = p.rgbShift
    if (p.speed != null) this.setTimeScale(p.speed)
    if (p.px != null || p.py != null) this.setPointer(p.px ?? this.target.x, p.py ?? this.target.y)
    if (p.motionShape != null) this.motion.shape = p.motionShape
    if (p.motionSpeed != null) this.motion.speed = p.motionSpeed
    if (p.motionSize != null) this.motion.size = p.motionSize
    if (p.motionPulse != null) this.motion.pulse = p.motionPulse
    // Cursor record/replay wiring.
    if (p.cursorReplay != null) this.cursorReplay = !!p.cursorReplay
    if (p.cursorDur != null) this.cursorDur = p.cursorDur
    // Adopt a persisted track only when the param ARRAY REF changes (a real
    // updateLayer), never per-frame — a fresh in-engine recording keeps the old
    // ref, so it isn't clobbered by the stale param before the host persists it.
    if (p.cursorPath !== undefined && p.cursorPath !== this._paramPathRef && !this._recording) {
      this._paramPathRef = p.cursorPath
      this.cursorPath = Array.isArray(p.cursorPath) ? p.cursorPath : []
    }
    // Edge-triggered record toggle — a self-contained record path (attaches a
    // pointermove listener to the engine's own canvas). A host can drive the
    // same via startCursorRecord/pushCursorSample/stopCursorRecord directly.
    if (p.cursorRecord != null) {
      if (p.cursorRecord && !this._recording) this.startCursorRecord()
      else if (!p.cursorRecord && this._recording) this.stopCursorRecord()
    }
    this._apply()
  }

  /** Begin capturing a cursor gesture. Clears the prior buffer + attaches a
   * pointermove listener to this.canvas (hover, no button — doesn't fight the
   * layer's pointerdown drag). Replay is suspended while recording. */
  startCursorRecord() {
    this.cursorReplay = false
    this._recBuf = []
    this._recStart = performance.now()
    this._recording = true
    if (!this._onCanvasMove && this.canvas) {
      this._onCanvasMove = (e) => {
        const r = this.canvas.getBoundingClientRect()
        if (!r.width || !r.height) return
        const x = (e.clientX - r.left) / r.width
        const y = 1 - (e.clientY - r.top) / r.height   // GL uv origin bottom-left
        this.pushCursorSample(Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y)))
      }
      this.canvas.addEventListener('pointermove', this._onCanvasMove)
    }
  }

  /** Feed one sample (uv 0..1, origin bottom-left) into the active recording,
   * and steer the live point so the trail follows while you record. Public so a
   * host can capture from a wrapper element instead of the engine canvas. */
  pushCursorSample(x, y) {
    if (!this._recording) return
    this._recBuf.push({ t: performance.now() - this._recStart, x, y })
    this.setPointer(x, y)
  }

  /** End recording. Normalizes the buffer to a 0..1 track (dropping the raw
   * wall clock into cursorDur, seconds), fires onCursorPath for persistence,
   * and returns the track. */
  stopCursorRecord() {
    if (!this._recording) return this.cursorPath
    this._recording = false
    if (this._onCanvasMove && this.canvas) this.canvas.removeEventListener('pointermove', this._onCanvasMove)
    this._onCanvasMove = null
    const buf = this._recBuf || []
    this._recBuf = null
    if (buf.length >= 2) {
      const dur = buf[buf.length - 1].t || 1
      this.cursorPath = buf.map((s) => ({ t: s.t / dur, x: s.x, y: s.y }))
      this.cursorDur = dur / 1000
    }
    this.onCursorPath?.(this.cursorPath, this.cursorDur)
    return this.cursorPath
  }

  /** Discard the recorded track (stops replay). */
  clearCursorPath() {
    this.cursorPath = []
    this.cursorDur = 0
    this.cursorReplay = false
    this.onCursorPath?.(this.cursorPath, 0)
  }

  /** Sample the normalized track at phase ph∈[0,1] → [x, y] (linear between
   * keyframes). */
  _sampleCursor(ph) {
    const track = this.cursorPath
    let i = 1
    while (i < track.length && track[i].t < ph) i += 1
    const a = track[i - 1]
    const b = track[Math.min(i, track.length - 1)]
    const span = (b.t - a.t) || 1
    const k = Math.min(1, Math.max(0, (ph - a.t) / span))
    return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k]
  }

  _apply() {
    this.trailMat.uniforms.uRadius.value = this.params.radius
    this.trailMat.uniforms.uDecay.value = this.params.decay
    this.displayMat.uniforms.uStrength.value = this.params.strength
    this.displayMat.uniforms.uRGBShift.value = this.params.rgbShift
  }

  /** Pointer position in uv space (0..1, origin bottom-left). */
  setPointer(u, v) {
    this.target.set(u, v)
    this.active = 1
  }

  /** Auto-drive motion source (path + pulse). shape 'off' → pointer only. */
  setMotion(m) { Object.assign(this.motion, m) }

  // Transport hooks: freeze the animation, scale its rate, clear the trail.
  setPaused(p) { this.paused = !!p }
  setTimeScale(s) { this.timeScale = Math.max(0.05, s) }
  clearTrail() { this._clearTargets() }
  reset() { this.time = 0; this._clearTargets() }

  resize(w, h) {
    if (w < 1 || h < 1) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    const rw = Math.max(2, Math.round(w * TRAIL_SCALE))
    const rh = Math.max(2, Math.round(h * TRAIL_SCALE))
    this.rtA.setSize(rw, rh)
    this.rtB.setSize(rw, rh)
    this.size.set(w, h)
    this.trailMat.uniforms.uAspect.value = w / h
    this.displayMat.uniforms.uTexel.value.set(1 / rw, 1 / rh)
    this._updateFit()
    this._clearTargets()
  }

  _updateFit() {
    const canvasAspect = this.size.x / this.size.y
    let sx
    let sy
    if (this.imageAspect > canvasAspect) {
      sx = canvasAspect / this.imageAspect
      sy = 1
    } else {
      sx = 1
      sy = this.imageAspect / canvasAspect
    }
    this.displayMat.uniforms.uImageScale.value.set(sx, sy)
    this.displayMat.uniforms.uImageOffset.value.set((1 - sx) / 2, (1 - sy) / 2)
  }

  // Self-RAF — only when constructed with { autoLoop: true }.
  start() {
    if (!this.autoLoop || this._raf) return
    const loop = () => {
      this._raf = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      this.frame(dt)
    }
    this._raf = requestAnimationFrame(loop)
  }

  // Externally-driven step: advance the clock by dt, feed the trail, render.
  // The host passes dt=0 while paused — the trail pass is skipped then (unless
  // fresh pointer energy is queued) so the held frame doesn't decay to black,
  // but the display pass still runs so param edits repaint.
  frame(dt, u) {
    if (!this.paused) this.time += dt * this.timeScale

    // Cursor replay — steer the point along the recorded track, sampled by a
    // normalized phase. Prefer the host's transport phase `u` (0..1, completes
    // the gesture once per transport loop) when passed; otherwise loop the
    // engine clock over the recorded duration. Wins over the auto path.
    let replaying = false
    if (this.cursorReplay && this.cursorPath.length >= 2) {
      const ph = u != null
        ? ((u % 1) + 1) % 1
        : (this.cursorDur ? (((this.time % this.cursorDur) + this.cursorDur) % this.cursorDur) / this.cursorDur : 0)
      const [x, y] = this._sampleCursor(ph)
      this.target.set(x, y)
      this.active = 1
      replaying = true
    }

    // Auto-drive: steer the point along the chosen path (pointer-free). Keeps
    // the stamp alive (active=1) so the trail feeds continuously.
    const path = replaying ? null : MOTION_PATHS[this.motion.shape]
    if (path) {
      const [mx, my] = path(this.time * this.motion.speed, this.motion.size * 0.5)
      this.target.set(mx, my)
      this.active = 1
    }
    // In-place pulse of the blob radius (0 = steady). Applied every frame so
    // toggling it back to 0 restores the set radius.
    const pk = this.motion.pulse
      ? 1 + this.motion.pulse * Math.sin(this.time * TAU * 0.5 * this.motion.speed)
      : 1
    this.trailMat.uniforms.uRadius.value = this.params.radius * pk

    const live = (!this.paused && dt > 0) || this.active > 0.001
    if (live) {
      this.eased.lerp(this.target, 0.12 * this.timeScale) // cursor lag

      // Trail feedback pass (rtA = previous, render into rtB, then swap).
      this.quad.material = this.trailMat
      this.trailMat.uniforms.uPrev.value = this.rtA.texture
      this.trailMat.uniforms.uMouse.value.copy(this.eased)
      this.trailMat.uniforms.uActive.value = this.active
      this.renderer.setRenderTarget(this.rtB)
      this.renderer.render(this.scene, this.camera)
      const tmp = this.rtA
      this.rtA = this.rtB
      this.rtB = tmp
      this.active *= 0.9 // stamping fades once the pointer stops feeding setPointer
    }

    // Display pass to screen.
    this.renderer.setRenderTarget(null)
    if (this.texture) {
      this.quad.material = this.displayMat
      this.displayMat.uniforms.uTrail.value = this.rtA.texture
      this.renderer.render(this.scene, this.camera)
    } else {
      this.renderer.clear()
    }
  }

  dispose() {
    if (this._onCanvasMove && this.canvas) this.canvas.removeEventListener('pointermove', this._onCanvasMove)
    this._onCanvasMove = null
    if (this._raf) cancelAnimationFrame(this._raf)
    this._raf = null
    this.rtA.dispose()
    this.rtB.dispose()
    this.trailMat.dispose()
    this.displayMat.dispose()
    this.geo.dispose()
    if (this.texture) this.texture.dispose()
    this.renderer.dispose()
  }
}
