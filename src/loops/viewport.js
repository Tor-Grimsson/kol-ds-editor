// Universal viewport camera for 2d loops — the Animation layer the archetype's
// Frame/Form needs. Opaque loop draw fns have no per-element hook, so the "motion"
// is a global camera the PLAYER applies around the loop's own draw:
//   FRAME (the whole loop moves)      — Spin (whole turns ⇒ seamless) · Zoom
//   FORM  (the loop modulates in place) — Pulse (zoom breathe) · Wobble (rotation osc)
// All seamless (spin = whole turns; pulse/wobble = sin, return at u=1). Keys are
// `vp`-prefixed so they never collide with a loop's own `spin`/`camZoom` params, and
// default to IDENTITY so a loop with no camera renders exactly as before.
//
// Rotation would reveal the canvas corners (the loop's bg rect rotates off them), so
// the camera adds just enough cover-zoom that the rotated frame always blankets the
// canvas — no separate bg fill needed.

const TAU = Math.PI * 2

export const VP_DEFAULTS = { vpZoom: 1, vpSpin: 0, vpPulse: 0, vpWobble: 0, vpRate: 1 }
export const VP_KEYS = Object.keys(VP_DEFAULTS)

// Apply the camera transform to ctx for frame u. Returns true if it transformed
// (caller wrapped it in save/restore); false if identity (nothing applied).
export function applyViewport(ctx, u, w, h, p) {
  const spin = Math.round(p.vpSpin || 0)
  const zoom = p.vpZoom ?? 1
  const pulse = p.vpPulse || 0
  const wobble = p.vpWobble || 0 // degrees
  if (!spin && pulse === 0 && wobble === 0 && zoom === 1) return false

  const ph = u * TAU * Math.round(p.vpRate || 1)
  const rot = u * TAU * spin + (wobble * Math.PI / 180) * Math.sin(ph)
  // Worst-case rotation this loop reaches → cover-zoom so corners never show.
  const maxAngle = spin ? Math.PI / 4 : Math.abs(wobble * Math.PI / 180)
  const cover = Math.cos(maxAngle) + Math.sin(maxAngle) // ≥1; √2 at 45°
  const z = Math.max(zoom * (1 + pulse * 0.5 * Math.sin(ph)), cover * 1.02)

  ctx.translate(w / 2, h / 2)
  ctx.rotate(rot)
  ctx.scale(z, z)
  ctx.translate(-w / 2, -h / 2)
  return true
}
