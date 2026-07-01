import EditorIcon from '../icons/EditorIcon'

const COLOR_TABS = ['Stroke', 'Colour', 'Swatches']

/**
 * TabsRow — bare tab row (close · tabs · minimise).
 * No outer chrome; the consumer wraps it. Close + minimise icons render only
 * if their handlers are passed. `tabs` defaults to color tabs but accepts any
 * label list — used by ColorModal (color tabs) and SelectionPalettePanel
 * (Palette / Inspector).
 */
export function TabsRow({ tabs = COLOR_TABS, active, onChange, onClose, onMinimise }) {
  return (
    <div className="flex items-stretch gap-4 px-3 h-10">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-meta hover:text-emphasis self-center"
          style={{ lineHeight: 0 }}
        >
          <EditorIcon name="close" size={12} />
        </button>
      )}

      {tabs.map((t) => {
        const isActive = t === active
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange?.(t)}
            aria-pressed={isActive}
            className={[
              'kol-mono-12 flex items-center cursor-pointer border-b-2',
              isActive
                ? 'text-emphasis border-fg'
                : 'text-meta hover:text-emphasis border-transparent',
            ].join(' ')}
          >
            {t}
          </button>
        )
      })}

      {onMinimise && (
        <button
          type="button"
          onClick={onMinimise}
          aria-label="Minimise"
          className="ml-auto text-meta hover:text-emphasis self-center"
          style={{ lineHeight: 0 }}
        >
          <EditorIcon name="chevron-down" size={12} />
        </button>
      )}
    </div>
  )
}

/**
 * PanelTabs — TabsRow wrapped in standalone chrome (matches the panel shells).
 */
export default function PanelTabs(props) {
  return (
    <div
      className="bg-surface-primary border border-fg-08 rounded overflow-hidden"
      style={{ width: 320 }}
    >
      <TabsRow {...props} />
    </div>
  )
}
