/**
 * transport — the motion clock + live-input store (param-graph RFC Phase 2).
 *
 * A module-level singleton (one editor instance) exposing normalized time
 * `t∈[0,1]` (matching the loops' `u`) that wraps at `loopSeconds`, plus a
 * live pointer position for modulation. Bound layers subscribe via
 * `useTransportCtx(true)` and re-render each tick; static layers pass
 * `false` and never subscribe, so the un-animated editor pays nothing.
 *
 * An external store (not React context) so 60fps ticks re-render ONLY the
 * handful of bound-layer renderers, never the whole tree.
 */
import { useSyncExternalStore } from 'react'
import { anyLiveSourceActive } from './sources'

let t           = 0
let playing     = false
let loopSeconds = 4
let mouse       = { x: 0.5, y: 0.5 }
let version     = 0

const subs   = new Set()
let raf      = null
let lastTs   = null

function notify() { version++; subs.forEach((cb) => cb()) }

function tick(ts) {
  if (lastTs == null) lastTs = ts
  const dt = (ts - lastTs) / 1000
  lastTs = ts
  if (playing) {
    t = (t + dt / loopSeconds) % 1
    notify()
  } else if (subs.size > 0 && anyLiveSourceActive()) {
    /* Live sources (audio, gamepad) change outside play/mouse events —
     * bound layers must re-sample per frame even while paused. */
    notify()
  }
  /* Keep the loop alive only while it has work (playing or subscribers). */
  if (playing || subs.size > 0) raf = requestAnimationFrame(tick)
  else { raf = null; lastTs = null }
}
function ensureRaf() { if (raf == null) { lastTs = null; raf = requestAnimationFrame(tick) } }

/* Live pointer → normalized 0..1 over the window. Notifies so mouse-bound
 * params update even when the transport is paused (modulation is live). */
if (typeof window !== 'undefined') {
  window.addEventListener('mousemove', (e) => {
    mouse = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight }
    if (subs.size > 0) notify()
  })
}

export const transport = {
  play()  { playing = true; ensureRaf(); notify() },
  pause() { playing = false; notify() },
  toggle() { playing ? transport.pause() : transport.play() },
  seek(frac) { t = ((frac % 1) + 1) % 1; notify() },
  setLoopSeconds(s) { loopSeconds = Math.max(0.1, Number(s) || 0.1); notify() },
  isPlaying() { return playing },
  getLoopSeconds() { return loopSeconds },
  getT() { return t },
  getCtx() { return { t, mouse } },
}

function subscribe(cb)   { subs.add(cb); ensureRaf(); return () => subs.delete(cb) }
function subscribeNever() { return () => {} }
function getVersion()    { return version }

/* Per-frame ctx for the resolver. enabled=false → stable no-op subscription
 * (never re-renders) so static layers are free. */
export function useTransportCtx(enabled) {
  useSyncExternalStore(enabled ? subscribe : subscribeNever, getVersion, getVersion)
  return transport.getCtx()
}

/* Transport UI hook — play state + loop duration, re-renders on any tick. */
export function useTransport() {
  useSyncExternalStore(subscribe, getVersion, getVersion)
  return {
    playing,
    loopSeconds,
    t,
    play:  transport.play,
    pause: transport.pause,
    toggle: transport.toggle,
    seek: transport.seek,
    setLoopSeconds: transport.setLoopSeconds,
  }
}
