import { useState } from 'react'
import KolLogo, { KOL_LOGO_VARIANTS, KOL_LOGO_NATURAL_DIMS } from '../../brand/logos/KolLogo'
import { ViewToggle } from '@kolkrabbi/kol-component'
import { useComposeState } from './state'
import { CANVAS_W, CANVAS_H } from './state'

/**
 * AssetsBody — left rail Assets tab content. Click a tile to insert a
 * shape{kind:'logo'} layer at the variant's natural aspect ratio.
 *
 * View toggle (list / grid) sits in the section header. List is the default
 * since this panel will grow more categories beyond Logos.
 */
const VIEW_OPTIONS = [
  { value: 'list', label: 'List view', icon: 'list' },
  { value: 'grid', label: 'Grid view', icon: 'grid' },
]

export default function AssetsBody() {
  const { addLayer } = useComposeState()
  const [view, setView] = useState('list')

  const insertLogo = (variant) => {
    const dims = KOL_LOGO_NATURAL_DIMS[variant] ?? { w: 320, h: 320 }
    const x = (CANVAS_W - dims.w) / 2
    const y = (CANVAS_H - dims.h) / 2
    addLayer('shape', { variant, x, y, w: dims.w, h: dims.h })
  }

  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="kol-helper-10 uppercase tracking-widest text-meta">Logos</p>
        <ViewToggle
          variant="icon"
          viewMode={view}
          onViewChange={setView}
          options={VIEW_OPTIONS}
        />
      </div>
      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-2">
          {KOL_LOGO_VARIANTS.map((variant) => (
            <button
              key={variant}
              type="button"
              onClick={() => insertLogo(variant)}
              className="bg-fg-04 hover:bg-fg-08 rounded p-3 flex flex-col items-center gap-2 cursor-pointer"
              title={variant}
            >
              <span className="block w-full h-12 text-emphasis">
                <KolLogo variant={variant} className="block w-full h-full" />
              </span>
              <span className="kol-helper-10 text-meta normal-case tracking-normal truncate w-full text-center">
                {variant}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col">
          {KOL_LOGO_VARIANTS.map((variant) => (
            <li key={variant}>
              <button
                type="button"
                onClick={() => insertLogo(variant)}
                className="w-full flex items-center gap-3 px-2 py-1.5 rounded hover:bg-fg-04 cursor-pointer text-left"
                title={variant}
              >
                <span className="block w-8 h-6 shrink-0 text-emphasis">
                  <KolLogo variant={variant} className="block w-full h-full" />
                </span>
                <span className="kol-helper-12 text-emphasis normal-case tracking-normal truncate flex-1">
                  {variant}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
