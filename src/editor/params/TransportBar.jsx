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
 * Space is NOT bound to play/pause here — Space is pan in this editor.
 * The fps readout lives in the canvas corner, not here.
 */

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
    </div>
  )
}
