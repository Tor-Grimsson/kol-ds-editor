---
title: Typography
type: reference
status: canonical
updated: 2026-05-18
verified: 2026-05-18
description: Font stacks, size scale, prose styles.
aliases:
  - typography
tags:
  - project/zine
  - domain/design-system
  - domain/typography
covers:
  - font stacks (display, body, mono)
  - size scale (8 steps)
  - line-height scale
  - prose styles for long-form
sources:
  - packages/ds/styles/tokens.css
related:
  - "[[kol-knowledge/_framework/_example/05-reference/01-colors|colors]]"
---

# Typography

## Font stacks

| Role | Stack | Token |
|---|---|---|
| Display | Right Grotesk, system-ui | `--font-display` |
| Body | Inter, system-ui | `--font-body` |
| Mono | JetBrains Mono, monospace | `--font-mono` |

## Size scale

```css
--size-xs    /* 12 */
--size-sm    /* 14 */
--size-base  /* 16 */
--size-md    /* 18 */
--size-lg    /* 20 */
--size-xl    /* 24 */
--size-2xl   /* 32 */
--size-3xl   /* 48 */
```

8 steps. Pixel values; `rem` conversion handled at the Tailwind layer.

## Line heights

```css
--leading-tight   /* 1.1 */
--leading-snug    /* 1.3 */
--leading-normal  /* 1.5 */
--leading-loose   /* 1.75 */
```

## Prose

For long-form (zine descriptions, about page), use the `prose` utility:

```html
<article class="prose">…</article>
```

Compiled from `--font-body`, `--leading-loose`, restrained max-width.
