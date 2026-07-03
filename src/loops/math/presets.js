// Math loops (group 'math', label 'Math') — the canvas2d generative engines
// ported from kol-labs-single src/pages/math/: spinner (free-running thread
// accumulation), threads (pure-u windmill drag), surface (z=f(x,y) heightfield
// + strange attractors behind the hand-rolled projector), waveform (Fourier
// epicycle synthesis), fields (scalar heatmap + flow · complex domain
// coloring), curves (the uzumaki parametric clip library) and orbits
// (free-running n-body trails). A preset names a base loop + a partial param
// override, same idiom as shape/field.
//
// Preset patches are the labs SPINNER_PRESETS / THREADS_PRESETS /
// SURFACE_PRESETS / WAVEFORM_PRESETS / FIELD_PRESETS / PARAMETRIC_PRESETS,
// expressed as diffs over the loop defaults. The waveform presets' `palette`
// quick-picks are resolved to their labs THEMES bg/fg hexes.

import spinner from './spinner.js'
import threads from './threads.js'
import surface from './surface.js'
import waveform from './waveform.js'
import fields from './fields.js'
import curves from './curves.js'
import orbits from './orbits.js'

export const MATH_LOOPS = [spinner, threads, surface, waveform, fields, curves, orbits]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const MATH_PRESETS = [
  // Spinner (the five polyhop carousel looks)
  P('spinner-rainbow', 'Spinner', 'math-spinner', {}, 'Spinner'),
  P('spinner-weave', 'Weave', 'math-spinner', { count: 16, drift: 0.08, weight: 1.6, glow: 6, ballR: 8 }, 'Spinner'),
  P('spinner-mono', 'Mono', 'math-spinner', { drift: 0.06, weight: 1.3, glow: 3, ballR: 8, mono: true, bg: '#050506' }, 'Spinner'),
  P('spinner-calm', 'Calm', 'math-spinner', { count: 8, drift: 0.03, span: 1.05, speed: 0.85, glow: 10, ballR: 10 }, 'Spinner'),
  P('spinner-bloom', 'Bloom', 'math-spinner', { count: 10, weight: 2.4, glow: 18, ballR: 12 }, 'Spinner'),
  // Threads — original loop looks
  P('threads-mill', 'Windmill', 'math-threads', { pull: 0.2 }, 'Threads'),
  P('threads-drag', 'Heavy drag', 'math-threads', { lines: 7, pull: 0.34, infR: 0.36, ballR: 46, ballSpeed: 0.8 }, 'Threads'),
  P('threads-five', 'Five-wing', 'math-threads', { wings: 5, pull: 0.16, ballR: 34 }, 'Threads'),
  P('threads-mono', 'Mono', 'math-threads', { pull: 0.22, mono: true, glow: 5, weight: 1.8, ballR: 38, bg: '#040405' }, 'Threads'),
  P('threads-swarm', 'Swarm', 'math-threads', { wings: 4, lines: 7, pull: 0.12, infR: 0.22, ballSpeed: 1.5, ballR: 28 }, 'Threads'),
  // Threads — other forms the balls interrupt
  P('threads-rings', 'Rings', 'math-threads', { form: 'rings', lines: 7, pull: 0.26, infR: 0.32, ballR: 38 }, 'Threads'),
  P('threads-ripple', 'Ripple', 'math-threads', { form: 'rings', lines: 11, pull: 0.36, infR: 0.42, ballR: 34, ballSpeed: 0.7, weight: 1.8 }, 'Threads'),
  P('threads-grid', 'Grid', 'math-threads', { form: 'grid', lines: 7, pull: 0.24, infR: 0.3, weight: 1.8, ballR: 36 }, 'Threads'),
  P('threads-mesh', 'Mesh', 'math-threads', { form: 'grid', wings: 4, lines: 9, mono: true, glow: 5, weight: 1.4, pull: 0.26, ballR: 32, bg: '#040405' }, 'Threads'),
  P('threads-bands', 'Bands', 'math-threads', { form: 'stripes', lines: 9, pull: 0.3, infR: 0.32, weight: 2, ballR: 38 }, 'Threads'),
  P('threads-rays', 'Rays', 'math-threads', { form: 'radial', lines: 14, pull: 0.2, ballR: 34 }, 'Threads'),
  P('threads-starburst', 'Starburst', 'math-threads', { form: 'radial', wings: 4, lines: 24, pull: 0.16, ballR: 26, ballSpeed: 1.3, weight: 1.6 }, 'Threads'),
  P('threads-spiral', 'Spiral', 'math-threads', { form: 'spiral', lines: 3, pull: 0.22, ballR: 38 }, 'Threads'),
  P('threads-waves', 'Waves', 'math-threads', { form: 'waves', lines: 9, pull: 0.26, infR: 0.32, ballR: 36 }, 'Threads'),
  P('threads-web', 'Web', 'math-threads', { form: 'web', lines: 12, pull: 0.22, infR: 0.3, ballR: 34 }, 'Threads'),
  // Surfaces (z = f(x,y))
  P('surface-ripple', 'Ripple', 'math-surface', { kind: 'surface', fn: 'ripple', mode: 'wire', height: 1, low: '#1b2b4a', high: '#ffd23f' }, 'Surfaces'),
  P('surface-saddle', 'Saddle', 'math-surface', { kind: 'surface', fn: 'saddle', mode: 'fill', height: 1, low: '#1a0b2e', high: '#ff5470' }, 'Surfaces'),
  P('surface-bell', 'Bell', 'math-surface', { kind: 'surface', fn: 'bell', mode: 'wire', height: 1.6, domain: 4, low: '#04140f', high: '#c9f29b' }, 'Surfaces'),
  // Attractors
  P('surface-lorenz', 'Lorenz', 'math-surface', { kind: 'attractor', attractor: 'lorenz', stroke: '#9ec1ff', gradient: true }, 'Attractors'),
  P('surface-rossler', 'Rössler', 'math-surface', { kind: 'attractor', attractor: 'rossler', stroke: '#ffd23f', steps: 9000 }, 'Attractors'),
  P('surface-aizawa', 'Aizawa', 'math-surface', { kind: 'attractor', attractor: 'aizawa', stroke: '#ff5470' }, 'Attractors'),
  // Waveforms — Fourier epicycle synthesis; each preset = wave + palette +
  // motion personality (labs WAVEFORM_PRESETS). Animate is the labs ClipEditor
  // tool, ported as its polar-rose base clip drawn in on the curves loop.
  P('wave-epicycle', 'Epicycle', 'math-waveform', { wave: 'square', harmonics: 8, speed: 0.3, rolloff: 0, bg: '#0c0a06', fg: '#ffb35c' }, 'Waveforms'),
  P('wave-harmonic', 'Harmonic', 'math-waveform', { wave: 'triangle', harmonics: 6, speed: 0.25, rolloff: 0, bg: '#f4f1ea', fg: '#16202e' }, 'Waveforms'),
  P('wave-overtone', 'Overtone', 'math-waveform', { wave: 'sawtooth', harmonics: 16, speed: 0.6, rolloff: 0.4, bg: '#0a0a0a', fg: '#ededed' }, 'Waveforms'),
  P('wave-phasor', 'Phasor', 'math-waveform', { wave: 'square', harmonics: 4, speed: 0.2, swing: 24, bg: '#0b1d3a', fg: '#8fd3ff' }, 'Waveforms'),
  P('wave-spectrum', 'Spectrum', 'math-waveform', { wave: 'sawtooth', harmonics: 12, speed: 0.45, stagger: 0.45, bg: '#050506', fg: '#9ec1ff' }, 'Waveforms'),
  P('wave-resonance', 'Resonance', 'math-waveform', { wave: 'triangle', harmonics: 9, speed: 0.3, pulse: 0.6, bg: '#0c0a06', fg: '#ffb35c' }, 'Waveforms'),
  P('wave-animate', 'Animate', 'math-curves', { clip: 'animate-rose', mode: 'reveal', stroke: '#9ec1ff', weight: 1.6 }, 'Waveforms'),
  // Fields — f(x,y) heatmap + flow particles · complex f(z) domain coloring
  // (labs FIELD_PRESETS over the fields FALLBACK).
  P('field-waves', 'Waves', 'math-field', { kind: 'scalar', fn: 'waves', range: 8, low: '#0b1530', high: '#ffce54' }, 'Fields'),
  P('field-ripples', 'Ripples', 'math-field', { kind: 'scalar', fn: 'ripples', range: 10, low: '#1a0b2e', high: '#ff5470' }, 'Fields'),
  P('field-saddle', 'Saddle', 'math-field', { kind: 'scalar', fn: 'saddle', range: 8, low: '#04140f', high: '#c9f29b' }, 'Fields'),
  P('field-roots2', 'z² − 1', 'math-field', { kind: 'complex', funcId: 'z2-1', range: 6, coloring: 'rings' }, 'Fields'),
  P('field-recip', '1 / z', 'math-field', { kind: 'complex', funcId: 'inv', range: 4, coloring: 'smooth' }, 'Fields'),
  P('field-sinz', 'sin z', 'math-field', { kind: 'complex', funcId: 'sin', range: 6, coloring: 'contour' }, 'Fields'),
  // Parametric — the two labs presets spinner/threads hadn't already claimed:
  // curves (the uzumaki clip library) + orbits (n-body trails).
  P('param-curves', 'Curves', 'math-curves', {}, 'Parametric'),
  P('param-orbits', 'Orbits', 'math-orbits', {}, 'Parametric'),
]
