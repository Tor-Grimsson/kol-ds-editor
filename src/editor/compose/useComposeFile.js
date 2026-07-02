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
/* Settings-file envelope — scopes a saved .json to this editor so load can
 * reject foreign files (labs settingsIO idiom). */
const SETTINGS_PAGE = 'kol-design-editor'
const SETTINGS_VERSION = 1

const WEBM_FPS = 30
const WEBM_MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/* Rasterize an SVG string onto a 2d context at w×h. Image decode is async —
 * the webm bake awaits each frame before capturing it. */
function drawSvgToCanvas(g, svgString, w, h) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      g.clearRect(0, 0, w, h)
      g.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      resolve()
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('SVG rasterize failed')) }
    img.src = url
  })
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(r))

export function useComposeFile() {
  const {
    layers, palette, aspect, canvasW, canvasH,
    colors, poolId, modeId, locks,
    currentPresetId, currentPresetName,
    setCurrentPresetId, setCurrentPresetName,
    loadPreset,
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

  /* Bake exactly one transport loop to webm, deterministically: N frames at
   * 30fps over loopSeconds, seeking t = i/N per frame and rasterizing the
   * resolved frame SVG onto a captureStream(0) canvas (frames pushed via
   * track.requestFrame(), never wall-clock sampled). One awaited RAF per
   * frame lets React repaint the live GL/filter layer canvases that
   * buildLayersSvg snapshots. Free-running layers (engine loops / sim
   * filters that don't derive from u) bake whatever frame they happen to be
   * at — they're live-canvas snapshots, not re-simulated. Prior transport
   * t + play state are restored after the bake. */
  const onExportWebm = async (scale) => {
    if (typeof MediaRecorder === 'undefined') return
    const k = [1, 2, 3].includes(scale) ? scale : 1
    const N = Math.max(1, Math.round(transport.getLoopSeconds() * WEBM_FPS))
    const wasPlaying = transport.isPlaying()
    const prevT = transport.getT()
    if (wasPlaying) transport.pause()

    const w = canvasW * k
    const h = canvasH * k
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')

    const stream = canvas.captureStream(0)
    const track = stream.getVideoTracks()[0]
    const mime = WEBM_MIMES.find((m) => MediaRecorder.isTypeSupported(m))
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    const stopped = new Promise((resolve) => { rec.onstop = resolve })
    rec.start()

    try {
      for (let i = 0; i < N; i++) {
        transport.seek(i / N)
        await nextFrame()
        const svg = buildLayersSvg({
          layers: resolveLayersDeep(layers, transport.getCtx()),
          palette, aspect, canvasW, canvasH,
        })
        await drawSvgToCanvas(g, svg, w, h)
        track.requestFrame()
      }
      rec.stop()
      await stopped
      downloadBlob(new Blob(chunks, { type: 'video/webm' }), `compose-loop-${w}x${h}-${Date.now().toString(36)}.webm`)
    } finally {
      if (rec.state !== 'inactive') rec.stop()
      transport.seek(prevT)
      if (wasPlaying) transport.play()
    }
  }

  /* Settings file — the whole frame spec in a versioned envelope. A different
   * lane from library presets: files travel between machines/sessions. */
  const onSaveSettings = () => {
    const env = { page: SETTINGS_PAGE, version: SETTINGS_VERSION, spec: buildSpec(currentPresetName) }
    downloadBlob(
      new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' }),
      `${SETTINGS_PAGE}.json`,
    )
  }

  /* Read + validate a picked settings File, then load its spec into the
   * frame (tracked through history — undo restores). Rejects with a clear
   * message on foreign/malformed files; the caller surfaces it. */
  const onLoadSettings = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.onload = () => {
      let env
      try { env = JSON.parse(String(reader.result)) }
      catch { reject(new Error('Not a JSON file')); return }
      if (!env || env.page !== SETTINGS_PAGE) { reject(new Error('Not a kol-design-editor settings file')); return }
      if (env.version !== SETTINGS_VERSION) { reject(new Error(`Unsupported settings version (${env.version})`)); return }
      if (!env.spec || typeof env.spec !== 'object') { reject(new Error('No spec in file')); return }
      loadPreset(env.spec)
      resolve()
    }
    reader.readAsText(file)
  })

  return {
    onSave, onSaveAs, onExportSvg, onExportPng, onExportWebm,
    onSaveSettings, onLoadSettings, currentPresetId,
  }
}
