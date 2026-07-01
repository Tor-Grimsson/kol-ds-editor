import { createContext, useContext, useState } from 'react'
import { LAYOUTS, LOGOS } from './palettes'

/**
 * Palette mode state — mode-specific UI only.
 *
 * The palette generator (pool / mode / colors / locks / bgOn / randomize /
 * loadPalette) lives in compose state so the canvas, the inspector, and the
 * palette mode all share one palette. This provider owns only the layout
 * preview chrome that the palette mode uniquely needs (layoutId, logoId,
 * seedColor for seed pools).
 */

const Ctx = createContext(null)

export function PaletteStateProvider({ children }) {
  const [layoutId, setLayoutId]   = useState(LAYOUTS[0].id)
  const [logoId, setLogoId]       = useState(LOGOS[1].id)
  const [seedColor, setSeedColor] = useState('#CCCCCC')

  const layout = LAYOUTS.find((l) => l.id === layoutId) ?? LAYOUTS[0]
  const logo   = LOGOS.find((l) => l.id === logoId)   ?? LOGOS[0]

  const value = {
    layoutId, setLayoutId, layout,
    logoId, setLogoId, logo,
    seedColor, setSeedColor,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePaletteState() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePaletteState must be inside <PaletteStateProvider>')
  return ctx
}
