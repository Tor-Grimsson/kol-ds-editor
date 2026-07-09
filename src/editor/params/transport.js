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
let stage       = null   /* pointer in virtual-canvas px (CanvasArea feeds it) */
let version     = 0
/* Reset epoch — a monotonic counter bumped ONLY by stop/rewind (never pause:
 * pause must hold every sim exactly where it is). Free-running/stateful
 * consumers (math-spinner/orbits trails, penrose protos, optic reaction-
 * diffusion, video currentTime) key their state on it, so stop/rewind means
 * "fresh run", matching the labs transport semantics. */
let epoch       = 0

const subs   = new Set()
let raf      = null
let lastTs   = null
/* Pointer-binding interest — toggled by the compose layer-state watcher
 * whenever any layer carries a mouse/stage-driven binding. Mousemove /
 * stage-pointer notifies are gated on it, so an editor with zero pointer
 * bindings pays nothing for cursor movement (position state still updates,
 * so getCtx is fresh the moment a binding appears). */
let pointerInterest = false

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
    if (pointerInterest && subs.size > 0) notify()
  })
}

export const transport = {
  play()  { playing = true; ensureRaf(); notify() },
  pause() { playing = false; notify() },
  toggle() { playing ? transport.pause() : transport.play() },
  seek(frac) { t = ((frac % 1) + 1) % 1; notify() },
  /* Stop = pause + rewind + new epoch; rewind keeps the play state. Both are
   * the ONLY epoch writers (see `epoch` above — pause-coherence). */
  stop()   { playing = false; t = 0; epoch++; notify() },
  rewind() { t = 0; epoch++; notify() },
  setLoopSeconds(s) { loopSeconds = Math.max(0.1, Number(s) || 0.1); notify() },
  isPlaying() { return playing },
  getLoopSeconds() { return loopSeconds },
  getT() { return t },
  getEpoch() { return epoch },
  getCtx() { return { t, mouse, stage, epoch } },
  /* Stage pointer in virtual px — feeds the layer-local pointer sources.
   * Notifies like mousemove so paused-but-bound layers track it. */
  setStagePointer(x, y) {
    stage = x == null ? null : { x, y }
    if (pointerInterest && subs.size > 0) notify()
  },
  /* See `pointerInterest` above — compose state scans layers for pointer
   * bindings and flips this so unbound editors skip pointer notifies. */
  setPointerInterest(on) { pointerInterest = !!on },
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
    stop: transport.stop,
    rewind: transport.rewind,
    setLoopSeconds: transport.setLoopSeconds,
  }
}

/* Snapshot hooks — re-render ONLY when the snapshot value changes (not per
 * tick), so a plain <video> layer can follow play/pause/reset without paying
 * the 60fps subscription the bound-layer renderers do. */
const getPlaying = () => playing
const getEpoch   = () => epoch
export function useTransportPlaying() {
  return useSyncExternalStore(subscribe, getPlaying, getPlaying)
}
export function useTransportEpoch() {
  return useSyncExternalStore(subscribe, getEpoch, getEpoch)
}
