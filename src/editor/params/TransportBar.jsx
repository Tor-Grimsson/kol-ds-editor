import { Icon } from '@kolkrabbi/kol-icons'
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
 * Space is NOT bound to play/pause here — Space is pan in this editor.
 * The fps readout lives in the canvas corner, not here.
 */

/* Size presets. `sm` (default) reproduces the desktop footer verbatim; `lg`
 * scales the cells, icons, and the loop readout to the touch scale used by
 * the mobile overlay (matches `size="lg"` buttons/toggles, ~40px tall). */
const SIZES = {
  sm: { cell: 'px-3 py-1.5', icon: 14, input: 'sm' },
  lg: { cell: 'px-4 py-2.5', icon: 20, input: 'lg' },
}

function Cell({ name, title, active, onClick, divider, cfg }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={[
        `${cfg.cell} inline-flex items-center cursor-pointer transition-colors`,
        divider ? 'border-l border-fg-08' : '',
        active ? 'text-emphasis' : 'text-meta hover:text-emphasis',
      ].filter(Boolean).join(' ')}
    >
      <Icon name={name} size={cfg.icon} />
    </button>
  )
}

export default function TransportBar({ size = 'sm' }) {
  const cfg = SIZES[size] ?? SIZES.sm
  const { playing, loopSeconds, play, pause, stop, rewind, setLoopSeconds } = useTransport()

  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="play" title="Play" active={playing} onClick={play} cfg={cfg} />
        <Cell name="pause" title="Pause" active={!playing} onClick={pause} divider cfg={cfg} />
      </div>

      <Input
        variant="ghost"
        size={cfg.input}
        prefix="Loop /"
        suffix="s"
        chars={3}
        value={String(loopSeconds)}
        onChange={(e) => setLoopSeconds(e.target.value)}
        inputClassName="text-center"
        className="flex-1 justify-center"
        title="Loop length (seconds)"
      />

      {/* Stop / rewind bump the transport's reset epoch — stateful consumers
          (sims, trails, video) restart fresh. Pause (left group) never does. */}
      <div className="inline-flex rounded overflow-hidden bg-surface-secondary shrink-0">
        <Cell name="stop" title="Stop" onClick={stop} cfg={cfg} />
        <Cell name="rewind" title="Rewind" onClick={rewind} divider cfg={cfg} />
      </div>
    </div>
  )
}
