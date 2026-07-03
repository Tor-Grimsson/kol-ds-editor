import { buildPath, isArray, isRadial, isRings } from './paths.js'
import { glyphAnim } from './animations.js'
import { featureString } from './features.js'
import { fontByKey, vfString } from './fonts.js'
import { buildMorphGlyphs, resolvedFont, ensureGlyphFont } from './morph.js'

/* KineticType — the SVG type composition engine, ported from kol-labs-single
 * src/pages/kinetic/engine/KineticType.js (Phase 10).
 *
 * A composition is a FRAME ({ bg }) holding N INSTANCES, each an independent
 * type element with its own text · font · colour · arrangement (path/grid/
 * radial/rings) · variable axes · OpenType features · internal animation.
 *
 * Why SVG: Canvas 2D can't set per-glyph variable-font axes, so each glyph is
 * its own <text>. We measure advances with the browser (getStartPositionOfChar
 * / getComputedTextLength — these reflect real VF/feature widths), place each
 * onto a curve via getPointAtLength + a tangent (or a grid cell / spoke /
 * ring), and animate as a pure fn of u∈[0,1] (seamless).
 *
 * Editor adaptation (the loops treatment — externally driven):
 *   - no internal rAF / transport / duration: the host calls renderAt(u)
 *     per transport tick (KineticLayer subscribes via useTransportCtx).
 *   - stripped vs labs: expression params (plain numerics — the established
 *     port pattern), the pattern backdrop (patternLoop), export/record/
 *     hit-test (build.js serializes the live SVG subtree instead).
 *   - PORTED (r4): the morph render mode — opentype.js glyph-outline
 *     interpolation (see morph.js). When `instance.morph.on`, glyphs render
 *     as <path> outlines instead of <text>: Cut A = the instance's font+vf,
 *     Cut B = morph.vf2 (same VF, other coords) or morph.face2 (cross-face).
 *     Outlines parse async (ensureGlyphFont) — the instance renders in text
 *     mode until they resolve, then swaps (labs' ensure/cache pattern), so
 *     renderAt stays synchronous. Radial/rings arrangements are <text>-only
 *     (labs rule).
 *   - ADDED vs labs (r3 — de-lockstep the repeated strings): per-instance
 *     `phase` (0..1) shifts that instance's u, and per-instance `stagger`
 *     (0..1) desyncs the instance's repeated units — spokes, rings, grid
 *     cells, multiplied copies. Unit k of K evaluates its motion at
 *     wrap01(u + stagger·k/K); radial/rings units additionally take up to two
 *     extra integer turns toward the last unit (constant-rate spin is phase-
 *     invariant, so only a RATE difference reads as different movement).
 *     Everything stays a pure fn of u with integer cycles ⇒ still seamless.
 *   - svg is pointer-inert; the positioned host div owns selection/drag.
 *
 * API: new KineticType(hostEl) · setComposition(comp) · resize(w,h) ·
 *      renderAt(u) · dispose()
 */
const NS = 'http://www.w3.org/2000/svg'
const TAU = Math.PI * 2
const clamp01 = (x) => Math.max(0, Math.min(1, x))
const wrap01 = (x) => x - Math.floor(x)
const el = (name) => document.createElementNS(NS, name)

// Content-layer case transform (none/upper/lower/title) — applied to the
// authored text before layout, so it's a typesetting choice the composition
// carries, not a UI auto-transform.
function applyCase(s, mode) {
  if (!s || !mode || mode === 'none') return s || ''
  if (mode === 'upper') return s.toUpperCase()
  if (mode === 'lower') return s.toLowerCase()
  if (mode === 'title') return s.replace(/\b\w/g, (c) => c.toUpperCase())
  return s
}

// Accept the composition shape, or wrap a legacy single-instance params blob.
function asComposition(params) {
  if (!params) return { bg: '#16202E', instances: [] }
  if (Array.isArray(params.instances)) return params
  const { bg, ...rest } = params
  return { bg: bg || '#16202E', instances: [{ id: 'main', ...rest }] }
}

export default class KineticType {
  constructor(host) {
    this.host = host
    this.params = asComposition(null)
    this.w = 0
    this.h = 0
    this._rt = new Map() // id → { group, pathEl, glyphG, glyphEls, cache, glyphKey, closed, kind?, morph* (see _setKind) }
    this._instSig = '' // instance-id signature; reconcile the DOM only when it changes
    this._needsRemeasure = false // set when fonts finish loading → drop caches once

    const svg = el('svg')
    svg.setAttribute('xmlns', NS)
    svg.style.display = 'block'
    svg.style.maxWidth = '100%'
    svg.style.maxHeight = '100%'
    // The host div owns pointer routing (selection/drag) — the SVG content
    // must never intercept events.
    svg.style.pointerEvents = 'none'
    // Clip to the frame (the SVG box = the layer box) by default, so type that
    // flows past the edges crops at the frame like a poster bleed instead of
    // spilling across the canvas. params.clip === false → 'visible'.
    svg.style.overflow = 'hidden'
    this._clipApplied = true
    this.bg = el('rect')
    this.layer = el('g')          // holds every instance group (export reads this)
    this.measEl = el('text')      // shared hidden measure node
    this.measEl.setAttribute('x', '0')
    this.measEl.setAttribute('y', '0')
    this.measEl.style.visibility = 'hidden'
    svg.append(this.bg, this.layer, this.measEl)
    host.appendChild(svg)
    this.svg = svg

    // Re-measure once real fonts finish loading (initial metrics may be
    // fallback). Flagged — renderAt drops the caches on the next frame.
    if (typeof document !== 'undefined' && document.fonts) {
      document.fonts.ready.then(() => { this._needsRemeasure = true }).catch(() => {})
    }
  }

  resize(wCss, hCss) {
    this.w = wCss
    this.h = hCss
    this.svg.setAttribute('width', wCss)
    this.svg.setAttribute('height', hCss)
    this.svg.setAttribute('viewBox', `0 0 ${wCss} ${hCss}`)
    this.bg.setAttribute('width', wCss)
    this.bg.setAttribute('height', hCss)
    for (const rt of this._rt.values()) rt.cache = null
  }

  setComposition(comp) { this.params = asComposition(comp) }

  renderAt(u) {
    if (!this.w || !this.h) return
    this._render(clamp01(u))
  }

  dispose() {
    if (this.svg && this.svg.parentNode === this.host) this.host.removeChild(this.svg)
  }

  // ── runtime DOM reconciliation: one <g> per instance, keyed by id, kept in
  // params order so z-stacking follows the instance list. ──
  _syncInstances() {
    const insts = this.params.instances || []
    // Reconcile the DOM only when the instance set/order actually changes —
    // not every frame (param edits keep the same ids → nothing to move).
    const sig = insts.map((i) => i.id).join('|')
    if (sig === this._instSig) return
    this._instSig = sig
    const ids = new Set(insts.map((i) => i.id))
    for (const [id, rt] of this._rt) {
      if (!ids.has(id)) { rt.group.remove(); this._rt.delete(id) }
    }
    for (const inst of insts) {
      let rt = this._rt.get(inst.id)
      if (!rt) {
        const group = el('g')
        const pathEl = el('path')
        pathEl.setAttribute('fill', 'none')
        const glyphG = el('g')
        glyphG.setAttribute('data-glyphs', inst.id)
        group.append(pathEl, glyphG)
        rt = { group, pathEl, glyphG, glyphEls: [], cache: null, glyphKey: '', closed: false }
        this._rt.set(inst.id, rt)
      }
      this.layer.appendChild(rt.group) // re-append → enforce DOM/z order
    }
  }

  _render(u) {
    // clip-to-frame toggle (default on) → SVG overflow
    const clip = this.params.clip !== false
    if (clip !== this._clipApplied) { this._clipApplied = clip; this.svg.style.overflow = clip ? 'hidden' : 'visible' }
    // fonts just finished loading → drop every measure cache so glyph metrics
    // re-measure against the real font (not the fallback used on first paint).
    if (this._needsRemeasure) {
      this._needsRemeasure = false
      for (const rt of this._rt.values()) rt.cache = null
    }
    this.bg.setAttribute('fill', this.params.bg || '#16202E')
    this._syncInstances()
    for (const inst of this.params.instances || []) {
      const rt = this._rt.get(inst.id)
      if (rt) this._renderInstance(inst, rt, u)
    }
  }

  // Build/refresh an instance's per-glyph <text> pool (text × copies). Keyed by
  // text|font|copies so a content change rebuilds, a param tweak doesn't.
  _ensureGlyphs(rt, text, font, copies) {
    const key = `${text}|${font.family}|${copies}`
    if (key === rt.glyphKey) return
    rt.glyphKey = key
    rt.glyphG.textContent = ''
    rt.glyphEls = []
    for (let c = 0; c < copies; c++) {
      for (const ch of text) {
        const t = el('text')
        t.setAttribute('text-anchor', 'middle')
        t.setAttribute('dominant-baseline', 'central')
        t.textContent = ch
        rt.glyphG.appendChild(t)
        rt.glyphEls.push(t)
      }
    }
  }

  // Measure ONE run of `text` (already multiplied) → glyph centres (arc-length
  // offsets) + total advance, at the base axis/feature values. Cached per instance.
  _measure(rt, p, font, text) {
    const ls = p.letterSpacing || 0
    const feat = featureString(p.opentype)
    const key = `${text}|${font.family}|${p.fontSize}|${ls}|${vfString(p.vf)}|${feat}`
    if (rt.cache && rt.cache.key === key) return rt.cache
    const m = this.measEl
    m.style.fontFamily = `'${font.family}'`
    m.style.fontSize = `${p.fontSize}px`
    m.style.letterSpacing = `${ls}px`
    m.style.fontVariationSettings = vfString(p.vf)
    m.style.fontFeatureSettings = feat
    m.textContent = text
    const n = text.length
    const centers = new Array(n)
    let total = 0
    try {
      total = m.getComputedTextLength()
      const starts = new Array(n)
      for (let i = 0; i < n; i++) starts[i] = m.getStartPositionOfChar(i).x
      for (let i = 0; i < n; i++) centers[i] = (starts[i] + (i + 1 < n ? starts[i + 1] : total)) / 2
    } catch {
      total = p.fontSize * 0.6 * n
      for (let i = 0; i < n; i++) centers[i] = (i + 0.5) * (total / Math.max(1, n))
    }
    rt.cache = { key, centers, total }
    return rt.cache
  }

  _renderInstance(p, rt, u0) {
    const font = fontByKey(p.font)
    // per-instance time shift — stacked instances stop moving in lockstep
    // (phase is authored on the preset or distributed by the stagger knob).
    // wrap01 keeps frame(0) ≡ frame(1).
    const u = p.phase ? wrap01(u0 + p.phase) : u0
    // type multiplier — repeat the word N times into one run so a single
    // instance makes N copies (joined by two spaces for a clean gap).
    const base = applyCase(p.text || '', p.case)
    const mult = Math.max(1, Math.round(p.multiply || 1))
    const text = mult > 1 && base ? Array(mult).fill(base).join('  ') : base
    const type = p.path?.type || 'line'

    // position offset (normalized) → translate the whole instance group.
    const ox = (p.offset?.x || 0) * this.w
    const oy = (p.offset?.y || 0) * this.h
    rt.group.setAttribute('transform', `translate(${ox.toFixed(2)} ${oy.toFixed(2)})`)

    // ── morph render mode: real glyph-outline interpolation (<path> glyphs) ──
    // Needs opentype outlines; if they aren't parsed yet, kick the load and fall
    // back to the live <text> render so nothing blanks while it streams in.
    // Radial/rings arrangements are <text>-only (no morph), so they skip this.
    if (p.morph?.on && !isRadial(type) && !isRings(type)) {
      const urlA = font.url
      const face2 = p.morph.face2 ? fontByKey(p.morph.face2) : null
      const urlB = face2 ? face2.url : urlA
      const fa = resolvedFont(urlA)
      const fb = resolvedFont(urlB)
      if (fa && fb) {
        this._setKind(rt, 'morph')
        this._renderMorph(p, rt, u, fa, fb, font, text, type)
        return
      }
      if (!fa) ensureGlyphFont(urlA).catch(() => {})
      if (!fb && urlB !== urlA) ensureGlyphFont(urlB).catch(() => {})
    }

    this._setKind(rt, 'text')

    if (isArray(type)) {
      rt.pathEl.setAttribute('d', '')
      rt.pathEl.style.opacity = 0
      const rows = Math.max(1, Math.round(p.path?.rows ?? 2))
      const cols = Math.max(1, Math.round(p.path?.cols ?? 3))
      this._ensureGlyphs(rt, text, font, rows * cols)
      if (!text.length) return
      this._measure(rt, p, font, text)
      this._placeArray(p, rt, font, u, rt.glyphEls, rows, cols)
      return
    }

    if (isRadial(type) || isRings(type)) {
      rt.pathEl.setAttribute('d', '')
      rt.pathEl.style.opacity = 0
      const count = Math.max(1, Math.round(p.path?.count ?? 12))
      this._ensureGlyphs(rt, text, font, count)
      if (!text.length) return
      this._measure(rt, p, font, text)
      if (isRadial(type)) this._placeRadial(p, rt, font, u, rt.glyphEls, count)
      else this._placeRings(p, rt, font, u, rt.glyphEls, count)
      return
    }

    const path = buildPath(type, this.w, this.h, p.path || {})
    rt.closed = path.closed
    rt.pathEl.setAttribute('d', path.d)
    rt.pathEl.setAttribute('stroke', p.showPath ? (p.fill || '#888') : 'none')
    rt.pathEl.setAttribute('stroke-width', p.showPath ? 1 : 0)
    rt.pathEl.style.opacity = p.showPath ? 0.25 : 0
    this._ensureGlyphs(rt, text, font, 1)
    if (!text.length) return
    this._measure(rt, p, font, text)
    this._placeOnPath(p, rt, font, u, rt.glyphEls)
  }

  // common per-glyph styling
  _styleGlyph(el2, p, font, a) {
    el2.style.fontFamily = `'${font.family}'`
    el2.style.fontSize = `${p.fontSize}px`
    el2.style.fontStyle = p.italic ? 'italic' : 'normal'
    el2.style.fontVariationSettings = vfString(a.vf ? { ...p.vf, ...a.vf } : p.vf)
    el2.style.fontFeatureSettings = featureString(p.opentype)
    el2.setAttribute('fill', p.fill || '#e8e4dc')
    el2.setAttribute('opacity', a.opacity)
  }

  // Compose every motion layer for one glyph — the primary `motion` plus the
  // `motions` stack. Displacements add, scale/opacity multiply, vf axes merge.
  _anim(p, base, font) {
    const list = p.motions && p.motions.length ? [p.motion, ...p.motions] : [p.motion]
    let dLen = 0, dNormal = 0, dRot = 0, scale = 1, opacity = 1, vf = null
    for (const m of list) {
      if (!m || (m.mode || 'none') === 'none') continue
      const ax = font.axes.find((a) => a.tag === (m.axis || (font.axes[0] && font.axes[0].tag)))
      const a = glyphAnim(m.mode, { ...base, m, axisTag: ax ? ax.tag : 'wght', axisMin: ax ? ax.min : 100, axisMax: ax ? ax.max : 900 })
      dLen += a.dLen; dNormal += a.dNormal; dRot += a.dRot; scale *= a.scale; opacity *= a.opacity
      if (a.vf) vf = { ...(vf || {}), ...a.vf }
    }
    return { dLen, dNormal, scale, dRot, opacity, vf }
  }

  // Place glyphs `els` along this instance's path (geometry from rt.pathEl,
  // which is attached for getPointAtLength).
  _placeOnPath(p, rt, font, u, els) {
    const cache = rt.cache
    if (!cache) return
    const pathLen = rt.pathEl.getTotalLength()
    if (!pathLen) return
    const { centers, total } = cache
    const align = p.align || 'center'
    const startLen = align === 'start' ? 0 : align === 'end' ? pathLen - total : (pathLen - total) / 2
    const eps = 0.75
    const closed = rt.closed
    // 'flow' = let glyphs run past an open path's ends (overflow the frame) by
    // extrapolating along the end tangent; 'contain' clamps them inside.
    const flow = p.flow === 'flow' && !closed
    const wrap = (L) => closed ? ((L % pathLen) + pathLen) % pathLen : Math.max(0, Math.min(pathLen, L))
    const ptAt = (L) => {
      if (flow && (L < 0 || L > pathLen)) {
        const edge = L < 0 ? 0 : pathLen
        const base = rt.pathEl.getPointAtLength(edge)
        const a2 = rt.pathEl.getPointAtLength(Math.max(0, edge - eps))
        const b2 = rt.pathEl.getPointAtLength(Math.min(pathLen, edge + eps))
        let dx = b2.x - a2.x, dy = b2.y - a2.y
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        const over = L - edge
        return { x: base.x + dx * over, y: base.y + dy * over }
      }
      return rt.pathEl.getPointAtLength(wrap(L))
    }
    const n = Math.min(els.length, centers.length)
    // stagger: multiplied copies desync — copy c of `mult` evaluates its
    // motion at wrap01(u + stagger·c/mult). Copy length in glyphs is
    // (run + joiner) / mult since copies are joined by two spaces.
    const stag = clamp01(p.stagger || 0)
    const mult = Math.max(1, Math.round(p.multiply || 1))
    const copyLen = (centers.length + 2) / mult

    for (let i = 0; i < n; i++) {
      // base point (pre-motion) → the glyph's normalized position for field sweeps
      const L0 = startLen + centers[i]
      const pBase = ptAt(L0)
      const ug = stag && mult > 1 ? wrap01(u + stag * Math.floor(i / copyLen) / mult) : u
      const a = this._anim(p, { i, n: centers.length, u: ug, sizePx: p.fontSize, pathLen, nx: this.w ? pBase.x / this.w : 0.5, ny: this.h ? pBase.y / this.h : 0.5 }, font)
      const L = L0 + a.dLen
      const pt = ptAt(L)
      const A = ptAt(L - eps)
      const B = ptAt(L + eps)
      const ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI
      els[i].setAttribute('transform',
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(ang + a.dRot).toFixed(2)}) translate(0 ${(-a.dNormal).toFixed(2)}) scale(${a.scale.toFixed(3)})`)
      this._styleGlyph(els[i], p, font, a)
    }
  }

  // Place glyphs `els` as a rows×cols grid of the text (the 'array'
  // arrangement). Motion still applies per glyph; seamless — u only enters
  // via the motion.
  _placeArray(p, rt, font, u, els, rows, cols) {
    const cache = rt.cache
    if (!cache) return
    const { centers, total } = cache
    const len = centers.length
    if (!len) return
    const m = Math.min(this.w, this.h) * 0.08
    const cellW = (this.w - 2 * m) / cols
    const cellH = (this.h - 2 * m) / rows
    // stagger: each grid cell's copy of the run evaluates at a shifted u.
    const stag = clamp01(p.stagger || 0)
    const cells = rows * cols

    for (let cell = 0; cell < cells; cell++) {
      const r = Math.floor(cell / cols)
      const c = cell % cols
      const cx = m + c * cellW + cellW / 2
      const cy = m + r * cellH + cellH / 2
      const originX = cx - total / 2
      const uc = stag ? wrap01(u + stag * cell / cells) : u
      for (let j = 0; j < len; j++) {
        const idx = cell * len + j
        const el2 = els[idx]
        if (!el2) continue
        const x = originX + centers[j]
        const a = this._anim(p, { i: cell * len + j, n: cells * len, u: uc, sizePx: p.fontSize, pathLen: 0, nx: this.w ? x / this.w : 0.5, ny: this.h ? cy / this.h : 0.5 }, font)
        const y = cy - a.dNormal
        el2.setAttribute('transform',
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.dRot.toFixed(2)}) scale(${a.scale.toFixed(3)})`)
        this._styleGlyph(el2, p, font, a)
      }
    }
  }

  // Place glyphs as N radial spokes (the 'radial' sunburst). Each spoke is the
  // whole run, read from the centre outward (glyph 0 nearest the middle),
  // spaced by its natural advance from an inner radius. The whole burst
  // rotates by `spin` full turns over u → seamless.
  _placeRadial(p, rt, font, u, els, count) {
    const cache = rt.cache
    if (!cache) return
    const { centers } = cache
    const len = centers.length
    if (!len) return
    const cx = this.w / 2, cy = this.h / 2
    const base = Math.min(this.w, this.h) * 0.5
    const inner = base * Math.max(0, Math.min(0.95, p.path?.inner ?? 0.12))
    const spin = Math.round(p.path?.spin ?? 1)
    // stagger: spokes stop rotating in lockstep — later spokes take up to two
    // extra integer turns (rate difference; a phase offset alone would only
    // read as a static twist) and their motion evaluates at a shifted u.
    const stag = clamp01(p.stagger || 0)
    for (let s = 0; s < count; s++) {
      const frac = count > 1 ? s / (count - 1) : 0
      const spinS = spin + (stag ? Math.round(stag * 2 * frac) : 0)
      const theta = (s / count) * TAU + u * TAU * spinS
      const us = stag ? wrap01(u + stag * s / count) : u
      const dx = Math.cos(theta), dy = Math.sin(theta)
      const deg = theta * 180 / Math.PI
      for (let j = 0; j < len; j++) {
        const idx = s * len + j
        const el2 = els[idx]
        if (!el2) continue
        const rho0 = inner + centers[j]
        const bx = cx + dx * rho0, by = cy + dy * rho0
        const a = this._anim(p, { i: idx, n: count * len, u: us, sizePx: p.fontSize, pathLen: base, nx: this.w ? bx / this.w : 0.5, ny: this.h ? by / this.h : 0.5 }, font)
        const rho = rho0 + a.dLen
        const x = cx + dx * rho, y = cy + dy * rho
        el2.setAttribute('transform',
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(deg + a.dRot).toFixed(2)}) translate(0 ${(-a.dNormal).toFixed(2)}) scale(${a.scale.toFixed(3)})`)
        this._styleGlyph(el2, p, font, a)
      }
    }
  }

  // Place glyphs on N concentric rings (the 'rings' vortex). The run wraps
  // around each circle (arc-length → angle), each successive ring is rotated
  // by `twist` (→ spiral arms) and its glyphs scale up by `grow` toward the
  // rim. The whole field rotates by `spin` full turns over u → seamless.
  _placeRings(p, rt, font, u, els, count) {
    const cache = rt.cache
    if (!cache) return
    const { centers, total } = cache
    const len = centers.length
    if (!len) return
    const cx = this.w / 2, cy = this.h / 2
    const base = Math.min(this.w, this.h) * 0.5
    const maxR = base * Math.max(0.1, Math.min(1, p.path?.radius ?? 0.92))
    const inner = maxR * Math.max(0.02, Math.min(0.95, p.path?.inner ?? 0.14))
    const spin = Math.round(p.path?.spin ?? 1)
    const twist = p.path?.twist ?? 0.5
    const grow = p.path?.grow ?? 0.6
    // stagger: rings stop rotating in lockstep — outer rings take up to two
    // extra integer turns (rate difference, still seamless; a phase offset
    // alone is indistinguishable from twist) and each ring's motion evaluates
    // at a shifted u.
    const stag = clamp01(p.stagger || 0)
    for (let r = 0; r < count; r++) {
      const frac = count > 1 ? r / (count - 1) : 0
      const radius = Math.max(1, inner + frac * (maxR - inner))
      const spinR = spin + (stag ? Math.round(stag * 2 * frac) : 0)
      const ringStart = u * TAU * spinR + frac * twist * TAU
      const ur = stag ? wrap01(u + stag * r / count) : u
      const gscale = 1 + grow * frac
      for (let j = 0; j < len; j++) {
        const idx = r * len + j
        const el2 = els[idx]
        if (!el2) continue
        const ang0 = ringStart + (centers[j] - total / 2) / radius
        const bx = cx + Math.cos(ang0) * radius, by = cy + Math.sin(ang0) * radius
        const a = this._anim(p, { i: idx, n: count * len, u: ur, sizePx: p.fontSize, pathLen: TAU * radius, nx: this.w ? bx / this.w : 0.5, ny: this.h ? by / this.h : 0.5 }, font)
        const ang = ang0 + a.dLen / radius
        const rr = radius - a.dNormal
        const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr
        const deg = ang * 180 / Math.PI + 90 + a.dRot
        el2.setAttribute('transform',
          `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${deg.toFixed(2)}) scale(${(a.scale * gscale).toFixed(3)})`)
        this._styleGlyph(el2, p, font, a)
      }
    }
  }

  // ── morph render mode (glyph-outline interpolation) ──────────────────────
  // Switch an instance's glyph pool between the <text> and <path> renderers.
  // The two element kinds can't coexist in one glyphG, so swapping clears it.
  _setKind(rt, kind) {
    if (rt.kind === kind) return
    rt.kind = kind
    rt.glyphG.textContent = ''
    rt.glyphEls = []
    rt.morphEls = []
    rt.glyphKey = ''
    rt.morphKey = ''
    rt.morphPoolKey = ''
    rt.cache = null
  }

  _renderMorph(p, rt, u, fa, fb, font, text, type) {
    const size = p.fontSize
    const axes = font.axes || []
    // Cut A = the instance's own axis coords. Cut B = vf2 (default = axis maxes)
    // for a same-face morph, or the second face's default outline (cross-face).
    const coordsA = {}
    for (const a of axes) coordsA[a.tag] = p.vf?.[a.tag] ?? a.def
    const cross = !!p.morph.face2
    const coordsB = {}
    if (!cross) for (const a of axes) coordsB[a.tag] = p.morph.vf2?.[a.tag] ?? a.max
    const gap = size * 0.12 + (p.letterSpacing || 0)
    const mode = p.morph.mode || 'morph'
    const blend = p.morph.blend ?? 0.5
    const curve = p.morph.curve || 'flat'
    const cp1 = p.morph.cp1 || { x: 0.33, y: 0.33 }
    const cp2 = p.morph.cp2 || { x: 0.66, y: 0.66 }
    const fill = p.fill || '#e8e4dc'

    // rebuild the glyph outlines only when something that changes geometry moves
    const mk = JSON.stringify([text, p.font, p.morph.face2 || '', size, coordsA, coordsB, mode, blend, curve, cp1, cp2, p.letterSpacing || 0, fill])
    const rebuilt = mk !== rt.morphKey
    if (rebuilt) {
      rt.morphKey = mk
      const built = buildMorphGlyphs(fa, fb, text, size, { mode, blend, curve, cp1, cp2, coordsA, coordsB, axes, gap })
      rt.morphData = built
      const centers = []
      let run = 0
      for (const g of built.glyphs) { centers.push(run + g.advance / 2); run += g.advance }
      rt.morphCenters = centers
      rt.morphTotal = built.totalAdvance
    }

    const runLen = rt.morphData?.glyphs.length || 0
    if (!text.length || !runLen) { rt.pathEl.setAttribute('d', ''); rt.pathEl.style.opacity = 0; return }

    const grid = isArray(type)
    const rows = grid ? Math.max(1, Math.round(p.path?.rows ?? 2)) : 1
    const cols = grid ? Math.max(1, Math.round(p.path?.cols ?? 3)) : 1
    const copies = grid ? rows * cols : 1
    const poolRebuilt = this._ensureMorphPool(rt, runLen, copies, mode)
    if (rebuilt || poolRebuilt) this._refreshMorphPaths(rt, copies, mode, fill)

    if (grid) {
      rt.pathEl.setAttribute('d', ''); rt.pathEl.style.opacity = 0
      this._placeMorphArray(p, rt, font, u, rows, cols)
      return
    }
    const path = buildPath(type, this.w, this.h, p.path || {})
    rt.closed = path.closed
    rt.pathEl.setAttribute('d', path.d)
    rt.pathEl.setAttribute('stroke', p.showPath ? (p.fill || '#888') : 'none')
    rt.pathEl.setAttribute('stroke-width', p.showPath ? 1 : 0)
    rt.pathEl.style.opacity = p.showPath ? 0.25 : 0
    this._placeMorphOnPath(p, rt, font, u)
  }

  // (re)build the <g>/<path> wrapper pool: copies × the glyph run. Each wrapper
  // holds one <path> (morph/random) or two (fade: Cut A over Cut B).
  _ensureMorphPool(rt, runLen, copies, mode) {
    const key = `${runLen}|${copies}|${mode}`
    if (key === rt.morphPoolKey) return false
    rt.morphPoolKey = key
    rt.glyphG.textContent = ''
    rt.morphEls = []
    const total = runLen * copies
    for (let i = 0; i < total; i++) {
      const g = el('g')
      g.appendChild(el('path'))
      if (mode === 'fade') g.appendChild(el('path'))
      rt.glyphG.appendChild(g)
      rt.morphEls.push(g)
    }
    return true
  }

  _refreshMorphPaths(rt, copies, mode, fill) {
    const glyphs = rt.morphData?.glyphs || []
    const runLen = glyphs.length
    if (!runLen) return
    for (let i = 0; i < rt.morphEls.length; i++) {
      const g = rt.morphEls[i]
      const gd = glyphs[i % runLen]
      if (!gd) continue
      const kids = g.childNodes
      if (mode === 'fade') {
        this._setMorphPath(kids[0], gd.dA, gd.bboxA, fill, gd.opA)
        this._setMorphPath(kids[1], gd.dB, gd.bboxB, fill, gd.opB)
      } else {
        this._setMorphPath(kids[0], gd.d, gd.bbox, fill, 1)
      }
    }
  }

  // centre the outline on the origin (bbox centre) so the wrapper's transform
  // positions it exactly like text-anchor:middle / dominant-baseline:central.
  _setMorphPath(pathEl, d, bbox, fill, opacity) {
    if (!pathEl) return
    pathEl.setAttribute('d', d || '')
    pathEl.setAttribute('fill', fill)
    pathEl.setAttribute('fill-rule', 'evenodd')
    pathEl.setAttribute('opacity', opacity)
    const cx = (bbox.x1 + bbox.x2) / 2
    const cy = (bbox.y1 + bbox.y2) / 2
    pathEl.setAttribute('transform', `translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`)
  }

  // Place morph wrappers along the path — same geometry as _placeOnPath, but on
  // <g> wrappers (no per-glyph font styling; outlines are baked). Carries the
  // editor's stagger extension exactly like _placeOnPath.
  _placeMorphOnPath(p, rt, font, u, els = rt.morphEls) {
    const centers = rt.morphCenters
    const total = rt.morphTotal
    if (!centers || !els) return
    const pathLen = rt.pathEl.getTotalLength()
    if (!pathLen) return
    const align = p.align || 'center'
    const startLen = align === 'start' ? 0 : align === 'end' ? pathLen - total : (pathLen - total) / 2
    const eps = 0.75
    const closed = rt.closed
    const flow = p.flow === 'flow' && !closed
    const wrap = (L) => closed ? ((L % pathLen) + pathLen) % pathLen : Math.max(0, Math.min(pathLen, L))
    const ptAt = (L) => {
      if (flow && (L < 0 || L > pathLen)) {
        const edge = L < 0 ? 0 : pathLen
        const base = rt.pathEl.getPointAtLength(edge)
        const a2 = rt.pathEl.getPointAtLength(Math.max(0, edge - eps))
        const b2 = rt.pathEl.getPointAtLength(Math.min(pathLen, edge + eps))
        let dx = b2.x - a2.x, dy = b2.y - a2.y
        const len = Math.hypot(dx, dy) || 1
        dx /= len; dy /= len
        const over = L - edge
        return { x: base.x + dx * over, y: base.y + dy * over }
      }
      return rt.pathEl.getPointAtLength(wrap(L))
    }
    const sk = p.italic ? ' skewX(-12)' : ''
    const n = Math.min(els.length, centers.length)
    const stag = clamp01(p.stagger || 0)
    const mult = Math.max(1, Math.round(p.multiply || 1))
    const copyLen = (centers.length + 2) / mult
    for (let i = 0; i < n; i++) {
      const L0 = startLen + centers[i]
      const pBase = ptAt(L0)
      const ug = stag && mult > 1 ? wrap01(u + stag * Math.floor(i / copyLen) / mult) : u
      const a = this._anim(p, { i, n: centers.length, u: ug, sizePx: p.fontSize, pathLen, nx: this.w ? pBase.x / this.w : 0.5, ny: this.h ? pBase.y / this.h : 0.5 }, font)
      const L = L0 + a.dLen
      const pt = ptAt(L)
      const A = ptAt(L - eps)
      const B = ptAt(L + eps)
      const ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI
      els[i].setAttribute('transform',
        `translate(${pt.x.toFixed(2)} ${pt.y.toFixed(2)}) rotate(${(ang + a.dRot).toFixed(2)}) translate(0 ${(-a.dNormal).toFixed(2)}) scale(${a.scale.toFixed(3)})${sk}`)
      els[i].setAttribute('opacity', a.opacity)
    }
  }

  // Place morph wrappers as a rows×cols grid — the morph twin of _placeArray,
  // per-cell stagger included.
  _placeMorphArray(p, rt, font, u, rows, cols, els = rt.morphEls) {
    const centers = rt.morphCenters
    const total = rt.morphTotal
    if (!centers || !els) return
    const runLen = centers.length
    if (!runLen) return
    const m = Math.min(this.w, this.h) * 0.08
    const cellW = (this.w - 2 * m) / cols
    const cellH = (this.h - 2 * m) / rows
    const sk = p.italic ? ' skewX(-12)' : ''
    const stag = clamp01(p.stagger || 0)
    const cells = rows * cols
    for (let cell = 0; cell < cells; cell++) {
      const r = Math.floor(cell / cols)
      const c = cell % cols
      const cx = m + c * cellW + cellW / 2
      const cy = m + r * cellH + cellH / 2
      const originX = cx - total / 2
      const uc = stag ? wrap01(u + stag * cell / cells) : u
      for (let j = 0; j < runLen; j++) {
        const idx = cell * runLen + j
        const e = els[idx]
        if (!e) continue
        const x = originX + centers[j]
        const a = this._anim(p, { i: idx, n: cells * runLen, u: uc, sizePx: p.fontSize, pathLen: 0, nx: this.w ? x / this.w : 0.5, ny: this.h ? cy / this.h : 0.5 }, font)
        const y = cy - a.dNormal
        e.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${a.dRot.toFixed(2)}) scale(${a.scale.toFixed(3)})${sk}`)
        e.setAttribute('opacity', a.opacity)
      }
    }
  }
}
