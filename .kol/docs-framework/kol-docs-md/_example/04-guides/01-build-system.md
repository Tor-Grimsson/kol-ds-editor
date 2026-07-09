---
title: Build system — Vite + pnpm workspace
type: guide
status: active
updated: 2026-05-18
description: How the kol-zine build pipeline works. pnpm workspace, Vite per-app, shared packages via workspace protocol.
audience: internal
tags:
  - project/zine
  - domain/build-system
  - provider/vercel
aliases:
  - build-system
prerequisites:
  - "[[02-install|install]]"
related:
  - "[[02-css-architecture|css-architecture]]"
---

# Build system

pnpm workspace orchestrates the build. One app (`apps/web`) consumes two packages (`packages/ds`, `packages/brand-data`) via workspace protocol.

## Prerequisites

- [[02-install|install]] completed
- Familiar with Vite basics

## Build flow

```bash
pnpm build           # builds apps/web, including ds + brand-data
pnpm dev             # dev server
pnpm test            # vitest
```

The `apps/web` Vite config resolves `@ds/*` and `@brand/*` aliases to the local packages. No build step needed for the packages themselves — Vite consumes their source directly.

## CI

Vercel detects the pnpm workspace. Build command: `pnpm --filter web build`. Output: `apps/web/dist/`.

## Troubleshooting

- **`Cannot find module '@ds/...'`** — workspace not installed cleanly. `pnpm install --force`.
- **Stale Vite cache** — `pnpm exec vite --force` or delete `node_modules/.vite/`.
- **Vercel build fails on workspace** — confirm "Install Command" is `pnpm install`, not `npm install`.
