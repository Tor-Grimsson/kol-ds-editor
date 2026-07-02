import { useEffect, useMemo, useState } from 'react'
import { Dropdown } from '@kolkrabbi/kol-component'
import { ColorSwatch } from '@kolkrabbi/kol-component'
import { resolveCssVar } from '../../components/sections/ColorRamp'

/**
 * SwatchesPanel — AC brand-token swatch picker.
 *
 * Default bank reads live from CSS custom properties so the panel stays in
 * sync with `kol-color.css` / `kol-opacity.css` / `kol-brand-color.css`. Five
 * sub-banks render in order:
 *   1. Foreground opacity ramp (14 stops)
 *   2. Red ramp (5 stops)
 *   3. Cream ramp (5 stops)
 *   4. Greyscale (10 stops)
 *   5. Absolutes (white + black)
 *
 * The dropdown switches between palettes — AC is the default; "Standard"
 * is a basic web-safe fallback for kicking off without brand context.
 */

const FG_STOPS    = ['01', '02', '04', '08', '12', '16', '24', '32', '40', '48', '64', '80', '88', '96']
const GREY_STOPS  = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']
const RED_STOPS   = ['100', '200', '300', '400', '500']
const CREAM_STOPS = ['100', '200', '300', '400', '500']

const STANDARD_SWATCHES = [
  '#000000', '#262626', '#525252', '#737373', '#A3A3A3', '#D4D4D4', '#E5E5E5', '#FFFFFF',
  '#7F1D1D', '#B91C1C', '#DC2626', '#EF4444', '#F87171', '#FCA5A5', '#FECACA', '#FEE2E2',
  '#78350F', '#B45309', '#D97706', '#F59E0B', '#FBBF24', '#FCD34D', '#FDE68A', '#FEF3C7',
  '#14532D', '#15803D', '#16A34A', '#22C55E', '#4ADE80', '#86EFAC', '#BBF7D0', '#DCFCE7',
  '#1E3A8A', '#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD', '#BFDBFE', '#DBEAFE',
  '#581C87', '#7E22CE', '#9333EA', '#A855F7', '#C084FC', '#D8B4FE', '#E9D5FF', '#F3E8FF',
]

const PALETTES = [
  { value: 'ac',       label: 'AC'       },
  { value: 'standard', label: 'Standard' },
]

export function SwatchesBody({ onPick }) {
  const [palette, setPalette] = useState('ac')
  const [tick, setTick]       = useState(0)

  /* Re-resolve when the document theme shifts (kol-system rebrand events). */
  useEffect(() => {
    const onTheme = () => setTick((t) => t + 1)
    window.addEventListener('kol:theme-change', onTheme)
    return () => window.removeEventListener('kol:theme-change', onTheme)
  }, [])

  const swatches = useMemo(() => {
    if (palette === 'ac') {
      const fg    = FG_STOPS.map((s) => resolveCssVar(`--kol-fg-${s}`))
      const red   = RED_STOPS.map((s) => resolveCssVar(`--kol-color-red-${s}`))
      const cream = CREAM_STOPS.map((s) => resolveCssVar(`--kol-color-cream-${s}`))
      const grey  = GREY_STOPS.map((s) => resolveCssVar(`--grey-${s}`))
      return [...fg, ...red, ...cream, ...grey, '#FFFFFF', '#000000'].filter(Boolean)
    }
    return STANDARD_SWATCHES
  }, [palette, tick])

  /* Grid is fixed at 8 cols × 6 rows. Swatches beyond the 48 slots are
   * dropped; cells stretch vertically to fill the available panel height. */
  const visible = swatches.slice(0, 48)

  return (
    <div className="p-4 flex flex-col gap-4 h-full min-h-0">
      <Dropdown
        variant="subtle"
        size="sm"
        options={PALETTES}
        value={palette}
        onChange={setPalette}
        className="w-full"
      />
      <div className="grid grid-cols-8 grid-rows-6 gap-1 flex-1 min-h-0">
        {visible.map((hex, i) => (
          <ColorSwatch
            key={`${hex}-${i}`}
            hex={hex}
            size="stretch"
            radius="tight"
            frame={false}
            onClick={onPick ? () => onPick(hex) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export default function SwatchesPanel(props) {
  return (
    <div
      className="bg-surface-primary border border-fg-08 rounded overflow-hidden"
      style={{ width: 320 }}
    >
      <SwatchesBody {...props} />
    </div>
  )
}
