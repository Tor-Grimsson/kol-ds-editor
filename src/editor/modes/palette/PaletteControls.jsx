import { useNavigate } from 'react-router-dom'
import { Dropdown } from '@kolkrabbi/kol-component'
import { ViewToggle } from '@kolkrabbi/kol-component'
import EditorButton from '../../components/EditorButton'
import { Section } from '@kolkrabbi/kol-component'
import { useGeneratorLibrary } from '../../library/LibraryProvider'
import { ASPECTS } from '../../shell/aspects'
import { LAYOUTS } from './palettes'
import { POOLS, MODES } from './pools'
import { usePaletteState } from './state'
import { useComposeState } from '../../compose/state'
import SwatchRow from '../../compose/SwatchRow'

const toOptions = (items) => items.map((i) => ({ value: i.id, label: i.label }))
const ASPECT_OPTIONS = ASPECTS.map(a => ({ value: a.id, label: a.label }))
const LAYOUT_OPTIONS = toOptions(LAYOUTS)
const POOL_OPTIONS   = toOptions(POOLS)
const MODE_OPTIONS   = toOptions(MODES)

const SLOT_LABELS = ['Primary', 'Secondary', 'Light', 'Dark', 'Accent', 'BG']

/**
 * PaletteControls — Tool Properties content for Palette mode. The full
 * palette generator control surface (aspect / layout / pool / mode /
 * swatches / randomize / save).
 */
export default function PaletteControls() {
  const {
    aspect, setAspect,
    bgOn, poolId, modeId, colors, locks, edited,
    isSeedSeeding,
    toggleBg, setPoolId: changePool, setModeId: changeMode,
    toggleLock, setColorAt, randomize, reset,
  } = useComposeState()
  const {
    layoutId, setLayoutId, layout,
    logoId, setLogoId,
  } = usePaletteState()
  const visibleSlotCount = bgOn ? 6 : 5
  const { savePalette } = useGeneratorLibrary()
  const navigate = useNavigate()

  return (
    <div className="kol-compose-rail">
      <div className="kol-compose-rail-head">
        <span className="kol-helper-10 uppercase text-meta">Palette controls</span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        <div className="grid grid-cols-4 items-end gap-2">
          <div className="col-span-3 min-w-0">
            <Section label="Aspect">
              <Dropdown
                variant="subtle" size="sm" className="w-full"
                options={ASPECT_OPTIONS}
                value={aspect}
                onChange={setAspect}
              />
            </Section>
          </div>
          <Section label="Logo">
            <ViewToggle
              variant="single"
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              viewMode={logoId === 'no-logo' ? 'off' : 'on'}
              onViewChange={(v) => setLogoId(v === 'off' ? 'no-logo' : 'client')}
            />
          </Section>
        </div>

        <div className="grid grid-cols-4 items-end gap-2">
          <div className="col-span-3 min-w-0">
            <Section label="Layout">
              <Dropdown variant="subtle" size="sm" className="w-full" options={LAYOUT_OPTIONS} value={layoutId} onChange={setLayoutId} />
            </Section>
          </div>
          <Section label="BG">
            <ViewToggle
              variant="single"
              options={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
              viewMode={bgOn ? 'on' : 'off'}
              onViewChange={(v) => { if ((v === 'on') !== bgOn) toggleBg() }}
            />
          </Section>
        </div>

        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <Section label="Pool">
              <Dropdown variant="subtle" size="sm" className="w-full" options={POOL_OPTIONS} value={poolId} onChange={changePool} />
            </Section>
          </div>
          <div className="flex-1 min-w-0">
            <Section label="Mode">
              <Dropdown variant="subtle" size="sm" className="w-full" options={MODE_OPTIONS} value={modeId} onChange={changeMode} />
            </Section>
          </div>
        </div>

        <Section label="Swatches">
          <div className="flex flex-col gap-2">
            {SLOT_LABELS.slice(0, visibleSlotCount).map((label, idx) => (
              <SwatchRow
                key={label}
                label={label}
                hex={colors[idx]}
                disabled={colors[idx] == null}
                unused={idx < 5 && !(layout.uses ?? [0, 1, 2, 3, 4]).includes(idx)}
                locked={locks[idx]}
                edited={edited[idx] || (isSeedSeeding && idx === 0)}
                onToggleLock={() => toggleLock(idx)}
                onChangeHex={(v) => setColorAt(idx, v)}
              />
            ))}
          </div>
        </Section>

        <div className="flex gap-2 pt-2 border-t border-fg-08">
          <EditorButton variant="primary" size="sm" className="flex-1" onClick={randomize}>
            Randomize
          </EditorButton>
          <EditorButton variant="primary" size="sm" className="flex-1" onClick={reset}>
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

        {/* Palette state is already shared with compose (see useComposeState
         * above) — Send is purely navigation. */}
        <EditorButton
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => navigate('/editor/compose')}
        >
          Send to compose
        </EditorButton>
      </div>
    </div>
  )
}
