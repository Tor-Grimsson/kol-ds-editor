---
title: Components
type: reference
status: canonical
updated: 2026-05-18
verified: 2026-05-18
description: Atom / molecule / organism registry for kol-zine.
aliases:
  - components
tags:
  - project/zine
  - domain/design-system
  - domain/components
covers:
  - 8 atoms
  - 5 molecules
  - 2 organisms
  - 1 layout
sources:
  - apps/web/src/components/
related:
  - "[[kol-knowledge/_framework/_example/05-reference/01-colors|colors]]"
  - "[[kol-knowledge/_framework/_example/05-reference/02-typography|typography]]"
---

# Components

16 total. Atomic design split.

## Atoms (8)

| Component | File | Purpose |
|---|---|---|
| Button | `atoms/Button.jsx` | Primary action surface |
| Link | `atoms/Link.jsx` | Inline or block link |
| Input | `atoms/Input.jsx` | Single-line text input |
| Label | `atoms/Label.jsx` | Form label |
| Icon | `atoms/Icon.jsx` | SVG icon by name |
| Price | `atoms/Price.jsx` | Formatted currency |
| Badge | `atoms/Badge.jsx` | Status pill |
| Divider | `atoms/Divider.jsx` | Horizontal rule |

## Molecules (5)

| Component | File | Composes |
|---|---|---|
| FormField | `molecules/FormField.jsx` | Label + Input + error |
| ZineCard | `molecules/ZineCard.jsx` | Cover + title + Price + Button |
| NavItem | `molecules/NavItem.jsx` | Icon + Link |
| PriceTag | `molecules/PriceTag.jsx` | Price + Badge (sale) |
| Search | `molecules/Search.jsx` | Input + Button |

## Organisms (2)

| Component | File | Purpose |
|---|---|---|
| CatalogGrid | `organisms/CatalogGrid.jsx` | Responsive grid of ZineCards |
| CartDrawer | `organisms/CartDrawer.jsx` | Slide-out cart with PayPal buttons |

## Layouts (1)

| Component | File | Purpose |
|---|---|---|
| SiteLayout | `layouts/SiteLayout.jsx` | Header / main / footer with route outlet |
