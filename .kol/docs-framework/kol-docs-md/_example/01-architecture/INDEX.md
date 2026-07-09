---
title: kol-zine — architecture decisions
type: decisions
status: canonical
updated: 2026-05-18
description: Locked architectural decisions for kol-zine. Print-on-demand pipeline, single-page app, brand-tier vs DS-tier separation.
audience: agency-internal
tags:
  - project/zine
  - domain/architecture
  - provider/printful
related:
  - "[[kol-knowledge/_framework/_example/02-audit/INDEX|audit]]"
  - "[[06-plans/INDEX|plans]]"
---

# kol-zine — architecture decisions

Three decisions locked. Everything downstream flows from these.

## D1 — Print-on-demand over inventory

**Context.** Zines are low-volume, high-variation. Holding inventory means dead capital and pulp waste.

**Decision.** Print-on-demand via Printful. Order triggers print, ships direct.

**Consequences.** Higher unit cost. No upfront print runs. Fulfillment time +2–3 days vs in-house. Inventory risk → zero.

![[architecture-diagram.png]]

## D2 — Single-page app, no CMS

**Context.** Zine catalogue is small (<50 SKUs), changes monthly.

**Decision.** SPA with content baked into `src/content/`. No Sanity, no headless CMS.

**Consequences.** Catalog updates require a deploy. Deploy is 90s on Vercel. Tradeoff acceptable until catalog exceeds ~100 SKUs.

## D3 — Brand-tier and DS-tier separated from day one

**Context.** Past projects collapsed brand into DS, then had to rip them apart.

**Decision.** `packages/ds/` and `packages/brand-data/` from project start. No brand values in DS files. No DS primitives in brand files.

**Consequences.** Slightly more ceremony when adding a brand color. Avoids the rebind cascade that's bitten every previous project.
