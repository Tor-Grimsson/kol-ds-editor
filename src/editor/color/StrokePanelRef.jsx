import { PanelBody } from './shared'

export default function StrokePanelRef() {
  return (
    <PanelBody>
      <Row label="Weight">
        <div className="flex items-center gap-2">
          <input className="kol-color-panel-num-input" defaultValue="1.5" style={{ width: 56 }} />
          <span className="text-[11px] text-[#6a6a6a]">pt</span>
        </div>
      </Row>
      <Row label="Style">
        <div className="kol-color-panel-seg">
          <div className="kol-color-panel-seg-opt is-active"><svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="1.5" /></svg></div>
          <div className="kol-color-panel-seg-opt"><svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" /></svg></div>
          <div className="kol-color-panel-seg-opt"><svg width="40" height="2" viewBox="0 0 40 2"><line x1="0" y1="1" x2="40" y2="1" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1 2" /></svg></div>
        </div>
      </Row>
      <Row label="Cap"><Seg options={['Butt', 'Round', 'Square']}        active="Butt"   /></Row>
      <Row label="Join"><Seg options={['Miter', 'Round', 'Bevel']}       active="Miter"  /></Row>
      <Row label="Align"><Seg options={['Inside', 'Center', 'Outside']}  active="Center" /></Row>
    </PanelBody>
  )
}

function Row({ label, children }) {
  return (
    <div className="grid items-center gap-[10px] mb-[10px]" style={{ gridTemplateColumns: '60px 1fr' }}>
      <div className="text-[11px] text-[#8a8a8a]">{label}</div>
      {children}
    </div>
  )
}

function Seg({ options, active }) {
  return (
    <div className="kol-color-panel-seg">
      {options.map((o) => (
        <div key={o} className={`kol-color-panel-seg-opt${o === active ? ' is-active' : ''}`}>{o}</div>
      ))}
    </div>
  )
}
