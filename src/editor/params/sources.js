/**
 * Modulation sources — the input nodes feeding the param graph (plan.md
 * Phase 2 item 3). A source turns live input into a normalized 0..1 signal
 * the resolver maps onto a param's range.
 *
 * Registry entries:
 *   id      unique key referenced by { bind:'mod', source: id } bindings
 *   label   display name (bind menu)
 *   sample(ctx) -> 0..1     ctx = transport's { t, mouse }
 *   live    true if the source changes outside transport time / mouse events
 *           (audio, gamepad) — transport notifies per frame while one is active
 *   ensure? async setup on first use (mic permission); called from the bind UI
 *           (a user gesture, so permission prompts are allowed)
 *   active? () => bool      live source currently producing a signal
 */
const SOURCES = new Map()

export function registerSource(src) {
  if (!src?.id) throw new Error('modulation source needs an id')
  SOURCES.set(src.id, src)
  return src
}
export function getSource(id)  { return SOURCES.get(id) }
export function getSources()   { return [...SOURCES.values()] }

export function sampleSource(id, ctx) {
  const s = SOURCES.get(id)
  if (!s) return 0
  const v = s.sample(ctx)
  return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0
}

/* Any live source active? Transport polls this to keep notifying while
 * paused (live modulation must track input without play). */
export function anyLiveSourceActive() {
  for (const s of SOURCES.values()) if (s.live && s.active?.()) return true
  return false
}

/* ── built-in sources ───────────────────────────────────────────────── */

registerSource({ id: 'time',   label: 'Time',    sample: (ctx) => ctx?.t ?? 0 })
registerSource({ id: 'mouseX', label: 'Mouse X', sample: (ctx) => ctx?.mouse?.x ?? 0 })
registerSource({ id: 'mouseY', label: 'Mouse Y', sample: (ctx) => ctx?.mouse?.y ?? 0 })

/* Audio — mic level (time-domain RMS). Lazy: mic permission + WebAudio graph
 * spin up on first bind (ensure()), not at import. */
let audioAnalyser = null
let audioData = null
registerSource({
  id: 'audio',
  label: 'Audio level',
  live: true,
  active: () => !!audioAnalyser,
  ensure: async () => {
    if (audioAnalyser) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ac = new AudioContext()
    const srcNode = ac.createMediaStreamSource(stream)
    audioAnalyser = ac.createAnalyser()
    audioAnalyser.fftSize = 512
    srcNode.connect(audioAnalyser)
    audioData = new Uint8Array(audioAnalyser.fftSize)
  },
  sample: () => {
    if (!audioAnalyser) return 0
    audioAnalyser.getByteTimeDomainData(audioData)
    let sum = 0
    for (let i = 0; i < audioData.length; i++) {
      const d = (audioData[i] - 128) / 128
      sum += d * d
    }
    /* RMS ≈ 0..~0.5 for loud input — ×3 gain so normal speech reads. */
    return Math.min(1, Math.sqrt(sum / audioData.length) * 3)
  },
})

/* Gamepad — first pad's left-stick axes, -1..1 → 0..1. Polled per sample
 * (the Gamepad API is poll-only). Active once a pad is connected. */
const padAxis = (n) => {
  const pad = typeof navigator !== 'undefined' && navigator.getGamepads?.()[0]
  return pad ? (pad.axes[n] + 1) / 2 : 0
}
const padActive = () => typeof navigator !== 'undefined' && !!navigator.getGamepads?.()[0]
registerSource({ id: 'padX', label: 'Joystick X', live: true, active: padActive, sample: () => padAxis(0) })
registerSource({ id: 'padY', label: 'Joystick Y', live: true, active: padActive, sample: () => padAxis(1) })
