import { useMemo, useRef, useState } from 'react'
import { Dropdown, Input } from '@kolkrabbi/kol-component'
import { useComposeState } from '../compose/state'
import { labelForLayer } from '../compose/labels'
import { EASING_OPTIONS } from './easing'
import { isBinding } from './resolve'
import { useTransport } from './transport'

/**
 * TimelineDock — the keyframe timeline (plan.md Phase 2 item 2), docked
 * below the canvas via the `canvas.footer` slot. Collapsed to nothing while
 * the composition has no keyframe tracks (the static editor pays zero
 * chrome); appears when a prop is bound to Keyframes via its BindDot.
 *
 *   [t readout] [scrub ruler ................................ playhead]
 *   [Layer · prop] [lane: ◆ diamonds at t, click adds, drag moves]
 *   [selected key: value · easing · delete]
 *
 * Writes go through updateLayer; drags commit on pointer-up (one undo entry
 * per gesture instead of a flood).
 */

/* Walk the layer tree, collecting every keyframe-track binding. */
function collectTracks(layers, out = []) {
  for (const l of layers) {
    for (const k in l) {
      const v = l[k]
      if (isBinding(v) && v.bind === 'track') out.push({ layer: l, key: k, keys: v.keys })
    }
    if (Array.isArray(l.children)) collectTracks(l.children, out)
  }
  return out
}

export default function TimelineDock() {
  const { layers, updateLayer } = useComposeState()
  const { t, seek } = useTransport()
  const tracks = useMemo(() => collectTracks(layers), [layers])
  const [selected, setSelected] = useState(null)   /* { layerId, key, index } */

  if (tracks.length === 0) return null

  const writeKeys = (track, nextKeys) => {
    const sorted = [...nextKeys].sort((a, b) => a.t - b.t)
    updateLayer(track.layer.id, { [track.key]: { bind: 'track', keys: sorted } })
  }

  return (
    <div className="border-t border-fg-08 px-4 py-2 flex flex-col gap-1 select-none" style={{ background: 'var(--kol-surface-primary)' }}>
      <ScrubRuler t={t} seek={seek} />
      {tracks.map((track) => (
        <TrackRow
          key={`${track.layer.id}:${track.key}`}
          track={track}
          t={t}
          selected={selected}
          setSelected={setSelected}
          writeKeys={writeKeys}
        />
      ))}
      <SelectedKeyEditor tracks={tracks} selected={selected} setSelected={setSelected} writeKeys={writeKeys} />
    </div>
  )
}

/* Click/drag to seek. */
function ScrubRuler({ t, seek }) {
  const ref = useRef(null)
  const fracFromEvent = (e) => {
    const r = ref.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }
  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    seek(fracFromEvent(e))
  }
  const onPointerMove = (e) => {
    if (e.buttons & 1) seek(fracFromEvent(e))
  }
  return (
    <div className="flex items-center gap-3">
      <span className="kol-mono-12 text-meta tabular-nums shrink-0 text-right" style={{ width: 120 }}>{t.toFixed(2)}</span>
      <div
        ref={ref}
        className="relative flex-1 h-4 cursor-ew-resize rounded"
        style={{ background: 'var(--kol-fg-04)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      >
        <Playhead t={t} />
      </div>
    </div>
  )
}

function Playhead({ t }) {
  return (
    <span
      aria-hidden="true"
      className="absolute top-0 bottom-0"
      style={{ left: `${t * 100}%`, width: 1.5, background: 'var(--kol-accent-primary)' }}
    />
  )
}

function TrackRow({ track, t, selected, setSelected, writeKeys }) {
  const laneRef = useRef(null)
  /* Local drag state — committed once on pointer-up. */
  const drag = useRef(null)
  const [, force] = useState(0)

  const fracFromEvent = (e) => {
    const r = laneRef.current.getBoundingClientRect()
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
  }

  const isSel = (i) =>
    selected && selected.layerId === track.layer.id && selected.key === track.key && selected.index === i

  const onLanePointerDown = (e) => {
    if (e.target.dataset.diamond !== undefined) return
    /* Add a key at the click position, valued at the track's current value
     * there (no visual jump), then select it. */
    const clickT = fracFromEvent(e)
    const v = sampleTrack(track.keys, clickT)
    const next = [...track.keys, { t: clickT, v, easing: 'linear' }].sort((a, b) => a.t - b.t)
    writeKeys(track, next)
    setSelected({ layerId: track.layer.id, key: track.key, index: next.findIndex((k) => k.t === clickT) })
  }

  const onDiamondPointerDown = (i) => (e) => {
    e.stopPropagation()
    if (e.altKey) {
      /* alt-click deletes (min 1 key stays — an empty track is a broken binding) */
      if (track.keys.length > 1) {
        writeKeys(track, track.keys.filter((_, j) => j !== i))
        setSelected(null)
      }
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { index: i, t: track.keys[i].t }
    setSelected({ layerId: track.layer.id, key: track.key, index: i })
  }
  const onDiamondPointerMove = (i) => (e) => {
    if (!drag.current || drag.current.index !== i) return
    drag.current.t = fracFromEvent(e)
    force((n) => n + 1)
  }
  const onDiamondPointerUp = (i) => () => {
    if (!drag.current || drag.current.index !== i) return
    const moved = { ...track.keys[i], t: drag.current.t }
    const next = track.keys.map((k, j) => (j === i ? moved : k))
    drag.current = null
    writeKeys(track, next)
    setSelected(null)
  }

  return (
    <div className="flex items-center gap-3">
      <span className="kol-helper-10 text-meta truncate shrink-0 text-right" style={{ width: 120 }} title={`${labelForLayer(track.layer)} · ${track.key}`}>
        {labelForLayer(track.layer)} · {track.key}
      </span>
      <div
        ref={laneRef}
        className="relative flex-1 h-5 rounded cursor-copy"
        style={{ background: 'var(--kol-fg-04)' }}
        onPointerDown={onLanePointerDown}
      >
        <Playhead t={t} />
        {track.keys.map((k, i) => {
          const kt = drag.current?.index === i ? drag.current.t : k.t
          return (
            <span
              key={i}
              data-diamond=""
              onPointerDown={onDiamondPointerDown(i)}
              onPointerMove={onDiamondPointerMove(i)}
              onPointerUp={onDiamondPointerUp(i)}
              title={`t=${kt.toFixed(2)} v=${typeof k.v === 'number' ? Math.round(k.v * 100) / 100 : k.v} (alt-click deletes)`}
              className="absolute top-1/2 cursor-grab"
              style={{
                left: `${kt * 100}%`,
                width: 9, height: 9,
                transform: 'translate(-50%, -50%) rotate(45deg)',
                background: isSel(i) ? 'var(--kol-accent-primary)' : 'var(--kol-fg-1)',
                borderRadius: 1.5,
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

/* Sample a track's value at t (linear across the segment — good enough for
 * the "add key without a jump" affordance). */
function sampleTrack(keys, t) {
  if (keys.length === 0) return 0
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  let i = 0
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++
  const a = keys[i], b = keys[i + 1]
  if (typeof a.v !== 'number' || typeof b.v !== 'number') return a.v
  const span = b.t - a.t || 1
  return a.v + (b.v - a.v) * ((t - a.t) / span)
}

function SelectedKeyEditor({ tracks, selected, setSelected, writeKeys }) {
  if (!selected) return null
  const track = tracks.find((tr) => tr.layer.id === selected.layerId && tr.key === selected.key)
  const key = track?.keys[selected.index]
  if (!key) return null

  const patchKey = (patch) => {
    writeKeys(track, track.keys.map((k, i) => (i === selected.index ? { ...k, ...patch } : k)))
  }
  const isNum = typeof key.v === 'number'

  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="kol-helper-10 text-meta shrink-0">key @ {key.t.toFixed(2)}</span>
      <Input
        variant="ghost" size="sm" chars={7}
        type={isNum ? 'number' : 'text'}
        value={String(key.v)}
        onChange={(e) => patchKey({ v: isNum ? Number(e.target.value) || 0 : e.target.value })}
      />
      <Dropdown
        variant="subtle" size="sm"
        options={EASING_OPTIONS}
        value={Array.isArray(key.easing) ? 'linear' : (key.easing ?? 'linear')}
        onChange={(v) => patchKey({ easing: v })}
      />
      <button
        type="button"
        className="kol-helper-10 text-meta hover:text-emphasis px-2"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={() => {
          if (track.keys.length > 1) writeKeys(track, track.keys.filter((_, i) => i !== selected.index))
          setSelected(null)
        }}
      >
        Delete key
      </button>
      <button
        type="button"
        className="kol-helper-10 text-meta hover:text-emphasis px-2 ml-auto"
        style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
        onClick={() => setSelected(null)}
      >
        Close
      </button>
    </div>
  )
}
