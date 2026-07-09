---
title: kol-zine — current-state audit
type: audit
status: active
updated: 2026-05-18
description: Snapshot of kol-zine repo as of 2026-05-18. Routes, components, dependencies, CSS line counts.
audience: agency-internal
tags:
  - project/zine
  - domain/audit
sources:
  - src/
  - package.json
  - vite.config.js
covers:
  - route inventory
  - component count
  - dependency footprint
  - CSS classification
related:
  - "[[kol-knowledge/_framework/_example/01-architecture/INDEX|architecture]]"
  - "[[06-plans/INDEX|plans]]"
---

# kol-zine — current-state audit

Snapshot taken 2026-05-18 against `main@a3f2c1`.

## Routes

| Route | Component | Purpose |
|---|---|---|
| `/` | `Home` | Landing, hero, latest 3 zines |
| `/catalog` | `Catalog` | Full SKU grid |
| `/zine/:slug` | `ZineDetail` | Per-zine page, buy button |
| `/about` | `About` | Studio info |

## Components

Atoms: 8. Molecules: 5. Organisms: 2. Layouts: 1.

Total: 16 components in `src/components/`. No drift between `src/` and the component inventory.

## Dependencies

```
dependencies:        12  (react, react-router-dom, ...)
devDependencies:     18  (vite, vitest, eslint, ...)
total node_modules:  243 packages, 89 MB
```

No `@sanity/*`, no `next`, no heavy CMS deps — consistent with [[kol-knowledge/_framework/_example/01-architecture/INDEX|D2]].

## CSS

Three files, 612 lines total.

| File | Lines | Classification |
|---|---|---|
| `packages/ds/styles/tokens.css` | 184 | DS-canon |
| `packages/brand-data/colors.css` | 92 | Brand |
| `apps/web/styles/site.css` | 336 | Site-chrome |

Zero brand values in `tokens.css`. Zero DS primitives in `colors.css`. [[kol-knowledge/_framework/_example/01-architecture/INDEX|D3]] holding.

## Findings

- No drift between architecture and reality.
- Component count is healthy for the route surface.
- `site.css` (336 lines) approaching the size where it should split — flag for next audit cycle.
