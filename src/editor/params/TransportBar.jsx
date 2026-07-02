import { useEffect, useState } from 'react'
import { Icon } from '@kolkrabbi/kol-loader'
import { Input } from '@kolkrabbi/kol-component'
import { useTransport } from './transport'

/**
 * TransportBar — playback transport, a port of the labs TransportBar
 * (kol-labs-single `components/framework/TransportBar.jsx`): two joined
 * icon button-groups flanking a centered ghost readout.
 *
 *   [▶ | ❚❚]      Loop / N s      [■ | ◀◀]
 *
 * Left group = play / pause (play lit when playing, pause lit when not).
 * Right group = stop (pause + rewind) / rewind (seek 0, keeps playing).
 * Center = loop length in seconds (labs centers tempo; our clock is a
 * normalized loop). Drives the module-level `transport` singleton.
 *
 * `f` toggles a live fps badge (measured only while shown). Space is NOT
 * bound to play/pause here — Space is pan in this editor.
 */

/* Live framerate, measured only while shown (RAF idles when off). */
function useFps(enabled) {
  const [fps, setFps] = useState(0)
  useEffect(() => {
    if (!enabled) return
    let raf, frames = 0, last = performance.now()
    const loop = (now) => {
      frames++
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)))
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
  return fps
}

function isTypingTarget(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function Cell({ name, title, active, onClick, divider }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={[
        'px-3 py-1.5 inline-flex items-center cursor-pointer transition-colors',
        divider ? 'border-l border-fg-08' : '',
        active ? 'text-emphasis' : 'text-meta hover:text-emphasis',
      ].filter(Boolean).join(' ')}
    >
      <Icon name={name} size={14} />
    </button>
  )
}

export default function TransportBar() {
  const { playing, loopSeconds, play, pause, seek, setLoopSeconds } = useTransport()
  const [showFps, setShowFps] = useState(false)
  const fps = useFps(showFps)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'f' && e.key !== 'F') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      setShowFps((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="play" title="Play" active={playing} onClick={play} />
        <Cell name="pause" title="Pause" active={!playing} onClick={pause} divider />
      </div>

      <Input
        variant="ghost"
        size="sm"
        prefix="Loop /"
        suffix="s"
        chars={3}
        value={String(loopSeconds)}
        onChange={(e) => setLoopSeconds(e.target.value)}
        inputClassName="text-center"
        className="flex-1 justify-center"
        title="Loop length (seconds)"
      />

      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="stop" title="Stop" onClick={() => { pause(); seek(0) }} />
        <Cell name="rewind" title="Rewind" onClick={() => seek(0)} divider />
      </div>

      {showFps && (
        <span
          className="absolute bottom-2 right-3 px-2 py-1 rounded border border-fg-08 bg-surface-secondary kol-mono-12 text-emphasis tabular-nums"
          title="Framerate — press F to hide"
        >
          {fps} fps
        </span>
      )}
    </div>
  )
}
