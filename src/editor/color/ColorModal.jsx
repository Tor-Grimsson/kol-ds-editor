import { useState } from 'react'
import { TabsRow }      from './PanelTabs'
import { StrokeBody }   from './StrokePanel'
import { ColourBody }   from './ColourPanel'
import { SwatchesBody } from './SwatchesPanel'
import { useColorTarget } from './useColorTarget'

/**
 * ColorModal — combined panel: TabsRow + active body in a single shell.
 *
 * Bound to the active color target (canvas fill or selected layer color) via
 * `useColorTarget`. Each body reads/writes through that target so picking a
 * swatch, dragging a hue strip, or adjusting a slider mutates the same value.
 */
export default function ColorModal({ defaultTab = 'Colour', onClose, onMinimise }) {
  const [tab, setTab] = useState(defaultTab)
  const target = useColorTarget()

  const onPickSwatch = (hex) => {
    target.onChange(hex.toUpperCase())
  }

  return (
    <div
      className="bg-surface-primary overflow-hidden border-b border-fg-08 flex flex-col"
      style={{ height: 320 }}
    >
      <div className="border-b border-fg-08 shrink-0">
        <TabsRow active={tab} onChange={setTab} onClose={onClose} onMinimise={onMinimise} />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'Stroke'   && <StrokeBody />}
        {tab === 'Colour'   && <ColourBody />}
        {tab === 'Swatches' && <SwatchesBody onPick={onPickSwatch} />}
      </div>
    </div>
  )
}
