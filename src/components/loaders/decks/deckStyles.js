/**
 * Shared CSS for the Slide deck and standalone slide use.
 *
 * Slides are scoped to their `.s-*` class names — NOT to `.runway-deck-stage` —
 * so the same SlideCover / SlideManifesto / SlideEnd components render
 * identically inside the deck shell (carousel) AND standalone (combo-lab
 * stage, compose layout backdrop, social composition). Fonts + colors come
 * from CSS vars with greyscale grey-* fallbacks; palette-aware slides
 * inject `--slide-bg / --slide-fg / --slide-accent` to override.
 *
 * KOL-aligned chrome throughout: frame elements (eyebrow/foot/captions/keys
 * /badges/table headers/ledger keys/end-card meta) use the KOL mono helper
 * voice (16px / 0.1em / 100% / 500). Display type stays untouched.
 *
 * Font-faces are NOT registered here — the SPA already loads the full
 * Right Grotesk family via kol-typography.css.
 */

/* Auto-inject the slide CSS once on module load. Both DeckShell (carousel
 * use) and combo-lab/slide-layouts (standalone use) import from this file,
 * so the styles are guaranteed present whenever a slide renders. */
let _injected = false
function injectOnce(css) {
  if (_injected) return
  if (typeof document === 'undefined') return
  if (document.getElementById('kol-slide-css')) { _injected = true; return }
  const el = document.createElement('style')
  el.id = 'kol-slide-css'
  el.textContent = css
  document.head.appendChild(el)
  _injected = true
}

export const SHARED = `
.runway-deck-wrap {
  position: fixed; inset: 0; background: #000; overflow: hidden;
  display: grid; place-items: center; z-index: 100;
}
.runway-deck-stage {
  width: 1920px; height: 1080px;
  transform: scale(min(calc(100vw / 1920), calc(100vh / 1080)));
  transform-origin: center;
  user-select: none; -webkit-user-select: none;
}
.runway-deck-stage .embla { overflow: hidden; width: 100%; height: 100%; }
.runway-deck-stage .embla__track { display: flex; height: 100%; will-change: transform; }
.runway-deck-stage section {
  flex: 0 0 1920px;
  width: 1920px; height: 1080px;
  position: relative;
}

/* ── Type-cut aliases — set on the deck stage AND on every standalone slide
   section so consumers don't need to wrap in .runway-deck-stage. Frame
   chrome resolves through --tight (KOL mono helper voice). Display cuts
   come straight from the Right Grotesk family. ───────────────────── */
.runway-deck-stage,
.s-cover, .s-wide-stamp, .s-number, .s-tall, .s-manifesto, .s-spatial,
.s-look, .s-quote, .s-index, .s-duo, .s-specimen, .s-contrast,
.s-credits, .s-end, .s-season {
  --display: 'Right Grotesk Narrow', system-ui, sans-serif;
  --tall:    'Right Grotesk Tall',    system-ui, sans-serif;
  --text:    'Right Grotesk Compact', system-ui, sans-serif;
  --tight:   var(--kol-font-family-mono);
  --wide:    'Right Grotesk Wide',    system-ui, sans-serif;
  --spatial: 'Right Grotesk Spatial', system-ui, sans-serif;
  --base:    'Right Grotesk',         system-ui, sans-serif;
}

/* Slide section base — position-absolute fills its parent (used standalone).
   When inside .runway-deck-stage, the rule above gives them the deck-stage
   flex-item sizing instead, which has higher specificity. */
.s-cover, .s-wide-stamp, .s-number, .s-tall, .s-manifesto, .s-spatial,
.s-look, .s-quote, .s-index, .s-duo, .s-specimen, .s-contrast,
.s-credits, .s-end, .s-season {
  position: absolute; inset: 0;
  overflow: hidden;
  background: var(--slide-bg, var(--kol-color-absolute-black));
  color: var(--slide-fg, var(--grey-50));
  font-family: var(--text);
}

/* ── Universal chrome — kol-helper-10 alignment everywhere ─────── */
.eyebrow {
  position: absolute; top: 60px; left: 80px; right: 80px;
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--slide-fg-meta, var(--grey-300)); font-weight: 500;
}
.eyebrow .l, .eyebrow .r { display: flex; gap: 28px; align-items: baseline; }
.eyebrow .dot { width: 5px; height: 5px; background: currentColor; border-radius: 50%; opacity: 0.7; transform: translateY(-3px); }
.foot {
  position: absolute; bottom: 50px; left: 80px; right: 80px;
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--slide-fg-faint, var(--grey-500)); font-weight: 500;
}

/* ── Cover (s-cover) ──────────────────────────────────────────── */
.s-cover { display: grid; place-items: center; }
.s-cover .stack { text-align: center; line-height: 0.84; font-family: var(--display); font-weight: 800; letter-spacing: -0.035em; text-transform: uppercase; }
.s-cover .stack .l1 { font-size: 220px; color: var(--slide-fg, var(--grey-100)); }
.s-cover .stack .l2 { font-size: 380px; color: var(--slide-fg, var(--grey-50)); margin-top: -10px; }
.s-cover .stack .l3 { font-size: 220px; font-style: italic; font-weight: 500; color: var(--slide-accent, var(--grey-300)); margin-top: -20px; font-family: var(--display); }
.s-cover .meta-l, .s-cover .meta-r {
  position: absolute; bottom: 80px;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em; line-height: 1.6;
  text-transform: uppercase; color: var(--slide-fg-meta, var(--grey-400)); font-weight: 500;
}
.s-cover .meta-l { left: 80px; }
.s-cover .meta-r { right: 80px; text-align: right; }
.s-cover .topbar {
  position: absolute; top: 80px; left: 80px; right: 80px;
  display: flex; justify-content: space-between; align-items: center;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--slide-fg-meta, var(--grey-400)); font-weight: 500;
}
.s-cover .mark {
  width: 40px; height: 40px;
  border: 1px solid var(--slide-fg-faint, var(--grey-500));
  display: grid; place-items: center;
  font-family: var(--tight); font-weight: 500; font-size: 16px; letter-spacing: 0;
  color: var(--slide-fg, var(--grey-200));
}

/* ── Look / monogram (s-look) ─────────────────────────────────── */
.s-look { padding: 0; }
.s-look .frame { position: absolute; inset: 140px 240px 120px; border: 1px solid var(--grey-800); display: grid; place-items: center; }
.s-look .frame .mono { font-family: var(--display); font-weight: 800; font-size: 660px; line-height: 0.85; letter-spacing: -0.06em; color: var(--grey-50); }
.s-look .frame .mono em { font-family: var(--display); font-style: italic; font-weight: 500; color: var(--grey-300); }
.s-look .corners::before, .s-look .corners::after,
.s-look .corners > i::before, .s-look .corners > i::after {
  content: ''; position: absolute; width: 18px; height: 18px; background: var(--kol-color-absolute-black); border: 1px solid var(--grey-500);
}
.s-look .corners::before { top: 132px; left: 232px; }
.s-look .corners::after  { top: 132px; right: 232px; }
.s-look .corners > i { position: absolute; inset: 0; }
.s-look .corners > i::before { bottom: 112px; left: 232px; }
.s-look .corners > i::after  { bottom: 112px; right: 232px; }
.s-look .caption {
  position: absolute; bottom: 50px; left: 80px; right: 80px;
  display: flex; justify-content: space-between; align-items: baseline;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}

/* ── Quote (s-quote) ──────────────────────────────────────────── */
.s-quote { padding: 0; }
.s-quote .body { position: absolute; inset: 220px 200px 180px; display: flex; flex-direction: column; justify-content: center; gap: 80px; }
.s-quote .open { font-family: var(--display); font-weight: 700; font-size: 280px; line-height: 0.7; color: var(--grey-800); position: absolute; top: 100px; left: 100px; }
.s-quote .body q { font-family: var(--tall); font-weight: 400; font-size: 88px; line-height: 1.05; letter-spacing: -0.012em; color: var(--grey-50); quotes: none; text-wrap: balance; }
.s-quote .body q em { font-family: var(--tall); font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-quote .body q::before, .s-quote .body q::after { content: ''; }
.s-quote .attr {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-300); font-weight: 500;
  display: flex; align-items: center; gap: 28px;
}
.s-quote .attr .line { width: 80px; height: 1px; background: var(--grey-500); }

/* ── Credits / colophon (s-credits) ───────────────────────────── */
.s-credits { padding: 0; }
.s-credits .grid { position: absolute; inset: 320px 120px 170px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 60px; }
.s-credits .col h4 {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
  border-bottom: 1px solid var(--grey-800); padding-bottom: 18px; margin-bottom: 28px;
}
.s-credits .col ul { list-style: none; display: flex; flex-direction: column; gap: 16px; padding: 0; margin: 0; }
.s-credits .col li { font-family: var(--display); font-weight: 500; font-size: 32px; color: var(--grey-100); letter-spacing: -0.005em; line-height: 1.15; }
.s-credits .col li small {
  display: block; margin-top: 4px;
  font-family: var(--tight); font-weight: 500; font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-500);
}
.s-credits .head-line { position: absolute; top: 150px; left: 120px; font-family: var(--display); font-weight: 700; font-size: 120px; letter-spacing: -0.025em; color: var(--grey-50); line-height: 0.95; }
.s-credits .head-line em { font-family: var(--display); font-style: italic; font-weight: 500; color: var(--grey-300); }

/* ── Manifesto (s-manifesto) ──────────────────────────────────── */
.s-manifesto { padding: 0; }
.s-manifesto .body { position: absolute; inset: 200px 160px; display: flex; align-items: center; }
.s-manifesto .lead { font-family: var(--display); font-weight: 400; font-size: 132px; line-height: 1.0; letter-spacing: -0.025em; color: var(--slide-fg, var(--grey-50)); text-wrap: balance; }
.s-manifesto .lead em { font-style: italic; font-weight: 500; color: var(--slide-accent, var(--grey-300)); }
.s-manifesto .lead b { font-weight: 700; color: var(--slide-fg, var(--grey-100)); }
.s-manifesto .lead .strike { text-decoration: line-through; text-decoration-color: var(--slide-fg, var(--grey-100)); text-decoration-thickness: 4px; color: var(--slide-accent, var(--grey-300)); }

/* ── End slide (s-end) ────────────────────────────────────────── */
.s-end { padding: 0; }
.s-end .core { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.s-end .core .small-1 {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--slide-fg-meta, var(--grey-300)); margin-bottom: 60px; font-weight: 500;
}
.s-end .core .big { font-family: var(--display); font-weight: 800; font-size: 460px; line-height: 0.8; letter-spacing: -0.05em; color: var(--slide-fg, var(--grey-50)); text-transform: uppercase; }
.s-end .core .big em { font-family: var(--display); font-style: italic; font-weight: 500; color: var(--slide-accent, var(--grey-200)); }
.s-end .core .small-2 {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--slide-fg-faint, var(--grey-500)); margin-top: 60px; font-weight: 500;
}
.s-end .core .rule-mid { width: 240px; height: 1px; background: var(--slide-fg-faint, var(--grey-500)); margin: 40px auto; }

/* ── Number / edition (s-number) ──────────────────────────────── */
.s-number { padding: 0; }
.s-number .grid { position: absolute; inset: 100px 80px 90px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 80px; }
.s-number .num { display: flex; flex-direction: column; justify-content: space-between; border-right: 1px solid var(--grey-700); padding-right: 80px; }
.s-number .num .head {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-number .num .big { font-family: var(--display); font-weight: 700; font-size: 600px; line-height: 0.78; letter-spacing: -0.05em; color: var(--grey-50); font-feature-settings: 'tnum'; }
.s-number .num .cap { font-family: var(--text); font-size: 22px; line-height: 1.4; color: var(--grey-200); max-width: 600px; letter-spacing: 0.04em; text-transform: uppercase; }
.s-number .ledger { display: flex; flex-direction: column; justify-content: center; gap: 28px; }
.s-number .ledger .row { display: grid; grid-template-columns: 110px 1fr; gap: 24px; align-items: baseline; padding-bottom: 22px; border-bottom: 1px solid var(--grey-800); }
.s-number .ledger .row .k {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-number .ledger .row .v { font-family: var(--display); font-weight: 500; font-size: 38px; color: var(--grey-50); letter-spacing: -0.005em; }
.s-number .ledger .row .v em { font-style: italic; font-weight: 500; color: var(--grey-300); }

/* ── Wide stamp (s-wide-stamp) ────────────────────────────────── */
.s-wide-stamp { padding: 0; }
.s-wide-stamp .word { position: absolute; left: 80px; right: 80px; top: 50%; transform: translateY(-50%); font-family: var(--wide); font-weight: 800; font-size: 360px; line-height: 0.85; letter-spacing: -0.035em; color: var(--grey-50); text-transform: uppercase; text-align: center; }
.s-wide-stamp .sub { position: absolute; left: 0; right: 0; top: calc(50% + 220px); text-align: center; font-family: var(--tight); font-weight: 400; font-style: italic; font-size: 44px; color: var(--grey-300); letter-spacing: -0.005em; }
.s-wide-stamp .lhs, .s-wide-stamp .rhs {
  position: absolute; top: 50%; transform: translateY(-50%);
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-wide-stamp .lhs { left: 80px; writing-mode: vertical-rl; transform: translateY(-50%) rotate(180deg); }
.s-wide-stamp .rhs { right: 80px; writing-mode: vertical-rl; }

/* ── Tall vertical (s-tall) ───────────────────────────────────── */
.s-tall { padding: 0; display: grid; place-items: center; }
.s-tall .col { font-family: var(--tall); font-weight: 800; line-height: 0.86; letter-spacing: -0.025em; text-transform: uppercase; text-align: center; font-size: 180px; color: var(--grey-50); }
.s-tall .col .a { color: var(--grey-100); }
.s-tall .col .b { color: var(--grey-50); }
.s-tall .col .c { font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-tall .col .d { color: var(--grey-200); font-family: var(--tall); font-weight: 200; }
.s-tall .number { position: absolute; left: 120px; top: 150px; font-family: var(--display); font-weight: 200; font-size: 180px; color: var(--grey-800); line-height: 0.8; letter-spacing: -0.05em; }
.s-tall .label {
  position: absolute; right: 80px; top: 50%; transform: translateY(-50%);
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
  writing-mode: vertical-rl;
}

/* ── Spatial (s-spatial) ──────────────────────────────────────── */
.s-spatial { padding: 0; }
.s-spatial .word { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--spatial); font-weight: 800; font-size: 420px; line-height: 0.8; letter-spacing: -0.06em; color: var(--grey-50); text-transform: uppercase; }
.s-spatial .word em { font-family: var(--spatial); font-style: italic; font-weight: 200; color: var(--grey-300); }
.s-spatial .topkey {
  position: absolute; top: 180px; left: 0; right: 0; text-align: center;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-spatial .botkey {
  position: absolute; bottom: 100px; left: 0; right: 0; text-align: center;
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-500); font-weight: 500; font-style: italic;
}

/* ── Index table (s-index) ────────────────────────────────────── */
.s-index { padding: 0; }
.s-index .head { position: absolute; top: 130px; left: 80px; right: 80px; display: flex; justify-content: space-between; align-items: baseline; font-family: var(--display); font-weight: 700; font-size: 88px; letter-spacing: -0.025em; color: var(--grey-50); }
.s-index .head em { font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-index .head .n {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; color: var(--grey-400); font-weight: 500;
}
.s-index .table { position: absolute; left: 80px; right: 80px; top: 280px; bottom: 110px; display: grid; grid-template-columns: 80px 2.5fr 1fr 1fr 1fr; align-content: start; row-gap: 0; font-family: var(--tight); font-size: 24px; line-height: 1.0; }
.s-index .table .th {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
  padding: 18px 0; border-bottom: 1px solid var(--grey-700);
}
.s-index .table .td { padding: 26px 0; border-bottom: 1px solid var(--grey-800); color: var(--grey-100); font-weight: 400; }
.s-index .table .td.no { color: var(--grey-300); font-family: var(--display); font-weight: 500; font-size: 30px; letter-spacing: -0.01em; }
.s-index .table .td.title { font-family: var(--display); font-weight: 500; font-size: 36px; letter-spacing: -0.015em; color: var(--grey-50); }
.s-index .table .td.title em { font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-index .table .td.dim { color: var(--grey-400); }

/* ── Material duo (s-duo) ─────────────────────────────────────── */
.s-duo { padding: 0; }
.s-duo .grid { position: absolute; inset: 130px 80px 100px; display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
.s-duo .col { position: relative; padding: 40px 60px; display: flex; flex-direction: column; justify-content: space-between; }
.s-duo .col + .col { border-left: 1px solid var(--grey-700); }
.s-duo .col .meta {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-duo .col .word { font-family: var(--tall); font-weight: 800; font-size: 220px; line-height: 0.86; letter-spacing: -0.025em; color: var(--grey-50); text-transform: uppercase; }
.s-duo .col.b .word { font-family: var(--wide); font-weight: 200; font-style: italic; color: var(--grey-200); font-size: 200px; letter-spacing: -0.02em; }
.s-duo .col .desc { font-family: var(--base); font-weight: 300; font-size: 26px; line-height: 1.45; color: var(--grey-300); max-width: 600px; }
.s-duo .col .desc b { color: var(--grey-50); font-weight: 500; }

/* ── Specimen (s-specimen) ────────────────────────────────────── */
.s-specimen { padding: 0; }
.s-specimen .head { position: absolute; top: 130px; left: 80px; font-family: var(--display); font-weight: 700; font-size: 88px; letter-spacing: -0.025em; color: var(--grey-50); }
.s-specimen .head em { font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-specimen .rows { position: absolute; left: 80px; right: 80px; top: 280px; bottom: 110px; display: grid; grid-template-rows: repeat(5, 1fr); }
.s-specimen .row { display: grid; grid-template-columns: 200px 1fr; align-items: center; gap: 40px; border-top: 1px solid var(--grey-800); }
.s-specimen .row:last-child { border-bottom: 1px solid var(--grey-800); }
.s-specimen .row .k {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
}
.s-specimen .row .v { color: var(--grey-50); white-space: nowrap; overflow: hidden; }
.s-specimen .r1 .v { font-family: var(--display); font-weight: 800; font-size: 96px; letter-spacing: -0.03em; }
.s-specimen .r2 .v { font-family: var(--tight); font-weight: 200; font-style: italic; font-size: 96px; letter-spacing: -0.015em; color: var(--grey-300); }
.s-specimen .r3 .v { font-family: var(--wide); font-weight: 600; font-size: 88px; letter-spacing: -0.025em; }
.s-specimen .r4 .v { font-family: var(--tall); font-weight: 500; font-size: 96px; letter-spacing: -0.02em; color: var(--grey-200); }
.s-specimen .r5 .v { font-family: var(--spatial); font-weight: 700; font-size: 96px; letter-spacing: -0.04em; }

/* ── Contrast (s-contrast) ────────────────────────────────────── */
.s-contrast { padding: 0; }
.s-contrast .lead { position: absolute; left: 80px; right: 80px; top: 160px; font-family: var(--display); font-weight: 200; font-size: 150px; line-height: 0.95; letter-spacing: -0.02em; color: var(--grey-50); text-wrap: balance; }
.s-contrast .lead em { font-style: italic; font-weight: 400; color: var(--grey-300); }
.s-contrast .sig { position: absolute; left: 80px; right: 80px; bottom: 130px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 60px; padding-top: 40px; border-top: 1px solid var(--grey-800); }
.s-contrast .sig .item .k {
  font-family: var(--tight); font-size: 16px; letter-spacing: 0.1em;
  line-height: 100%; text-transform: uppercase; color: var(--grey-400); font-weight: 500;
  margin-bottom: 14px;
}
.s-contrast .sig .item .v { font-family: var(--base); font-weight: 400; font-size: 30px; line-height: 1.35; color: var(--grey-100); letter-spacing: -0.005em; }
.s-contrast .sig .item .v em { font-family: var(--base); font-style: italic; font-weight: 400; color: var(--grey-300); }

/* ── Inline embed (sized to parent width, aspect-ratio kept) ──── */
.runway-deck-inline {
  position: relative;
  width: 100%;
  aspect-ratio: 1920 / 1080;
  overflow: hidden;
  background: #000;
  border-radius: 4px;
  isolation: isolate;
}
.runway-deck-inline .runway-deck-stage {
  position: absolute; top: 0; left: 0;
  width: 1920px; height: 1080px;
  transform-origin: top left;
}
.runway-deck-inline-counter {
  position: absolute; top: 12px; left: 16px; z-index: 5;
  font-family: var(--kol-font-family-mono);
  font-size: 11px; letter-spacing: 0.3em;
  color: rgba(245, 245, 245, 0.7);
}
/* Reusable arrow button — same visual treatment as .kol-sidenav-toggle (small
   round, themed border, themed bg). One class for both inline + fullscreen
   variants, position/size deltas applied via the variant modifiers. */
.runway-deck-arrow {
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--kol-surface-primary);
  border: 1px solid var(--kol-border-default);
  color: var(--kol-fg-48);
  cursor: pointer; padding: 0;
  border-radius: 999px;
  transition: color 150ms ease, border-color 150ms ease, opacity 150ms ease;
}
.runway-deck-arrow:hover { color: var(--kol-surface-on-primary); border-color: var(--kol-fg-24); }
.runway-deck-arrow:disabled { opacity: 0.25; cursor: not-allowed; }

.runway-deck-arrow--inline-prev,
.runway-deck-arrow--inline-next {
  position: absolute; top: 50%; transform: translateY(-50%); z-index: 5;
  width: 32px; height: 32px;
}
.runway-deck-arrow--inline-prev { left: 12px; }
.runway-deck-arrow--inline-next { right: 12px; }

/* ── Fullscreen UI (controls / counter / exit) ────────────────── */
.runway-deck-ui {
  position: fixed; z-index: 110;
  font-family: var(--kol-font-family-mono);
  color: rgba(245, 245, 245, 0.8); user-select: none;
}
.runway-deck-ui--counter { top: 24px; left: 24px; font-size: 12px; letter-spacing: 0.3em; }
.runway-deck-ui--exit    { top: 20px; right: 24px; font-size: 12px; letter-spacing: 0.3em; cursor: pointer; background: transparent; border: 1px solid rgba(245, 245, 245, 0.2); padding: 8px 14px; border-radius: 999px; text-transform: uppercase; }
.runway-deck-ui--exit:hover { color: #fff; border-color: rgba(245, 245, 245, 0.5); }
.runway-deck-arrow--fs-prev,
.runway-deck-arrow--fs-next {
  position: fixed; bottom: 24px; z-index: 110;
  width: 32px; height: 32px;
}
.runway-deck-arrow--fs-prev { left: 24px; }
.runway-deck-arrow--fs-next { right: 24px; }
`

injectOnce(SHARED)
