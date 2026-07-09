import { useEffect, useRef, useState } from 'react'
import { Input, Slider, LabeledControl, ViewToggle } from '@kolkrabbi/kol-component'
import { getSource } from './sources'
import { learnCC } from './midi'
import { learnGamepad, isGamepadSource } from './gamepad'
import { isBinding } from './resolve'
import { compileExpr } from './expr'
import { transport } from './transport'

/**
 * ModulationEditor — the transform editor for ONE bound param (range / invert /
 * smooth / curve, plus source-specific rate·phase, expression field + plot, or
 * MIDI/gamepad learn). Lifted OUT of the BindDot popover (which overflowed the
 * viewport) into the Parameters → Animation tab, where it has room. The dot is
 * now a pure source picker; this is where you shape the signal.
 *
 * Self-contained: reads the binding off `layer[param.key]`, writes through
 * `setProp` (undo-safe). Renders nothing unless the param is bound to a source.
 */

/* Click-to-fill examples for the expression source — best of labs'
 * oscilloscope reference list, limited to strings that stay in 0..1. */
const EXPR_EXAMPLES = [
  { code: 'wave(t*2)',    desc: 'Fast sine' },
  { code: 'saw(t)*0.8',   desc: 'Ramp to 80' },
  { code: 'tri(t*0.5)',   desc: 'Slow bounce' },
  { code: 'pulse(t, 0.3)', desc: 'PWM 30%' },
  { code: 'ease(t*2, 4)', desc: 'Fast + punchy' },
  { code: 'bell(t)',      desc: 'Bell curve' },
  { code: 'step(t, 4)',   desc: '4 steps' },
  { code: 'rand()',       desc: 'Noise' },
]

/* ── ExprPlot — oscilloscope-lite. Plots the expression over ONE LOOP with
 * grid rails at the curve's min/mid/max, dashed 0/1 clamp rails, a playhead at
 * the transport's loop phase, and the current-value dot. Redraws per rAF so
 * audio/rand expressions animate live; colours follow the editor theme. */
const PLOT_W = 196
const PLOT_H = 64
function ExprPlot({ expr }) {
  const ref = useRef(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return undefined
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = PLOT_W * dpr
    cv.height = PLOT_H * dpr
    const ctx = cv.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    let raf = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const cs = getComputedStyle(cv)
      const accent = cs.getPropertyValue('--kol-accent-primary').trim() || '#2dd4bf'
      const fg = cs.color || 'rgb(160,160,160)'
      const c = compileExpr(expr)
      const secs = transport.getLoopSeconds()
      const u = transport.getCtx().t ?? 0
      const pad = 6
      const innerW = PLOT_W - pad * 2
      const innerH = PLOT_H - pad * 2

      ctx.clearRect(0, 0, PLOT_W, PLOT_H)

      const N = innerW
      const vs = new Float64Array(N + 1)
      let vMin = Infinity
      let vMax = -Infinity
      for (let i = 0; i <= N; i++) {
        const v = c.ok ? c.fn((i / N) * secs) : 0
        vs[i] = v
        if (v < vMin) vMin = v
        if (v > vMax) vMax = v
      }
      const vMid = (vMin + vMax) / 2
      const lo = Math.min(vMin, 0)
      const hi = Math.max(vMax, 1)
      const span = (hi - lo) || 1
      const toY = (v) => pad + innerH * (1 - (v - lo) / span)
      const toX = (i) => pad + (i / N) * innerW

      ctx.strokeStyle = 'rgba(231,76,60,0.35)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      for (const v of [0, 1]) {
        const y = toY(v)
        ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(PLOT_W - pad, y); ctx.stroke()
      }
      ctx.setLineDash([])

      if (c.ok) {
        ctx.font = '8px var(--kol-font-mono, monospace)'
        ctx.strokeStyle = fg
        ctx.fillStyle = fg
        for (const v of [vMax, vMid, vMin]) {
          const y = toY(v)
          ctx.globalAlpha = 0.12
          ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(PLOT_W - pad, y); ctx.stroke()
          ctx.globalAlpha = 0.5
          ctx.fillText(v.toFixed(2), pad + 2, y - 2)
        }
        ctx.globalAlpha = 1

        const curve = (endI) => {
          ctx.beginPath()
          for (let i = 0; i <= endI; i++) {
            const y = toY(vs[i])
            if (i === 0) ctx.moveTo(toX(0), y)
            else ctx.lineTo(toX(i), y)
          }
          ctx.stroke()
        }
        ctx.strokeStyle = accent
        ctx.lineWidth = 1
        ctx.globalAlpha = 0.25
        curve(N)

        const px2 = pad + u * innerW
        ctx.globalAlpha = 0.4
        ctx.beginPath(); ctx.moveTo(px2, pad); ctx.lineTo(px2, PLOT_H - pad); ctx.stroke()

        ctx.globalAlpha = 1
        ctx.lineWidth = 1.5
        curve(Math.round(u * N))

        ctx.fillStyle = accent
        ctx.beginPath()
        ctx.arc(px2, toY(c.fn(u * secs)), 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [expr])
  return (
    <canvas
      ref={ref}
      aria-label="Expression plot over one loop"
      style={{ width: PLOT_W, height: PLOT_H, display: 'block', borderRadius: 3, background: 'var(--kol-fg-04, rgba(128,128,128,0.06))' }}
    />
  )
}

export function ModulationEditor({ layer, param, setProp }) {
  const value = layer[param.key]
  const [exprDraft, setExprDraft] = useState(null)
  const [learning, setLearning] = useState(false)
  const [padLearning, setPadLearning] = useState(false)

  if (!isBinding(value) || value.bind !== 'mod') return null

  const source = value.source
  const tr = value.transform ?? {}
  const isLfo = source.startsWith('lfo-')
  const isMidi = source === 'midi'
  const isGamepad = isGamepadSource(source)
  const isExpr = source === 'expr'
  const exprStr = tr.expr ?? 'wave(t)'

  const patchTransform = (patch) => setProp(param.key, { ...value, transform: { ...tr, ...patch } })
  const commitExpr = (str) => {
    setExprDraft(null)
    const s = String(str).trim()
    if (s && s !== exprStr) patchTransform({ expr: s })
  }
  const onLearn = async () => {
    setLearning(true)
    const cc = await learnCC()
    setLearning(false)
    if (cc != null) patchTransform({ cc })
  }
  const onPadLearn = async () => {
    setPadLearning(true)
    const id = await learnGamepad()
    setPadLearning(false)
    if (id) setProp(param.key, { ...value, source: id })
  }

  const defaultRange = () => (param.min != null && param.max != null ? [param.min, param.max] : [0, 1])
  const range = tr.range ?? defaultRange()
  const num = (v, fallback) => { const n = Number(v); return Number.isFinite(n) ? n : fallback }

  return (
    <div className="flex flex-col gap-3">
      <LabeledControl label="Range">
        <div className="flex items-center gap-2">
          <Input
            variant="filled" size="sm" type="number" chars={5}
            value={range[0]}
            onChange={(e) => patchTransform({ range: [num(e.target.value, range[0]), range[1]] })}
          />
          <span className="kol-helper-10 text-meta">to</span>
          <Input
            variant="filled" size="sm" type="number" chars={5}
            value={range[1]}
            onChange={(e) => patchTransform({ range: [range[0], num(e.target.value, range[1])] })}
          />
        </div>
      </LabeledControl>
      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Invert">
          <ViewToggle
            options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
            viewMode={tr?.invert ? 'on' : 'off'}
            onViewChange={(v) => patchTransform({ invert: v === 'on' })}
          />
        </LabeledControl>
        <LabeledControl label="Smooth">
          <Slider min={0} max={0.95} step={0.05} value={tr?.smooth ?? 0} onChange={(v) => patchTransform({ smooth: v })} />
        </LabeledControl>
      </div>
      <LabeledControl label="Curve">
        <Slider min={0.25} max={4} step={0.05} value={tr?.curve ?? 1} onChange={(v) => patchTransform({ curve: v })} />
      </LabeledControl>
      {isLfo && (
        <div className="grid grid-cols-2 gap-2">
          <LabeledControl label="Rate · cycles">
            <Slider min={0.25} max={16} step={0.25} value={tr?.rate ?? 1} onChange={(v) => patchTransform({ rate: v })} />
          </LabeledControl>
          <LabeledControl label="Phase">
            <Slider min={0} max={1} step={0.01} value={tr?.phase ?? 0} onChange={(v) => patchTransform({ phase: v })} />
          </LabeledControl>
        </div>
      )}
      {isExpr && (
        <>
          <LabeledControl label="Expression">
            <Input
              variant="ghost" size="sm"
              value={exprDraft ?? exprStr}
              onChange={(e) => setExprDraft(e.target.value)}
              onBlur={(e) => commitExpr(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            />
          </LabeledControl>
          <ExprPlot expr={exprStr} />
          <div className="flex flex-col">
            {EXPR_EXAMPLES.map((ex) => (
              <button
                key={ex.code}
                type="button"
                onClick={() => patchTransform({ expr: ex.code })}
                className="w-full kol-helper-10 h-6 inline-flex items-center gap-2 text-body hover:text-emphasis text-left"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontVariantLigatures: 'none' }}
              >
                <span className="truncate" style={{ fontFamily: 'var(--kol-font-mono, monospace)' }}>{ex.code}</span>
                <span className="flex-1 text-right text-meta truncate">{ex.desc}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {isMidi && (
        <LabeledControl label={tr?.cc != null ? `MIDI · CC ${tr.cc}` : 'MIDI · no CC yet'}>
          <button
            type="button"
            onClick={onLearn}
            className="kol-helper-12 px-2 py-1 rounded border border-fg-08 text-body hover:text-emphasis"
            style={{ background: 'transparent', cursor: 'pointer' }}
          >
            {learning ? 'Move a knob…' : 'Learn'}
          </button>
        </LabeledControl>
      )}
      {isGamepad && (
        <LabeledControl label={getSource(source)?.label ?? 'Gamepad'}>
          <button
            type="button"
            onClick={onPadLearn}
            className="kol-helper-12 px-2 py-1 rounded border border-fg-08 text-body hover:text-emphasis"
            style={{ background: 'transparent', cursor: 'pointer' }}
          >
            {padLearning ? 'Move a control…' : 'Learn'}
          </button>
        </LabeledControl>
      )}
    </div>
  )
}

/**
 * ModulationList — every param on the layer that's bound to a source, each with
 * its ModulationEditor. This is the Animation tab's modulation surface: pick a
 * source at the dot, shape it here. Keyframe bindings (bind:'track') are edited
 * in the timeline, not listed here.
 */
export function ModulationList({ layer, schema, setProp }) {
  const bound = (schema ?? []).filter((p) => {
    const v = layer[p.key]
    return isBinding(v) && v.bind === 'mod'
  })
  if (bound.length === 0) return null
  return (
    <div className="flex flex-col gap-4">
      <span className="kol-helper-10 text-meta">Modulation</span>
      {bound.map((p) => {
        const src = getSource(layer[p.key].source)
        return (
          <div key={p.key} className="flex flex-col gap-2 pt-3 border-t border-fg-08">
            <div className="flex items-center justify-between">
              <span className="kol-helper-12 text-emphasis">{p.label ?? p.key}</span>
              <span className="kol-helper-10 text-meta">{src?.label ?? layer[p.key].source}</span>
            </div>
            <ModulationEditor layer={layer} param={p} setProp={setProp} />
          </div>
        )
      })}
    </div>
  )
}
