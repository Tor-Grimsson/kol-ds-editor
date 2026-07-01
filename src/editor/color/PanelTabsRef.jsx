import './color-panel.css'

const TABS = ['Stroke', 'Colour', 'Swatches']

export default function PanelTabsRef({ active = 'Colour', onChange }) {
  return (
    <div className="kol-color-panel">
      <div className="kol-color-panel-tabs flex items-center gap-[14px] h-9 px-[10px]">
        <div className="kol-color-panel-close" title="Close" />
        <div className="kol-color-panel-divider" />
        {TABS.map((t) => (
          <div
            key={t}
            className={`kol-color-panel-tab${t === active ? ' is-active' : ''}`}
            onClick={() => onChange?.(t)}
          >
            {t}
          </div>
        ))}
        <div className="ml-auto w-[18px] h-[18px] grid place-items-center text-[#8a8a8a] cursor-pointer" title="More">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M2 4l3 3 3-3" />
          </svg>
        </div>
      </div>
    </div>
  )
}
