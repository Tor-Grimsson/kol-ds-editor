import { EASE } from './primitiveEasing.js'
import { lerp } from '../lib/util.js'

// Keyframe animation track — a PURE sampler so the timeline stays scrubbable
// (pose derived from the playhead, never accumulated). Keyframes:
//   { t: 0..1, rot:[x,y,z] (radians), pos:[x,y,z], scale, ease }
// Assumes keyframes are sorted by t (the editor keeps them sorted on add).
// Easing comes from the shared src/lib/easing.js (EASE + EASE_OPTIONS).

const lerp3 = (A, B, t) => [lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)]
const pose = (k) => ({ rot: k.rot || [0, 0, 0], pos: k.pos || [0, 0, 0], scale: k.scale ?? 1 })

// Pose at normalized time u∈[0,1]. Holds the end poses outside the keyframe span.
export function sampleKeyframes(kfs, u) {
  if (!kfs || !kfs.length) return {}
  if (kfs.length === 1) return pose(kfs[0])
  let i = 0
  while (i < kfs.length - 1 && u > kfs[i + 1].t) i++
  const a = kfs[i]
  const b = kfs[i + 1] || a
  const span = b.t - a.t || 1
  let f = Math.max(0, Math.min(1, (u - a.t) / span))
  f = (EASE[b.ease] || EASE.inout)(f)
  return {
    rot: lerp3(a.rot || [0, 0, 0], b.rot || [0, 0, 0], f),
    pos: lerp3(a.pos || [0, 0, 0], b.pos || [0, 0, 0], f),
    scale: lerp(a.scale ?? 1, b.scale ?? 1, f),
  }
}

// A spin across the whole loop — the seed track when keyframe mode is first
// entered (demonstrates interpolation; first/last poses match → seamless loop).
export const DEFAULT_KEYFRAMES = [
  { t: 0, rot: [0, 0, 0], pos: [0, 0, 0], scale: 1, ease: 'inout' },
  { t: 1, rot: [0, Math.PI * 2, 0], pos: [0, 0, 0], scale: 1, ease: 'inout' },
]
