---
title: CSS architecture — Tailwind v4 + DS tokens + brand layer
type: guide
status: active
updated: 2026-05-18
description: How CSS is layered. DS primitives in tokens, brand values in brand-data, site chrome in apps/web.
audience: internal
tags:
  - project/zine
  - domain/css
aliases:
  - css-architecture
related:
  - "[[01-build-system|build-system]]"
  - "[[kol-knowledge/_framework/_example/05-reference/01-colors|colors]]"
  - "[[kol-knowledge/_framework/_example/05-reference/02-typography|typography]]"
---

# CSS architecture

Three-layer cascade, each owns a different concern.

## Layers

```
packages/ds/styles/tokens.css       ← DS primitives (--space-*, --radius-*, --font-*)
packages/brand-data/colors.css      ← brand values (--brand-primary, etc.)
apps/web/styles/site.css            ← site chrome (layout, marketing-only)
```

Imported in that order in `apps/web/src/main.jsx`. The cascade order matches the dependency direction.

## Rules

- **No brand values in `tokens.css`.** If a `--color-*` exists in DS, it's a *semantic* token (`--color-bg-primary`) that resolves via `var(--brand-primary)`.
- **No DS primitives in `colors.css`.** Brand is literal values only.
- **No `kol-*` prefix anywhere.** The framework's deprecated naming doesn't apply here — see [[kol-knowledge/_framework/_example/01-architecture/INDEX|D3]].

## Tailwind v4

`apps/web/styles/site.css` registers Tailwind via `@theme`:

```css
@theme {
  --color-bg-primary: var(--brand-primary);
  --font-sans: var(--font-body);
}
```

Tailwind utilities then resolve through DS semantic tokens, which resolve through brand values. One source of truth per concern.

## When to write CSS vs Tailwind

- **Tailwind** for component-internal layout, spacing, typography utilities.
- **CSS rule** when you need pseudo-elements, descendant selectors, or cascade-level theming.

Default: Tailwind first. Reach for CSS only when Tailwind can't express it.
