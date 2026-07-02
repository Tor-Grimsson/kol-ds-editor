// The Loop contract — the foundation the whole loop library builds on.
//
// A Loop is a SEAMLESS, parameterized motion source that is a PURE FUNCTION of
// normalized time u∈[0,1]. Because the frame is derived from u (never from
// accumulated state), a loop is scrubbable, deterministic, exportable, and —
// the point — reusable as BASE MOTION that the radar/synth effects can consume
// as a generated source (vs only image/video).
//
// A Loop definition (data module):
//   {
//     id:       string         unique, kebab-case
//     label:    string         human name (gallery + stage)
//     group:    'shape' | 'pattern' | 'field'
//     kind:     '2d' | '3d'    which player runtime drives it (slice 1 = '2d')
//     duration: number         seconds for one loop at realtime (tempo 120)
//     params:   ParamSchema[]  declarative controls (see below)
//     draw(ctx, u, w, h, params)   // kind:'2d' — paints the FULL frame in CSS px.
//                                  // 3d loops instead expose a class engine that
//                                  // satisfies the Player contract below.
//   }
//
// ParamSchema entry:
//   { key, label, type: 'range'|'color', min?, max?, step?, default }
//
// The Player contract (what a runtime exposes so the framework Scrubber /
// TransportBar / ExportPanel can drive ANY loop, 2d or 3d, identically):
//   onProgress = ({t, dur}) => void   // written each frame (drives the scrubber)
//   seek(frac)                        // 0..1 → jump the playhead (works paused)
//   setParams(params) · setTransport({paused, speed, loop, duration})
//   exportBlob() · exportBlobAt(w, h)        // PNG (current frame / @Nx)
//   recordLoop(w, h, fps)                    // one seamless u:0→1 webm sweep
//   dispose()
//
// PrimitiveEngine already satisfies this for 3d; LoopPlayer2D satisfies it for 2d.

// Build the initial param object for a loop. A loop with a complex param shape
// (e.g. the pattern loop's rules array) declares a `defaults` object directly;
// otherwise we assemble it from the declarative `params` + `camera` schemas.
export function loopDefaults(loop) {
  if (loop?.defaults) return JSON.parse(JSON.stringify(loop.defaults))
  const out = {}
  for (const p of loop?.params || []) out[p.key] = p.default
  for (const p of loop?.camera || []) out[p.key] = p.default
  return out
}
