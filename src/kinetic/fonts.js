// Font registry for the kinetic layer — the TG variable fonts the shipped
// presets use (real fvar axes, read from the ttf fvar tables). Trimmed from
// the labs registry (src/pages/kinetic/lib/vfAxes.js) to the faces the 10
// preset compositions reference; files live in public/fonts/TG/.
//
// Also owns the export font cache: base64 @font-face CSS pre-fetched at layer
// mount (warmFontCss) so build.js can embed fonts SYNCHRONOUSLY into the
// exported SVG (its layer walk is sync).

export const FONTS = [
  { key: 'rot', label: 'Rot', family: 'TG Rot', url: '/fonts/TG/TGRotVF.ttf', axes: [{ tag: 'wdth', min: 64, max: 172, def: 100 }, { tag: 'wght', min: 100, max: 900, def: 400 }] },
  { key: 'malromur', label: 'Malromur', family: 'TG Malromur', url: '/fonts/TG/TGMalromurRomanVF.ttf', axes: [{ tag: 'wght', min: 300, max: 900, def: 300 }] },
  { key: 'gullhamrar', label: 'Gullhamrar', family: 'TG Gullhamrar', url: '/fonts/TG/TGGullhamrarVF.ttf', axes: [{ tag: 'wght', min: 300, max: 900, def: 300 }] },
]

export const FONT_OPTIONS = FONTS.map((f) => ({ value: f.key, label: f.label }))
export const AXIS_LABELS = { wght: 'Weight', wdth: 'Width', ital: 'Italic', slnt: 'Slant', opsz: 'Optical size' }
export const fontByKey = (k) => FONTS.find((f) => f.key === k) || FONTS[0]

// Default vf object for a font (each present axis at its default value).
export function defaultVf(font) {
  const out = {}
  for (const a of font.axes) out[a.tag] = a.def
  return out
}

// vf object → `'wght' 600, 'wdth' 120` (a font-variation-settings string).
export function vfString(vf) {
  const parts = Object.entries(vf || {}).map(([tag, val]) => `'${tag}' ${Math.round(val * 100) / 100}`)
  return parts.length ? parts.join(', ') : 'normal'
}

// Load every registered font via FontFace. Variable ranges are declared so the
// browser treats them as variable (weight/stretch ranges). Idempotent.
let started = false
export async function loadFonts() {
  if (started || typeof FontFace === 'undefined') return
  started = true
  for (const f of FONTS) {
    const desc = {}
    const wght = f.axes.find((a) => a.tag === 'wght')
    const wdth = f.axes.find((a) => a.tag === 'wdth')
    if (wght) desc.weight = `${wght.min} ${wght.max}`
    if (wdth) desc.stretch = `${wdth.min}% ${wdth.max}%`
    try {
      const ff = new FontFace(f.family, `url(${f.url})`, desc)
      document.fonts.add(ff)
      ff.load().catch(() => {})
    } catch { /* ignore */ }
  }
  try { await document.fonts.ready } catch { /* ignore */ }
}

// ── export font embedding ────────────────────────────────────────────────
// url → @font-face css with the font inlined as a base64 data URI. Warmed
// async at layer mount; read sync at export time. ~190 KB across all three
// faces, fetched once per session.
const cssCache = new Map()
let warming = null

export function warmFontCss() {
  if (warming) return warming
  warming = Promise.all(FONTS.map(async (f) => {
    if (cssCache.has(f.url)) return
    try {
      const buf = await fetch(f.url).then((r) => { if (!r.ok) throw new Error('font fetch failed'); return r.arrayBuffer() })
      const bytes = new Uint8Array(buf)
      let bin = ''
      const CH = 0x8000
      for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH))
      const b64 = btoa(bin)
      cssCache.set(f.url, `@font-face{font-family:'${f.family}';src:url(data:font/truetype;base64,${b64}) format('truetype');font-weight:1 1000;font-stretch:1% 1000%;}`)
    } catch { /* export falls back to system fonts for this face */ }
  }))
  return warming
}

// Sync: joined @font-face css for every face the composition uses (empty
// string until warmFontCss has resolved — export then falls back to whatever
// the rasterizer has, same trade-off as the raster-snapshot idiom).
export function kineticFontCss(comp) {
  const urls = new Set()
  for (const inst of comp?.instances ?? []) urls.add(fontByKey(inst.font).url)
  return [...urls].map((u) => cssCache.get(u)).filter(Boolean).join('\n')
}
