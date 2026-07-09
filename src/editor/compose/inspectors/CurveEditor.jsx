import { useEffect, useState } from 'react'
import { Dropdown, Input, LabeledControl } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { NumberField } from './NumberField'
import { CLIPS, CURVE_KINDS, defaultCustomFor, forkClipDef } from '../../../loops/math/curves'
import { isValidVars } from '../../../loops/math/mathfn'

/**
 * CurveEditor — curve authoring for the math-curves loop (port of labs
 * uzumaki CurveControls: kind picker, per-kind ranges + expressions, the
 * epicycle term list). Renders under the Parameters panel's Style tab for
 * math-curves layers.
 *
 * Fork-on-edit: while the layer shows a stock clip, the editor displays that
 * clip's def (expressions from the clip table's `src` strings); the FIRST
 * commit writes `{ clip: 'custom', custom: <forked def> }` into the layer —
 * the shared CLIPS table is never mutated. The fork also seeds the layer's
 * copies/spiral params from the stock clip's authored mod (unless the user
 * already moved them), so a forked Mandala keeps its six copies.
 *
 * Expressions are strings compiled by loops/math/mathfn (variables: polar
 * r(th) · parametric x/y/z(t) · points a/r(k)). A string that doesn't
 * compile is still committed — the loop keeps rendering its last good fn —
 * and the field shows a "doesn't compile" hint until fixed.
 */

const num = (v, fb) => { const n = Number(v); return Number.isFinite(n) ? n : fb }

/* Draft/commit text input for an expression (the NumberField idiom, mono). */
function ExprField({ label, value, args, onCommit }) {
  const [draft, setDraft] = useState(value ?? '')
  useEffect(() => { setDraft(value ?? '') }, [value])
  const bad = String(draft).trim() !== '' && !isValidVars(draft, args)
  return (
    <LabeledControl label={label} hint={bad ? 'doesn’t compile — last good kept' : undefined}>
      <Input
        variant="filled" size="sm" className="w-full"
        style={{ fontFamily: 'var(--kol-font-mono, monospace)', fontVariantLigatures: 'none' }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { if (draft !== value) onCommit(draft) }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      />
    </LabeledControl>
  )
}

/* Start/end of the curve's parameter range (labs RangeFields). */
function RangeFields({ def, commit }) {
  const [a, b] = def.range || [0, 1]
  return (
    <div className="grid grid-cols-2 gap-2">
      <LabeledControl label="Start">
        <NumberField variant="filled" size="sm" value={a} onCommit={(v) => commit({ range: [num(v, a), b] })} />
      </LabeledControl>
      <LabeledControl label="End">
        <NumberField variant="filled" size="sm" value={b} onCommit={(v) => commit({ range: [a, num(v, b)] })} />
      </LabeledControl>
    </div>
  )
}

/* Epicycle = a sum of rotating vectors; each term {amp, freq, phase} is one
 * vector (labs TermsEditor — add/remove terms = the vector array). */
function TermsEditor({ def, commit }) {
  const terms = def.terms || []
  const setTerm = (i, key, v) =>
    commit({ terms: terms.map((tm, j) => (j === i ? { ...tm, [key]: v } : tm)) })
  const addTerm = () => commit({ terms: [...terms, { amp: 0.5, freq: 2, phase: 0 }] })
  const removeTerm = (i) => commit({ terms: terms.filter((_, j) => j !== i) })
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="kol-helper-10 text-meta">Vectors</span>
        <EditorButton variant="secondary" size="sm" onClick={addTerm}>Add</EditorButton>
      </div>
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1.5 items-center min-w-0 [&>*]:min-w-0">
        <span className="kol-helper-10 text-fg-48 text-center">amp</span>
        <span className="kol-helper-10 text-fg-48 text-center">freq</span>
        <span className="kol-helper-10 text-fg-48 text-center">phase</span>
        <span />
        {terms.map((tm, i) => (
          <TermRow
            key={i}
            term={tm}
            onSet={(k, v) => setTerm(i, k, v)}
            onRemove={() => removeTerm(i)}
            canRemove={terms.length > 1}
          />
        ))}
      </div>
    </div>
  )
}

function TermRow({ term, onSet, onRemove, canRemove }) {
  const cell = (key, fallback) => (
    <NumberField
      variant="filled" size="sm"
      value={term[key] ?? fallback}
      onCommit={(v) => onSet(key, num(v, term[key] ?? fallback))}
    />
  )
  return (
    <>
      {cell('amp', 1)}
      {cell('freq', 1)}
      {cell('phase', 0)}
      <EditorButton variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove} aria-label="Remove vector">×</EditorButton>
    </>
  )
}

export default function CurveEditor({ layer, patch }) {
  const isCustom = layer.clip === 'custom'
  const fork = isCustom ? null : forkClipDef(layer.clip)
  const def = isCustom ? (layer.custom ?? defaultCustomFor('polar')) : fork.def
  const kind = def.kind || 'polar'

  /* Any commit forks a stock clip to 'custom' in the layer's params. */
  const commit = (defPatch) => {
    const extra = {}
    if (!isCustom) {
      extra.clip = 'custom'
      if ((layer.copies ?? 1) <= 1 && fork.copies > 1) extra.copies = fork.copies
      if (!(layer.spiral > 0) && fork.spiral > 0) extra.spiral = fork.spiral
    }
    patch({ ...extra, custom: { ...def, ...defPatch } })
  }
  /* Kind switch replaces the whole def with that kind's defaults (labs onKind). */
  const setKind = (k) => {
    if (k === kind) return
    patch({ clip: 'custom', custom: defaultCustomFor(k) })
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="kol-helper-10 text-meta">Curve</span>
      <Dropdown size="sm" variant="subtle" className="w-full" options={CURVE_KINDS} value={kind} onChange={setKind} />
      {!isCustom && (
        <p className="kol-helper-10 text-meta">
          Editing “{(CLIPS.find((c) => c.id === layer.clip) || CLIPS[0]).label}” forks it to a custom curve.
        </p>
      )}

      {kind === 'epicycle' && (
        <>
          <LabeledControl label="Turns">
            <NumberField variant="filled" size="sm" value={def.turns ?? 1} onCommit={(v) => commit({ turns: num(v, def.turns ?? 1) })} />
          </LabeledControl>
          <TermsEditor def={def} commit={commit} />
        </>
      )}

      {kind === 'polar' && (
        <>
          <RangeFields def={def} commit={commit} />
          <ExprField label="r(th)" value={def.r} args={['th']} onCommit={(v) => commit({ r: v })} />
        </>
      )}

      {(kind === 'param2d' || kind === 'param3d') && (
        <>
          <RangeFields def={def} commit={commit} />
          <ExprField label="x(t)" value={def.x} args={['t']} onCommit={(v) => commit({ x: v })} />
          <ExprField label="y(t)" value={def.y} args={['t']} onCommit={(v) => commit({ y: v })} />
          {kind === 'param3d' && (
            <ExprField label="z(t)" value={def.z} args={['t']} onCommit={(v) => commit({ z: v })} />
          )}
        </>
      )}

      {kind === 'points' && (
        <>
          <LabeledControl label="Count">
            <NumberField variant="filled" size="sm" value={def.count ?? 1400} onCommit={(v) => commit({ count: Math.max(1, Math.round(num(v, def.count ?? 1400))) })} />
          </LabeledControl>
          <ExprField label="a(k)" value={def.a} args={['k']} onCommit={(v) => commit({ a: v })} />
          <ExprField label="r(k)" value={def.r} args={['k']} onCommit={(v) => commit({ r: v })} />
        </>
      )}

      {kind === 'maurer' && (
        <div className="grid grid-cols-2 gap-2">
          <LabeledControl label="n">
            <NumberField variant="filled" size="sm" value={def.n ?? 6} onCommit={(v) => commit({ n: num(v, def.n ?? 6) })} />
          </LabeledControl>
          <LabeledControl label="d°">
            <NumberField variant="filled" size="sm" value={def.d ?? 71} onCommit={(v) => commit({ d: num(v, def.d ?? 71) })} />
          </LabeledControl>
        </div>
      )}
    </div>
  )
}
