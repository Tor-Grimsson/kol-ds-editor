import { createContext, useContext, useState } from 'react'
import { CANVAS_DEFAULTS } from '../../shell/Canvas'
import { useComposeState, resolveColor } from '../../compose/state'
import { findLayerDeep } from '../../compose/helpers'
import { applyCase } from './cuts'
import { pickCutFor } from './axisRandom'

/* Fields a text-layer in compose understands. updateFrame patches that
 * touch any of these fields are mirrored into the bound compose layer. */
const TEXT_LAYER_FIELDS = new Set([
  'text', 'width', 'weight', 'italic', 'size',
  'tracking', 'lineHeight', 'case', 'color', 'textAlign',
])

/**
 * Type mode state — context provider for the type generator.
 * Lifted from TypeLab's local-useState so canvas + controls render
 * independently inside EditorShell.
 */

let nextFrameId = 1
const newFrame = (overrides = {}) => ({
  id:         `f${nextFrameId++}`,
  x:          240,
  y:          440,
  w:          600,
  text:       'Made to last',
  width:      'Tight',
  weight:     600,
  italic:     false,
  size:       96,
  tracking:   -0.01,
  lineHeight: 1.05,
  case:       'original',
  color:      CANVAS_DEFAULTS.guideColor,
  textAlign:  'center',
  axisOn:           false,
  axisMode:         'morph',
  width2:           'Spatial',
  weight2:          900,
  blend:            0.5,
  axisCurve:        'flat',
  curveCp1:         { x: 0.33, y: 0.33 },
  curveCp2:         { x: 0.66, y: 0.66 },
  randomWidthLock:  '',
  randomWeightLock: '',
  ...overrides,
})

const DEFAULT_STATE = () => ({
  aspect:     '1:1',
  bgColor:    CANVAS_DEFAULTS.bgColor,
  frames:     [newFrame({ id: 'f0' })],
  selectedId: 'f0',
})

const Ctx = createContext(null)

export function TypeStateProvider({ children }) {
  const [state, setState] = useState(DEFAULT_STATE)

  /* boundLayerId — when set, edits to the frame whose id === boundLayerId
   * flow live to the source compose text layer. The frame's id is set to
   * the layer's id at load time so the binding lookup is the natural
   * frame.id check. */
  const [boundLayerId, setBoundLayerId] = useState(null)
  const compose = useComposeState()

  const set = (patch) => setState((s) => ({ ...s, ...patch }))

  const selectedFrame = state.frames.find((f) => f.id === state.selectedId) ?? null

  const updateFrame = (id, patch) => {
    setState((s) => ({
      ...s,
      frames: s.frames.map((f) => f.id === id ? { ...f, ...patch } : f),
    }))
    /* Round-trip: if this frame is bound to a compose layer, mirror only
     * the text-layer-relevant fields. Skip if the bound layer is gone (it
     * was deleted in compose) — the next render also clears the binding. */
    if (id === boundLayerId) {
      const layerPatch = {}
      for (const key of Object.keys(patch)) {
        if (TEXT_LAYER_FIELDS.has(key)) layerPatch[key] = patch[key]
      }
      if (Object.keys(layerPatch).length > 0) {
        const layer = findLayerDeep(compose.layers, boundLayerId)
        if (!layer || layer.type !== 'text') {
          setBoundLayerId(null)
        } else {
          compose.updateLayer(boundLayerId, layerPatch)
        }
      }
    }
  }

  const deleteFrame = (id) => setState((s) => {
    const next = s.frames.filter((f) => f.id !== id)
    return {
      ...s,
      frames:     next.length ? next : [newFrame()],
      selectedId: next.length ? next[0].id : null,
    }
  })

  const addFrame = () => {
    const f = newFrame({ x: 240 + Math.random() * 200, y: 240 + Math.random() * 200 })
    setState((s) => ({ ...s, frames: [...s.frames, f], selectedId: f.id }))
  }

  /* Explode the selected frame's text into one frame per character, each with
   * a deterministic-random (width, weight) cut. */
  const explodeFrame = (id) => {
    const src = state.frames.find((f) => f.id === id)
    if (!src) return
    const cased = applyCase(src.text, src.case)
    const chars = Array.from(cased)
    const seed  = Math.floor(Math.random() * 99991)
    const estW  = Math.max(40, src.size * 0.62)
    const newFrames = chars.map((ch, i) => {
      const [w, wt] = pickCutFor(i, seed, {
        widthLock:  src.randomWidthLock,
        weightLock: src.randomWeightLock,
      })
      return newFrame({
        x:          src.x + i * estW,
        y:          src.y,
        w:          estW,
        text:       ch,
        width:      w,
        weight:     wt,
        size:       src.size,
        tracking:   0,
        lineHeight: src.lineHeight,
        case:       'original',
        italic:     src.italic,
        color:      src.color,
        textAlign:  'center',
        axisOn:     false,
      })
    })
    setState((s) => ({
      ...s,
      frames:     [...s.frames.filter((f) => f.id !== id), ...newFrames],
      selectedId: newFrames[0]?.id ?? null,
    }))
  }

  const selectFrame = (id) => set({ selectedId: id })

  const reset = () => {
    nextFrameId = 1
    setState(DEFAULT_STATE())
  }

  /* Load a saved type spec — adds it as a new frame and selects it.
   * Item shape mirrors what `saveType` writes (text + typography fields,
   * no x/y/w; position defaults from `newFrame`). Optional `boundLayerId`
   * pins the new frame's id to the compose layer's id so subsequent edits
   * flow back via `updateFrame`'s round-trip path. */
  const loadType = (item, { boundLayerId: bid = null } = {}) => {
    if (!item) {
      if (bid === null) setBoundLayerId(null)
      return
    }
    const f = bid != null
      ? newFrame({ ...item, id: bid })
      : newFrame({ ...item })
    setState((s) => ({ ...s, frames: [...s.frames, f], selectedId: f.id }))
    setBoundLayerId(bid)
  }

  /* Manually unbind — the "Done" / "Unlink" button in Type controls calls
   * this when the user is done editing the bound compose layer. */
  const unbindLayer = () => setBoundLayerId(null)

  const value = {
    state, set, selectedFrame,
    updateFrame, deleteFrame, addFrame, explodeFrame, selectFrame, reset,
    loadType, unbindLayer, boundLayerId,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useTypeState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTypeState must be inside <TypeStateProvider>')
  return ctx
}
