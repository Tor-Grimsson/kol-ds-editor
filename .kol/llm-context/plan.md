---
_template:
  version: 1
  path: docs/plan.md
  sync: skip
---

# kol-design-editor — future roadmap

Where the editor goes next: a **unicorn.studio / effect.app-class** motion-and-effects tool built on the vector base already shipped. Target capabilities: a pipeable **effects** repo, a **3D layer**, **motion** on a timeline/loop *and* as live modulation (mouse / joystick / audio), arbitrary **canvas sizing**, per-layer **controls exposed to the inspector**, and the **color modes** packaged as a first-class feature.

Nothing here is committed until it graduates to a roadmap entry in `llm-context/AGENT-CONTEXT.md`. Two decisions are big enough to get their own RFCs before any code — see [[2026-07-01-param-graph|param-graph RFC]] and [[2026-07-01-render-fork|render-fork RFC]].

---

## The reframe — two of the six asks are infrastructure, not features

"Expose controls to the inspector" and "package color modes into a feature" look like peers to "3D layer." They aren't — they're the **spine** the other four stand on:

- **Parameter graph.** Every layer prop resolves from a *constant*, a *keyframe track* (time→value), or a *modulation source* (input→value). Timeline, modulation, effect knobs, and inspector controls are all views onto this one graph. Build it three times and the systems drift — the exact duplicate-systems trap this project already fights. Full shape in the [[2026-07-01-param-graph|param-graph RFC]].
- **Registry seam.** Layer types, effects, and modulation sources self-register and declare their own controls. ARCHITECTURE §5 already committed to this for effects; we make it real and prove it by packaging color modes as the first self-registered feature.

Get those right and effects / 3D / motion land as *thin* additions. Skip them and you get six silos that fight each other.

## The one real fork — rendering

Everything except effects and 3D is buildable on today's DOM/SVG base. Effects and the 3D layer are **WebGL**, and the compositor is DOM/SVG. Hybrid (GL layers composite as positioned `<canvas>` inside the DOM stack) vs. commit to a full GL scene was the pivotal bet. **RESOLVED 2026-07-01 by auditing the effects repo → hybrid (Option A).** ~90% of effects are self-contained (one canvas each); the rest sample their *own* uploaded asset, not the scene below — so nothing needs full-frame scene-as-texture, and the heterogeneous renderers (canvas2d/three/p5/pixi) rule out a single GL scene. See the [[2026-07-01-render-fork|render-fork RFC]] audit section.

---

## Phased roadmap (dependency-ordered, not excitement-ordered)

### Phase 0 — canvas sizing + grid toggle — SHIPPED 2026-07-01
Real pixel canvas dims (presets + custom W×H) driving frame ratio + export resolution; 1080-virtual coord space kept (zero layer ripple); show/hide grid. See `llm-context/session-log/2026-07-01-phase0-canvas-sizing.md`. (Fully-variable virtual space — e.g. authoring a 400×400 canvas at native 400 rather than 1080-downscaled — remains the bigger refactor, deferred.)

### Phase 1 — the spine (unlocks everything after it) — SHIPPED 2026-07-02
1. **Parameter/control schema** — layer types declare typed params; the inspector auto-renders them. "Expose controls to inspector" becomes automatic instead of per-layer hand-wiring.
2. **Registry seam** — prove it by packaging the color modes as the first self-registered feature. Low risk (the code exists), high architectural value (defines the plugin contract effects will use).

### Phase 2 — motion backbone (rendering-agnostic, highest leverage) — SHIPPED 2026-07-02
1. **Animatable params** — a param resolves from constant | keyframe track | modulation binding.
2. **Timeline + loop** UI.
3. **Modulation-source registry** — time, mouse, audio (FFT), joystick. Sources are input nodes feeding the same param graph. All of this runs on the DOM/SVG layers today — zero GL, immediate payoff.

### Phase 3 — effect layers (hybrid resolved; spike the seam, then import) — CUT ONE SHIPPED 2026-07-02 (items 1+2: loop layer host + shape/field loops; items 3+4 remain "Later")

### Phase 4 — generative waves (SCOPED 2026-07-03, 3-agent audit of kol-labs-single)

Every remaining generative family, sized and ordered. Engine APIs, param surfaces, and preset stores verified per family; three.js pin `^0.169.0`.

**Wave 2 — the four named three.js generators (Drift / Gradients / Soft Forms / 3D Scene) — SHIPPED 2026-07-03** (`src/loops/gl/`: data-only catalog + lazy host; three isolated in an async chunk). All four were trivial-to-small ports:
- **Drift** (`drift/engine/DriftEngine.js`, 406 L) — fullscreen-quad shader, 3 families × 3 styles, **`renderAtPhase(u)` already exists**, seamless (4-D simplex on a circle). Preset registry ships (`drift/registry.js`). Zero-friction: port FIRST.
- **Gradients** (`gradients/engine.js` IridescentEngine, 3 cats × 4 types) — caller-driven `frame(dt)`, no RAF of its own; owns GRAD_PALETTES/BACKDROPS (SoftForms imports them → port together).
- **Soft Forms 2D + 3D** (`softforms/engine.js` 248 L, `engine3d.js` 337 L) — caller-driven `frame(dt)`, trivial; 3D adds camera params (`setCamera({theta,phi,dist})`). Scene presets in `registry3d.js`.
- **3D Scene = Primitive** (`gradient/primitive/engine/PrimitiveEngine.js`, 438 L) — the closest thing to the Player contract (seek/onProgress/exportBlobAt/recordLoop all real; `update()` instead of `setParams`). Owns its RAF → small shim to external drive. Drags three/addons (OrbitControls, RoomEnvironment, Wireframe/LineMaterial) + optional audio/spotlight (**strip audio+spotlight in cut one**). Pose presets are pure `sample(u)` fns (`data/primitives.js`) — transport-perfect.

None of the nine engines declare param schemas — schemas are hand-written on our side per family (keys fully mapped in the audit; expose the core knobs, not all ~25).

**Wave 2b — SHIPPED IN FULL 2026-07-03:** Forms (8 forms), Environments (3 scenes), Ribbon (glass/chrome + post FX) as seek-driven engine loops; GradientEngine as the free-running 'Mesh gradient' loop in the gradients group (non-seamless accepted — ambient generator); Abstract RD (11 variations) + MSTP Turing (8) as canvas2d sim loops (free-running, sim state pooled per layer). Only the image-driven Dither mode moved to wave 4 (needs a source image).

**Wave 3 — canvas2d one-offs, ordered by presets-per-effort:**
1. **Scanlines** — SHIPPED 2026-07-03 (30 generative presets; the 5 image-driven filter presets moved to wave 4).
2. **Pattern categories** — SHIPPED 2026-07-03 (57 presets, glyph tile dropped with opentype; the 'pattern' loop group is restored).
3. **Optic: Halftone / Moiré / Reaction** — SHIPPED 2026-07-03 (22 presets; reaction documented non-scrubbing).
4. **Math** — SHIPPED 2026-07-03 (Spinner/Threads/Surface+Attractor, 26 presets; labs' "Viewport3D" proved to be a hand-rolled projector, so Surfaces came along canvas2d-pure).
5. **Para-type** — SHIPPED 2026-07-03 (13 glyph presets, 16 anatomy axes).

**Skip (documented, don't reopen):** Kinetic + Type (SVG composition model — instances/fonts/paths don't fit `draw(ctx,u,w,h,params)`; porting freezes them into dead snapshots); Penrose (15 prototypes each need a 2D-core/orbit-rig split — restructure; its orbit rig is a stage concern, not a loop).

**Host consequence:** the loop layer host grows one branch — engine-class loops (`kind:'engine'`: `init(canvas)` + per-tick `renderAtPhase(u)`/`frame(dt)` + `dispose()`), lazy-imported so three.js stays out of the base bundle. Camera interaction (orbit drag) is NOT in cut one — camera params ride the schema.

### Phase 5 — wave 4: image filters / scene-samplers (SCOPED 2026-07-03, dedicated audit)

All ~12 scene-samplers sample an uploaded image/video (shared ImageContext in labs) — in the editor the natural source is a **photo layer's image**, params riding the layer. Key architectural note from the audit: several effects are genuinely **source-agnostic** (Glass displacement reads any pixels; Scanline-filter samples luma via callback; Dither's `setImageField` takes plain arrays) — meaning a future "sample another layer's canvas" (loop output as filter input!) is feasible. Expose per-layer canvas + a cheap luma sampler as the core seam.

- **Wave 4a — SHIPPED 2026-07-03:** Glass / Scanline-filter / Dither live as photo-layer filters (`src/filters/` catalog; `layer.filterId` + flat params → bind dots/timeline work on filter knobs; live-canvas export snapshot; crop×filter mutually exclusive in v1).
- **Wave 4b — SHIPPED 2026-07-03:** radar FX ×7 + ASCII + effects canvas tier ×7 (one posterize kept) as filter defs. 18 canvas filters total.
- **Wave 4c — SHIPPED 2026-07-03:** Synth ×4 (Trails/Rutt-Etra/Slitscan/Disco) + Distortion as GL engine filters (`src/filters/gl/` catalog+host, lazy; three core now a SHARED chunk with the loops host). Free-running by nature. **Pixi tier NOT ported** (deliberate — pixi@8 + global-app lifecycle for 18 effects; opt-in later if wanted).
- **Wave 4d — RESOLVED 2026-07-03:** Lens 2D (RefractEngine) shipped as `gl-lens`; Lens 3D skipped with verdict (interactive 3D scene — gizmo/orbit/bloom — not expressible as a params filter; revisit only with an interactive-3D layer type).

**Kill criteria:** if the photo-layer-as-source seam turns ugly (async pipelines, GL context churn per layer), stop at wave 4a and re-scope before Synth/pixi.

### Phase 6 — editor UX hardening — SHIPPED 2026-07-03 (all six workstreams; kinetic-type layer remains the scoped later item)

Six workstreams, A first (the others hang off it):
- **A — inspector restructure:** right rail → Inspector · **Parameters** · Palette. Inspector = high-level only (position/dims/rotate + NEW opacity slider+input + blend dropdown); per-capability pointer rows ("Loop · Circle morph →") flip to the Parameters tab where AutoControls/schema controls live. Fix the AxisField focus-overflow (horizontal scroll) by adopting the PropertyInput idiom from the stroke panel.
- **B — footer rebuild:** footer moves to the LEFT rail; segmented-toggle sizing matched to the labs reference; Output tab = Aspect dropdown + @Nx scale dropdown + Export PNG + **Export loop (webm)** (bake one transport loop: seek u stepwise, rasterize buildLayersSvg per frame onto a captureStream(0) canvas — pulls the deferred motion-baking item in); File tab context-sensitive (generative: Save/Load settings JSON · photo-with-source: Upload image / Clear image; video source deferred).
- **C — canvas/chrome polish:** loop background on/off toggle (only when the loop has a bg-roled param and bg isn't mixed into its color math); editable frame title top-left; fix selection-wireframe zoom jolt; topbar z above rulers + light ruler variant; zoom % and fps unified as matching chips side-by-side at the zoom position.
- **D — defaults + rough edges:** swatch defaults → Primary #FFCF33 / Secondary #AD5038 / Light #FAF7F0 / Dark #222D3D / Accent #DF760B / BG #F5EBD8 (likely resolves the all-cream-500 issue); nudge undo coalescing; marquee skips hidden/locked; ruler label lag.
- **E — camera-drag toggle** on orbit-capable engine layers (Rutt-Etra, 3D scene, forms, environment, ribbon): enables the engine's OrbitControls and suppresses editor drag on that canvas (also settles the scan-vs-pointer-routing conflict). Related-later: pointer-as-camera modulation.
- **Kinetic-type layer (scoped later, from review item 11):** text layer / Type mode / labs TYPE-Kinetic all stand on the shared type foundation (`modes/type/cuts`); the labs compositions' right home is a future kinetic-type LAYER on the KineticType engine — not a merge into Type mode. Unblocks the skip-listed labs Type/Kinetic import.

### Phase 7 — universal effects — SHIPPED 2026-07-03 (canvas filters on shape/text/pattern/path/2d-loop via self-render source; GL filters photo-only v1; engine loops/groups excluded v1)

### Phase 8 — media library + video sources — SHIPPED 2026-07-03 (+ full param-connectivity audit: every schema param traced to its consumer; fixes/gates/removals in the session log)
Bucket (`asset-library/`) wired as the internal library, the labs way: `admin.kolkrabbi.io/api/list` listing + `media.kolkrabbi.io` URLs through a **same-origin `/media/` proxy** (CDN sends no CORS headers; the proxy is what keeps filter canvases untainted). MediaPicker modal (library-only; labs' local-gallery half skipped). Video as a photo source: `srcType:'video'`, `<video>` element normalized into the image workflow (labs ImageContext pattern), per-frame fitted-source redraw for canvas filters, `VideoTexture`/`touchSource` for GL filters; crop excluded for video.

### Phase 9 — modulation sources v2 — SHIPPED 2026-07-03 (audio bands mic/track, LFOs, MIDI learn, layer-local pointer, per-binding range/invert/smooth)
Rationale: every knob in the catalog (~300 presets, 24 filters) is already bindable — richer sources multiply everything at once, vs. a new layer type adding one lane.
- **Audio bands**: labs `audioSource.js` has FFT band reads — replace the single mic-RMS source with bass/mid/high band sources (+ audio-file input, not just mic).
- **LFOs**: sine/triangle/square sources with rate + phase — cheap, huge win (animate anything without keyframes).
- **MIDI**: Web MIDI knobs/faders as sources (feature-detect; labs Live page's mapping model — smoothing/curve/range per binding — is the reference).
- **Per-binding transform UI**: BindDot grows smooth/invert/range controls (the resolver's `transform` already carries range).
- **Pointer-relative-to-layer** (local 0..1 within the layer's bounds) + the deferred pointer-as-camera idea rides this.

### Phase 10 — kinetic-type layer — SHIPPED 2026-07-03 (zero-dep engine port — flubber/mathjs/paper all proved unnecessary; 10 labs presets; VECTOR export with inlined fonts)
The labs Type/Kinetic compositions as a dedicated layer type on the KineticType engine (opentype + paper + flubber — the skip-listed import, now with a home). Shares the type foundation with text layers / Type mode.

Effects attach to ANY layer, not just photos: the layer's own rendered output becomes the filter `src` (the "layer-as-filter-source" seam from the wave-4 audit). Canvas-rendered layers (loop/filtered-photo) are already canvases; DOM/SVG layers (shape/text/pattern/path) rasterize themselves per frame (static layers: once). Entry points: **Effects menu in the top bar (before Mode)** + "Add effect" in the inspector — both edit in the Parameters tab. Depends on Phase 6-A.
1. **Spike** the effect-layer host: one offscreen canvas (start with a zero-dep `src/loops/` shape loop) positioned/transformed as a normal layer, honoring opacity. Validates the *seam*, not the compositing model (audit already settled that).
2. **Import `src/loops/` shape+field loops** — pure `draw(ctx,u,w,h,params)` modules, ~5-file zero-npm runtime. Their schema plugs into Phase 1; their pure-`u` playback plugs into Phase 2's transport (loops literally can't run without it — tightens motion-before-effects). Exclude the pattern loop (opentype) + effects pixi tier (pixi.js) from cut one.
3. **Later:** the scene-sampler filters (Effects/Glass/Radar) — each needs its own source asset wired (reuses photo-layer + image-insert), the pixi tier drags pixi.js.
4. **3D layer** — genuinely new (no 3D effect ships in the repo); a three.js/r3f layer on the same effect-layer host.

**Why motion before effects, even with the effects repo ready:** a static effect is just a filter — effect × modulation is what unicorn/effect actually sell. Motion ships now on the base we have; effects wait on the risky GL spike. And the param graph built for motion *is* the graph effects plug into — motion-first de-risks effects for free.

---

## Feature entries

### canvas sizing
Arbitrary width/height (or a preset + custom), replacing the fixed 1080 virtual width.

**shape** — canvas inspector gains W/H fields + a preset dropdown; rulers/letterbox already track a virtual size.
**architecture** — generalize `CANVAS_VIRTUAL_W` / aspect derivation to a `{w, h}` pair threaded through Canvas, snap targets, export `aspectToWH`.
**trade-offs** — presets (social sizes) stay the fast path; fully-free sizing risks users making export-hostile dimensions.
**open questions** — does changing canvas size reflow existing layers, or leave them in place? (Lean: leave in place, offer a "fit" action.)
**kill criteria** — none; this is table-stakes.

### parameter graph + inspector controls
See [[2026-07-01-param-graph|param-graph RFC]]. The load-bearing piece — everything below assumes it.

### color modes as a feature
Repackage the existing palette / pattern / type color modes behind the registry seam as the reference implementation of a "feature."

**shape** — no user-facing change initially; internally the modes become a registered feature bundle.
**architecture** — a feature manifest (id, registered layer types, contributed controls, contributed inspector panels) consumed by the registry.
**trade-offs** — an extraction refactor with no immediate user payoff; the payoff is that effects reuse the exact seam.
**open questions** — how much of the current mode-router coupling has to move? (Scope it before committing.)
**kill criteria** — if the seam can't cleanly absorb the color modes, the seam design is wrong — fix it before building effects on it.

### motion — timeline + modulation
See [[2026-07-01-param-graph|param-graph RFC]] (modulation is a consumer of the graph). Timeline UI, loop playback, and the modulation-source registry (time/mouse/audio/joystick).

**shape** — a bottom timeline dock; params show a keyframe/modulation affordance in the inspector; a transport (play/loop/scrub).
**architecture** — a runtime evaluator that resolves the param graph each frame; sources are RAF/event/Web-Audio driven input nodes.
**trade-offs** — introduces a per-frame evaluation loop the static editor never needed; needs a play/pause boundary so authoring stays cheap.
**open questions** — keyframe interpolation model (bezier easing per segment?); does export bake motion to video, or is it preview-only first? (Lean: preview-only first, export later.)
**kill criteria** — if per-frame evaluation can't hold 60fps on a modest composition, rethink the evaluator before adding sources.

### effects (from the effects repo)
GL layer types registered via the seam. Blocked on the render fork.

**shape** — effect layers appear in the layer stack; their params surface in the inspector; modulation drives them.
**architecture** — each effect is a registered GL layer type rendering to an offscreen canvas; params declared via the schema.
**trade-offs** — full-frame effects over live vector/text are the hard case — see the render-fork RFC for what the hybrid can and can't do.
**open questions** — the whole render-fork RFC.
**kill criteria** — if the hybrid can't composite effects acceptably and a full GL scene means bulldozing the vector editor, pause and re-scope (§4).

### 3D layer
A three.js / r3f layer, architecturally a specialized GL layer.

**shape** — insert a 3D layer; inspector exposes camera / geometry / material params; modulation drives them.
**architecture** — same GL-layer host as effects; r3f scene rendered to the layer's canvas.
**trade-offs** — pulls in a heavy dep (three) — gate it behind the same build allowance as paper.
**open questions** — asset import (glTF)? or primitives-only v1? (Lean: primitives + basic materials first.)
**kill criteria** — if it can't share the effects GL-layer host, the host abstraction is wrong.

---

Nothing here is committed. Items graduate to `llm-context/AGENT-CONTEXT.md` when they become real work; the two RFCs resolve before their phases start.
