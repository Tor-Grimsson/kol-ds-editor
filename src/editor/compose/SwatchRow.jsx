import EditorIcon from '../icons/EditorIcon'
import { Input } from '@kolkrabbi/kol-component'
import { ColorSwatch } from '@kolkrabbi/kol-component'
import { tokenNameFor } from '../modes/palette/pools'

/**
 * SwatchRow — single palette slot row for the compose Palette inspector.
 *
 * The swatch chip routes through the DS `ColorSwatch` atom for visual
 * consistency with `SwatchesPanel`, `ColorPicker`, and `LayerInspector`.
 * The lock overlay sits above the chip in a sibling absolute span (sized
 * to the wrapper) so the chip's `overflow-hidden` doesn't clip it.
 */
export default function SwatchRow({ label, hex, disabled, unused, locked, edited, onToggleLock, onChangeHex }) {
  return (
    <div
      className={`kol-swatch-row grid items-center gap-2${disabled ? ' opacity-30 pointer-events-none' : ''}${unused ? ' is-unused' : ''}`}
      style={{ gridTemplateColumns: '24px 1fr 1fr 1fr' }}
      aria-disabled={disabled || undefined}
    >
      <div className="group relative shrink-0" style={{ width: 24, height: 24 }}>
        <ColorSwatch
          hex={unused ? null : hex}
          showTransparent={unused}
          size="stretch"
          onClick={onToggleLock}
          aria-pressed={locked}
          title={locked ? 'Unlock' : 'Lock'}
        />
        <span
          aria-hidden="true"
          className={`absolute inset-0 inline-flex items-center justify-center rounded-[2px] transition-opacity bg-fg-absolute-48 text-white pointer-events-none ${
            locked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <EditorIcon name={locked ? 'lock' : 'unlock'} size={12} />
        </span>
      </div>
      <span className={`kol-helper-12 truncate ${unused ? 'text-meta' : 'text-emphasis'}`}>{label}</span>
      <span className={`kol-helper-10 truncate ${unused ? 'text-subtle' : 'text-meta'}`}>{tokenNameFor(hex) ?? ''}</span>
      <Input
        variant="filled"
        size="sm"
        prefix="#"
        chars={6}
        uppercase
        value={(hex ?? '').replace(/^#/, '').toUpperCase()}
        onChange={(e) => onChangeHex('#' + e.target.value.replace(/^#/, '').toUpperCase())}
        maxLength={6}
        className={unused ? 'opacity-50' : ''}
      />
    </div>
  )
}
