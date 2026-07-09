---
title: Catalog restructure — multi-currency support
type: plan
status: active
updated: 2026-05-18
description: Proposal to add EUR and USD pricing per SKU, with currency switcher in the cart.
audience: agency-internal
tags:
  - project/zine
  - domain/restructure
  - domain/i18n
phases:
  - 1-data-shape
  - 2-ui-switcher
  - 3-printful-sync
related:
  - "[[kol-knowledge/_framework/_example/01-architecture/INDEX|architecture]]"
  - "[[03-components|components]]"
drift: []
---

# Catalog restructure — multi-currency support

Add EUR + USD pricing per SKU, surface a currency switcher in the cart.

## Why

Single-currency (EUR) blocks ~40% of inbound traffic per Umami. US visitors bounce on the EUR price.

## Current state

- SKUs in `src/content/zines.js` carry one `price: number` field.
- Cart renders `Price` atom with `eur` formatter hardcoded.
- Printful catalog is EUR-only.

## Target state

- SKUs carry `prices: { eur: number, usd: number }`.
- Cart has a 2-state switcher; switcher state persists in `localStorage`.
- Printful catalog has both currencies; webhook reconciles on order.

## Phases

### Phase 1 — data shape

- Migrate `src/content/zines.js` to `prices: { eur, usd }`
- Update `Price` atom to accept currency prop, default EUR
- Acceptance: `pnpm test` green, manual smoke clean

### Phase 2 — UI switcher

- Add `CurrencySwitcher` molecule
- Wire localStorage persistence
- Acceptance: switcher toggles, prices update reactively, persists across reloads

### Phase 3 — Printful sync

- Add USD prices in Printful dashboard
- Update `printful-webhook` to read currency from order
- Acceptance: USD test order → Printful captures correct currency
