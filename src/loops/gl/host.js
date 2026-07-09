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
import { DEFAULT_KEYFRAMES } from './primitiveKeyframes.js'
import { layerCycles, layerPhase } from './phase.js'
import { resolveTheme, DEFAULT_THEME } from '../lib/themes.js'
import { transport } from '../../editor/params/transport.js'

/* Live engines by layer id — the panel-side action channel (hostAction).
 * Registration keys off the canvas's data-layer-id attribute (LayerRenderer
 * stamps it before the engine mounts), so no renderer signature change. */
const LIVE = new Map()

/* Per-engine layer duration (seconds) — set by applyParams for the engines
 * whose schema carries a `duration` param; driveEngine folds it into the
 * phase mapping (see layerCycles). WeakMap: dies with the engine. */
const DUR = new WeakMap()

/* Per-engine geometry-param signature (scene) — PrimitiveEngine treats any
 * update({params}) as geometry-dirty, so only pass params when they change
 * (applyParams runs every frame while playing). */
const GEOM = new WeakMap()

export function createEngine(def, canvas) {
  const engine = buildEngine(def, canvas)
  /* OrbitControls attach to the layer canvas at construction and would fight
   * the editor's move-drag — start disabled; the layer's `cameraDrag` toggle
   * enables them (setCameraDrag). */
  if (engine.controls) engine.controls.enabled = false
  const layerId = canvas?.dataset?.layerId
  if (layerId) LIVE.set(layerId, engine)
  return engine
}

/* Imperative action channel — panels reach a layer's live engine without a
 * ref plumb through LayerRenderer. Whitelisted verbs only. */
export function hostAction(layerId, action) {
  const engine = LIVE.get(layerId)
  if (!engine) return false
  if (action === 'resetCamera') {
    engine.resetCamera?.()
    return true
  }
  return false
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
      /* PrimitiveEngine takes update({globals, primitive, params}); host owns
       * the playhead → paused stays false with speed 0 so seek() positions it
       * and the orbit camera still updates. */
      DUR.set(engine, params.duration ?? 8)
      /* Geometry knobs (schema pWinds/qWinds → engine p/q) rebuild the mesh —
       * only pass them when the signature actually moves. */
      const geom = { tube: params.tube ?? 0.32, p: params.pWinds ?? 2, q: params.qWinds ?? 3, detail: params.detail ?? 0 }
      const sig = `${geom.tube}|${geom.p}|${geom.q}|${geom.detail}`
      const geomDirty = GEOM.get(engine) !== sig
      if (geomDirty) GEOM.set(engine, sig)
      engine.update({
        primitive: params.primitive,
        ...(geomDirty ? { params: geom } : {}),
        globals: {
          preset: params.pose,
          /* schema value 'keyframes' → engine's 'keyframe' discriminator */
          animMode: params.animMode === 'keyframes' || params.animMode === 'keyframe' ? 'keyframe' : 'preset',
          keyframes: Array.isArray(params.keyframes) && params.keyframes.length ? params.keyframes : DEFAULT_KEYFRAMES,
          loop: true, paused: false, speed: 0, duration: params.duration ?? 8,
          count: params.count, arrangement: params.arrangement, spread: params.spread,
          objectSize: params.objectSize, stagger: params.stagger,
          cameraMotion: params.cameraMotion, orbitSpeed: params.orbitSpeed, fov: params.fov,
          wireframe: params.wireframe, strokeWidth: params.strokeWidth,
          materialType: params.materialType, environment: params.environment,
          roughness: params.roughness, metalness: params.metalness,
          color: params.sceneColor, flatShading: !!params.flatShading, rounding: params.rounding,
          showAxis: !!params.showAxis, axisLength: params.axisLength, axisOpacity: params.axisOpacity,
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
      DUR.set(engine, params.duration ?? 12)
      engine.update({
        geom: {
          seed: params.seed, loops: params.loops, height: params.height,
          gap: params.gap, depth: params.depth, curl: params.curl, width: params.width,
          /* ?? — layers saved before these schema keys existed pass concrete
           * values, keeping the engine's geometry dirty-check stable. */
          ribbonThickness: params.ribbonThickness ?? 0.12, corner: params.corner ?? 0.045,
        },
        globals: {
          ...HOST_CLOCK, duration: params.duration ?? 12,
          flow: params.flow, cameraOrbit: params.cameraOrbit, orbitSpeed: params.orbitSpeed,
          fov: params.fov, materialType: params.materialType, color: params.ribbonColor,
          roughness: params.roughness, metalness: params.metalness, ior: params.ior,
          dispersion: params.dispersion,
          wireframe: !!params.wireframe, strokeWidth: params.wireStroke ?? 2.5,
          aberration: params.aberration, bloom: params.bloom, vignette: params.vignette, grain: params.grain,
        },
      })
      /* update() ignores globals.background — the clear colour has its own
       * setter (applyParams' bgToggle clear-alpha pass runs after this). */
      if (params.background != null) engine.setBackground(params.background)
      return
    case 'mesh': {
      /* Single = one tile from the layer's seed; grid = the labs browse view,
       * 9 variations at seeds base + i·7919 (GradientPage VARIATIONS). Each
       * spec mirrors the labs seeded resolveSpec — rotSpeed/phase roll from
       * its seed so the same seed always drifts the same way. */
      const mode = params.mode === 'grid' ? 'grid' : 'single'
      const base = params.seed ?? 7
      const seeds = mode === 'grid' ? Array.from({ length: 9 }, (_, i) => base + i * 7919) : [base]
      engine.update({
        mode,
        idx: 0,
        specs: seeds.map((seed) => meshSpec(seed, params)),
        globals: {
          glow: params.glow, grain: params.grain, speed: params.speed,
          paused: false, bg: params.bgAmount ?? 0.85, bgStyle: params.bgStyle ?? 0,
        },
      })
      /* Theme → scene bg. Mesh has no roled colour params, so the editor's
       * Theme select only reaches the engine here (labs GradientPage:
       * setBackground(resolveTheme(themeId, invert).bg) — clear colour AND
       * the bg shader's uBase mix target). */
      engine.setBackground(resolveTheme(params.themeId ?? DEFAULT_THEME, !!params.themeInvert).bg)
      return
    }
    default:
      /* Drift / Iridescent / SoftForms read known keys off the flat object;
       * extra layer keys are ignored (same trick as the 2d loops). */
      engine.setParams(params)
  }
}

/* labs GradientPage resolveSpec, editor dialect: shape/palette/driver are
 * pinned by the schema (their rolls burn to keep rng order), distort acts as
 * a multiplier on the seeded roll. */
function meshSpec(seed, params) {
  const rng = mulberry32(seed)
  rng(); rng(); rng()   /* burn shape/palette/driver rolls (pinned by schema) */
  const distortRoll = rng()
  const rotSpeed = 0.12 + rng() * 0.3
  const phase = rng() * Math.PI * 2
  const pal = MESH_PALETTES.find((p) => p.id === params.palette) || MESH_PALETTES[0]
  return {
    seed,
    shape: params.shape || 'sphere',
    colors: pal.colors.map((c) => shiftHue(c, params.hueShift || 0)),
    driver: params.driver ?? 0,
    distort: (params.distort ?? 0.5) * (0.6 + distortRoll * 0.5),
    rotSpeed,
    phase,
  }
}

export function driveEngine(def, engine, { u, dt }) {
  if (def.drive === 'phase') {
    engine.renderAtPhase(u)
  } else if (def.drive === 'seek') {
    /* Per-layer `duration`: the layer runs an INTEGER number of engine cycles
     * per transport loop (layerCycles quantizes loopSeconds/duration, min 1)
     * so the whole composition still loops seamlessly. Engines' own dur
     * cancels out of seek(u)→u, so scaling here is the entire mapping. */
    const d = DUR.get(engine)
    const su = d ? layerPhase(u, layerCycles(d, transport.getLoopSeconds())) : u
    engine.seek(su)
    engine.frame(0)
  } else {
    /* free-running: advance only by the host-supplied dt (0 while paused —
     * still renders, so param edits repaint the held frame) */
    engine.frame(dt)
  }
}

export function destroyEngine(engine) {
  if (!engine) return
  for (const [id, e] of LIVE) if (e === engine) LIVE.delete(id)
  const renderer = engine.renderer   /* some engines null this in teardown — capture first */
  /* Teardown runs inside React's unmount cleanup — a throw here would kill
   * the whole tree (the blank-screen-on-delete bug). Engines are being
   * discarded anyway; log and move on. */
  try {
    if (typeof engine.dispose === 'function') engine.dispose()
    else if (typeof engine.destroy === 'function') engine.destroy()
  } catch (err) {
    console.warn('[gl] engine dispose failed (ignored):', err?.message ?? err)
  }
  /* Release the WebGL context NOW instead of at GC — Chrome caps live
   * contexts (~16) and force-loses the oldest, which can blank a LIVE layer. */
  try { renderer?.forceContextLoss?.() } catch { /* context already lost */ }
}
