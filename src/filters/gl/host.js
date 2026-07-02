/**
 * GL filter host — the ONLY module that imports the three.js filter engines
 * (synths / distortion / lens). Loaded lazily by EngineFilterLayer, mirroring
 * loops/gl/host.js, so three stays out of the base bundle.
 *
 * Contract (driven by the renderer):
 *   createEngine(def, canvas)            → engine mounted on the layer canvas
 *   setSource(def, engine, srcCanvas)    → push the fitted source image
 *   applyParams(def, engine, params)     → flat layer params → engine
 *   driveEngine(def, engine, {u, dt})    → one frame (synths are feedback-
 *                                          based → dt drive, free-running)
 *   destroyEngine(engine)                → teardown
 *
 * Every ported engine shares the same surface (setSource / setParams /
 * frame / resize / dispose — the synthBase contract), so only construction
 * switches on the def.
 */
import TrailsEngine from './trailsEngine.js'
import ScanEngine from './scanEngine.js'
import SlitscanEngine from './slitscanEngine.js'
import DiscoEngine from './discoEngine.js'
import DistortionEngine from './distortionEngine.js'
import { RefractEngine } from './refractEngine.js'

const ENGINES = {
  trails:   TrailsEngine,
  scan:     ScanEngine,
  slitscan: SlitscanEngine,
  disco:    DiscoEngine,
  distort:  DistortionEngine,
  lens:     RefractEngine,
}

export function createEngine(def, canvas) {
  const Engine = ENGINES[def?.engine]
  if (!Engine) throw new Error(`unknown gl filter engine "${def?.engine}"`)
  return new Engine(canvas)
}

export function setSource(def, engine, srcCanvas) {
  engine.setSource(srcCanvas)
}

export function applyParams(def, engine, params) {
  engine.setParams(params)
}

export function driveEngine(def, engine, { dt }) {
  engine.frame(dt)
}

export function destroyEngine(engine) {
  if (!engine) return
  if (typeof engine.dispose === 'function') engine.dispose()
  else if (typeof engine.destroy === 'function') engine.destroy()
}
