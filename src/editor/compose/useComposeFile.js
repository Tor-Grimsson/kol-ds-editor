import { useModal } from '@kolkrabbi/kol-component'
import { useComposeState } from './state'
import { useGeneratorLibrary } from '../library/LibraryProvider'
import { buildLayersSvg, downloadComposeSvg, downloadComposePng } from './build'
import { resolveLayersDeep } from '../params/resolve'
import { transport } from '../params/transport'

/**
 * useComposeFile — the compose frame's save / save-as / export actions,
 * extracted from MenuTop so the rail footer (EditorFooter File/Output tabs)
 * and the topbar File menu share ONE implementation instead of drifting
 * copies.
 */
export function useComposeFile() {
  const {
    layers, palette, aspect, canvasW, canvasH,
    colors, poolId, modeId, locks,
    currentPresetId, currentPresetName,
    setCurrentPresetId, setCurrentPresetName,
  } = useComposeState()
  const { addItem, updateItem } = useGeneratorLibrary()
  const modal = useModal()

  const buildSpec = (name) => ({
    intent:  'whole',
    name:    name ?? null,
    aspect,
    canvasW, canvasH,
    layers,
    palette: { poolId, modeId, colors, locks },
  })

  const onSave = async () => {
    if (currentPresetId) {
      updateItem('preset', currentPresetId, buildSpec(currentPresetName))
      return
    }
    const name = await modal.prompt('Name this frame:', '')
    if (name === null) return
    const id = addItem('preset', buildSpec(name || null))
    if (id) {
      setCurrentPresetId(id)
      setCurrentPresetName(name || null)
    }
  }

  const onSaveAs = async () => {
    const name = await modal.prompt('Save as:', currentPresetName ?? '')
    if (name === null) return
    const id = addItem('preset', buildSpec(name || null))
    if (id) {
      setCurrentPresetId(id)
      setCurrentPresetName(name || null)
    }
  }

  /* Export snapshots the CURRENT frame — bound (animated/modulated) props
   * resolve to concrete values so build.js never sees a binding object. */
  const buildArgs = { layers: resolveLayersDeep(layers, transport.getCtx()), palette, aspect, canvasW, canvasH }
  const onExportSvg = () => downloadComposeSvg(buildLayersSvg(buildArgs), `compose-${canvasW}x${canvasH}-${Date.now().toString(36)}.svg`)
  /* PNG takes the footer's 1×/2×/3× scale on top of the set W×H (the canvas
   * carries real output pixels; scale is a resolution bump). Guarded so
   * event-object callers (topbar menu onClick) fall back to 1×. SVG is
   * vector — scale doesn't apply. */
  const onExportPng = (scale) => {
    const k = [1, 2, 3].includes(scale) ? scale : 1
    downloadComposePng(buildLayersSvg(buildArgs), `compose-${canvasW * k}x${canvasH * k}-${Date.now().toString(36)}.png`, k)
  }

  return { onSave, onSaveAs, onExportSvg, onExportPng, currentPresetId }
}
