// Abstract — Multi-Scale Turing Patterns (Engine B). Jonathan McCabe's algorithm.
//
// One scalar field. Each step, for several SCALES (an activator radius and a
// larger inhibitor radius), blur the field at both radii; per pixel pick the
// scale with the SMALLEST activator−inhibitor difference (the scale at which the
// neighbourhood is most uniform), and nudge that pixel up/down by that scale's
// step. Then renormalise the whole field. Small scales settle fast detail; large
// scales drift slowly → the nested, draped, multi-scale look. Colour comes from
// which scale "won" each pixel; relief from shading the field as a heightfield.
//
// Refs: McCabe, "Cyclic Symmetric Multi-Scale Turing Patterns"; github.com/tripzilch/mstp.

// A PRESET is an ordered scale set. Radii are integer pixels (box-blur windows);
// `amount` is the per-step nudge — smaller for larger scales so big structures
// move slowly under fine detail.
export const MSTP_PRESETS = [
  {
    id: 'classic', label: 'Classic',
    scales: [
      { act: 1, inh: 2, amount: 0.05 },
      { act: 2, inh: 4, amount: 0.04 },
      { act: 4, inh: 8, amount: 0.03 },
      { act: 8, inh: 16, amount: 0.02 },
      { act: 16, inh: 32, amount: 0.01 },
    ],
  },
  {
    id: 'fine', label: 'Fine',
    scales: [
      { act: 1, inh: 2, amount: 0.052 },
      { act: 2, inh: 3, amount: 0.042 },
      { act: 3, inh: 6, amount: 0.034 },
      { act: 5, inh: 10, amount: 0.024 },
      { act: 8, inh: 16, amount: 0.014 },
    ],
  },
  {
    id: 'bold', label: 'Bold',
    scales: [
      { act: 2, inh: 4, amount: 0.04 },
      { act: 4, inh: 8, amount: 0.03 },
      { act: 8, inh: 16, amount: 0.022 },
      { act: 16, inh: 32, amount: 0.014 },
      { act: 28, inh: 54, amount: 0.008 },
    ],
  },
  {
    id: 'labyrinth', label: 'Labyrinth',
    scales: [
      { act: 1, inh: 2, amount: 0.06 },
      { act: 2, inh: 4, amount: 0.038 },
      { act: 4, inh: 8, amount: 0.024 },
    ],
  },
]

// Per-scale colours (RGB 0–1). Index = scale index; ≥ the longest preset (5).
export const MSTP_COLORS = [
  {
    value: 'candy', label: 'Candy',
    colors: [[0.96, 0.52, 0.62], [0.62, 0.5, 0.92], [0.4, 0.82, 0.85], [0.72, 0.9, 0.5], [0.97, 0.82, 0.42], [0.86, 0.62, 0.86]],
  },
  {
    value: 'spectrum', label: 'Spectrum',
    colors: [[0.86, 0.12, 0.22], [0.96, 0.52, 0.12], [0.96, 0.86, 0.2], [0.22, 0.72, 0.32], [0.2, 0.46, 0.86], [0.52, 0.22, 0.72]],
  },
  {
    value: 'gold', label: 'Gold',
    colors: [[0.1, 0.07, 0.03], [0.5, 0.32, 0.08], [0.88, 0.66, 0.18], [1.0, 0.95, 0.77], [0.62, 0.42, 0.16], [0.32, 0.2, 0.08]],
  },
  {
    value: 'ocean', label: 'Ocean',
    colors: [[0.03, 0.08, 0.2], [0.1, 0.36, 0.56], [0.2, 0.66, 0.72], [0.52, 0.86, 0.86], [0.86, 0.96, 0.96], [0.3, 0.52, 0.72]],
  },
  {
    value: 'mono', label: 'Mono',
    colors: [[0.22, 0.22, 0.24], [0.4, 0.4, 0.43], [0.58, 0.58, 0.6], [0.76, 0.76, 0.78], [0.92, 0.92, 0.94], [0.5, 0.5, 0.52]],
  },
]

export const mstpPresetById = (id) => MSTP_PRESETS.find((p) => p.id === id) || MSTP_PRESETS[0]
export const mstpColorsById = (id) => (MSTP_COLORS.find((c) => c.value === id) || MSTP_COLORS[0]).colors
