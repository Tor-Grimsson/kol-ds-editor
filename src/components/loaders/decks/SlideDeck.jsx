import usePageTitle from '../../hooks/usePageTitle'
import DeckShell from './DeckShell'
import { fgOn } from '../../../editor/modes/palette/palettes'

/**
 * SlideDeck — 14-slide typographic deck.
 *
 * The deck renders all 14 slides in greyscale (no palette), via DeckShell.
 * The 3 palette-aware slides (Cover, Manifesto, End) are also exported
 * individually for combo-lab / social / compose use, where they accept a
 * palette and render in branded mode. Same JSX, same scoped CSS — the only
 * difference is whether the consumer injects palette CSS vars.
 *
 * Origin: deduped merge of the V1–V4 Runway decks (2026-05-01).
 * Shared CSS in deckStyles.js. Embla carousel via DeckShell.
 */
export default function SlideDeck({ inline = false }) {
  if (!inline) usePageTitle('Slide deck')
  return (
    <DeckShell total={14} inline={inline}>
      <SlideCover />
      <SlideWideStamp />
      <SlideNumber />
      <SlideTall />
      <SlideManifesto footIndex={5} />
      <SlideSpatial />
      <SlideLook />
      <SlideQuote />
      <SlideIndex />
      <SlideDuo />
      <SlideSpecimen />
      <SlideContrast />
      <SlideCredits />
      <SlideEnd footIndex={14} />
    </DeckShell>
  )
}

/* ─── Palette → CSS-var helpers ─────────────────────────────────
 * Each palette-aware slide computes its own bg / fg / accent mapping from
 * palette role-colors. Greyscale fallback comes from the CSS via grey-*
 * defaults — so when no palette is passed, no vars are set and the deck
 * renders in its original greyscale chrome. */

function dimVars(fg) {
  return {
    '--slide-fg-meta':  `color-mix(in srgb, ${fg} 55%, transparent)`,
    '--slide-fg-faint': `color-mix(in srgb, ${fg} 40%, transparent)`,
  }
}

function coverVars(palette) {
  if (!palette) return undefined
  const fg = fgOn(palette.primary)
  return {
    '--slide-bg':     palette.primary,
    '--slide-fg':     fg,
    '--slide-accent': palette.light,
    ...dimVars(fg),
  }
}

function manifestoVars(palette) {
  if (!palette) return undefined
  const { light, dark, accent } = palette
  return {
    '--slide-bg':     light,
    '--slide-fg':     dark,
    '--slide-accent': accent,
    ...dimVars(dark),
  }
}

function endVars(palette) {
  if (!palette) return undefined
  const { dark, light, accent } = palette
  const fg = fgOn(dark)
  return {
    '--slide-bg':     dark,
    '--slide-fg':     fg,
    '--slide-accent': accent ?? light,
    ...dimVars(fg),
  }
}

const fmt = (n) => String(n).padStart(2, '0')

/* ─── Slides ────────────────────────────────────────────────── */

export function SlideCover({ palette }) {
  return (
    <section className="s-cover" style={coverVars(palette)}>
      <div className="topbar">
        <span>Kolkrabbi Vinnustofa</span>
        <span className="mark">KV</span>
        <span>Reykjavík · 2026</span>
      </div>
      <div className="stack">
        <div className="l1">Kolkrabbi</div>
        <div className="l2">Vinnustofa</div>
        <div className="l3">no. one</div>
      </div>
      <div className="meta-l">Spring · Summer<br />Twenty Twenty-Six</div>
      <div className="meta-r">A Collection<br />In Twenty-Four Editions</div>
    </section>
  )
}

function SlideWideStamp() {
  return (
    <section className="s-wide-stamp">
      <div className="eyebrow">
        <div className="l"><span>Chapter I</span><span className="dot" /><span>The Position</span></div>
        <div className="r"><span>SS · 26</span></div>
      </div>
      <div className="lhs">A Counter · Proposal</div>
      <div className="word">SLOW</div>
      <div className="sub">— is also a kind of speed.</div>
      <div className="rhs">Made in Iceland · By Hand</div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>02 / 14</span></div>
    </section>
  )
}

function SlideNumber() {
  return (
    <section className="s-number">
      <div className="eyebrow">
        <div className="l"><span>Chapter II</span><span className="dot" /><span>The Edition</span></div>
        <div className="r"><span>Limit · 24</span></div>
      </div>
      <div className="grid">
        <div className="num">
          <div className="head">Edition Size</div>
          <div className="big"><span>24</span></div>
          <div className="cap">Twenty-four pieces. Numbered, signed, retired. No reissue.</div>
        </div>
        <div className="ledger">
          <div className="row"><span className="k">Cut by</span><span className="v">One pair of hands<em>.</em></span></div>
          <div className="row"><span className="k">Stitched in</span><span className="v">Reykjavík, IS</span></div>
          <div className="row"><span className="k">Linen from</span><span className="v"><em>Libeco</em>, Belgium</span></div>
          <div className="row"><span className="k">Buttons</span><span className="v">Italian horn</span></div>
          <div className="row"><span className="k">Lining</span><span className="v">Como silk</span></div>
          <div className="row"><span className="k">Per piece</span><span className="v">42 hours<em> · avg.</em></span></div>
        </div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>03 / 14</span></div>
    </section>
  )
}

function SlideTall() {
  return (
    <section className="s-tall">
      <div className="eyebrow">
        <div className="l"><span>Chapter III</span><span className="dot" /><span>The Question</span></div>
        <div className="r"><span>Why So Much, So Fast?</span></div>
      </div>
      <div className="number">02</div>
      <div className="col">
        <div className="a">Why so</div>
        <div className="b">much</div>
        <div className="c">so fast,</div>
        <div className="d">when none of it</div>
        <div className="b">lasts<span className="c">.</span></div>
      </div>
      <div className="label">Tall · Mixed Weights</div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>04 / 14</span></div>
    </section>
  )
}

export function SlideManifesto({ palette, footIndex, footTotal = 14 }) {
  return (
    <section className="s-manifesto" style={manifestoVars(palette)}>
      <div className="eyebrow">
        <div className="l"><span>Chapter IV</span><span className="dot" /><span>A Position</span></div>
        <div className="r"><span>The Line We Keep</span></div>
      </div>
      <div className="body">
        <div className="lead">
          We make <em>few</em> things, slowly, and we <b>sign</b> every one. <span className="strike">Mass</span> is not <em>a method</em> we know.
        </div>
      </div>
      {footIndex && (
        <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>{fmt(footIndex)} / {fmt(footTotal)}</span></div>
      )}
    </section>
  )
}

function SlideSpatial() {
  return (
    <section className="s-spatial">
      <div className="eyebrow">
        <div className="l"><span>Chapter V</span><span className="dot" /><span>The Word</span></div>
        <div className="r"><span>Hold This One</span></div>
      </div>
      <div className="word">last<em>.</em></div>
      <div className="botkey">Verb · Adjective · Promise</div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>06 / 14</span></div>
    </section>
  )
}

function SlideLook() {
  return (
    <section className="s-look">
      <div className="eyebrow">
        <div className="l"><span>Chapter VI</span><span className="dot" /><span>The Mark</span></div>
        <div className="r"><span>Maker's Signature</span></div>
      </div>
      <div className="frame"><div className="mono">K<em>V</em></div></div>
      <div className="corners"><i /></div>
      <div className="caption"><span>The monogram, hand-drawn 2024</span><span>07 / 14</span></div>
    </section>
  )
}

function SlideQuote() {
  return (
    <section className="s-quote">
      <div className="eyebrow">
        <div className="l"><span>Chapter VII</span><span className="dot" /><span>From the Studio</span></div>
        <div className="r"><span>Note · 2024</span></div>
      </div>
      <div className="open">"</div>
      <div className="body">
        <q>I do not believe in fashion. I believe in <em>making the same coat</em> better, every winter, until I die.</q>
        <div className="attr"><span className="line" /><span>Yr Þrastardóttir · Founder</span></div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>08 / 14</span></div>
    </section>
  )
}

function SlideIndex() {
  const rows = [
    ['01', <>The <em>Long</em> Coat</>,        'Linen · Belgium',  '58 hrs', '24 / 24'],
    ['02', 'The Soft Shirt',                    'Cotton · Japan',   '26 hrs', '24 / 24'],
    ['03', <>A Trouser, <em>Cut Wide</em></>,   'Wool · Yorkshire', '38 hrs', '24 / 24'],
    ['04', 'The Quiet Dress',                   'Silk · Como',      '44 hrs', '24 / 24'],
    ['05', <>A Knit, <em>by Hand</em></>,       'Wool · Iceland',   '62 hrs', '24 / 24'],
    ['06', 'The Last Jacket',                    'Linen · Belgium',  '52 hrs', '24 / 24'],
  ]
  return (
    <section className="s-index">
      <div className="eyebrow">
        <div className="l"><span>Chapter VIII</span><span className="dot" /><span>The Index</span></div>
        <div className="r"><span>Six Pieces, Each in Twenty-Four</span></div>
      </div>
      <div className="head">
        <span>The <em>Pieces.</em></span>
        <span className="n">Six Styles · Edition of Twenty-Four</span>
      </div>
      <div className="table">
        <div className="th">No.</div>
        <div className="th">Title</div>
        <div className="th">Material</div>
        <div className="th">Hours</div>
        <div className="th">Edition</div>
        {rows.map(([no, title, mat, hrs, ed], i) => (
          <Row key={i} no={no} title={title} mat={mat} hrs={hrs} ed={ed} />
        ))}
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>09 / 14</span></div>
    </section>
  )
}

function Row({ no, title, mat, hrs, ed }) {
  return (
    <>
      <div className="td no">{no}</div>
      <div className="td title">{title}</div>
      <div className="td dim">{mat}</div>
      <div className="td dim">{hrs}</div>
      <div className="td dim">{ed}</div>
    </>
  )
}

function SlideDuo() {
  return (
    <section className="s-duo">
      <div className="eyebrow">
        <div className="l"><span>Chapter IX</span><span className="dot" /><span>Two Materials</span></div>
        <div className="r"><span>Linen · Wool</span></div>
      </div>
      <div className="grid">
        <div className="col a">
          <div className="meta">Primary · 01</div>
          <div className="word">linen</div>
          <div className="desc"><b>Libeco, Belgium.</b> A fifth-generation mill on the Lys river, where the long-staple flax is dew-retted in the same fields it grows.</div>
        </div>
        <div className="col b">
          <div className="meta">Counterweight · 02</div>
          <div className="word">wool.</div>
          <div className="desc"><b>Iceland.</b> Native lopi from the unmixed fleece of the Icelandic sheep — finer outer, warm inner — spun a single time, knit by hand.</div>
        </div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>10 / 14</span></div>
    </section>
  )
}

function SlideSpecimen() {
  return (
    <section className="s-specimen">
      <div className="eyebrow">
        <div className="l"><span>Chapter X</span><span className="dot" /><span>The Alphabet</span></div>
        <div className="r"><span>One Family · Five Voices</span></div>
      </div>
      <div className="head">A House <em>Voice.</em></div>
      <div className="rows">
        <div className="row r1"><span className="k">Display · Narrow</span><span className="v">KOLKRABBI VINNUSTOFA</span></div>
        <div className="row r2"><span className="k">Editorial · Tight</span><span className="v"><em>made by hand · signed by name</em></span></div>
        <div className="row r3"><span className="k">Title · Wide</span><span className="v">SS · 26</span></div>
        <div className="row r4"><span className="k">Headline · Tall</span><span className="v">slow is also a speed</span></div>
        <div className="row r5"><span className="k">Display · Spatial</span><span className="v">last.</span></div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>11 / 14</span></div>
    </section>
  )
}

function SlideContrast() {
  return (
    <section className="s-contrast">
      <div className="eyebrow">
        <div className="l"><span>Chapter XI</span><span className="dot" /><span>The Promise</span></div>
        <div className="r"><span>What We Sign For</span></div>
      </div>
      <div className="lead">
        A garment that <em>outlives</em> the season<br />and the <em>wearer</em>, both.
      </div>
      <div className="sig">
        <div className="item"><div className="k">Numbered</div><div className="v">By hand, in red ink, on the inside seam — <em>1 of 24</em>.</div></div>
        <div className="item"><div className="k">Signed</div><div className="v">By the cutter, on a linen tag — <em>so you know whose hand</em>.</div></div>
        <div className="item"><div className="k">Repaired</div><div className="v">For the life of the piece. Send it back. We send it forward.</div></div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>12 / 14</span></div>
    </section>
  )
}

function SlideCredits() {
  return (
    <section className="s-credits">
      <div className="eyebrow">
        <div className="l"><span>Chapter XII</span><span className="dot" /><span>The Colophon</span></div>
        <div className="r"><span>Credits</span></div>
      </div>
      <div className="head-line">A Small <em>House.</em></div>
      <div className="grid">
        <div className="col">
          <h4>Studio</h4>
          <ul>
            <li>Yr Þrastardóttir<small>Founder · Cutter</small></li>
            <li>Sól Eiríksdóttir<small>Atelier</small></li>
            <li>Hrafn Jónsson<small>Atelier</small></li>
          </ul>
        </div>
        <div className="col">
          <h4>Materials</h4>
          <ul>
            <li>Libeco<small>Linen · Belgium</small></li>
            <li>Buttoneria Milanese<small>Horn · Italy</small></li>
            <li>Mantero<small>Silk · Como</small></li>
          </ul>
        </div>
        <div className="col">
          <h4>This Edition</h4>
          <ul>
            <li>SS · 26<small>Spring / Summer 2026</small></li>
            <li>24 Pieces<small>Per Style</small></li>
            <li>Numbered<small>By Hand · In Red Ink</small></li>
          </ul>
        </div>
      </div>
      <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>13 / 14</span></div>
    </section>
  )
}

export function SlideEnd({ palette, footIndex, footTotal = 14 }) {
  return (
    <section className="s-end" style={endVars(palette)}>
      <div className="eyebrow">
        <div className="l"><span>End</span><span className="dot" /><span>Thank You</span></div>
        <div className="r"><span>Reykjavík · 2026</span></div>
      </div>
      <div className="core">
        <div>
          <div className="small-1">Made by Hand · Signed by Name</div>
          <div className="big">K<em>V</em></div>
          <div className="rule-mid" />
          <div className="small-2">kolkrabbi · com</div>
        </div>
      </div>
      {footIndex && (
        <div className="foot"><span>Kolkrabbi Vinnustofa</span><span>{fmt(footIndex)} / {fmt(footTotal)}</span></div>
      )}
    </section>
  )
}
