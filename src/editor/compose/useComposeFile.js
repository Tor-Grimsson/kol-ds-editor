import { useRef } from 'react'
import { useModal } from '@kolkrabbi/kol-component'
import { useComposeState } from './state'
import { useGeneratorLibrary } from '../library/LibraryProvider'
import { buildLayersSvg, downloadComposeSvg, downloadComposePng, svgToPngBlob } from './build'
import { warmTextFonts } from '../modes/type/textOutline'
import { warmFontCss } from '../../kinetic/fonts'
import { resolveLayersDeep, makeSmoothingState } from '../params/resolve'
import { transport } from '../params/transport'
import { downloadBlob } from '../lib/download'
import { PRESET_SIZES } from '../shell/aspects'
import { makeZip } from '../lib/zipStore'

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
/* One-shot handoff key: the "Open output" button writes the whole-doc envelope
 * here, the chromeless OutputView (`../OutputView`) reads it on mount. */
export const OUTPUT_SNAPSHOT_KEY = 'kol:output-snapshot'

const WEBM_FPS = 30
const WEBM_MIMES = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']

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

/* Deep scan (groups walked) for kinetic layers — gates the kinetic font-css
 * warm: no kinetic layer, no font fetch. */
const hasKineticLayer = (ls) => (ls ?? []).some((l) => l.type === 'kinetic' || (l.type === 'group' && hasKineticLayer(l.children)))

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

  /* Live-record handle (rAF pump + MediaRecorder) — a ref so it survives the
   * hook's re-renders across a recording session. */
  const recorderRef = useRef(null)
  /* Freshest layers/palette for the live-record pump — updated every render so
   * the running capture reflects edits/param tweaks made WHILE recording, not
   * the closure snapshot from record-start. */
  const liveRef = useRef(null)
  liveRef.current = { layers, palette }

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

  /* Export snapshots the frame at CLICK time — bound (animated/modulated)
   * props resolve to concrete values inside each handler so build.js never
   * sees a binding object. Resolving here in the hook body would freeze t at
   * the caller's last render (export buttons don't re-render on transport
   * ticks) while loop layers sample transport live — one export would mix
   * two times. */
  const buildArgs = () => ({ layers: resolveLayersDeep(layers, transport.getCtx()), palette, aspect, canvasW, canvasH })
  /* Text layers export as glyph outlines — parse the cut TTFs (async,
   * promise-cached) BEFORE the sync buildLayersSvg call; a cold cut falls
   * back to foreignObject inside build.js. Kinetic layers embed their fonts
   * as base64 @font-face css — warm that cache too or a fresh session
   * exports kinetic text in system faces. */
  const warmExportFonts = async (resolvedLayers) => {
    await warmTextFonts(resolvedLayers)
    if (hasKineticLayer(resolvedLayers)) await warmFontCss()
  }
  const onExportSvg = async () => {
    const args = buildArgs()
    await warmExportFonts(args.layers)
    downloadComposeSvg(buildLayersSvg(args), `compose-${canvasW}x${canvasH}-${Date.now().toString(36)}.svg`)
  }
  /* PNG takes the footer's 1×/2×/3× scale on top of the set W×H (the canvas
   * carries real output pixels; scale is a resolution bump). Guarded so
   * event-object callers (topbar menu onClick) fall back to 1×. SVG is
   * vector — scale doesn't apply. */
  const onExportPng = async (scale) => {
    const k = [1, 2, 3].includes(scale) ? scale : 1
    const args = buildArgs()
    await warmExportFonts(args.layers)
    /* rasterScale bakes snapshot/redraw rasters (2d loops, video frames)
     * inside the SVG at k× so they stay crisp when the whole SVG scales. */
    downloadComposePng(buildLayersSvg({ ...args, rasterScale: k }), `compose-${canvasW * k}x${canvasH * k}-${Date.now().toString(36)}.png`, k)
  }

  /* Render the current frame at an ARBITRARY aspect preset + @Nx scale to a
   * PNG Blob (no download) — the batch-export matrix loops this. The aspect
   * only reframes the 1080-virtual viewBox (layers keep their coords); dims
   * come from PRESET_SIZES, falling back to the live canvas for unknown ids.
   * Resolves layers at the live transport t and warms fonts (cache hits after
   * the first combo). */
  const renderComposePngBlob = async (aspectId, scale) => {
    const k = [1, 2, 3].includes(scale) ? scale : 1
    const sz = PRESET_SIZES[aspectId] ?? { w: canvasW, h: canvasH }
    const args = buildArgs()
    await warmExportFonts(args.layers)
    const svg = buildLayersSvg({
      layers: args.layers, palette,
      aspect: aspectId, canvasW: sz.w, canvasH: sz.h,
      rasterScale: k,
    })
    return svgToPngBlob(svg, k)
  }

  /* Batch multi-size export — render every {aspectId, scale} job to a PNG and
   * bundle them into ONE store-only .zip (zipStore, no dependency). Transport
   * is paused for the run so every size captures the SAME live moment, then
   * restored. `onProgress(done, total)` drives the N/M counter; filenames
   * encode preset+scale (e.g. `compose-9x16@2x.png`). */
  const runBatchExport = async (jobs, onProgress) => {
    if (!jobs?.length) return
    const wasPlaying = transport.isPlaying()
    if (wasPlaying) transport.pause()
    try {
      const entries = []
      for (let i = 0; i < jobs.length; i++) {
        onProgress?.(i, jobs.length)
        const { aspectId, scale } = jobs[i]
        const blob = await renderComposePngBlob(aspectId, scale)
        entries.push({
          name: `compose-${aspectId.replace(':', 'x')}@${scale}x.png`,
          data: new Uint8Array(await blob.arrayBuffer()),
        })
      }
      onProgress?.(jobs.length, jobs.length)
      downloadBlob(makeZip(entries), `compose-batch-${Date.now().toString(36)}.zip`)
    } finally {
      if (wasPlaying) transport.play()
    }
  }

  /* Bake exactly one transport loop to webm, fully OFFLINE: seek t = i/N per
   * frame, rasterize the resolved frame SVG onto a scratch canvas, and encode
   * that frozen frame as VP9 via Mediabunny's CanvasSource (WebCodecs under the
   * hood). No realtime pacing, no MediaRecorder — each frame is encoded as fast
   * as it rasterizes with an explicit i/fps-second timestamp, so N frames = one
   * deterministic seamless loop with zero dropped frames (the old captureStream
   * + track.requestFrame path both drifted AND crashed — requestFrame isn't a
   * function on the capture track in current Chrome). Free-running layers
   * (engine loops / sim filters that don't derive from t) still bake whatever
   * frame they happen to be at — live-canvas snapshots, not re-simulated. Prior
   * transport t + play state are restored after the bake.
   * ponytail: Mediabunny (dynamic import, code-split) — supersedes webm-muxer.
   * WebCodecs-gated — Safari no-ops until it ships VideoEncoder. */
  const onExportWebm = async (scale, onProgress) => {
    if (typeof VideoEncoder === 'undefined') return
    const k = [1, 2, 3].includes(scale) ? scale : 1
    /* Warm text + kinetic fonts once — every baked frame builds sync from
     * the same caches. */
    await warmExportFonts(buildArgs().layers)
    const N = Math.max(1, Math.round(transport.getLoopSeconds() * WEBM_FPS))
    const wasPlaying = transport.isPlaying()
    const prevT = transport.getT()
    if (wasPlaying) transport.pause()

    /* Isolated EMA store for `smooth` bindings — the bake steps it exactly
     * once per baked frame, while the live renderers keep stepping the
     * module-level store, so neither pass contaminates the other
     * (deterministic bakes). One silent warm-up lap converges the EMA
     * toward its looping steady state; an exact frame N-1 → 0 seam is
     * inherently impossible with an EMA. */
    const smoothState = makeSmoothingState()
    for (let i = 0; i < N; i++) resolveLayersDeep(layers, { ...transport.getCtx(), t: i / N, smoothState })

    const w = canvasW * k
    const h = canvasH * k
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')

    const { Output, WebMOutputFormat, BufferTarget, CanvasSource } = await import('mediabunny')
    const output = new Output({ format: new WebMOutputFormat(), target: new BufferTarget() })
    const source = new CanvasSource(canvas, { codec: 'vp9', bitrate: Math.round(w * h * WEBM_FPS * 0.1) })
    output.addVideoTrack(source, { frameRate: WEBM_FPS })
    await output.start()
    const frameDur = 1 / WEBM_FPS // seconds per frame
    onProgress?.(0, N)

    try {
      for (let i = 0; i < N; i++) {
        transport.seek(i / N)
        /* Double rAF — the first fires around React's seek re-render commit,
         * the second after the passive effects that repaint kinetic/filter
         * layer canvases have flushed; a single rAF can snapshot the
         * PREVIOUS frame's pixels under load. */
        await nextFrame()
        await nextFrame()
        const svg = buildLayersSvg({
          layers: resolveLayersDeep(layers, { ...transport.getCtx(), smoothState }),
          palette, aspect, canvasW, canvasH,
          rasterScale: k,
        })
        await drawSvgToCanvas(g, svg, w, h)
        await source.add(i / WEBM_FPS, frameDur)
        onProgress?.(i + 1, N)
      }
      await output.finalize()
      downloadBlob(new Blob([output.target.buffer], { type: 'video/webm' }), `compose-loop-${w}x${h}-${Date.now().toString(36)}.webm`)
    } finally {
      transport.seek(prevT)
      if (wasPlaying) transport.play()
    }
  }

  /* Live record — capture whatever's happening on screen in REAL time
   * (transport running, params being tweaked), the complement to onExportWebm's
   * deterministic offline loop bake. The editor has NO single live canvas —
   * layers are separate positioned DOM/<canvas> elements — so the pump
   * re-composites each rAF through the SAME build/snapshot path the bake uses
   * (buildLayersSvg → drawSvgToCanvas), but sampling the LIVE transport ctx
   * instead of seeking. captureStream(fps) samples the scratch surface on its
   * own cadence; whatever's painted at sample time lands in the webm. The
   * SVG-decode per frame won't always hold 30fps under heavy layers — the
   * record is honest wall-clock WYSIWYG, not frame-locked. Aspect + canvas dims
   * freeze at start (a mid-stream resize would break the stream); layers +
   * palette stay live via liveRef. */
  const onRecordStart = async (scale) => {
    if (typeof MediaRecorder === 'undefined' || recorderRef.current) return false
    const k = [1, 2, 3].includes(scale) ? scale : 1
    await warmExportFonts(resolveLayersDeep(layers, transport.getCtx()))
    const aspectId = aspect
    const baseW = canvasW
    const baseH = canvasH
    const w = baseW * k
    const h = baseH * k
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const g = canvas.getContext('2d')

    const stream = canvas.captureStream(WEBM_FPS)
    const mime = WEBM_MIMES.find((m) => MediaRecorder.isTypeSupported(m))
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
    const chunks = []
    rec.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
    const stopped = new Promise((resolve) => { rec.onstop = resolve })

    let alive = true
    const pump = async () => {
      while (alive) {
        const { layers: liveLayers, palette: livePalette } = liveRef.current
        const svg = buildLayersSvg({
          layers: resolveLayersDeep(liveLayers, transport.getCtx()),
          palette: livePalette, aspect: aspectId, canvasW: baseW, canvasH: baseH,
          rasterScale: k,
        })
        try { await drawSvgToCanvas(g, svg, w, h) } catch { /* skip a bad frame, keep recording */ }
        await nextFrame()
      }
    }

    rec.start()
    pump()
    recorderRef.current = {
      stop: async () => {
        alive = false
        if (rec.state !== 'inactive') rec.stop()
        await stopped
        downloadBlob(new Blob(chunks, { type: 'video/webm' }), `compose-live-${w}x${h}-${Date.now().toString(36)}.webm`)
      },
    }
    return true
  }

  const onRecordStop = async () => {
    const r = recorderRef.current
    if (!r) return
    recorderRef.current = null
    await r.stop()
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

  /* Snapshot the whole doc to localStorage and open the chromeless output view
   * (`../OutputView`) in a new tab — a clean surface for OS / browser-tab
   * screen recording. Snapshot at open-time, not live-synced: a loop recording
   * doesn't need live edits, the loop plays via the transport. */
  const openOutputWindow = () => {
    try {
      localStorage.setItem(
        OUTPUT_SNAPSHOT_KEY,
        JSON.stringify({ page: SETTINGS_PAGE, version: SETTINGS_VERSION, spec: buildSpec(currentPresetName) }),
      )
    } catch { /* storage blocked/full — open anyway; output renders its default */ }
    window.open(`${window.location.pathname}?view=output`, '_blank', 'noopener')
  }

  return {
    onSave, onSaveAs, onExportSvg, onExportPng, onExportWebm,
    renderComposePngBlob, runBatchExport, onRecordStart, onRecordStop,
    onSaveSettings, onLoadSettings, openOutputWindow, currentPresetId,
  }
}
