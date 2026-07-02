/**
 * midi — Web MIDI CC values as a modulation source (Phase 9). One access
 * request, all inputs listened, last-seen value per CC number (any channel)
 * kept 0..1. Bindings pick their CC via MIDI LEARN: arm it, wiggle a knob,
 * the next CC message that arrives becomes the binding's `transform.cc`.
 *
 * Feature-detected — browsers without Web MIDI just read 0.
 */
const cc = new Map()          /* cc number -> 0..1 */
let access = null
let enabled = false
let learnCb = null            /* (ccNumber) => void, one-shot */

function onMessage(e) {
  const [status, d1, d2] = e.data
  if ((status & 0xf0) !== 0xb0) return   /* control change only */
  cc.set(d1, d2 / 127)
  if (learnCb) { const fn = learnCb; learnCb = null; fn(d1) }
}

function wireInputs() {
  for (const input of access.inputs.values()) input.onmidimessage = onMessage
}

export async function enableMidi() {
  if (enabled) return true
  if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) return false
  try {
    access = await navigator.requestMIDIAccess()
    wireInputs()
    access.onstatechange = wireInputs   /* hot-plugged devices */
    enabled = true
    return true
  } catch (err) {
    console.info('[midi] not available:', err?.message ?? err)
    return false
  }
}

export function isMidiEnabled() { return enabled }
export function readCC(n) { return cc.get(n) ?? 0 }
export function anyCCSeen() { return cc.size > 0 }

/* One-shot learn — resolves with the next CC number touched (or null on a
 * 10s timeout so an armed learn can't dangle forever). */
export function learnCC() {
  return new Promise((resolve) => {
    const timer = setTimeout(() => { learnCb = null; resolve(null) }, 10000)
    learnCb = (n) => { clearTimeout(timer); resolve(n) }
  })
}
