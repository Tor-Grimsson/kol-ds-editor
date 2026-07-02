/**
 * expr — expression evaluator for the 'expr' modulation source (Phase 9+).
 * Port of labs' foundational lib (kol-labs-single/src/lib/exprParam.js): a
 * hand-rolled `new Function()` compiler, no parser dependency, compiled once
 * per expression string and cached forever.
 *
 * TIME — `t` is SECONDS, exactly like labs (exprParam's `t` is the engine
 * playhead in seconds; the period-1 oscillators make `wave(t)` one cycle per
 * second). The editor transport's ctx.t is normalized loop time 0..1, so the
 * caller (the 'expr' source in ./sources) feeds `ctx.t * loopSeconds`. With
 * an integer loop length every period-1 oscillator (wave/saw/tri/pulse/ease/
 * bell/step) wraps seamlessly at the loop point, and the labs example
 * strings keep their exact speeds.
 *
 * OUTPUT SPACE — an expression produces the normalized source signal:
 * oscillators are 0..1 and sampleSource clamps the result to 0..1 before
 * transform.range maps it onto the param. `max` is the VARIABLE 1 and `min`
 * the VARIABLE 0 (the oscilloscope's knob-range idiom, normalized) — NOT
 * Math.min/Math.max. Use clamp(x,a,b) where a picker function is needed.
 *
 * SAFETY — same guarantees as exprParam: a compile/probe failure yields
 * { ok:false, fn:()=>0 }; a compiled fn never throws and never returns a
 * non-finite value — runtime faults return the last good value for that
 * expression, or 0 before one exists.
 *
 * LIVE — level/bass/mid/high read the shared analyser (0 while audio is
 * off; enable via the transport footer's audio row) and rand() re-rolls per
 * sample. `usesLive` flags expressions that need per-frame re-sampling even
 * while the transport is paused.
 */
import { readAudio } from './audioBands'

const ZERO_AUDIO = { level: 0, bass: 0, mid: 0, high: 0 }

const PRELUDE = `
  "use strict";
  var s=t, time=t;
  var level=+a.level||0, bass=+a.bass||0, mid=+a.mid||0, high=+a.high||0;
  var min=0, max=1;
  var PI=Math.PI, TAU=6.283185307179586, PHI=1.618033988749895, E=Math.E,
      SQRT2=Math.SQRT2, SQRT3=1.7320508075688772, SQRT5=2.23606797749979,
      LN2=Math.LN2, LN10=Math.LN10, DEG=0.017453292519943295;
  var sin=Math.sin, cos=Math.cos, tan=Math.tan,
      asin=Math.asin, acos=Math.acos, atan=Math.atan, atan2=Math.atan2,
      sinh=Math.sinh, cosh=Math.cosh, tanh=Math.tanh,
      abs=Math.abs, sign=Math.sign, floor=Math.floor, ceil=Math.ceil,
      round=Math.round, trunc=Math.trunc, sqrt=Math.sqrt, cbrt=Math.cbrt,
      exp=Math.exp, log=Math.log, log2=Math.log2, log10=Math.log10,
      pow=Math.pow, hypot=Math.hypot;
  function frac(x){return x-floor(x);}
  function mod(a,b){return ((a%b)+b)%b;}
  function clamp(x,a,b){return x<a?a:(x>b?b:x);}
  function lerp(a,b,u){return a+(b-a)*u;}
  function smooth(u){u=clamp(u,0,1);return u*u*(3-2*u);}
  function wave(x){return sin(x*TAU)*0.5+0.5;}
  function saw(x){return frac(x);}
  function tri(x){var p=frac(x);return p<0.5?p*2:(1-p)*2;}
  function pulse(x,w){w=(w===undefined?0.5:w);return frac(x)<w?1:0;}
  function ease(x,c){c=(c===undefined?2:c);var p=frac(x);var v=p<0.5?p*2:(1-p)*2;return pow(v,c);}
  function bell(x){var p=frac(x);return exp(-pow((p-0.5)*6,2));}
  function step(x,k){k=(k===undefined?4:k);return floor(frac(x)*k)/k;}
  function rand(){return Math.random();}
`

const cache = new Map()
const LIVE_RE = /\b(level|bass|mid|high|rand)\b/

/**
 * Compile an expression string. Cached by string. Returns
 * { ok, usesLive, fn }:
 *   ok       false on a compile (syntax / non-numeric) error
 *   usesLive expression references an audio band or rand() — the consumer
 *            must re-sample per frame even while the transport is paused
 *   fn(t, a) -> number — t in SECONDS, a = audio bands (defaults to the
 *            live analyser). Never throws, never non-finite.
 */
export function compileExpr(str) {
  const key = String(str)
  const hit = cache.get(key)
  if (hit) return hit

  let entry
  try {
    // `a` carries the live audio bands (level/bass/mid/high); see PRELUDE.
    // eslint-disable-next-line no-new-func
    const raw = new Function('t', 'a', `${PRELUDE}return (${key});`)
    /* Probe at t=1 with silent audio — rejects strings that parse but don't
     * evaluate to a number, so half-typed input degrades to ok:false. */
    const probe = raw(1, ZERO_AUDIO)
    if (typeof probe !== 'number') throw new Error('not numeric')
    let last = 0
    entry = {
      ok: true,
      usesLive: LIVE_RE.test(key),
      fn: (t, a = readAudio()) => {
        try {
          const v = raw(t, a)
          if (typeof v === 'number' && Number.isFinite(v)) { last = v; return v }
          return last
        } catch {
          return last
        }
      },
    }
  } catch {
    entry = { ok: false, usesLive: false, fn: () => 0 }
  }
  cache.set(key, entry)
  return entry
}

/** True if `str` is a syntactically valid, numeric expression. */
export function isValidExpr(str) {
  return compileExpr(str).ok
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  const w = compileExpr('wave(t)')
  console.assert(w.ok && !w.usesLive && Math.abs(w.fn(0.25) - 1) < 1e-9, 'wave(t) peaks at t=0.25')
  console.assert(compileExpr('saw(t)*0.8').fn(0.5, ZERO_AUDIO) === 0.4, 'saw scales')
  console.assert(compileExpr('pulse(t, 0.3)').fn(0.2, ZERO_AUDIO) === 1, 'pulse width')
  console.assert(compileExpr('t*20 % max').fn(0.025, ZERO_AUDIO) === 0.5, 'max is the variable 1')
  console.assert(compileExpr('bass*2').usesLive && compileExpr('rand()').usesLive, 'live flags')
  console.assert(compileExpr('#fff').ok === false && compileExpr('#fff').fn(0) === 0, 'garbage → 0')
  console.assert(compileExpr('1/0').fn(0, ZERO_AUDIO) === 0, 'non-finite → last good (0)')
}
