import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MenuItem, MenuDropdownItem, MenuDropdownDivider, MenuDropdownNest } from '@kolkrabbi/kol-component'
import { Input, useModal } from '@kolkrabbi/kol-component'
import EditorIcon from '../icons/EditorIcon'
import { ASPECTS } from './aspects'
import { useComposeState } from '../compose/state'
import { useGeneratorLibrary } from '../library/LibraryProvider'
import { STARTERS } from '../library/starters'
import { usePatternState } from '../modes/pattern/state'
import { useTypeState } from '../modes/type/state'
import { getFeatures } from '../registry/features'
import { useComposeFile } from '../compose/useComposeFile'
import { findLayerDeep } from '../compose/helpers'
import { FILTERS } from '../../filters'
import { schemaDefaults } from '../params/schema'
import { loopById } from '../../loops/registry'

/**
 * MenuTop — top bar above the editor grid.
 *
 *   [ Frame title ]   [ Mode ▼ ]  [ File ▼ ]  [ Canvas ▼ ]  [ Templates ▼ ]
 *
 * The top-level entries (Mode / File / Canvas / Templates) are MenuItems;
 * each opens a dropdown panel of MenuDropdownItems.
 */
const ASPECT_OPTIONS = ASPECTS.map((a) => ({ value: a.id, label: a.label }))

const SLOT_META = {
  palette: { label: 'Palettes', target: 'palette' },
  pattern: { label: 'Patterns', target: 'pattern' },
  type:    { label: 'Types',    target: 'type'    },
  preset:  { label: 'Presets',  target: 'compose' },
}

const SLOT_KEYS = ['palette', 'pattern', 'type', 'preset']

export default function MenuTop() {
  const {
    aspect, setAspect,
    view, setView,
    layers, selectedId, updateLayer,
    canUndo, canRedo, undo, redo,
    clearLayers,
    currentPresetId, currentPresetName, setCurrentPresetName,
    loadPreset, loadPalette,
    snapEnabled, toggleSnap,
  } = useComposeState()
  const { library } = useGeneratorLibrary()
  const { loadPattern } = usePatternState()
  const { loadType }    = useTypeState()
  const navigate = useNavigate()
  const { mode: currentMode } = useParams()
  const modal = useModal()
  /* Mode menu from the feature registry — computed at render so registration
   * (Editor's side-effect import) has already run. */
  const modes = getFeatures().filter((f) => f.nav !== false)

  /* Save / save-as / export shared with the rail EditorFooter. */
  const { onSave, onSaveAs, onExportSvg, onExportPng } = useComposeFile()

  /* Frame title — click-to-edit inline. Enter/blur commit, Escape cancels
   * (unmount doesn't re-fire the React blur handler). */
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft]     = useState('')
  const startTitleEdit = () => { setTitleDraft(currentPresetName ?? ''); setEditingTitle(true) }
  const commitTitle    = () => { setEditingTitle(false); setCurrentPresetName(titleDraft.trim() || null) }

  /* Effects menu (Phase 7) — apply a filter to the selected layer and jump
   * to the Effects tab. Engine (GL) filters need an image source: photo
   * layers get the full catalog, other positioned layers the canvas set;
   * engine (GL) loops can't host effects yet (no GL source path). */
  const fxLayer = selectedId && selectedId !== 'canvas' ? findLayerDeep(layers, selectedId) : null
  const fxEngineLoop = fxLayer?.type === 'loop' && loopById(fxLayer.loopId)?.kind === 'engine'
  const fxTarget = fxLayer && !fxEngineLoop && ['shape', 'text', 'pattern', 'path', 'loop', 'photo'].includes(fxLayer.type) ? fxLayer : null
  const fxOptions = fxTarget
    ? FILTERS.filter((f) => fxTarget.type === 'photo' || f.kind !== 'engine')
    : []
  const applyEffect = (f) => {
    if (!fxTarget) return
    updateLayer(fxTarget.id, { filterId: f.id, ...schemaDefaults(f.params) })
    window.dispatchEvent(new CustomEvent('kol:open-effects'))
  }
  const clearEffect = () => {
    if (fxTarget) updateLayer(fxTarget.id, { filterId: null })
  }

  const confirmReplaceIfUnsaved = async () => {
    if (layers.length === 0) return true
    if (currentPresetId)      return true
    return modal.confirm('Discard the current canvas? Unsaved changes will be lost.')
  }

  const onOpenItem = async (slot, item) => {
    if (slot === 'preset' && !(await confirmReplaceIfUnsaved())) return
    switch (slot) {
      case 'palette': loadPalette(item); break
      case 'pattern': loadPattern(item); break
      case 'type':    loadType(item);    break
      case 'preset':  loadPreset(item);  break
      default: return
    }
    navigate(`/editor/${SLOT_META[slot].target}`)
  }

  const onOpenStarter = async (s) => {
    if (!(await confirmReplaceIfUnsaved())) return
    loadPreset(s.preset)
    navigate('/editor/compose')
  }

  return (
    <div className="kol-editor-topbar flex items-center gap-3 px-4 h-12 border-b border-fg-08">
      {editingTitle ? (
        <Input
          variant="ghost"
          size="sm"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitTitle()
            else if (e.key === 'Escape') setEditingTitle(false)
          }}
          autoFocus
          placeholder="Untitled"
          width="220px"
          inputClassName="kol-helper-12 text-emphasis"
        />
      ) : (
        <span
          className="kol-helper-12 text-emphasis truncate cursor-text"
          onClick={startTitleEdit}
          title="Rename"
        >
          {currentPresetName || 'Untitled'}
        </span>
      )}
      <div className="flex items-center gap-1 ml-auto">
        {/* panelClassName z-[1000]: MenuItem panels opt out of .kol-popover
            chrome (panel={false}) and get NO z-index — the canvas rulers
            (z-index 4, positioned) would paint over them. Match the
            .kol-popover token value. */}
        <MenuItem label="Effects" panelClassName="z-[1000]" panelStyle={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="py-1 w-[220px]">
            {!fxTarget ? (
              <div className="kol-helper-10 text-subtle px-3 py-1">Select a layer first</div>
            ) : (
              <>
                <MenuDropdownItem onClick={clearEffect} disabled={!fxTarget.filterId}>
                  None
                </MenuDropdownItem>
                <MenuDropdownDivider />
                {fxOptions.map((f) => (
                  <MenuDropdownItem
                    key={f.id}
                    onClick={() => applyEffect(f)}
                    shortcut={fxTarget.filterId === f.id ? <EditorIcon name="check" size={11} /> : undefined}
                  >
                    {f.label}
                  </MenuDropdownItem>
                ))}
              </>
            )}
          </div>
        </MenuItem>

        <MenuItem label="Mode" panelClassName="z-[1000]">
          <div className="py-1 w-[220px]">
            {modes.map((m) => (
              <MenuDropdownItem
                key={m.id}
                onClick={() => navigate(`/editor/${m.id}`)}
                shortcut={currentMode === m.id ? <EditorIcon name="check" size={11} /> : undefined}
              >
                {m.title}
              </MenuDropdownItem>
            ))}
          </div>
        </MenuItem>

        <MenuItem label="File" panelClassName="z-[1000]">
          <div className="py-1 w-[220px]">
            <MenuDropdownItem onClick={onSave}>
              {currentPresetId ? 'Save' : 'Save…'}
            </MenuDropdownItem>
            <MenuDropdownItem onClick={onSaveAs}>
              Save as…
            </MenuDropdownItem>
            <MenuDropdownItem onClick={clearLayers} disabled={layers.length === 0}>
              Clear
            </MenuDropdownItem>
            <MenuDropdownDivider />
            <MenuDropdownItem
              onClick={toggleSnap}
              shortcut={snapEnabled ? <EditorIcon name="check" size={11} /> : undefined}
            >
              Snap to guides
            </MenuDropdownItem>
            <MenuDropdownDivider />
            <MenuDropdownItem onClick={onExportSvg}>
              Export SVG
            </MenuDropdownItem>
            <MenuDropdownItem onClick={onExportPng}>
              Export PNG
            </MenuDropdownItem>
            <MenuDropdownDivider />
            <MenuDropdownItem onClick={undo} disabled={!canUndo} shortcut="⌘Z">Undo</MenuDropdownItem>
            <MenuDropdownItem onClick={redo} disabled={!canRedo} shortcut="⇧⌘Z">Redo</MenuDropdownItem>
          </div>
        </MenuItem>

        <MenuItem label="Canvas" panelClassName="z-[1000]">
          <div className="py-1 w-[220px]">
            <MenuDropdownNest label="Aspect">
              {ASPECT_OPTIONS.map((opt) => (
                <MenuDropdownItem
                  key={opt.value}
                  onClick={() => setAspect(opt.value)}
                  shortcut={aspect === opt.value ? <EditorIcon name="check" size={11} /> : undefined}
                >
                  {opt.label}
                </MenuDropdownItem>
              ))}
            </MenuDropdownNest>
            <MenuDropdownNest label="View">
              <MenuDropdownItem
                onClick={() => setView('single')}
                shortcut={view === 'single' ? <EditorIcon name="check" size={11} /> : undefined}
              >
                Single
              </MenuDropdownItem>
              <MenuDropdownItem
                onClick={() => setView('social')}
                shortcut={view === 'social' ? <EditorIcon name="check" size={11} /> : undefined}
              >
                Social
              </MenuDropdownItem>
            </MenuDropdownNest>
          </div>
        </MenuItem>

        <MenuItem label="Templates" align="end" panelClassName="z-[1000]" panelStyle={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="py-1 w-[220px]">
            <MenuDropdownNest label={`Starters · ${STARTERS.length}`}>
              {STARTERS.map((s) => (
                <MenuDropdownItem
                  key={s.id}
                  onClick={() => onOpenStarter(s)}
                >
                  {s.name}
                </MenuDropdownItem>
              ))}
            </MenuDropdownNest>
            {SLOT_KEYS.map((slot) => {
              const items = library[slot] ?? []
              return (
                <MenuDropdownNest
                  key={slot}
                  label={`${SLOT_META[slot].label} · ${items.length}`}
                >
                  {items.length === 0 ? (
                    <div className="kol-helper-10 text-subtle px-3 py-1">empty</div>
                  ) : (
                    items.map((item, i) => {
                      const fallback = `${SLOT_META[slot].label.slice(0, -1)} ${i + 1}`
                      const label = item.name
                        ?? (slot === 'type'   && item.text ? item.text.slice(0, 24) : null)
                        ?? (slot === 'preset' && item.aspect ? `${item.aspect}${Array.isArray(item.layers) ? ` · ${item.layers.length}L` : ''}` : null)
                        ?? fallback
                      const swatch = slot === 'palette' && Array.isArray(item.colors) && (
                        <div className="flex gap-px">
                          {item.colors.slice(0, 6).map((c, j) => (
                            <span key={j} className="inline-block" style={{ background: c ?? 'transparent', width: 8, height: 14 }} />
                          ))}
                        </div>
                      )
                      return (
                        <MenuDropdownItem
                          key={item.id}
                          onClick={() => onOpenItem(slot, item)}
                          prefix={swatch || undefined}
                        >
                          {label}
                        </MenuDropdownItem>
                      )
                    })
                  )}
                </MenuDropdownNest>
              )
            })}
          </div>
        </MenuItem>
      </div>
    </div>
  )
}
