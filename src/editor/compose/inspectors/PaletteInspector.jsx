import EditorButton from '../../components/EditorButton'
import { Dropdown } from '@kolkrabbi/kol-component'
import { LabeledControl } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import SwatchRow from '../SwatchRow'
import { POOLS, MODES } from '../../modes/palette/pools'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { useComposeState } from '../state'

const toOptions = (items) => items.map((i) => ({ value: i.id, label: i.label }))
const POOL_OPTIONS = toOptions(POOLS)
const MODE_OPTIONS = toOptions(MODES)

const SLOT_LABELS = ['Primary', 'Secondary', 'Light', 'Dark', 'Accent', 'BG']

/**
 * Palette inspector — port of Combo Lab's palette controls into /compose.
 *
 * Mutates compose state via useComposeState().
 */
export default function PaletteInspector() {
  const {
    poolId, modeId, colors, locks, edited, bgOn,
    isSeedSeeding,
    setPoolId, setModeId,
    toggleLock, setColorAt, randomize, reset, toggleBg,
  } = useComposeState()

  const { savePalette } = useGeneratorLibrary()

  const visibleSlotCount = bgOn ? 6 : 5

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        <LabeledControl label="Pool">
          <Dropdown variant="subtle" size="sm" className="w-full" options={POOL_OPTIONS} value={poolId} onChange={setPoolId} />
        </LabeledControl>
        <LabeledControl label="Mode">
          <Dropdown variant="subtle" size="sm" className="w-full" options={MODE_OPTIONS} value={modeId} onChange={setModeId} />
        </LabeledControl>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="kol-helper-10 uppercase text-meta">Swatches</span>
          <div className="flex items-center gap-2">
            <span className="kol-helper-10 uppercase text-meta">BG</span>
            <ViewToggle
              variant="single"
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              viewMode={bgOn ? 'on' : 'off'}
              onViewChange={(v) => { if ((v === 'on') !== bgOn) toggleBg() }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {SLOT_LABELS.slice(0, visibleSlotCount).map((label, idx) => (
            <SwatchRow
              key={label}
              label={label}
              hex={colors[idx]}
              disabled={colors[idx] == null}
              unused={false}
              locked={locks[idx]}
              edited={edited[idx] || (isSeedSeeding && idx === 0)}
              onToggleLock={() => toggleLock(idx)}
              onChangeHex={(v) => setColorAt(idx, v)}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2 border-t border-fg-08">
        <EditorButton variant="primary" size="sm" className="flex-1" onClick={randomize}>
          Randomize
        </EditorButton>
        <EditorButton variant="secondary" size="sm" className="flex-1" onClick={reset}>
          Reset
        </EditorButton>
      </div>

      <EditorButton
        variant="primary"
        size="sm"
        className="w-full"
        onClick={() => savePalette({ colors, bgEnabled: bgOn, poolId, modeId })}
      >
        Save palette to library
      </EditorButton>
    </div>
  )
}
