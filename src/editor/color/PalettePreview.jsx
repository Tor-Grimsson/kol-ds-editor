/**
 * PalettePreview — non-interactive proportion preview for the Palette modal.
 *
 * Renders the current palette applied in the selected layout's proportions
 * as a simple composition of rects. Replaces the palette mode's full canvas
 * stage (modes/palette/layouts.jsx) — labels and the logo element are
 * dropped by design; this is a reference swatch, not a mock.
 */

const COMPOSITIONS = {
  /* 60 / 30 / 10 — primary 10, secondary 30, light 60. */
  'ratio-603010': (p) => (
    <div className="flex h-full">
      <div className="flex-[1]" style={{ background: p.primary }} />
      <div className="flex-[3]" style={{ background: p.secondary }} />
      <div className="flex-[6]" style={{ background: p.light }} />
    </div>
  ),

  /* Tower — 4-band vertical. */
  'tower': (p) => (
    <div className="flex h-full flex-col">
      {[p.primary, p.secondary, p.light, p.dark].map((c, i) => (
        <div key={i} className="flex-1" style={{ background: c }} />
      ))}
    </div>
  ),

  /* Quad split — 50 / 25 / 25 with accent chip. */
  'quad-split': (p) => (
    <div className="flex h-full">
      <div className="flex-1" style={{ background: p.primary }} />
      <div className="flex flex-1 flex-col">
        <div className="flex-1" style={{ background: p.light }} />
        <div className="relative flex-1" style={{ background: p.dark }}>
          <div className="absolute bottom-2 right-2 h-3 w-3" style={{ background: p.accent }} />
        </div>
      </div>
    </div>
  ),

  /* Card row — 4 discrete cards. */
  'card-row': (p) => (
    <div className="flex h-full gap-1.5">
      {[p.primary, p.secondary, p.light, p.dark].map((c, i) => (
        <div key={i} className="flex-1 rounded" style={{ background: c }} />
      ))}
    </div>
  ),

  /* Stripe row — Method 01 / 02 proportion bars. */
  'stripe-row': (p) => (
    <div className="flex h-full flex-col justify-center gap-3">
      <div className="flex h-6">
        <div className="flex-[6]" style={{ background: p.primary }} />
        <div className="flex-[3]" style={{ background: p.light }} />
        <div className="flex-[1]" style={{ background: p.accent }} />
      </div>
      <div className="flex h-6">
        {[p.primary, p.secondary, p.light, p.light, p.accent, p.dark].map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>
    </div>
  ),

  /* Applied card — plate + surface + bands on light ground. */
  'applied-card': (p) => (
    <div className="flex h-full gap-2 p-2" style={{ background: p.light }}>
      <div className="flex-[3] rounded-sm" style={{ background: p.primary }} />
      <div className="flex flex-[2] flex-col gap-2">
        <div className="relative flex-1 rounded-sm border border-fg-08" style={{ background: p.light }}>
          <div className="absolute bottom-1.5 left-1.5 flex gap-1">
            <span className="h-2.5 w-2.5" style={{ background: p.secondary }} />
            <span className="h-2.5 w-2.5" style={{ background: p.accent }} />
          </div>
        </div>
        <div className="h-5 rounded-sm" style={{ background: p.secondary }} />
        <div className="h-3 rounded-sm" style={{ background: p.dark }} />
      </div>
    </div>
  ),
}

export default function PalettePreview({ layoutId, palette, bgOn }) {
  const render = COMPOSITIONS[layoutId] ?? COMPOSITIONS['ratio-603010']
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none select-none rounded border border-fg-08 p-3"
      style={bgOn && palette.bg ? { background: palette.bg } : undefined}
    >
      <div className="h-[140px] overflow-hidden rounded-sm">{render(palette)}</div>
    </div>
  )
}
