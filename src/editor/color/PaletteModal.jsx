import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Dropdown, LabeledControl, ViewToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../components/EditorButton'
import EditorIcon from '../icons/EditorIcon'
import SwatchRow from '../compose/SwatchRow'
import { useComposeState } from '../compose/state'
import { useGeneratorLibrary } from '../library/LibraryProvider'
import { POOLS, MODES } from '../modes/palette/pools'
import { LAYOUTS } from '../modes/palette/palettes'
import { hexToHsl, hslToHex } from '../modes/palette/colorMath'
import PaletteHarmonyWheel, { HARMONIES, harmonyById } from './PaletteHarmonyWheel'
import PalettePreview from './PalettePreview'

/**
 * PaletteModal — the palette generator as a standalone modal window.
 *
 * Illustrator color-settings model: set the palette here, the app consumes
 * it everywhere (the palette already lives in compose state, so every edit
 * is live — no "send" step). Replaces the old palette mode; the generator
 * machinery (pool / mode / swatches / locks / randomize / reset / save) is
 * harvested from PaletteControls / PaletteInspector, with a harmony color
 * wheel and a non-interactive layout preview in place of the mode canvas.
 *
 * Mounts nothing until a `kol:open-color-modal` CustomEvent arrives on
 * `window`; closes on its close button, Esc, or backdrop click. Must sit
 * inside ComposeStateProvider + GeneratorLibraryProvider.
 */

export const OPEN_COLOR_MODAL_EVENT = 'kol:open-color-modal'

const toOptions = (items) => items.map((i) => ({ value: i.id, label: i.label }))
const POOL_OPTIONS    = toOptions(POOLS)
const MODE_OPTIONS    = toOptions(MODES)
const HARMONY_OPTIONS = toOptions(HARMONIES)

/* Slide layouts are 16:9 typographic canvases — mode-canvas material, not
 * proportion studies — so the preview picker keeps only the aspect-free
 * layouts. */
const PREVIEW_LAYOUTS = LAYOUTS.filter((l) => !l.aspect)
const LAYOUT_OPTIONS  = toOptions(PREVIEW_LAYOUTS)

const SLOT_LABELS = ['Primary', 'Secondary', 'Light', 'Dark', 'Accent', 'BG']

const isHex = (v) => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v)

export default function PaletteModal() {
  const [open, setOpen] = useState(false)

  /* Selection chrome persists across opens; the body itself remounts per
   * open so the wheel re-syncs its base hue from the live palette. */
  const [layoutId, setLayoutId]   = useState(PREVIEW_LAYOUTS[0].id)
  const [harmonyId, setHarmonyId] = useState(HARMONIES[0].id)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_COLOR_MODAL_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_COLOR_MODAL_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  return createPortal(
    <PaletteModalBody
      onClose={() => setOpen(false)}
      layoutId={layoutId}
      setLayoutId={setLayoutId}
      harmonyId={harmonyId}
      setHarmonyId={setHarmonyId}
    />,
    document.body,
  )
}

function PaletteModalBody({ onClose, layoutId, setLayoutId, harmonyId, setHarmonyId }) {
  const {
    poolId, modeId, colors, locks, edited, bgOn, isSeedSeeding, palette,
    setPoolId, setModeId, toggleLock, setColorAt, randomize, reset, toggleBg,
  } = useComposeState()
  const { savePalette } = useGeneratorLibrary()

  const harmony = harmonyById(harmonyId)
  const layout  = PREVIEW_LAYOUTS.find((l) => l.id === layoutId) ?? PREVIEW_LAYOUTS[0]
  const visibleSlotCount = bgOn ? 6 : 5

  /* Base hue tracks slot 0 (Primary). `lastSeen` guards the feedback loop:
   * a palette write coming from the wheel itself must not re-derive the
   * hue from its own (8-bit-rounded) output mid-drag. External changes
   * (randomize, reset, hex edits, pool switches) do re-sync the wheel. */
  const [hue, setHue] = useState(() => (isHex(colors[0]) ? hexToHsl(colors[0]).h : 0))
  const lastSeen = useRef(colors[0])
  useEffect(() => {
    const hex = colors[0]
    if (!isHex(hex) || hex === lastSeen.current) return
    lastSeen.current = hex
    setHue(hexToHsl(hex).h)
  }, [colors])

  /* Re-hue the five role slots per the harmony scheme, preserving each
   * slot's saturation + lightness (Light stays light, Dark stays dark).
   * Locked and empty slots are skipped, mirroring randomize's contract. */
  const applyHarmony = (baseHue, scheme) => {
    const offsets = scheme.roleOffsets
    for (let i = 0; i < 5; i++) {
      if (locks[i] || !isHex(colors[i])) continue
      const { s, l } = hexToHsl(colors[i])
      const hex = hslToHex((((baseHue + offsets[i]) % 360) + 360) % 360, s, l)
      if (i === 0) lastSeen.current = hex
      setColorAt(i, hex)
    }
  }

  const onHueChange = (h) => {
    setHue(h)
    applyHarmony(h, harmony)
  }

  const onHarmonyChange = (id) => {
    setHarmonyId(id)
    applyHarmony(hue, harmonyById(id))
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette"
        className="kol-popover w-[720px] max-w-[92vw] max-h-[90vh] overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex h-10 items-center justify-between border-b border-fg-08 px-5">
          <span className="kol-helper-12 text-emphasis">Palette</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-meta hover:text-emphasis"
            style={{ lineHeight: 0 }}
          >
            <EditorIcon name="close" size={12} />
          </button>
        </div>

        <div className="grid grid-cols-[264px_1fr] gap-6 p-5">
          {/* ── Harmony wheel ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-center">
              <PaletteHarmonyWheel size={248} hue={hue} harmony={harmony} onHueChange={onHueChange} />
            </div>
            <LabeledControl label="Harmony">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={HARMONY_OPTIONS}
                value={harmonyId}
                onChange={onHarmonyChange}
              />
            </LabeledControl>
          </div>

          {/* ── Generator: pool / mode, swatches, preview, actions ── */}
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <LabeledControl label="Pool">
                <Dropdown variant="subtle" size="sm" className="w-full" options={POOL_OPTIONS} value={poolId} onChange={setPoolId} />
              </LabeledControl>
              <LabeledControl label="Mode">
                <Dropdown variant="subtle" size="sm" className="w-full" options={MODE_OPTIONS} value={modeId} onChange={setModeId} />
              </LabeledControl>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="kol-helper-10 uppercase text-meta">Swatches</span>
                <div className="flex items-center gap-2">
                  <span className="kol-helper-10 uppercase text-meta">BG</span>
                  <ViewToggle
                    variant="single"
                    options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
                    viewMode={bgOn ? 'on' : 'off'}
                    onViewChange={(v) => { if ((v === 'on') !== bgOn) toggleBg() }}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {SLOT_LABELS.slice(0, visibleSlotCount).map((label, idx) => (
                  <SwatchRow
                    key={label}
                    label={label}
                    hex={colors[idx]}
                    disabled={colors[idx] == null}
                    unused={idx < 5 && !(layout.uses ?? [0, 1, 2, 3, 4]).includes(idx)}
                    locked={locks[idx]}
                    edited={edited[idx] || (isSeedSeeding && idx === 0)}
                    onToggleLock={() => toggleLock(idx)}
                    onChangeHex={(v) => setColorAt(idx, v)}
                  />
                ))}
              </div>
            </div>

            <LabeledControl label="Layout">
              <Dropdown variant="subtle" size="sm" className="w-full" options={LAYOUT_OPTIONS} value={layoutId} onChange={setLayoutId} />
            </LabeledControl>
            <PalettePreview layoutId={layoutId} palette={palette} bgOn={bgOn} />

            <div className="flex gap-2 border-t border-fg-08 pt-2">
              <EditorButton variant="primary" size="sm" className="flex-1" onClick={randomize}>
                Randomize
              </EditorButton>
              <EditorButton variant="secondary" size="sm" className="flex-1" onClick={reset}>
                Reset
              </EditorButton>
            </div>

            <EditorButton
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => savePalette({ colors, bgEnabled: bgOn, poolId, modeId })}
            >
              Save palette to library
            </EditorButton>
          </div>
        </div>
      </div>
    </div>
  )
}
