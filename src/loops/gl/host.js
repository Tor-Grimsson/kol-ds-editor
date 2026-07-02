/**
 * GL loop host — the ONLY module that imports the three.js engines. Loaded
 * lazily (dynamic import) by the loop layer renderer the first time an
 * engine loop mounts, so three stays out of the base bundle.
 *
 * Adapts each engine's native API to one host contract:
 *   createEngine(def, canvas)          → engine instance, mounted on canvas
 *   applyParams(def, engine, params)   → push flat layer params into it
 *   driveEngine(def, engine, {u, dt})  → produce one frame (per def.drive)
 *   destroyEngine(engine)              → teardown (dispose/destroy)
 */
import { DriftEngine } from './DriftEngine.js'
import { IridescentEngine } from './IridescentEngine.js'
import { SoftFormsEngine } from './SoftFormsEngine.js'
import { SoftForms3DEngine } from './SoftForms3DEngine.js'
import PrimitiveEngine from './PrimitiveEngine.js'
import FormsEngine from './FormsEngine.js'
import EnvironmentEngine from './EnvironmentEngine.js'
import RibbonEngine from './RibbonEngine.js'
import GradientEngine from './GradientEngine.js'
import { PALETTES as MESH_PALETTES, shiftHue } from './meshPalettes.js'
import { mulberry32 } from './rng.js'

export function createEngine(def, canvas) {
  const engine = buildEngine(def, canvas)
  /* OrbitControls attach to the layer canvas at construction and would fight
   * the editor's move-drag — start disabled; the layer's `cameraDrag` toggle
   * enables them (setCameraDrag). */
  if (engine.controls) engine.controls.enabled = false
  return engine
}

/* Enable/disable the engine's interactive camera (no-op for engines
 * without OrbitControls). */
export function setCameraDrag(def, engine, on) {
  if (engine?.controls) engine.controls.enabled = !!on
}

function buildEngine(def, canvas) {
  switch (def.engine) {
    case 'drift': {
      const e = new DriftEngine(def.family)
      e.init(canvas)
      return e
    }
    case 'iridescent': {
      const e = new IridescentEngine()
      e.init(canvas)
      return e
    }
    case 'softforms': {
      const e = new SoftFormsEngine()
      e.init(canvas)
      return e
    }
    case 'softforms3d': {
      const e = new SoftForms3DEngine()
      e.init(canvas)
      return e
    }
    case 'scene':
      return new PrimitiveEngine(canvas)   /* host-driven: no self-RAF */
    case 'forms':
      return new FormsEngine(canvas)
    case 'environment':
      return new EnvironmentEngine(canvas)
    case 'ribbon':
      return new RibbonEngine(canvas)
    case 'mesh':
      return new GradientEngine(canvas)
    default:
      throw new Error(`unknown gl engine "${def.engine}"`)
  }
}

/* Shared transport globals for the playhead engines the host drives via
 * seek(): never self-paused (controls/orbit keep updating) but speed 0 so
 * the playhead moves ONLY where seek() puts it. */
const HOST_CLOCK = { loop: true, paused: false, speed: 0 }

export function applyParams(def, engine, params) {
  applyEngineParams(def, engine, params)
  /* Background toggle (scene-type engines, def.bgToggle): the renderers are
   * alpha:true — clear-alpha 0 makes the backdrop transparent. Runs AFTER
   * the per-engine update so engine-internal setClearColor calls (alpha 1)
   * don't win. */
  if (def.bgToggle) engine.renderer?.setClearAlpha(params.bgOn === false ? 0 : 1)
}

function applyEngineParams(def, engine, params) {
  switch (def.engine) {
    case 'scene': {
      /* PrimitiveEngine takes update({globals, primitive}); host owns the
       * playhead → paused stays false with speed 0 so seek() positions it
       * and the orbit camera still updates. */
      engine.update({
        primitive: params.primitive,
        globals: {
          preset: params.pose, animMode: 'preset', loop: true, paused: false, speed: 0,
          count: params.count, arrangement: params.arrangement, spread: params.spread,
          objectSize: params.objectSize, stagger: params.stagger,
          cameraMotion: params.cameraMotion, orbitSpeed: params.orbitSpeed, fov: params.fov,
          wireframe: params.wireframe, strokeWidth: params.strokeWidth,
          materialType: params.materialType, environment: params.environment,
          roughness: params.roughness, metalness: params.metalness,
          color: params.sceneColor, flatShading: false, showAxis: false,
        },
      })
      return
    }
    case 'softforms3d':
      engine.setParams(params)
      if (params.camTheta != null) {
        engine.setCamera({ theta: params.camTheta, phi: params.camPhi ?? 0.35, dist: params.camDist ?? 3 })
      }
      return
    case 'forms':
      engine.update({
        form: params.form,
        globals: {
          ...HOST_CLOCK, duration: 8,
          samples: params.samples, cycles: params.cycles, amp: params.amp,
          pointSize: params.pointSize, turns: params.turns, radius: params.radius,
          height: params.height, spin: params.spin, spinSpeed: params.spinSpeed,
          fov: params.fov, color: params.formColor, accent: params.accent,
        },
      })
      return
    case 'environment':
      engine.update({
        env: params.env,
        globals: {
          ...HOST_CLOCK, duration: 8,
          samples: params.samples, cycles: params.cycles, amp: params.amp,
          spin: params.spin, spinSpeed: params.spinSpeed, fov: params.fov,
          color: params.formColor, accent: params.accent,
        },
      })
      return
    case 'ribbon':
      engine.update({
        geom: {
          seed: params.seed, loops: params.loops, height: params.height,
          gap: params.gap, depth: params.depth, curl: params.curl, width: params.width,
        },
        globals: {
          ...HOST_CLOCK, duration: 12,
          flow: params.flow, cameraOrbit: params.cameraOrbit, orbitSpeed: params.orbitSpeed,
          fov: params.fov, materialType: params.materialType, color: params.ribbonColor,
          roughness: params.roughness, metalness: params.metalness, ior: params.ior,
          dispersion: params.dispersion,
          wireframe: false, strokeWidth: 2.5,
          aberration: params.aberration, bloom: params.bloom, vignette: params.vignette, grain: params.grain,
        },
      })
      /* update() ignores globals.background — the clear colour has its own
       * setter (applyParams' bgToggle clear-alpha pass runs after this). */
      if (params.background != null) engine.setBackground(params.background)
      return
    case 'mesh': {
      /* Build ONE tile spec, mirroring the labs page's seeded resolveSpec —
       * rotSpeed/phase roll from the seed so the same seed always drifts the
       * same way. */
      const rng = mulberry32(params.seed ?? 7)
      rng(); rng(); rng()   /* burn shape/palette/driver rolls (pinned by schema) */
      const distortRoll = rng()
      const rotSpeed = 0.12 + rng() * 0.3
      const phase = rng() * Math.PI * 2
      const pal = MESH_PALETTES.find((p) => p.id === params.palette) || MESH_PALETTES[0]
      engine.update({
        mode: 'single',
        idx: 0,
        specs: [{
          seed: params.seed ?? 7,
          shape: params.shape || 'sphere',
          colors: pal.colors.map((c) => shiftHue(c, params.hueShift || 0)),
          driver: params.driver ?? 0,
          distort: (params.distort ?? 0.5) * (0.6 + distortRoll * 0.5),
          rotSpeed,
          phase,
        }],
        globals: {
          glow: params.glow, grain: params.grain, speed: params.speed,
          paused: false, bg: params.bgAmount ?? 0.85, bgStyle: params.bgStyle ?? 0,
        },
      })
      return
    }
    default:
      /* Drift / Iridescent / SoftForms read known keys off the flat object;
       * extra layer keys are ignored (same trick as the 2d loops). */
      engine.setParams(params)
  }
}

export function driveEngine(def, engine, { u, dt }) {
  if (def.drive === 'phase') {
    engine.renderAtPhase(u)
  } else if (def.drive === 'seek') {
    engine.seek(u)
    engine.frame(0)
  } else {
    /* free-running: advance only by the host-supplied dt (0 while paused —
     * still renders, so param edits repaint the held frame) */
    engine.frame(dt)
  }
}

export function destroyEngine(engine) {
  if (!engine) return
  /* Teardown runs inside React's unmount cleanup — a throw here would kill
   * the whole tree (the blank-screen-on-delete bug). Engines are being
   * discarded anyway; log and move on. */
  try {
    if (typeof engine.dispose === 'function') engine.dispose()
    else if (typeof engine.destroy === 'function') engine.destroy()
  } catch (err) {
    console.warn('[gl] engine dispose failed (ignored):', err?.message ?? err)
  }
}
