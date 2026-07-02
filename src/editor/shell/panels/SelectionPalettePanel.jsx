import { useEffect, useState } from 'react'
import { TabsRow } from '../../color/PanelTabs'
import { useComposeState } from '../../compose/state'
import PaletteInspector from '../../compose/inspectors/PaletteInspector'
import InspectorRail from '../../compose/InspectorRail'
import ParametersPanel from '../../compose/inspectors/ParametersPanel'
import EffectsPanel from '../../compose/inspectors/EffectsPanel'

const TABS = ['Inspector', 'Parameters', 'Effects', 'Palette']

/**
 * SelectionPalettePanel — right.body. Four tabs sharing one shell:
 * Inspector (high-level layer surface, default) · Parameters (schema-driven
 * per-type controls — loop/shape/text/pattern) · Effects (category → filter
 * picker + params) · Palette (frame-level palette controls).
 *
 * Auto-flip: when the user selects a real layer, the active tab flips to
 * Inspector (Canvas-row clicks are skipped — selecting Canvas means frame
 * editing, where Palette is more useful). Inspector pointer rows dispatch
 * `kol:open-params` / `kol:open-effects` to flip here.
 */
export default function SelectionPalettePanel() {
  const { selectedId } = useComposeState()
  const [tab, setTab]  = useState('Inspector')

  useEffect(() => {
    if (selectedId && selectedId !== 'canvas') setTab('Inspector')
  }, [selectedId])

  useEffect(() => {
    const openParams  = () => setTab('Parameters')
    const openEffects = () => setTab('Effects')
    window.addEventListener('kol:open-params', openParams)
    window.addEventListener('kol:open-effects', openEffects)
    return () => {
      window.removeEventListener('kol:open-params', openParams)
      window.removeEventListener('kol:open-effects', openEffects)
    }
  }, [])

  return (
    <div className="kol-compose-rail">
      <div className="border-b border-fg-08">
        <TabsRow tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'Palette'    && <div className="p-4"><PaletteInspector /></div>}
        {tab === 'Inspector'  && <InspectorRail />}
        {tab === 'Parameters' && <ParametersPanel />}
        {tab === 'Effects'    && <EffectsPanel />}
      </div>
    </div>
  )
}
