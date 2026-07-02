/**
 * audioBands — one analyser whose smoothed bands feed the modulation-source
 * registry (level / bass / mid / high). Ported from labs `lib/audioSource.js`
 * (bin-fraction FFT split + asymmetric smoothing), extended with an audio-
 * FILE input: the transport footer can point the analyser at an uploaded
 * track instead of the mic.
 *
 * Off until enabled from a user gesture (mic permission / autoplay policy);
 * bands read 0 while disabled so bound params simply hold still.
 *
 *   enableAudio({ file? })  -> Promise<boolean>   mic when no file
 *   disableAudio()          -> teardown, bands to 0
 *   readAudio()             -> { level, bass, mid, high }  (live, mutated)
 *   isAudioEnabled() / audioSourceKind() -> 'mic' | 'file' | null
 */

const audio = { level: 0, bass: 0, mid: 0, high: 0 }

let ctx = null
let analyser = null
let stream = null      /* mic path */
let audioEl = null     /* file path — looping <audio> */
let objectUrl = null
let raf = 0
let timeBuf = null
let freqBuf = null
let enabled = false
let kind = null

/* Rise fast so transients read, fall slow so bound params don't strobe. */
const ATTACK = 0.5
const RELEASE = 0.12
const smoothTo = (prev, target) => prev + (target - prev) * (target > prev ? ATTACK : RELEASE)

function tick() {
  if (!enabled || !analyser) return

  analyser.getFloatTimeDomainData(timeBuf)
  let sum = 0
  for (let i = 0; i < timeBuf.length; i++) sum += timeBuf[i] * timeBuf[i]
  const level = Math.min(1, Math.sqrt(sum / timeBuf.length) * 4)

  analyser.getByteFrequencyData(freqBuf)
  const N = freqBuf.length
  const bassEnd = Math.floor(N * 0.04)
  const midEnd = Math.floor(N * 0.25)
  let b = 0, m = 0, h = 0
  for (let i = 0; i < bassEnd; i++) b += freqBuf[i]
  for (let i = bassEnd; i < midEnd; i++) m += freqBuf[i]
  for (let i = midEnd; i < N; i++) h += freqBuf[i]

  audio.level = smoothTo(audio.level, level)
  audio.bass = smoothTo(audio.bass, Math.min(1, b / bassEnd / 200))
  audio.mid = smoothTo(audio.mid, Math.min(1, m / (midEnd - bassEnd) / 160))
  audio.high = smoothTo(audio.high, Math.min(1, h / (N - midEnd) / 120))

  raf = requestAnimationFrame(tick)
}

/**
 * Start analysing. Call from a user gesture. `file` (a File/Blob) routes a
 * looping <audio> through the analyser instead of the mic. Idempotent per
 * kind — switching mic ↔ file tears down and rebuilds.
 */
export async function enableAudio({ file } = {}) {
  const nextKind = file ? 'file' : 'mic'
  if (enabled && kind === nextKind && !file) return true
  disableAudio()
  if (typeof window === 'undefined') return false
  try {
    const AC = window.AudioContext || window.webkitAudioContext
    ctx = new AC()
    if (ctx.state === 'suspended') await ctx.resume()
    let srcNode
    if (file) {
      objectUrl = URL.createObjectURL(file)
      audioEl = new Audio(objectUrl)
      audioEl.loop = true
      audioEl.crossOrigin = 'anonymous'
      srcNode = ctx.createMediaElementSource(audioEl)
      srcNode.connect(ctx.destination)   /* audible — it's a track, not a mic */
      await audioEl.play()
    } else {
      if (!navigator.mediaDevices?.getUserMedia) return false
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      srcNode = ctx.createMediaStreamSource(stream)
    }
    analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    srcNode.connect(analyser)
    timeBuf = new Float32Array(analyser.fftSize)
    freqBuf = new Uint8Array(analyser.frequencyBinCount)
    enabled = true
    kind = nextKind
    raf = requestAnimationFrame(tick)
    return true
  } catch (err) {
    console.info('[audio] not available:', err?.message ?? err)
    disableAudio()
    return false
  }
}

export function disableAudio() {
  enabled = false
  kind = null
  if (raf) { cancelAnimationFrame(raf); raf = 0 }
  if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null }
  if (audioEl) { audioEl.pause(); audioEl = null }
  if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
  if (ctx) { try { ctx.close() } catch { /* already closed */ } ctx = null }
  analyser = null
  timeBuf = freqBuf = null
  audio.level = audio.bass = audio.mid = audio.high = 0
}

export function readAudio() { return audio }
export function isAudioEnabled() { return enabled }
export function audioSourceKind() { return kind }
