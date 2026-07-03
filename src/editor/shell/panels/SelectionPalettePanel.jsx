import { useEffect, useState } from 'react'
import { TabsRow } from '../../color/PanelTabs'
import { useComposeState } from '../../compose/state'
import { findLayerDeep } from '../../compose/helpers'
import InspectorRail from '../../compose/InspectorRail'
import ParametersPanel from '../../compose/inspectors/ParametersPanel'
import EffectsPanel from '../../compose/inspectors/EffectsPanel'
import PatternPanel from '../../compose/inspectors/PatternPanel'
import TextPanel from '../../compose/inspectors/TextPanel'

const BASE_TABS = ['Inspector', 'Parameters', 'Effects']

/**
 * SelectionPalettePanel — right.body. Three fixed tabs sharing one shell —
 * Inspector (high-level layer surface, default) · Parameters (schema-driven
 * per-type controls) · Effects (category → filter picker + params) — plus a
 * selection-driven fourth: Pattern (pattern layer selected) or Text (text
 * layer selected), each the harvested mode surface bound to the layer's own
 * props. The type tab appends at the end so the fixed three never shift.
 * Palette editing left the rail (palette modal).
 *
 * Auto-flip: when the user selects a real layer, the active tab flips to
 * Inspector (Canvas-row clicks are skipped — selecting Canvas means frame
 * editing). Inspector pointer rows dispatch `kol:open-params` /
 * `kol:open-effects` / `kol:open-pattern` / `kol:open-text` to flip here.
 */
export default function SelectionPalettePanel() {
  const { selectedId, layers } = useComposeState()
  const [tab, setTab]  = useState('Inspector')

  /* Same layer resolution as ParametersPanel/EffectsPanel — in multi-select
   * the first selected layer drives the panels, so it gates the tab too. */
  const layer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null
  const tabs = layer?.type === 'pattern' ? [...BASE_TABS, 'Pattern']
    : layer?.type === 'text' ? [...BASE_TABS, 'Text']
    : BASE_TABS
  /* Selection changes can strand the active tab (Pattern active, then a
   * shape selected / deselect-all) — fall back without writing state. */
  const active = tabs.includes(tab) ? tab : 'Inspector'

  useEffect(() => {
    if (selectedId && selectedId !== 'canvas') setTab('Inspector')
  }, [selectedId])

  useEffect(() => {
    const openParams  = () => setTab('Parameters')
    const openEffects = () => setTab('Effects')
    const openPattern = () => setTab('Pattern')
    const openText    = () => setTab('Text')
    window.addEventListener('kol:open-params', openParams)
    window.addEventListener('kol:open-effects', openEffects)
    window.addEventListener('kol:open-pattern', openPattern)
    window.addEventListener('kol:open-text', openText)
    return () => {
      window.removeEventListener('kol:open-params', openParams)
      window.removeEventListener('kol:open-effects', openEffects)
      window.removeEventListener('kol:open-pattern', openPattern)
      window.removeEventListener('kol:open-text', openText)
    }
  }, [])

  return (
    <div className="kol-compose-rail">
      <div className="border-b border-fg-08">
        <TabsRow tabs={tabs} active={active} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {active === 'Inspector'  && <InspectorRail />}
        {active === 'Parameters' && <ParametersPanel />}
        {active === 'Effects'    && <EffectsPanel />}
        {active === 'Pattern'    && <PatternPanel />}
        {active === 'Text'       && <TextPanel />}
      </div>
    </div>
  )
}
