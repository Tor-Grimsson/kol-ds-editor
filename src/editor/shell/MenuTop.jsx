import { useState } from 'react'
import { MenuItem, MenuDropdownItem, MenuDropdownDivider, MenuDropdownNest } from '@kolkrabbi/kol-component'
import { Input, useModal } from '@kolkrabbi/kol-component'
import EditorIcon from '../icons/EditorIcon'
import { ASPECTS } from './aspects'
import { useComposeState } from '../compose/state'
import { useGeneratorLibrary } from '../library/LibraryProvider'
import { STARTERS } from '../library/starters'
import { useComposeFile } from '../compose/useComposeFile'
import { findLayerDeep } from '../compose/helpers'
import { isBooleanable } from '../compose/boolean-ops'
import { FILTERS } from '../../filters'
import { schemaDefaults } from '../params/schema'
import { loopById, groupById, presetsInGroup, presetsInSub, presetParams } from '../../loops/registry'
import { GENERATIVE_TREE } from '../../loops/taxonomy'
import { effectCategories } from '../compose/inspectors/effectCategories'

/**
 * MenuTop — top bar above the editor grid.
 *
 *   [ Frame title ]   [ Tools ▼ ]  [ File ▼ ]  [ Canvas ▼ ]  [ Templates ▼ ]
 *
 * The top-level entries (Tools / File / Canvas / Templates) are MenuItems;
 * each opens a dropdown panel of MenuDropdownItems.
 */
const ASPECT_OPTIONS = ASPECTS.map((a) => ({ value: a.id, label: a.label }))

const SLOT_META = {
  palette: { label: 'Palettes' },
  pattern: { label: 'Patterns' },
  type:    { label: 'Types'    },
  preset:  { label: 'Presets'  },
}

const SLOT_KEYS = ['palette', 'pattern', 'type', 'preset']

export default function MenuTop() {
  const {
    aspect, setAspect,
    view, setView,
    layers, selectedId, selectedIds, updateLayer, addLayer,
    flattenSelected, releaseBoolean,
    canUndo, canRedo, undo, redo,
    clearLayers,
    currentPresetId, currentPresetName, setCurrentPresetName,
    loadPreset, loadPalette, insertFromLibrary,
    snapEnabled, toggleSnap,
  } = useComposeState()
  const { library } = useGeneratorLibrary()
  const modal = useModal()

  const openColorModal = () => window.dispatchEvent(new CustomEvent('kol:open-color-modal'))

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
  const fxTarget = fxLayer && !fxEngineLoop && ['shape', 'text', 'pattern', 'path', 'loop', 'misc', 'photo'].includes(fxLayer.type) ? fxLayer : null
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

  /* Generative menu — the app hierarchy (METHOD > TYPE > CATEGORY > PRESET,
   * docs/documentation/01-hierarchy.md) over the loop registry. Picking a
   * preset inserts a loop layer carrying it (same update shape as the
   * inspector's applyPreset). */
  const addGenerative = (preset, groupId) => {
    addLayer('loop', {
      loopGroup:   groupId,
      presetId:    preset.id,
      presetLabel: preset.label,
      loopId:      preset.loop,
      ...presetParams(preset),
    })
  }
  /* Presets of one registry group, in file order with sub-bucket headers. */
  const generativeItems = (groupId) => {
    const out = []
    let lastSub = null
    for (const p of presetsInGroup(groupId)) {
      if (p.sub && p.sub !== lastSub) {
        lastSub = p.sub
        out.push(
          <div key={`sub-${p.sub}`} className="kol-helper-10 text-subtle px-3 pt-2 pb-1">
            {p.sub}
          </div>,
        )
      }
      out.push(
        <MenuDropdownItem key={p.id} onClick={() => addGenerative(p, groupId)}>
          {p.label}
        </MenuDropdownItem>,
      )
    }
    return out
  }
  /* Vector menu — Flatten shape (Figma ⌘E semantics): one selected bool
   * group bakes to its path; ≥2 eligible vector layers destructive-unite. */
  const vectorSel = (selectedIds ?? []).filter((id) => id !== 'canvas')
    .map((id) => findLayerDeep(layers, id)).filter(Boolean)
  const canFlatten =
    (vectorSel.length === 1 && vectorSel[0].type === 'bool') ||
    (vectorSel.length >= 2 && vectorSel.every(isBooleanable))
  /* Release = un-boolean (top-level bools, ungroup scope). */
  const canRelease = layers.some((l) => l.id === selectedId && l.type === 'bool')

  /* EFFECTS > Pattern — the four labs /optic/* generator pages. They insert
   * loop layers (nothing to filter), so they render without an fx target. */
  const FX_PATTERN_CATEGORIES = [
    { label: 'Moiré',         group: 'optic',     sub: 'Moiré' },
    { label: 'Mesh Gradient', group: 'gradients', sub: 'Mesh' },
    { label: 'Reaction',      group: 'optic',     sub: 'Reaction' },
    { label: 'Halftone',      group: 'optic',     sub: 'Halftone' },
  ]

  const confirmReplaceIfUnsaved = async () => {
    if (layers.length === 0) return true
    if (currentPresetId)      return true
    return modal.confirm('Discard the current canvas? Unsaved changes will be lost.')
  }

  /* Open a library item in place: palettes load into the live palette and
   * surface the color modal; pattern / type items insert a layer carrying
   * the saved settings (insertFromLibrary owns the spec→layer mapping);
   * presets replace the canvas. */
  const onOpenItem = async (slot, item) => {
    if (slot === 'preset' && !(await confirmReplaceIfUnsaved())) return
    switch (slot) {
      case 'palette': loadPalette(item); openColorModal();      break
      case 'pattern': insertFromLibrary('pattern', item);       break
      case 'type':    insertFromLibrary('type', item);          break
      case 'preset':  loadPreset(item);                         break
      default:
    }
  }

  const onOpenStarter = async (s) => {
    if (!(await confirmReplaceIfUnsaved())) return
    loadPreset(s.preset)
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
        <MenuItem label="Generative" panelClassName="z-[1000]" panelStyle={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="py-1 w-[260px]">
            {GENERATIVE_TREE.map((parent) => (
              <MenuDropdownNest key={parent.label} label={parent.label}>
                {parent.groups.length === 1
                  ? generativeItems(parent.groups[0])
                  : parent.groups.map((gid) => (
                      <MenuDropdownNest key={gid} label={parent.labels?.[gid] ?? groupById(gid).label}>
                        {generativeItems(gid)}
                      </MenuDropdownNest>
                    ))}
              </MenuDropdownNest>
            ))}
          </div>
        </MenuItem>

        <MenuItem label="Effects" panelClassName="z-[1000]" panelStyle={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="py-1 w-[260px]">
            {/* TYPE nests (Halftone · Scanline · CRT · Refraction · FX rack ·
                Pattern); categories inside apply a filter to the selected
                layer. Preset picking lives in the Effects panel. */}
            {!fxTarget ? (
              <div className="kol-helper-10 text-subtle px-3 py-1">Select a layer to apply an effect</div>
            ) : (
              <>
                <MenuDropdownItem onClick={clearEffect} disabled={!fxTarget.filterId}>
                  None
                </MenuDropdownItem>
                <MenuDropdownDivider />
                {effectCategories(fxOptions).filter((c) => c.id !== 'other' && c.id !== 'pattern').map((c) => (
                  <MenuDropdownNest key={c.id} label={c.label}>
                    {c.filters.map((f) => (
                      <MenuDropdownItem
                        key={f.id}
                        onClick={() => applyEffect(f)}
                        shortcut={fxTarget.filterId === f.id ? <EditorIcon name="check" size={11} /> : undefined}
                      >
                        {f.label}
                      </MenuDropdownItem>
                    ))}
                  </MenuDropdownNest>
                ))}
              </>
            )}
            {/* Pattern (labs EFFECTS > Pattern) — one nest holding both its
                filters (need an fx target) and the four generator categories
                (insert a layer, no target needed). */}
            <MenuDropdownDivider />
            <MenuDropdownNest label="Pattern">
              {fxTarget && effectCategories(fxOptions).find((c) => c.id === 'pattern')?.filters.map((f) => (
                <MenuDropdownItem
                  key={f.id}
                  onClick={() => applyEffect(f)}
                  shortcut={fxTarget.filterId === f.id ? <EditorIcon name="check" size={11} /> : undefined}
                >
                  {f.label}
                </MenuDropdownItem>
              ))}
              {FX_PATTERN_CATEGORIES.map((c) => (
                <MenuDropdownNest key={c.label} label={c.label}>
                  {presetsInSub(c.group, c.sub).map((p) => (
                    <MenuDropdownItem key={p.id} onClick={() => addGenerative(p, c.group)}>
                      {p.label}
                    </MenuDropdownItem>
                  ))}
                </MenuDropdownNest>
              ))}
            </MenuDropdownNest>
          </div>
        </MenuItem>

        <MenuItem label="Vector" panelClassName="z-[1000]">
          <div className="py-1 w-[220px]">
            <MenuDropdownItem onClick={flattenSelected} disabled={!canFlatten}>
              Flatten shape
            </MenuDropdownItem>
            <MenuDropdownItem onClick={() => releaseBoolean()} disabled={!canRelease}>
              Release boolean
            </MenuDropdownItem>
          </div>
        </MenuItem>

        <MenuItem label="Tools" panelClassName="z-[1000]">
          <div className="py-1 w-[220px]">
            <MenuDropdownItem onClick={openColorModal}>
              Color
            </MenuDropdownItem>
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
