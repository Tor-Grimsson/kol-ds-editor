// Kuramoto-Sivashinsky spatiotemporal chaos — pseudo-spectral 2D.
// ∂u/∂t + ∇²u + ∇⁴u + |∇u|²/2 = 0
// Linear stiff terms handled by integrating factor in Fourier space.
// Nonlinear gradient-squared term computed in real space and transformed each step.
// Domain is periodic; SDF mask applied post-step (blend to 0 outside glyph).
//
// Reference: Kuramoto & Tsuzuki 1976; Observable @rreusser/kuramoto-sivashinsky-equation-in-2d



import { num } from '../knobs.js'
import { clear, strokeOutline, wrapLoop, rampRGB, roleRGB } from '../common.js'

const PARAMS          = [
  { key: 'res',   type: 'int',   min: 64,  max: 128, default: 96,  step: 16,   label: 'grid res (2ⁿ)' },
  { key: 'dt',    type: 'range', min: 0.1, max: 0.8, default: 0.3, step: 0.05, label: 'Δt' },
  { key: 'scale', type: 'range', min: 0.5, max: 4.0, default: 1.5, step: 0.1,  label: 'domain scale' },
  { key: 'steps', type: 'int',   min: 1,   max: 6,   default: 2,   step: 1,    label: 'steps/frame' },
]

// Minimal real-valued 2D FFT via repeated 1D DFT (Cooley-Tukey, power-of-2).
// Returns interleaved [re0, im0, re1, im1, ...] length 2*N.
function fft1d(re              , im              , inv         )       {
  const n = re.length
  // Bit-reversal
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t
      t = im[i]; im[i] = im[j]; im[j] = t
    }
  }
  const sign = inv ? 1 : -1
  for (let len = 2; len <= n; len <<= 1) {
    const ang = sign * 2 * Math.PI / len
    const wRe = Math.cos(ang), wIm = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let curR = 1, curI = 0
      for (let j = 0; j < len >> 1; j++) {
        const uR = re[i+j], uI = im[i+j]
        const vR = re[i+j+len/2]*curR - im[i+j+len/2]*curI
        const vI = re[i+j+len/2]*curI + im[i+j+len/2]*curR
        re[i+j]        = uR + vR; im[i+j]        = uI + vI
        re[i+j+len/2]  = uR - vR; im[i+j+len/2]  = uI - vI
        const nR = curR*wRe - curI*wIm
        curI = curR*wIm + curI*wRe; curR = nR
      }
    }
  }
  if (inv) { for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n } }
}

export const r2_wave_04_kuramoto_sivashinsky            = {
  id: 'r2-wave-04-kuramoto-sivashinsky',
  name: 'KURAMOTO-SIVASHINSKY CHAOS',
  repo: 'Kuramoto & Tsuzuki 1976',
  summary: 'Fourth-order PDE producing sustained spatiotemporal chaos. Energy injected at intermediate scales, damped at small scales, cascaded by the nonlinear ∇²u·∇u term. Cells crawl and merge indefinitely — never repeats.',
  helps: 'Best choice for an endlessly looping fill texture with no transient settling — the chaos is intrinsic, not decaying.',
  params: PARAMS,
  init({ ctx, sdf, W, H, rng, params }) {
    let G     = num(params, 'res', 96)
    let dt    = num(params, 'dt', 0.3)
    let scale = num(params, 'scale', 1.5)
    let steps = num(params, 'steps', 2)

    // Snap G to nearest power of 2
    G = Math.pow(2, Math.round(Math.log2(G)))
    const N = G * G

    let u = new Float64Array(N)
    const mask = new Float32Array(N)  // smooth mask: 0 outside, 1 deep inside

    const rebuildMask = () => {
      for (let y = 0; y < G; y++) {
        for (let x = 0; x < G; x++) {
          const sx = (x / G) * sdf.w
          const sy = (y / G) * sdf.h
          const d = sdf.sample(sx, sy)
          // smooth ramp: 0 at boundary, 1 when d < −3 px in SDF space
          mask[y * G + x] = d < 0 ? Math.min(1, -d / 3) : 0
        }
      }
    }
    rebuildMask()

    // Seed: small random noise inside
    for (let i = 0; i < N; i++) {
      if (mask[i] > 0) u[i] = (rng() - 0.5) * 0.1
    }

    // Precompute wavenumbers and integrating factor exp(−(k²−k⁴)Δt)
    // L(k) = −k² − k⁴  (linear part of KS in Fourier space)
    // Integrating factor: E = exp(L·dt)
    const buildFactors = (dtVal        , scaleVal        ) => {
      const Edt = new Float64Array(N)
      for (let ky = 0; ky < G; ky++) {
        for (let kx = 0; kx < G; kx++) {
          // frequency in [-G/2, G/2)
          const fkx = kx <= G/2 ? kx : kx - G
          const fky = ky <= G/2 ? ky : ky - G
          const k2 = (fkx * fkx + fky * fky) * (2 * Math.PI / (scaleVal * G)) ** 2
          const Lk = -k2 + k2 * k2  // note: KS in standard form: ∂u/∂t = −∇²u − ∇⁴u − ½|∇u|²
          // linear part = −k² − k⁴, multiply by -1 for the rhs sign convention
          Edt[ky * G + kx] = Math.exp((-k2 - k2 * k2) * dtVal)
        }
      }
      return Edt
    }
    let Edt = buildFactors(dt, scale)

    // Row/col FFT buffers (Float64)
    const rowRe = new Float64Array(G), rowIm = new Float64Array(G)
    // Full 2D FFT via row-then-column
    const uRe = new Float64Array(N), uIm = new Float64Array(N)
    const fft2d = (re              , im              , inv         ) => {
      for (let y = 0; y < G; y++) {
        rowRe.set(re.subarray(y*G, y*G+G))
        rowIm.set(im.subarray(y*G, y*G+G))
        fft1d(rowRe, rowIm, inv)
        re.set(rowRe, y*G); im.set(rowIm, y*G)
      }
      for (let x = 0; x < G; x++) {
        for (let y = 0; y < G; y++) { rowRe[y] = re[y*G+x]; rowIm[y] = im[y*G+x] }
        fft1d(rowRe, rowIm, inv)
        for (let y = 0; y < G; y++) { re[y*G+x] = rowRe[y]; im[y*G+x] = rowIm[y] }
      }
    }

    const gradRe = new Float64Array(N), gradIm = new Float64Array(N)
    const nlRe = new Float64Array(N), nlIm = new Float64Array(N)
    const dxRe = new Float64Array(N), dxIm = new Float64Array(N)
    const dyRe = new Float64Array(N), dyIm = new Float64Array(N)

    const img = ctx.createImageData(G, G)
    const tmpC = document.createElement('canvas')
    tmpC.width = G; tmpC.height = G
    const tctx = tmpC.getContext('2d')

    return wrapLoop(() => {
      const newDt    = num(params, 'dt', 0.3)
      const newScale = num(params, 'scale', 1.5)
      steps = num(params, 'steps', 2)
      if (newDt !== dt || newScale !== scale) {
        dt = newDt; scale = newScale
        Edt = buildFactors(dt, scale)
      }

      for (let s = 0; s < steps; s++) {
        // Forward FFT of u
        uRe.set(u); uIm.fill(0)
        fft2d(uRe, uIm, false)

        // Compute ∂u/∂x and ∂u/∂y in Fourier space → ux, uy in real space
        const L = scale * G / (2 * Math.PI)
        for (let ky = 0; ky < G; ky++) {
          for (let kx = 0; kx < G; kx++) {
            const i = ky * G + kx
            const fkx = (kx <= G/2 ? kx : kx - G) / L
            const fky = (ky <= G/2 ? ky : ky - G) / L
            // ∂/∂x: multiply by ikx
            dxRe[i] = -fkx * uIm[i]; dxIm[i] =  fkx * uRe[i]
            dyRe[i] = -fky * uIm[i]; dyIm[i] =  fky * uRe[i]
          }
        }
        fft2d(dxRe, dxIm, true)
        fft2d(dyRe, dyIm, true)

        // Nonlinear term: ½(ux² + uy²) in real space → forward FFT
        for (let i = 0; i < N; i++) {
          nlRe[i] = 0.5 * (dxRe[i] * dxRe[i] + dyRe[i] * dyRe[i])
          nlIm[i] = 0
        }
        fft2d(nlRe, nlIm, false)

        // Advance in Fourier space: û_new = E * (û − dt * NL_hat)
        for (let i = 0; i < N; i++) {
          uRe[i] = Edt[i] * (uRe[i] - dt * nlRe[i])
          uIm[i] = Edt[i] * (uIm[i] - dt * nlIm[i])
        }

        // Inverse FFT back to real space
        fft2d(uRe, uIm, true)
        u.set(uRe)

        // Apply smooth mask
        for (let i = 0; i < N; i++) u[i] *= mask[i]
      }

      // Render: map u to brightness (auto-normalize)
      let uMin = Infinity, uMax = -Infinity
      for (let i = 0; i < N; i++) { if (mask[i] > 0) { if (u[i] < uMin) uMin = u[i]; if (u[i] > uMax) uMax = u[i] } }
      const uRange = uMax - uMin || 1

      for (let i = 0; i < N; i++) {
        const j = i * 4
        if (mask[i] === 0) {
          const [br, bg, bb] = roleRGB('bg')
          img.data[j] = br; img.data[j+1] = bg; img.data[j+2] = bb; img.data[j+3] = 255
          continue
        }
        const v = (u[i] - uMin) / uRange  // 0..1
        const [r, g, b] = rampRGB(v)
        img.data[j]   = r
        img.data[j+1] = g
        img.data[j+2] = b
        img.data[j+3] = 255
      }

      clear(ctx, W, H)
      tctx.putImageData(img, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmpC, 0, 0, W, H)
      strokeOutline(ctx, sdf, W, H)
    })
  },
}
