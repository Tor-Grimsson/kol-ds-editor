// One easing source for the whole app — keyframe timelines, camera moves, pose
// tracks. `EASE` maps a name → fn(u∈0..1). `EASE_OPTIONS` is the matching
// labelled list for dropdowns, derived from the same table so the two can't
// drift. The quad set (linear/in/out/inout) is verbatim from the original
// uzumaki + primitive copies so existing clips/keyframes don't shift; the rest
// are the standard Penner curves.
//
// (Replaces the two copies that lived in math/uzumaki/engine/easing.js and
//  gradient/primitive/data/keyframes.js.)

function bounceOut(u) {
  const n1 = 7.5625
  const d1 = 2.75
  if (u < 1 / d1) return n1 * u * u
  if (u < 2 / d1) { u -= 1.5 / d1; return n1 * u * u + 0.75 }
  if (u < 2.5 / d1) { u -= 2.25 / d1; return n1 * u * u + 0.9375 }
  u -= 2.625 / d1
  return n1 * u * u + 0.984375
}

export const EASE = {
  linear: (u) => u,
  // quad — the original in/out/inout
  in: (u) => u * u,
  out: (u) => 1 - (1 - u) * (1 - u),
  inout: (u) => (u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2),
  // sine
  sine: (u) => -(Math.cos(Math.PI * u) - 1) / 2,
  // cubic
  cubicIn: (u) => u * u * u,
  cubicOut: (u) => 1 - Math.pow(1 - u, 3),
  cubicInOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  // expo
  expoOut: (u) => (u >= 1 ? 1 : 1 - Math.pow(2, -10 * u)),
  expoInOut: (u) =>
    u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2,
  // back — overshoot
  backOut: (u) => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(u - 1, 3) + c1 * Math.pow(u - 1, 2)
  },
  backInOut: (u) => {
    const c2 = 1.70158 * 1.525
    return u < 0.5
      ? (Math.pow(2 * u, 2) * ((c2 + 1) * 2 * u - c2)) / 2
      : (Math.pow(2 * u - 2, 2) * ((c2 + 1) * (u * 2 - 2) + c2) + 2) / 2
  },
  // elastic / bounce
  elasticOut: (u) => {
    if (u <= 0) return 0
    if (u >= 1) return 1
    const c4 = (2 * Math.PI) / 3
    return Math.pow(2, -10 * u) * Math.sin((u * 10 - 0.75) * c4) + 1
  },
  bounceOut,
}

// Human labels for the dropdowns — one entry per EASE key, in EASE order.
const LABELS = {
  linear: 'Linear',
  in: 'Ease in',
  out: 'Ease out',
  inout: 'Ease in-out',
  sine: 'Sine',
  cubicIn: 'Cubic in',
  cubicOut: 'Cubic out',
  cubicInOut: 'Cubic in-out',
  expoOut: 'Expo out',
  expoInOut: 'Expo in-out',
  backOut: 'Back out',
  backInOut: 'Back in-out',
  elasticOut: 'Elastic out',
  bounceOut: 'Bounce out',
}

export const EASE_OPTIONS = Object.keys(EASE).map((value) => ({ value, label: LABELS[value] || value }))
