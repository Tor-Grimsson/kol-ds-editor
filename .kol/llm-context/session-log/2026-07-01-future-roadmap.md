# Session: future roadmap + two RFCs (planning, docs-only)

**Date:** 2026-07-01
**Agent:** Grim (Claude Opus)
**Summary:** Planned the post-parity future of the editor toward a unicorn.studio/effect.app-class motion+effects tool (effects repo, 3D layer, timeline+modulation, canvas sizing, inspector controls, color modes as a feature). No code — docs only.

## Key decisions / reframe
- **Two of the six asks are infrastructure, not features:** "expose controls to inspector" + "package color modes" = the *spine* (parameter graph + registry seam) the other four stand on.
- **The one real fork is rendering:** effects + 3D are WebGL; the base is DOM/SVG. Recommendation = hybrid (GL layers as positioned `<canvas>`), resolve hybrid-vs-rasterize by spike. Never full-GL bulldoze (§4).
- **Sequencing: motion before effects** even with the effects repo ready — motion ships on today's base, de-risks effects (same param graph), and effect × modulation is the actual product.

## Changes Made
- Rewrote `docs/plan.md` (kept its `_template` block) as the dependency-ordered roadmap: Phase 0 canvas sizing → Phase 1 spine → Phase 2 motion → Phase 3 GL fork; per-feature entries in the native shape/architecture/trade-offs/open-questions/kill-criteria template.
- New `docs/rfc/` folder (kol-docs `plan`-type docs, framework frontmatter):
  - `2026-07-01-param-graph.md` — one reactive param model (constant | keyframe track | modulation), schema-driven inspector, runtime evaluator.
  - `2026-07-01-render-fork.md` — hybrid vs. full-GL vs. hybrid+rasterize; spike-first.
- Updated `AGENT-CONTEXT.md` roadmap + open-explorations to point at the plan + RFCs.

## Next Steps
1. When ready to build: Phase 0 (canvas sizing) is the free-standing warm-up. Phase 1 (param schema refactor) is the first real spine work — start there after resolving the param-graph RFC's open questions (interpolation model, serialization location, export baking).
2. Effects-repo audit (per render-fork RFC) — how many effects need full-frame compositing vs. per-layer — decides whether hybrid alone covers v1.
3. Still no git repo.
