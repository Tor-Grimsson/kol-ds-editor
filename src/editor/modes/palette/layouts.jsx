/**
 * Combo Lab — layout primitives.
 *
 * Every layout accepts { palette, logo } and renders its geometry with the
 * current palette's 5 role-colors. Structural CSS lives in foundations.css
 * under `.kol-combo-*`. Inline styles here are strictly data-driven
 * (background + color from the palette).
 */
import KolLogo from '../../../brand/logos/KolLogo'
import { fgOn } from './palettes'

/* LogoSlot — size is a numeric prop, rendered as inline width. */
const LogoSlot = ({ logo, size = 48 }) => {
  if (!logo || logo.id === 'none' || !logo.variant) return null
  return (
    <span className="kol-combo-logo" style={{ width: size }}>
      <KolLogo variant={logo.variant} />
    </span>
  )
}

/* ────────── 60 / 30 / 10 ────────── */
export function RatioBar({ palette, logo }) {
  const { primary, secondary, light } = palette
  return (
    <div className="kol-combo-stage kol-combo-frame kol-combo-stage--fill kol-combo-stage--ratio">
      <div className="kol-combo-slab" style={{ background: primary, color: fgOn(primary) }}>
        <span className="kol-combo-label">Primary</span>
        <LogoSlot logo={logo} size={48} />
        <span className="kol-combo-number">10</span>
      </div>
      <div className="kol-combo-slab" style={{ background: secondary, color: fgOn(secondary) }}>
        <span className="kol-combo-label">Secondary</span>
        <span className="kol-combo-number">30</span>
      </div>
      <div className="kol-combo-slab" style={{ background: light, color: fgOn(light) }}>
        <span className="kol-combo-label">Neutral</span>
        <span className="kol-combo-number">60</span>
      </div>
    </div>
  )
}

/* ────────── Tower — 4-band vertical ────────── */
export function Tower({ palette, logo }) {
  const { primary, secondary, light, dark } = palette
  const band = (bg, label) => (
    <div className="kol-combo-slab kol-combo-slab--end" style={{ background: bg, color: fgOn(bg) }}>
      <span className="kol-combo-label">{label}</span>
    </div>
  )
  return (
    <div className="kol-combo-stage kol-combo-frame kol-combo-stage--tower">
      <div className="kol-combo-slab kol-combo-slab--between" style={{ background: primary, color: fgOn(primary) }}>
        <LogoSlot logo={logo} size={48} />
        <span className="kol-combo-label">Primary</span>
      </div>
      {band(secondary, 'Secondary')}
      {band(light, 'Light')}
      {band(dark, 'Dark')}
    </div>
  )
}

/* ────────── Quad split — 50 / 25 / 25 ────────── */
export function QuadSplit({ palette, logo }) {
  const { primary, light, dark, accent } = palette
  return (
    <div className="kol-combo-stage kol-combo-frame kol-combo-stage--fill kol-combo-stage--quad">
      <div className="kol-combo-slab kol-combo-slab--between" style={{ background: primary, color: fgOn(primary) }}>
        <LogoSlot logo={logo} size={64} />
        <span className="kol-combo-label">Primary · 50</span>
      </div>
      <div className="kol-combo-quad-col">
        <div className="kol-combo-slab kol-combo-slab--end" style={{ background: light, color: fgOn(light) }}>
          <span className="kol-combo-label">Light · 25</span>
        </div>
        <div className="kol-combo-slab kol-combo-slab--between" style={{ background: dark, color: fgOn(dark) }}>
          <span className="kol-combo-label" style={{ color: accent }}>Accent</span>
          <span className="kol-combo-label">Dark · 25</span>
        </div>
      </div>
    </div>
  )
}

/* ────────── Card row — 4 discrete cards ────────── */
export function CardRow({ palette, logo }) {
  const { primary, secondary, light, dark } = palette
  const card = (bg, label, withLogo = false) => (
    <div
      className={`kol-combo-card kol-combo-frame${withLogo ? ' kol-combo-card--between' : ' kol-combo-card--end'}`}
      style={{ background: bg, color: fgOn(bg) }}
    >
      {withLogo && <LogoSlot logo={logo} size={40} />}
      <span className="kol-combo-label">{label}</span>
    </div>
  )
  return (
    <div className="kol-combo-stage kol-combo-stage--card-row">
      {card(primary, 'Primary', true)}
      {card(secondary, 'Secondary')}
      {card(light, 'Light')}
      {card(dark, 'Dark')}
    </div>
  )
}

/* ────────── Stripe row — Method 01 / 02 bars ────────── */
export function StripeRow({ palette }) {
  const { primary, secondary, light, dark, accent } = palette
  /* Rule color derived from dark with alpha suffix. We pass it via a CSS
     custom prop so the class handles border-top/border-bottom declarations. */
  const ruleColor = `${dark}20`
  return (
    <div
      className="kol-combo-stage kol-combo-frame kol-combo-stage--stripe-row"
      style={{
        '--stripe-rule': ruleColor,
        '--stripe-accent': accent,
      }}
    >
      {/* Method 01 — single-row proportion bar */}
      <div className="kol-combo-stripe-row">
        <div className="kol-combo-stripe-bar">
          <div className="kol-combo-stripe-seg kol-combo-stripe-seg--6" style={{ background: primary }} />
          <div className="kol-combo-stripe-seg kol-combo-stripe-seg--3 kol-combo-stripe-neutral" style={{ background: light }} />
          <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: accent }} />
          <span className="kol-combo-stripe-method">Method 01</span>
        </div>
      </div>
      {/* Method 02 — split-row */}
      <div className="kol-combo-stripe-row">
        <div className="kol-combo-stripe-bar">
          <div className="kol-combo-stripe-group kol-combo-stripe-group--3">
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: primary }} />
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: secondary }} />
          </div>
          <div className="kol-combo-stripe-group kol-combo-stripe-group--3">
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1 kol-combo-stripe-neutral" style={{ background: light }} />
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: light }} />
          </div>
          <div className="kol-combo-stripe-group kol-combo-stripe-group--1">
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: accent }} />
            <div className="kol-combo-stripe-seg kol-combo-stripe-seg--1" style={{ background: dark }} />
          </div>
          <span className="kol-combo-stripe-method">Method 02</span>
        </div>
      </div>
    </div>
  )
}

/* ────────── Applied card — brand-applied tile (card + logo + swatches) ────────── */
export function AppliedCard({ palette, logo }) {
  const { primary, secondary, light, dark, accent } = palette
  return (
    <div className="kol-combo-stage kol-combo-frame kol-combo-stage--applied" style={{ background: light }}>
      {/* Main logo plate */}
      <div className="kol-combo-applied-plate" style={{ background: primary, color: fgOn(primary) }}>
        <LogoSlot logo={logo} size={72} />
        <span className="kol-combo-label">Front</span>
      </div>
      {/* Right swatch column */}
      <div className="kol-combo-applied-col">
        <div className="kol-combo-slab kol-combo-slab--between kol-combo-applied-surface" style={{ background: light, color: fgOn(light) }}>
          <span className="kol-combo-label">Surface</span>
          <div className="kol-combo-applied-accent-strip">
            <span className="kol-combo-applied-accent-chip" style={{ background: secondary }} />
            <span className="kol-combo-applied-accent-chip" style={{ background: accent }} />
          </div>
        </div>
        <div className="kol-combo-applied-band kol-combo-applied-band--lg" style={{ background: secondary }} />
        <div className="kol-combo-applied-band kol-combo-applied-band--sm" style={{ background: dark }} />
      </div>
    </div>
  )
}

import { SLIDE_LAYOUT_COMPONENTS } from './slide-layouts'

export const LAYOUT_COMPONENTS = {
  'ratio-603010': RatioBar,
  'tower':        Tower,
  'quad-split':   QuadSplit,
  'card-row':     CardRow,
  'stripe-row':   StripeRow,
  'applied-card': AppliedCard,
  ...SLIDE_LAYOUT_COMPONENTS,
}
