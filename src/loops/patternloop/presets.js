// Pattern Loops — the kol-labs-single LOOPS-page pattern gallery (30 presets),
// ported from labs src/loops/pattern/presets.js. NOT the Pattern-Lab category:
// src/loops/pattern/ holds the same rule/tiling ENGINE with the labs
// /pattern-page tiling presets (Stripes/Tartan/Blocks/…); this module is the
// labs /loops-page gallery — shape-tile compositions with generous per-cell
// animation (pulse / fade / swing / colour-mix, phased by an axis).
//
// The engine is NOT duplicated here: every preset drives the already-ported
// 'pattern-rules' loop (src/loops/pattern/patternLoop.js — same module labs
// registers, schema-exposed for the inspector). This file registers only under
// the separate 'patternloop' category, so both galleries share one engine.
// Preset params are source-verbatim from labs.

// A rule = a selector + per-cell transform. Defaults match the engine's newRule
// shape; override only what a preset needs. (Distinct id prefix from the
// pattern category's presets so rule keys never collide.)
let rid = 0
const R = (o = {}) => ({
  id: `plr${++rid}`,
  selectKind: 'all', n: 2, offset: 0, n2: 2, offset2: 0,
  expression: 'sin(col * 0.6) + cos(row * 0.6)',
  groupW: 1, groupH: 1, rotate: 0, flipH: false, flipV: false, hide: false, opacity: 1,
  ...o,
})
const P = (id, label, params, sub) => ({ id, label, loop: 'pattern-rules', params, sub })

export const PATTERNLOOP_PRESETS = [
  // Grids
  P('plus-checker', 'Plus checker', {
    shape: 'prim:plus', cols: 6, rows: 6, cell: 120, gap: 16, color: '#fcfbf8', color2: '#c2502e', bg: '#0e0e11',
    camFlow: 0, rules: [R({ selectKind: 'checker', rotate: 45 })],
    animAxis: 'diag', animWaves: 2, pulse: 0.45, swing: 45, colorMix: 0.5,
  }, 'Grids'),
  P('bar-weave', 'Bar weave', {
    shape: 'prim:bar', cols: 8, rows: 8, cell: 120, gap: 6, color: '#e8e4dc', color2: '#7fd1ff', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'every-col', n: 2, rotate: 90 })],
    animAxis: 'col', animWaves: 3, fade: 0.65, colorMix: 0.4,
  }, 'Grids'),
  P('diamond-fade', 'Diamond fade', {
    shape: 'prim:diamond', cols: 7, rows: 7, cell: 110, gap: 18, color: '#7fd1ff', color2: '#f6c453', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'every-nth', n: 3, opacity: 0.4 })],
    animAxis: 'radial', animWaves: 3, pulse: 0.35, fade: 0.6, colorMix: 0.5,
  }, 'Grids'),
  P('circle-tunnel', 'Circle tunnel', {
    shape: 'prim:circle', cols: 5, rows: 5, cell: 120, gap: 24, color: '#f6c453', color2: '#d7263d', bg: '#0e0e11',
    camZoom: 1.4, camFlow: 1, rules: [R({ selectKind: 'checker', opacity: 0.55 })],
    animAxis: 'radial', animWaves: 4, pulse: 0.5, colorMix: 0.6,
  }, 'Grids'),
  P('square-diagonal', 'Square diagonal', {
    shape: 'prim:square', cols: 8, rows: 8, cell: 110, gap: 10, color: '#c2502e', color2: '#f6c453', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin((col + row) * 0.8)', rotate: 45 })],
    animAxis: 'diag', animWaves: 3, swing: 90, pulse: 0.3,
  }, 'Grids'),
  // Tessellations
  P('triangle-tess', 'Triangle tessellation', {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 110, gap: 0, color: '#e8e4dc', color2: '#3a6ea5', bg: '#1c2740',
    camFlow: 0, rules: [R({ selectKind: 'every-row', n: 2, flipV: true })],
    animAxis: 'row', animWaves: 2, fade: 0.5, swing: 30,
  }, 'Tessellations'),
  P('triangle-alt', 'Triangle alternate', {
    shape: 'prim:triangle', cols: 8, rows: 8, cell: 110, gap: 4, color: '#8f5ad0', color2: '#f6c453', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'every-col', n: 2, rotate: 180 })],
    animAxis: 'diag', animWaves: 3, pulse: 0.4, swing: 60, colorMix: 0.5,
  }, 'Tessellations'),
  P('hex-honeycomb', 'Hex honeycomb', {
    shape: 'prim:hexagon', cols: 7, rows: 7, cell: 110, gap: 6, color: '#f6c453', color2: '#c2502e', bg: '#0e0e11',
    camFlow: 0, rules: [R({ selectKind: 'every-row', n: 2, flipH: true })],
    animAxis: 'radial', animWaves: 3, pulse: 0.5, colorMix: 0.6,
  }, 'Tessellations'),
  P('brutgrid', 'Brutgrid', {
    shape: 'prim:square', cols: 8, rows: 8, cell: 110, gap: 2, color: '#0b0b0e', color2: '#0b0b0e', bg: '#e8e4dc',
    camFlow: 0, rules: [R({ selectKind: 'all', groupW: 2, groupH: 2, rotate: 90 }), R({ selectKind: 'checker', hide: true })],
    animAxis: 'diag', animWaves: 2, swing: 90, pulse: 0.25,
  }, 'Tessellations'),
  P('plus-mesh', 'Plus mesh', {
    shape: 'prim:plus', cols: 9, rows: 9, cell: 110, gap: 2, color: '#2a8f8f', color2: '#f6c453', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'cos(col * 0.9) * cos(row * 0.9)' })],
    animAxis: 'diag', animWaves: 4, pulse: 0.6, fade: 0.4, colorMix: 0.5,
  }, 'Tessellations'),
  // Abstract
  P('abstract-01', 'Abstract 01', {
    shape: 'abstract:abstract-01', cols: 5, rows: 5, cell: 130, gap: 18, color: '#fcfbf8', color2: '#7fd1ff', bg: '#0e0e11',
    camFlow: 0, spin: 1, rules: [],
    animAxis: 'radial', animWaves: 2, pulse: 0.4, colorMix: 0.5,
  }, 'Abstract'),
  P('abstract-02', 'Abstract 02', {
    shape: 'abstract:abstract-02', cols: 4, rows: 4, cell: 150, gap: 20, color: '#c2502e', color2: '#f6c453', bg: '#0b0b0e',
    camZoom: 1.2, camFlow: 0, rules: [R({ selectKind: 'checker', rotate: 90 })],
    animAxis: 'diag', animWaves: 2, pulse: 0.5, colorMix: 0.6,
  }, 'Abstract'),
  P('abstract-03', 'Abstract 03', {
    shape: 'abstract:abstract-03', cols: 5, rows: 5, cell: 130, gap: 16, color: '#7fd1ff', color2: '#8f5ad0', bg: '#06060a',
    camAngle: 30, camFlow: 0, rules: [R({ selectKind: 'every-nth', n: 2, flipH: true })],
    animAxis: 'col', animWaves: 3, fade: 0.5, swing: 30, colorMix: 0.4,
  }, 'Abstract'),
  P('abstract-06', 'Abstract 06', {
    shape: 'abstract:abstract-06', cols: 3, rows: 3, cell: 200, gap: 28, color: '#f6c453', color2: '#c2502e', bg: '#0e0e11',
    camFlow: 0, rules: [R({ selectKind: 'checker', opacity: 0.6 })],
    animAxis: 'radial', animWaves: 2, pulse: 0.6, colorMix: 0.6,
  }, 'Abstract'),
  P('abstract-spin', 'Abstract spin', {
    shape: 'abstract:abstract-01', cols: 4, rows: 4, cell: 150, gap: 20, color: '#8f5ad0', color2: '#f6c453', bg: '#06060a',
    spin: 1, rules: [R({ selectKind: 'checker' })],
    animAxis: 'diag', animWaves: 2, pulse: 0.4, swing: 60, colorMix: 0.5,
  }, 'Abstract'),
  // Flow
  P('star-scatter', 'Star scatter', {
    shape: 'prim:star', cols: 7, rows: 7, cell: 110, gap: 16, color: '#f6c453', color2: '#c2502e', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'every-nth', n: 3, hide: true }), R({ selectKind: 'checker', opacity: 0.5, rotate: 36 })],
    animAxis: 'radial', animWaves: 3, pulse: 0.5, swing: 36, colorMix: 0.5,
  }, 'Flow'),
  P('bar-scroll', 'Bar scroll', {
    shape: 'prim:bar', cols: 6, rows: 10, cell: 110, gap: 8, color: '#e8e4dc', color2: '#7fd1ff', bg: '#1b2a6b',
    camAngle: 90, camFlow: 1, rules: [R({ selectKind: 'every-row', n: 2, opacity: 0.6 })],
    animAxis: 'row', animWaves: 4, fade: 0.6, pulse: 0.3,
  }, 'Flow'),
  P('circle-rings', 'Circle rings', {
    shape: 'prim:circle', cols: 9, rows: 9, cell: 110, gap: 6, color: '#7fd1ff', color2: '#f6c453', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin((col - 4) * (col - 4) + (row - 4) * (row - 4))' })],
    animAxis: 'radial', animWaves: 3, pulse: 0.6, colorMix: 0.6,
  }, 'Flow'),
  P('hex-flow', 'Hex flow', {
    shape: 'prim:hexagon', cols: 6, rows: 6, cell: 120, gap: 10, color: '#2a8f8f', color2: '#f6c453', bg: '#0e0e11',
    camFlow: 1, spin: 1, rules: [R({ selectKind: 'all', opacity: 0.85 })],
    animAxis: 'diag', animWaves: 2, pulse: 0.4, swing: 30, colorMix: 0.5,
  }, 'Flow'),
  P('diamond-zoom', 'Diamond zoom', {
    shape: 'prim:diamond', cols: 4, rows: 4, cell: 130, gap: 30, color: '#c2502e', color2: '#f6c453', bg: '#0b0b0e',
    camZoom: 2, camFlow: 1, rules: [R({ selectKind: 'checker', rotate: 45 })],
    animAxis: 'radial', animWaves: 3, pulse: 0.5, swing: 45, colorMix: 0.6,
  }, 'Flow'),
  // Stripes — directional bar fields, animated along the stripe axis
  P('vertical-bars', 'Vertical bars', {
    shape: 'prim:bar', cols: 9, rows: 6, cell: 110, gap: 10, color: '#e8e4dc', color2: '#7fd1ff', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'every-col', n: 2, rotate: 90, opacity: 0.55 })],
    animAxis: 'col', animWaves: 4, fade: 0.6, pulse: 0.3,
  }, 'Stripes'),
  P('horizontal-scan', 'Horizontal scan', {
    shape: 'prim:bar', cols: 6, rows: 9, cell: 110, gap: 10, color: '#f6c453', color2: '#c2502e', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'every-row', n: 2 })],
    animAxis: 'row', animWaves: 4, fade: 0.7, swing: 12,
  }, 'Stripes'),
  P('diagonal-stripes', 'Diagonal stripes', {
    shape: 'prim:square', cols: 8, rows: 8, cell: 110, gap: 4, color: '#7fd1ff', color2: '#f6c453', bg: '#0e0e11',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin((col + row) * 0.9)', rotate: 45 })],
    animAxis: 'diag', animWaves: 4, pulse: 0.35, colorMix: 0.5,
  }, 'Stripes'),
  P('thick-thin', 'Thick / thin', {
    shape: 'prim:bar', cols: 10, rows: 5, cell: 110, gap: 6, color: '#c2502e', color2: '#f6c453', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'every-col', n: 3, rotate: 90, groupW: 1 })],
    animAxis: 'col', animWaves: 3, fade: 0.5, pulse: 0.4,
  }, 'Stripes'),
  P('bar-weave-2', 'Bar weave', {
    shape: 'prim:bar', cols: 8, rows: 8, cell: 110, gap: 8, color: '#2a8f8f', color2: '#f4f1ea', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'every-col', n: 2, rotate: 90 }), R({ selectKind: 'every-row', n: 2, opacity: 0.7 })],
    animAxis: 'diag', animWaves: 3, fade: 0.5, colorMix: 0.4,
  }, 'Stripes'),
  // Noise — scattered, hash-driven selection for a static / grain feel
  P('scatter-dots', 'Scatter dots', {
    shape: 'prim:circle', cols: 10, rows: 10, cell: 100, gap: 8, color: '#fcfbf8', color2: '#7fd1ff', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin(col * 12.9 + row * 7.3)', hide: true })],
    animAxis: 'radial', animWaves: 5, pulse: 0.5, colorMix: 0.4,
  }, 'Noise'),
  P('static-grain', 'Static grain', {
    shape: 'prim:square', cols: 12, rows: 12, cell: 90, gap: 2, color: '#e8e4dc', color2: '#6b6b6b', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'cos(col * 8.1) * sin(row * 5.7)', opacity: 0.5 })],
    animAxis: 'diag', animWaves: 6, fade: 0.6, colorMix: 0.5,
  }, 'Noise'),
  P('sparse-plus', 'Sparse plus', {
    shape: 'prim:plus', cols: 9, rows: 9, cell: 110, gap: 6, color: '#f6c453', color2: '#c2502e', bg: '#0e0e11',
    camFlow: 0, rules: [R({ selectKind: 'every-nth', n: 5, hide: true }), R({ selectKind: 'expression', expression: 'sin(col * 4.3 - row * 6.1)', rotate: 45 })],
    animAxis: 'radial', animWaves: 4, pulse: 0.45, swing: 45,
  }, 'Noise'),
  P('flicker-cells', 'Flicker cells', {
    shape: 'prim:diamond', cols: 10, rows: 10, cell: 100, gap: 6, color: '#7fd1ff', color2: '#8f5ad0', bg: '#06060a',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin(col * 9.7) + cos(row * 11.3)', opacity: 0.6 })],
    animAxis: 'diag', animWaves: 7, pulse: 0.6, fade: 0.4, colorMix: 0.6,
  }, 'Noise'),
  P('hash-field', 'Hash field', {
    shape: 'prim:square', cols: 11, rows: 11, cell: 95, gap: 3, color: '#2a8f8f', color2: '#f6c453', bg: '#0b0b0e',
    camFlow: 0, rules: [R({ selectKind: 'expression', expression: 'sin(col * 6.7 + row * 13.1) * cos(col * 3.3)', rotate: 90 })],
    animAxis: 'col', animWaves: 6, fade: 0.5, pulse: 0.35, colorMix: 0.5,
  }, 'Noise'),
]
