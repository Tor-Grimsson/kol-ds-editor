import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { resolveCssVar } from '../../../components/sections/ColorRamp'
import { useComposeState, resolveColor } from '../../compose/state'
import { findLayerDeep } from '../../compose/helpers'
import { DEFAULT_SHAPE_ID, getShapeSvg } from './shapes'
import { buildPatternSvg } from './render'
import { newRule, randomRule } from './RuleRow'

/**
 * Pattern mode state — context provider for the pattern generator.
 * Lifted from PatternLab's local-useState pile so canvas, controls, and
 * the rules panel can render independently inside EditorShell.
 */

const DEFAULT_COLOR_TOKENS = { color: '--brand-blue-400', background: '--cream-100' }

/* Random-palette tokens — resolve at draw time so the random pool tracks
 * any KOL token edits in kol-color.css. Mirrors combo-lab/pools.js. */
const RANDOM_PALETTE_TOKENS = [
  '--brand-blue-400', '--brand-blue-500', '--grey-400', '--grey-300', '--grey-200', '--grey-50',
  '--cream-100',      '--cream-400',      '--cream-500',
  '--brand-red-200',  '--brand-red-300',  '--brand-red-400',
]
const buildRandomPalette = () => RANDOM_PALETTE_TOKENS.map(resolveCssVar).filter(Boolean)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]

const Ctx = createContext(null)

export function PatternStateProvider({ children }) {
  const [shapeId, setShapeId]     = useState(DEFAULT_SHAPE_ID)
  const [customSvg, setCustomSvg] = useState('')
  const [cols, setCols]           = useState(4)
  const [rows, setRows]           = useState(4)
  const [gap, setGap]             = useState(0)
  const [padding, setPadding]     = useState(0)
  const [stretch, setStretch]     = useState(false)
  const [overflow, setOverflow]   = useState(false)
  const [bgOn, setBgOn]           = useState(true)
  const [colors, setColors]       = useState(() => ({
    color:      resolveCssVar(DEFAULT_COLOR_TOKENS.color),
    background: resolveCssVar(DEFAULT_COLOR_TOKENS.background),
  }))
  const [rules, setRules]         = useState([])

  /* boundLayerId — when set, every change to the pattern fields above
   * fires `updateLayer(boundLayerId, ...)` on the compose store. Drives
   * the "Edit in Pattern mode" round-trip: edits in this mode flow live
   * into the source compose pattern layer. Cleared by `unbindLayer` or
   * by a `loadPattern` call without a binding. */
  const [boundLayerId, setBoundLayerId] = useState(null)
  const compose = useComposeState()

  const shapeSvg    = getShapeSvg(shapeId, customSvg)
  const effectiveBg = bgOn ? colors.background : null

  const svgString = useMemo(
    () => buildPatternSvg({
      shapeSvg, cols, rows, gap, stretch, padding, overflow, rules,
      color: colors.color,
      bg:    effectiveBg,
      size:  256,
    }),
    [shapeSvg, cols, rows, gap, stretch, padding, overflow, rules, colors.color, effectiveBg]
  )

  const randomizeColors = () => {
    const palette = buildRandomPalette()
    if (palette.length < 2) return
    const a = pick(palette)
    let b = pick(palette)
    while (b === a) b = pick(palette)
    setColors({ color: a, background: b })
  }

  const randomizeRules = () => {
    const count = Math.floor(Math.random() * 3) + 1
    setRules(Array.from({ length: count }, randomRule))
  }

  const setColorAt  = (tab, hex) => setColors((prev) => ({ ...prev, [tab]: hex }))
  const resetColors = () => setColors({
    color:      resolveCssVar(DEFAULT_COLOR_TOKENS.color),
    background: resolveCssVar(DEFAULT_COLOR_TOKENS.background),
  })
  const copyCss = () => {
    const css = `color: ${colors.color};\nbackground: ${colors.background};`
    if (navigator.clipboard) navigator.clipboard.writeText(css).catch(() => {})
  }

  const addRule    = () => setRules((prev) => [...prev, newRule()])
  const updateRule = (idx, updated) => setRules((prev) => prev.map((r, i) => i === idx ? updated : r))
  const removeRule = (idx) => setRules((prev) => prev.filter((_, i) => i !== idx))
  const rerollRule = (idx) => setRules((prev) => prev.map((r, i) => i === idx ? { ...randomRule(), id: r.id } : r))

  /* Load a saved pattern item into live state. Item shape mirrors what
   * `savePattern` writes: { shapeId, customSvg, cols, rows, gap, padding,
   * stretch, overflow, color, bg, rules }. Optional `boundLayerId` opts
   * into the round-trip binding — passing it makes subsequent edits flow
   * into that compose layer. Caller is expected to have already resolved
   * any palette refs to literal hex; see `LayerInspector.onEditInPatternMode`. */
  const loadPattern = (item, { boundLayerId: bid = null } = {}) => {
    if (!item) {
      if (bid === null) setBoundLayerId(null)
      return
    }
    /* Suppress the next sync — the `setState` flurry below will trigger
     * the binding effect once after batch, but those values came from the
     * layer itself so writing them back is a no-op + extra history noise. */
    skipNextSyncRef.current = true
    if (item.shapeId !== undefined)             setShapeId(item.shapeId)
    if (item.customSvg !== undefined)           setCustomSvg(item.customSvg)
    if (typeof item.cols === 'number')          setCols(item.cols)
    if (typeof item.rows === 'number')          setRows(item.rows)
    if (typeof item.gap === 'number')           setGap(item.gap)
    if (typeof item.padding === 'number')       setPadding(item.padding)
    if (typeof item.stretch === 'boolean')      setStretch(item.stretch)
    if (typeof item.overflow === 'boolean')     setOverflow(item.overflow)
    if (item.color !== undefined || item.bg !== undefined) {
      setColors((prev) => ({
        color:      item.color ?? prev.color,
        background: item.bg    ?? prev.background,
      }))
    }
    /* `bgOn` derives from `bg` — single source of truth (matches the
     * library's `patternFromSpec` rule `bgOn = spec.bg != null`). Loading
     * a no-bg item must explicitly turn `bgOn` off, otherwise pattern
     * mode keeps its previous bgOn from a prior session and the
     * round-trip effect writes a bg the source layer didn't have. */
    if (item.bg !== undefined) setBgOn(item.bg != null)
    if (Array.isArray(item.rules)) setRules(item.rules)
    setBoundLayerId(bid)
  }

  /* Manually unbind — the "Done" / "Unlink" button in Pattern controls
   * calls this when the user is done editing the bound compose layer. */
  const unbindLayer = () => setBoundLayerId(null)

  /* Round-trip sync: when bound, push every pattern-field change into the
   * source compose layer. `skipNextSyncRef` short-circuits the first run
   * after `loadPattern` (the initial values came from the layer itself).
   * Auto-clears the binding if the layer disappears (deleted in compose). */
  const skipNextSyncRef = useRef(true)
  useEffect(() => {
    if (skipNextSyncRef.current) { skipNextSyncRef.current = false; return }
    if (!boundLayerId) return
    const layer = findLayerDeep(compose.layers, boundLayerId)
    if (!layer || layer.type !== 'pattern') {
      setBoundLayerId(null)
      return
    }
    compose.updateLayer(boundLayerId, {
      shapeId, customSvg, cols, rows, gap, padding, stretch, overflow,
      bgOn,
      color: colors.color,
      bg:    bgOn ? colors.background : null,
      rules,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shapeId, customSvg, cols, rows, gap, padding, stretch, overflow, bgOn, colors.color, colors.background, rules, boundLayerId])

  const value = {
    shapeId, setShapeId, customSvg, setCustomSvg,
    cols, setCols, rows, setRows, gap, setGap, padding, setPadding,
    stretch, setStretch, overflow, setOverflow, bgOn, setBgOn,
    colors, effectiveBg, svgString, rules,
    randomizeColors, randomizeRules,
    setColorAt, resetColors, copyCss,
    addRule, updateRule, removeRule, rerollRule,
    loadPattern, unbindLayer, boundLayerId,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePatternState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePatternState must be inside <PatternStateProvider>')
  return ctx
}
