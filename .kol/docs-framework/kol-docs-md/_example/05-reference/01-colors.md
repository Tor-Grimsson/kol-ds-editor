---
title: Colors
type: reference
status: canonical
updated: 2026-05-18
verified: 2026-05-18
description: Brand palette + semantic tokens. Two ramps, identity, UI state.
aliases:
  - colors
tags:
  - project/zine
  - domain/design-system
  - domain/color
covers:
  - 2 brand ramps (primary, accent × 5 stops each)
  - neutral ramp (cream)
  - identity tokens (primary, on-primary, secondary, on-secondary)
  - UI state (error, warning, info, success)
sources:
  - packages/brand-data/colors.css
  - packages/ds/styles/tokens.css
related:
  - "[[kol-knowledge/_framework/_example/05-reference/02-typography|typography]]"
  - "[[02-css-architecture|css-architecture]]"
---

# Colors

Two-layer color system. Brand values live in `brand-data/colors.css`, semantic tokens resolve to them in `ds/tokens.css`.

![[color-ramp.png]]

## Brand ramps

```css
--brand-primary-100  →  500
--brand-accent-100   →  500
--brand-cream-100    →  500
```

Five stops each. `100` is lightest, `500` darkest.

## Identity tokens

```css
--color-primary           /* → var(--brand-primary-500) */
--color-on-primary        /* → var(--brand-cream-100) */
--color-secondary         /* → var(--brand-accent-400) */
--color-on-secondary      /* → var(--brand-cream-100) */
```

## UI state

```css
--ui-error      /* red 500 */
--ui-warning    /* amber 400 */
--ui-info       /* blue 400 */
--ui-success    /* green 500 */
```

## Tailwind utilities

After `@theme` registration in `site.css`:

```html
<div class="bg-primary text-on-primary">…</div>
```

## Related

- [[kol-knowledge/_framework/_example/05-reference/02-typography|typography]] — sibling reference
- [[02-css-architecture|css-architecture]] — the layer model
