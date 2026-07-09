/**
 * mathfn — safe GEOMETRY expression compiler for the math loops (port of
 * kol-labs-single math/lib/mathfn.js compileVars + the identifier gate from
 * math/uzumaki/lib/funcgen.js isSafeExpr, hardened like editor expr.js).
 *
 * compileVars('sin(x)*cos(y)', ['x','y','t']) -> (x,y,t)=>number | null
 *
 * The caller names the variables, so one compiler serves every slot:
 * surface z=f(x,y,t) · scalar field f(x,y) · waveform f(t) · curve r(th) /
 * x(t)/y(t)/z(t) / a(k)/r(k). Unlike editor expr.js (whose output is a
 * normalized 0..1 modulation signal), these are raw geometry functions —
 * output is unclamped, `min`/`max` are Math.min/Math.max, and there is no
 * audio scope.
 *
 * SAFETY — two independent gates in front of the `new Function` sink, since
 * expressions arrive from loaded/shared settings .json:
 *   1. funcgen's isSafeExpr — math-only characters, and every identifier
 *      (including property names after `.`, so `sin.constructor(...)` dies)
 *      must be a prelude ident or a caller-declared variable.
 *   2. expr.js's SHADOWED_GLOBALS — dangerous globals bound to undefined
 *      parameters so even a gate miss can't reach network/DOM/storage.
 * A compile/probe failure yields null (callers fail at edit time, labs
 * behavior); a compiled fn never throws and never returns a non-finite
 * value — runtime faults return the last good value for that fn, or 0.
 */

const PRELUDE = `
  "use strict";
  var PI=Math.PI, TAU=6.283185307179586, PHI=1.618033988749895, E=Math.E,
      SQRT2=Math.SQRT2, SQRT3=1.7320508075688772, SQRT5=2.23606797749979,
      LN2=Math.LN2, LN10=Math.LN10, DEG=0.017453292519943295, FEIGENBAUM=4.66920160910299;
  var sin=Math.sin, cos=Math.cos, tan=Math.tan,
      asin=Math.asin, acos=Math.acos, atan=Math.atan, atan2=Math.atan2,
      sinh=Math.sinh, cosh=Math.cosh, tanh=Math.tanh,
      abs=Math.abs, sign=Math.sign, floor=Math.floor, ceil=Math.ceil,
      round=Math.round, trunc=Math.trunc, sqrt=Math.sqrt, cbrt=Math.cbrt,
      exp=Math.exp, log=Math.log, log2=Math.log2, log10=Math.log10,
      pow=Math.pow, hypot=Math.hypot, min=Math.min, max=Math.max;
  function frac(v){return v-floor(v);}
  function mod(a,b){return ((a%b)+b)%b;}
  function clamp(v,a,b){return v<a?a:(v>b?b:v);}
  function lerp(a,b,u){return a+(b-a)*u;}
  function smooth(u){u=clamp(u,0,1);return u*u*(3-2*u);}
  function wave(v){return sin(v)*0.5+0.5;}
  function saw(v){return frac(v);}
  function tri(v){var p=frac(v);return p<0.5?p*2:(1-p)*2;}
  function pulse(v,w){w=(w===undefined?0.5:w);return frac(v)<w?1:0;}
  function bell(v){var p=frac(v);return exp(-pow((p-0.5)*6,2));}
  function step(v,k){k=(k===undefined?4:k);return floor(frac(v)*k)/k;}
`

/* Every identifier the PRELUDE defines. Caller-declared variables extend
 * this per compile. Any other identifier — `fetch`, `constructor`,
 * `window`, a property name after `.` — is not math and is rejected. */
const PRELUDE_IDENTS = new Set([
  'PI', 'TAU', 'PHI', 'E', 'SQRT2', 'SQRT3', 'SQRT5', 'LN2', 'LN10', 'DEG', 'FEIGENBAUM',
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh',
  'abs', 'sign', 'floor', 'ceil', 'round', 'trunc', 'sqrt', 'cbrt', 'exp', 'log', 'log2', 'log10',
  'pow', 'hypot', 'min', 'max', 'frac', 'mod', 'clamp', 'lerp', 'smooth',
  'wave', 'saw', 'tri', 'pulse', 'bell', 'step',
])

/* Guard the `new Function` sink (funcgen isSafeExpr, θ dropped — the editor
 * schemas use ASCII variable names). `(?<!\w)` skips the `e` in `1e5`
 * exponents but still checks property names after `.`. */
function isSafeExpr(expr, args) {
  if (/[^\w\s.+\-*/%^(),]/.test(expr)) return false
  const ids = expr.match(/(?<!\w)[A-Za-z_][\w]*/g) || []
  return ids.every((id) => PRELUDE_IDENTS.has(id) || args.includes(id))
}

/* Dangerous globals shadowed as never-passed parameters (bound to
 * undefined) — same list as editor expr.js. `eval` and `import` are
 * reserved words in strict code and cannot be shadowed; the Math scope
 * the PRELUDE exposes stays intact. */
// ponytail: scope-shadowing, not a real sandbox (constructor chains still escape); upgrade path = SES/worker isolation.
const SHADOWED_GLOBALS = [
  'globalThis', 'window', 'self', 'document', 'fetch', 'XMLHttpRequest',
  'localStorage', 'sessionStorage', 'indexedDB', 'navigator', 'location',
  'top', 'parent', 'frames', 'opener', 'Function', 'WebSocket', 'Worker',
  'importScripts',
]

const cache = new Map() // `${args}|${expr}` -> fn | null
const CACHE_MAX = 64

/**
 * Compile an expression over named variables into a fast numeric function.
 * Returns null if the expression is empty, unsafe, throws at compile/probe,
 * or doesn't yield a number — so callers can fail at edit time instead of
 * mid-loop. The returned fn NEVER throws and never returns a non-finite
 * value (runtime faults return its last good value, 0 before one exists).
 */
export function compileVars(expr, args) {
  if (expr == null || String(expr).trim() === '') return null
  const key = `${args.join(',')}|${expr}`
  if (cache.has(key)) return cache.get(key)

  let out = null
  const src = String(expr)
  if (isSafeExpr(src, args)) {
    try {
      // eslint-disable-next-line no-new-func
      const raw = new Function(...args, ...SHADOWED_GLOBALS, `${PRELUDE}return (${src});`)
      const probe = raw(...args.map(() => 0.5))
      if (typeof probe === 'number') {
        let last = 0
        out = (...vals) => {
          try {
            const v = raw(...vals)
            if (typeof v === 'number' && Number.isFinite(v)) { last = v; return v }
            return last
          } catch {
            return last
          }
        }
      }
    } catch { /* syntax error → null */ }
  }
  cache.set(key, out)
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  return out
}

/**
 * compileSlot — compileVars + keep-the-last-good-fn (labs edit-time
 * behavior, adapted for a render loop that re-reads params every frame).
 * A slot is one expression field of one layer (key it `loopId:layerId:field`);
 * while the current string doesn't compile, the slot keeps returning the
 * last fn that did, so a half-typed expression never blanks the render.
 * Returns null only before the slot ever compiled successfully.
 */
const slots = new Map() // slotKey -> { expr, fn }
const SLOTS_MAX = 32
export function compileSlot(slotKey, expr, args) {
  const hit = slots.get(slotKey)
  if (hit && hit.expr === expr) return hit.fn
  const fn = compileVars(expr, args)
  if (fn) {
    slots.set(slotKey, { expr, fn })
    while (slots.size > SLOTS_MAX) slots.delete(slots.keys().next().value)
    return fn
  }
  return hit ? hit.fn : null
}

/** True if `str` compiles to a numeric function of `args` (edit-time check). */
export function isValidVars(str, args) {
  return compileVars(str, args) != null
}

/* ── dev self-check ─────────────────────────────────────────────────── */
if (import.meta.env?.DEV) {
  const f = compileVars('sin(x)*cos(y)', ['x', 'y'])
  console.assert(f && Math.abs(f(Math.PI / 2, 0) - 1) < 1e-9, 'sin*cos compiles')
  console.assert(compileVars('x + t', ['x', 'y', 't'])(1, 0, 2) === 3, 'named vars bind in order')
  console.assert(compileVars('fetch(x)', ['x']) === null, 'globals rejected')
  console.assert(compileVars('sin.constructor("1")(x)', ['x']) === null, 'constructor chain rejected')
  console.assert(compileVars('x="pwn"', ['x']) === null, 'non-math chars rejected')
  console.assert(compileVars('', ['x']) === null, 'empty → null')
  const g = compileVars('1/x', ['x'])
  console.assert(g(0.5) === 2 && g(0) === 2, 'non-finite → last good')
  console.assert(compileSlot('t1', 'x*2', ['x'])(2) === 4, 'slot compiles')
  console.assert(compileSlot('t1', 'x*(', ['x'])(2) === 4, 'slot keeps last good on error')
}
