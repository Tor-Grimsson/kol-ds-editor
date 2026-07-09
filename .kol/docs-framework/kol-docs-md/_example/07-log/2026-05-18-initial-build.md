---
title: Initial build — kol-zine scaffold
type: log
status: archived
updated: 2026-05-18
description: First commit. pnpm workspace, apps/web Vite SPA, packages/ds + brand-data, four routes wired.
repo: kol-zine
tags:
  - project/zine
  - domain/scaffold
---

# Session: Initial build — kol-zine scaffold

**Date:** 2026-05-18
**Agent:** Grim (Opus 4.7, 1M)
**Summary:** Bootstrapped kol-zine. pnpm workspace + Vite SPA + DS / brand-data packages. Four routes wired, 16 components in place, no Printful yet.

## Changes Made

### New files

- `pnpm-workspace.yaml` — workspace declaring `apps/*` and `packages/*`
- `apps/web/` — Vite SPA shell, four routes (`/`, `/catalog`, `/zine/:slug`, `/about`)
- `packages/ds/styles/tokens.css` — initial token scaffold
- `packages/brand-data/colors.css` — brand ramps + identity tokens
- `apps/web/src/components/` — 8 atoms, 5 molecules, 2 organisms, 1 layout (inventory in `[[../05-reference/03-components|components]]`)

### Modified

- `package.json` — workspace root, pnpm scripts
- `vite.config.js` — workspace alias resolution

## Current state

### Working

- `pnpm dev` runs cleanly, dev server on `:5173`
- All four routes render (placeholder content)
- Token cascade resolves: brand → DS semantic → Tailwind utility
- Catalog reads from `src/content/zines.js` (3 placeholder SKUs)

### Not yet

- Printful integration
- PayPal Smart Buttons
- Production deploy

## Next steps

- Wire Printful API (see [[03-deploy|deploy]])
- Add catalog content from engagement brief
- First Vercel deploy
