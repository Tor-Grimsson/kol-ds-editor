// Scanline loops — the single cumulative-sum engine + the picker presets, ported
// from kol-labs-single scanlines/registry.js. The labs' six CATEGORIES (a
// geometry/mark family each) become preset `sub` groups; each preset's param
// patch is the labs `defaults` verbatim (they patch over the loop's defaults the
// same way the labs patched over FALLBACK).
//
// The labs FILTER_PRESETS (photo/lines/mesh/ascii/mirror) are NOT ported — they
// need an image/video/webcam luma source, which the loop contract has no input
// for (a loop is a pure function of u + params).

import scanline from './engine.js'

export const SCANLINE_LOOPS = [scanline]

const P = (id, label, loop, params = {}, sub) => ({ id, label, loop, params, sub })

export const SCANLINE_PRESETS = [
  // Spaced
  P('scan-spaced-drift', 'Drift', 'scanline', { geometry: 'rows', mark: 'dots', field: 'noise', rows: 96, minGap: 5, maxGap: 26, contrast: 1.1 }, 'Spaced'),
  P('scan-spaced-fine', 'Fine', 'scanline', { geometry: 'rows', mark: 'dots', field: 'noise', rows: 132, minGap: 3, maxGap: 18, contrast: 1.2 }, 'Spaced'),
  P('scan-spaced-coarse', 'Coarse', 'scanline', { geometry: 'rows', mark: 'dots', field: 'noise', rows: 54, minGap: 8, maxGap: 34, markSize: 1.3 }, 'Spaced'),
  P('scan-spaced-waves', 'Waves', 'scanline', { geometry: 'rows', mark: 'dots', field: 'waves', rows: 90, minGap: 4, maxGap: 24, freq: 1.4 }, 'Spaced'),
  P('scan-spaced-columns', 'Columns', 'scanline', { geometry: 'columns', mark: 'dots', field: 'noise', rows: 96, minGap: 5, maxGap: 26 }, 'Spaced'),
  // Glyph
  P('scan-glyph-ascii', 'ASCII', 'scanline', { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 56, minGap: 9, maxGap: 26, charset: 'ascii' }, 'Glyph'),
  P('scan-glyph-blocks', 'Blocks', 'scanline', { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 64, minGap: 7, maxGap: 22, charset: 'blocks' }, 'Glyph'),
  P('scan-glyph-binary', 'Binary', 'scanline', { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 60, minGap: 8, maxGap: 24, charset: 'binary' }, 'Glyph'),
  P('scan-glyph-dotset', 'Dots', 'scanline', { geometry: 'rows', mark: 'glyph', field: 'noise', rows: 56, minGap: 9, maxGap: 26, charset: 'dots' }, 'Glyph'),
  P('scan-glyph-dense', 'Dense', 'scanline', { geometry: 'rows', mark: 'glyph', field: 'waves', rows: 84, minGap: 5, maxGap: 18, charset: 'ascii', fontScale: 0.8 }, 'Glyph'),
  // Lattice
  P('scan-lattice-mesh', 'Mesh', 'scanline', { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 64, minGap: 7, maxGap: 18 }, 'Lattice'),
  P('scan-lattice-weave', 'Weave', 'scanline', { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 70, minGap: 5, maxGap: 18, weave: true }, 'Lattice'),
  P('scan-lattice-terrain', 'Terrain', 'scanline', { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 60, minGap: 7, maxGap: 16, displace: 0.7 }, 'Lattice'),
  P('scan-lattice-fine', 'Fine', 'scanline', { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 100, minGap: 5, maxGap: 14, markSize: 0.7 }, 'Lattice'),
  P('scan-lattice-bold', 'Bold', 'scanline', { geometry: 'rows', mark: 'lattice', field: 'noise', rows: 48, minGap: 8, maxGap: 22, markSize: 1.6 }, 'Lattice'),
  // Vortex
  P('scan-vortex-swirl', 'Swirl', 'scanline', { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 220, minGap: 4, maxGap: 22, swirl: 0.8 }, 'Vortex'),
  P('scan-vortex-straight', 'Straight', 'scanline', { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 220, minGap: 4, maxGap: 22, swirl: 0 }, 'Vortex'),
  P('scan-vortex-dense', 'Dense', 'scanline', { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 360, minGap: 3, maxGap: 18, swirl: 0.5 }, 'Vortex'),
  P('scan-vortex-wide', 'Wide', 'scanline', { geometry: 'radial', mark: 'dots', field: 'noise', rayCount: 150, minGap: 5, maxGap: 26, swirl: 1, markSize: 1.3 }, 'Vortex'),
  P('scan-vortex-dash', 'Dash', 'scanline', { geometry: 'radial', mark: 'dash', field: 'noise', rayCount: 200, minGap: 4, maxGap: 22, swirl: 0.6, dashLen: 1 }, 'Vortex'),
  // Rings
  P('scan-rings-concentric', 'Concentric', 'scanline', { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20, dashLen: 1 }, 'Rings'),
  P('scan-rings-fine', 'Fine', 'scanline', { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 100, minGap: 3, maxGap: 16, dashLen: 0.8 }, 'Rings'),
  P('scan-rings-bold', 'Bold', 'scanline', { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 36, minGap: 5, maxGap: 24, dashLen: 1.4, markSize: 1.4 }, 'Rings'),
  P('scan-rings-dotted', 'Dotted', 'scanline', { geometry: 'rings', mark: 'dots', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20 }, 'Rings'),
  P('scan-rings-swirl', 'Swirl', 'scanline', { geometry: 'rings', mark: 'dash', field: 'noise', ringCount: 60, minGap: 4, maxGap: 20, swirl: 0.5, dashLen: 1 }, 'Rings'),
  // Spiral
  P('scan-spiral-single', 'Single', 'scanline', { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 8, arms: 1, minGap: 4, maxGap: 20 }, 'Spiral'),
  P('scan-spiral-double', 'Double', 'scanline', { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 6, arms: 2, minGap: 4, maxGap: 20 }, 'Spiral'),
  P('scan-spiral-triple', 'Triple', 'scanline', { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 5, arms: 3, minGap: 4, maxGap: 18 }, 'Spiral'),
  P('scan-spiral-tight', 'Tight', 'scanline', { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 14, arms: 1, minGap: 3, maxGap: 14 }, 'Spiral'),
  P('scan-spiral-galaxy', 'Galaxy', 'scanline', { geometry: 'spiral', mark: 'dots', field: 'noise', turns: 6, arms: 4, minGap: 4, maxGap: 22, markSize: 1.2 }, 'Spiral'),
]
