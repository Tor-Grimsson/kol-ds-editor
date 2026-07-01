import { useEffect, useState } from 'react'
import { TabsRow } from '../../color/PanelTabs'
import { useComposeState } from '../../compose/state'
import PaletteInspector from '../../compose/inspectors/PaletteInspector'
import InspectorRail from '../../compose/InspectorRail'

const TABS = ['Palette', 'Inspector']

/**
 * SelectionPalettePanel — right.body. Two tabs (Palette · Inspector) sharing
 * one shell. Palette tab shows the active palette controls (frame-level);
 * Inspector tab shows selection-driven layer/frame editor.
 *
 * Auto-flip: when the user selects a real layer, the active tab flips to
 * Inspector. Canvas-row clicks are skipped — selecting Canvas means the
 * user is editing the frame, where Palette is more useful than the canvas
 * inspector. Manual click on Inspector still works for the Canvas case.
 */
export default function SelectionPalettePanel() {
  const { selectedId } = useComposeState()
  const [tab, setTab]  = useState('Palette')

  useEffect(() => {
    if (selectedId && selectedId !== 'canvas') setTab('Inspector')
  }, [selectedId])

  return (
    <div className="kol-compose-rail">
      <div className="border-b border-fg-08">
        <TabsRow tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'Palette'   && <div className="p-4"><PaletteInspector /></div>}
        {tab === 'Inspector' && <InspectorRail />}
      </div>
    </div>
  )
}
