---
title: kol-zine — docs
type: index
status: active
updated: 2026-05-18
description: Reference docs folder demonstrating the kol-docs framework applied to a small fictional project (kol-zine — a print-on-demand zine publisher).
tags:
  - project/zine
  - framework/example
aliases:
  - zine-docs
---

# kol-zine — docs

Docs for the kol-zine project. Use this folder as the reference shape when starting a new project under `kol-docs/`.

## Sections

| Section | Contents |
|---|---|
| `01-architecture/` | Load-bearing decisions (ADR-style). Single-doc folder — [[kol-knowledge/_framework/_example/01-architecture/INDEX\|the INDEX is the doc]]. |
| `02-audit/` | Current-state snapshot. Single-doc folder — [[kol-knowledge/_framework/_example/02-audit/INDEX\|the INDEX is the doc]]. |
| `03-setup/` | Sequential playbook: [[kol-knowledge/_framework/_example/03-setup/INDEX\|overview]] → [[01-prerequisites\|prerequisites]] → [[02-install\|install]] → [[03-deploy\|deploy]] |
| `04-guides/` | Catalog: [[01-build-system\|build-system]] · [[02-css-architecture\|css-architecture]] |
| `05-reference/` | Catalog: [[kol-knowledge/_framework/_example/05-reference/01-colors\|colors]] · [[kol-knowledge/_framework/_example/05-reference/02-typography\|typography]] · [[03-components\|components]] |
| `06-plans/` | Dated: [[2026-05-18-restructure\|2026-05-18 — multi-currency restructure]] |
| `07-log/` | Dated: [[2026-05-18-initial-build\|2026-05-18 — initial build]] |

## Conventions applied here

- **INDEX where it adds signal.** This INDEX (project-level routing), `01-architecture/INDEX` and `02-audit/INDEX` (single-doc folders where the INDEX *is* the content), and `03-setup/INDEX` (frames the sequential read order). `04-guides/`, `05-reference/`, `06-plans/`, `07-log/` have no INDEX — this parent describes their contents directly.
- **Numbering.** Sequential folders (`03-setup/`) use `NN-` for reading order. Catalog folders (`04-guides/`, `05-reference/`) use `NN-` for display priority. Dated folders (`06-plans/`, `07-log/`) use ISO date prefix.
- **Folder rule.** At each level: INDEX (when needed) + `_assets/` and/or `_files/` (when needed) + either subfolders or loose files, never both.
- **Supporting files.** Renderable media (images, video, PDFs) lives in `_assets/`, embedded with `![[name.png]]`. Non-renderable files (configs, raw data, code samples) live in `_files/`, linked but not auto-rendered.

See `[[../INDEX|_framework]]`, `[[01-conventions|conventions]]`, `[[02-archetypes|archetypes]]`, `[[03-tag-taxonomy|tag-taxonomy]]`.
