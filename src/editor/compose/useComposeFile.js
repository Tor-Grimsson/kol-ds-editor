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

  const filename  = `compose-${canvasW}x${canvasH}-${Date.now().toString(36)}`
  /* Export snapshots the CURRENT frame — bound (animated/modulated) props
   * resolve to concrete values so build.js never sees a binding object. */
  const buildArgs = { layers: resolveLayersDeep(layers, transport.getCtx()), palette, aspect, canvasW, canvasH }
  const onExportSvg = () => downloadComposeSvg(buildLayersSvg(buildArgs), `${filename}.svg`)
  /* scale 1 — the canvas carries real output pixels, so export at exactly
   * the set W×H (user bumps dimensions for higher res, not a hidden 2×). */
  const onExportPng = () => downloadComposePng(buildLayersSvg(buildArgs), `${filename}.png`, 1)

  return { onSave, onSaveAs, onExportSvg, onExportPng, currentPresetId }
}
