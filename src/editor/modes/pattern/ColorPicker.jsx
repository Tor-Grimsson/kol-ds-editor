import { useState, useMemo } from 'react'
import EditorButton from '../../components/EditorButton'
import { ColorSwatch } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { resolveCssVar } from '../../../components/sections/ColorRamp'
import { ColorField } from '../../compose/inspectors/LayerInspector'
import { resolveColor, useComposeState } from '../../compose/state'

/**
 * Two-tab color picker — Color / Background.
 * Each tab edits its own hex value via the swatch grid + hex input.
 *
 * Props:
 *   values      = { color, background }   — current hex per tab
 *   onChange(tab, hex)                    — fires on swatch click + hex edit
 *   onCopyCss()                           — fires on Copy CSS
 *   onReset()                             — fires on Reset
 */

const TAB_OPTIONS = [
  { value: 'color',      label: 'Color' },
  { value: 'background', label: 'Background' },
]

const ROW_WARM_TOKENS = [
  '--cream-100', '--cream-200', '--cream-300', '--cream-400', '--cream-500',
  '--brand-red-100', '--brand-red-200', '--brand-red-300', '--brand-red-400', '--brand-red-500',
]

const ROW_GREY_TOKENS = [
  '--grey-50',  '--grey-100', '--grey-200', '--grey-300', '--grey-400',
  '--grey-500', '--grey-600', '--grey-700', '--grey-800', '--grey-900',
]

export default function ColorPicker({ values, onChange, onCopyCss, onReset }) {
  const [tab, setTab] = useState('color')
  const raw = values?.[tab]
  const value = raw ?? ''
  const isTransparent = raw === null
  const { palette } = useComposeState()
  const setValue = (hex) => onChange?.(tab, hex)
  const handleSwatchClick = (hex, e) => {
    if (e.altKey) {
      e.preventDefault()
      setValue(null)
    } else {
      setValue(hex)
    }
  }
  /* ColorField hands us either a hex string or a palette ref ('palette:foo').
   * Pattern state stores hex only — resolve refs against the live compose
   * palette before storing. Empty/null is treated as transparent. */
  const handleFieldChange = (v) => {
    if (v == null || v === '') { setValue(null); return }
    if (typeof v !== 'string') return
    if (v.startsWith('palette:')) {
      const hex = resolveColor(v, palette)
      if (hex) setValue(hex)
    } else {
      setValue(v)
    }
  }

  /* Resolve token names to live hex at render time — palette stays in sync
   * with token edits in kol-color.css. */
  const rows = useMemo(() => [
    ROW_WARM_TOKENS.map((t) => resolveCssVar(t)),
    ROW_GREY_TOKENS.map((t) => resolveCssVar(t)),
  ], [])

  return (
    <div className="flex flex-col gap-3">
      <ViewToggle
        options={TAB_OPTIONS}
        viewMode={tab}
        onViewChange={setTab}
      />

      <div className="flex flex-col gap-1">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-10 gap-1">
            {row.map((hex, j) => (
              <ColorSwatch
                key={`${i}-${j}-${hex}`}
                hex={hex}
                title={`${hex} · alt+click for transparent`}
                selected={!isTransparent && value?.toUpperCase() === hex?.toUpperCase()}
                onClick={(e) => handleSwatchClick(hex, e)}
              />
            ))}
          </div>
        ))}
      </div>

      <ColorField
        value={isTransparent ? null : value}
        onChange={handleFieldChange}
        palette={palette}
        hideLabel
      />

      <div className="flex gap-2 pt-2 border-t border-fg-08">
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={onCopyCss}>
          Copy CSS
        </EditorButton>
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={onReset}>
          Reset
        </EditorButton>
      </div>
    </div>
  )
}
