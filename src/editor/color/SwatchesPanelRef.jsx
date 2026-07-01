import { PanelBody, ChevYStack } from './shared'

const SWATCHES = [
  '#1a1a1a', '#2d2d2d', '#404040', '#5a5a5a', '#7a7a7a', '#9a9a9a', '#bababa', '#e0e0e0',
  '#3a1a1a', '#5a2424', '#7a3030', '#9a4040', '#3a2a1a', '#5a3a24', '#7a5030', '#9a6840',
  '#1a3a1a', '#244a24', '#306030', '#408040', '#1a2a3a', '#244a5a', '#30607a', '#40809a',
  '#2a1a3a', '#3a244a', '#503060', '#684080', '#3a1a2a', '#5a2440', '#7a3060', '#9a4080',
  '#0a0a0a', '#141414', '#1e1e1e', '#282828', '#323232', '#3c3c3c', '#464646', '#505050',
]

export default function SwatchesPanelRef() {
  return (
    <PanelBody>
      <p className="kol-color-panel-uplabel mb-[6px]">Recent</p>
      <div className="kol-color-panel-recent mb-[14px]" />
      <div className="flex items-center gap-[6px] mb-3">
        <div className="kol-color-panel-pal-select">
          <span className="text-[#6a6a6a]">▤</span>
          <span className="flex-1">bingo</span>
          <ChevYStack />
        </div>
        <div className="flex gap-[6px]">
          <div className="kol-color-panel-tool-btn">+</div>
          <div className="kol-color-panel-tool-btn">⋯</div>
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1 mb-[14px]">
        {SWATCHES.map((c, i) => (
          <div key={i} className="kol-color-panel-sw-grid-cell" style={{ background: c }} />
        ))}
      </div>
      <div className="flex items-center gap-2 pt-[10px] border-t border-[#2a2a2a] text-[#6a6a6a]">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="4.5" cy="4.5" r="3.2" />
          <path d="M7 7l3 3" />
        </svg>
        <input className="kol-color-panel-search-input" placeholder="search swatches" />
      </div>
    </PanelBody>
  )
}
