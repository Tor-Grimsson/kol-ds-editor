import { useState } from 'react'
import { TabsRow } from '../../color/PanelTabs'
import { LayerStackBody } from '../../compose/LayerStack'
import AssetsBody from '../../compose/AssetsBody'

const TABS = ['Layers', 'Assets']

/**
 * LayersAssetsPanel — left.body. Two tabs (Layers · Assets) sharing one
 * shell. Layers tab shows the live layer stack; Assets tab is a library of
 * draggable / clickable assets (logos for now; templates + layouts later).
 */
export default function LayersAssetsPanel() {
  const [tab, setTab] = useState('Layers')

  return (
    <div className="kol-compose-rail border-b border-fg-08">
      <div className="border-b border-fg-08">
        <TabsRow tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'Layers' && <LayerStackBody />}
        {tab === 'Assets' && <AssetsBody />}
      </div>
    </div>
  )
}
