/**
 * gamepad — Web Gamepad API as a full set of modulation sources, plus a
 * poll-based LEARN mirroring midi.js.
 *
 * The Gamepad API is POLL-ONLY (no per-input events beyond connect/disconnect),
 * so there is no persistent poll loop here: each source reads
 * navigator.getGamepads() live inside its `sample`, and the transport's tick
 * re-samples every frame while a pad is active (sources.anyLiveSourceActive →
 * padConnected). LEARN is the one exception — it spins a short-lived rAF that
 * watches for the first axis pushed / button pressed, then tears itself down
 * (it can't be event-driven the way MIDI learn is).
 *
 * Standard mapping (DualShock/DualSense/Xbox map to this in Chrome):
 *   axes    0,1 = left stick X,Y   ·   2,3 = right stick X,Y
 *   buttons 0..3 = south/east/west/north (A/B/X/Y · ✕/○/□/△)
 *           4,5 = L1/R1   ·   6,7 = L2/R2 (analog triggers)
 *
 * Feature-detected — browsers/devices without a pad just read 0.
 */

/* ── raw readers ─────────────────────────────────────────────────────── */

export function readPad() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return null
  const pads = navigator.getGamepads()
  for (const p of pads) if (p) return p
  return null
}
export function padConnected() { return !!readPad() }

/* Axis -1..1 → 0..1. (No deadzone — matches the pre-existing padX/padY reader;
 * LEARN uses a half-travel threshold so resting drift never false-triggers.) */
function axis01(n) {
  const p = readPad()
  if (!p) return 0
  const v = p.axes[n]
  return Number.isFinite(v) ? (v + 1) / 2 : 0
}
/* Button analog value 0..1 (triggers L2/R2 are analog on most pads). */
function buttonValue(n) {
  const p = readPad()
  return p ? (p.buttons[n]?.value ?? 0) : 0
}
/* Button digital 0/1. */
function buttonBit(n) {
  const p = readPad()
  return p ? (p.buttons[n]?.pressed ? 1 : 0) : 0
}
/* Derived: normalized stick angle 0..1 (atan2, rest = 0). */
function stickAngle(xi, yi) {
  const p = readPad()
  if (!p) return 0
  const x = p.axes[xi] ?? 0, y = p.axes[yi] ?? 0
  const a = Math.atan2(y, x) / (Math.PI * 2)
  return a - Math.floor(a)
}
/* Derived: stick push magnitude 0..1. */
function stickForce(xi, yi) {
  const p = readPad()
  if (!p) return 0
  const x = p.axes[xi] ?? 0, y = p.axes[yi] ?? 0
  return Math.min(1, Math.hypot(x, y))
}

/* ── source descriptors ──────────────────────────────────────────────────
 * The full set sources.js registers (order = bind-menu order). Each carries a
 * `read` closure; learnable inputs also carry an `axis`/`button` index so LEARN
 * can map a detected input back to its source id. Derived sticks are NOT
 * learnable (they need a whole-stick gesture) — picked from the menu instead. */
export const GAMEPAD_SOURCES = [
  { id: 'pad-leftX',  label: 'Pad · Left stick X',   axis: 0,   read: () => axis01(0) },
  { id: 'pad-leftY',  label: 'Pad · Left stick Y',   axis: 1,   read: () => axis01(1) },
  { id: 'pad-rightX', label: 'Pad · Right stick X',  axis: 2,   read: () => axis01(2) },
  { id: 'pad-rightY', label: 'Pad · Right stick Y',  axis: 3,   read: () => axis01(3) },
  { id: 'pad-LT',     label: 'Pad · L2 (trigger)',   button: 6, read: () => buttonValue(6) },
  { id: 'pad-RT',     label: 'Pad · R2 (trigger)',   button: 7, read: () => buttonValue(7) },
  { id: 'pad-a',      label: 'Pad · A (south)',      button: 0, read: () => buttonBit(0) },
  { id: 'pad-b',      label: 'Pad · B (east)',       button: 1, read: () => buttonBit(1) },
  { id: 'pad-x',      label: 'Pad · X (west)',       button: 2, read: () => buttonBit(2) },
  { id: 'pad-y',      label: 'Pad · Y (north)',      button: 3, read: () => buttonBit(3) },
  { id: 'pad-L1',     label: 'Pad · L1 (bumper)',    button: 4, read: () => buttonBit(4) },
  { id: 'pad-R1',     label: 'Pad · R1 (bumper)',    button: 5, read: () => buttonBit(5) },
  { id: 'pad-leftAngle',  label: 'Pad · Left stick ∠ (circle)',  read: () => stickAngle(0, 1) },
  { id: 'pad-leftForce',  label: 'Pad · Left stick ⊙ (push)',    read: () => stickForce(0, 1) },
  { id: 'pad-rightAngle', label: 'Pad · Right stick ∠ (circle)', read: () => stickAngle(2, 3) },
  { id: 'pad-rightForce', label: 'Pad · Right stick ⊙ (push)',   read: () => stickForce(2, 3) },
]

/* Is a binding source one of ours (incl. the padX/padY back-compat aliases)? */
export function isGamepadSource(id) {
  return typeof id === 'string' && (id.startsWith('pad-') || id === 'padX' || id === 'padY')
}

/* ── learn ───────────────────────────────────────────────────────────────
 * Mirror of learnCC(): arm, wiggle a stick / press a button, resolve with the
 * matching source id (or null on a 10s timeout so an armed learn can't dangle).
 * Poll-based because the Gamepad API has no input events. */
const AXIS_ID   = new Map(GAMEPAD_SOURCES.filter((s) => s.axis   != null).map((s) => [s.axis, s.id]))
const BUTTON_ID = new Map(GAMEPAD_SOURCES.filter((s) => s.button != null).map((s) => [s.button, s.id]))
const AXIS_MOVE = 0.5   /* an axis must travel half its range to count */

export function learnGamepad() {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') return resolve(null)
    const start = readPad()
    const baseAxes = start ? [...start.axes] : []
    const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now())
    let raf = 0
    const done = (id) => { cancelAnimationFrame(raf); resolve(id) }
    const step = () => {
      const p = readPad()
      if (p) {
        for (const [i, id] of BUTTON_ID) {
          if (p.buttons[i]?.pressed) return done(id)
        }
        for (let i = 0; i < p.axes.length; i++) {
          const id = AXIS_ID.get(i)
          if (id && Math.abs((p.axes[i] ?? 0) - (baseAxes[i] ?? 0)) > AXIS_MOVE) return done(id)
        }
      }
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
      if (now - t0 > 10000) return done(null)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
  })
}
