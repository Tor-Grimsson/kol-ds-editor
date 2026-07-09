---
title: kol-docs-lib package
type: index
status: active
updated: 2026-07-05
description: Canon for the scaffold-docs-system skill (formerly kol-docs-lib) — the whole-repo docs layout (documentation vs machinery vs .kol), the .obsidian source model, and a worked reference repo. The outermost tier.
tags:
  - framework/conventions
aliases:
  - kol-docs-lib-package
---

# kol-docs-lib — package

The **whole-repo-library tier**. What the `scaffold-docs-system` skill (formerly `kol-docs-lib`) reads to stand up or normalise a repo's entire `docs/` tree. Contains the md tier ([[../kol-docs-md/INDEX|kol-docs-md]]), which contains fm.

| File | Holds |
|---|---|
| [[01-structure\|structure]] | The three layers (`documentation/` vs machinery vs `.kol/`), folder + INDEX law at the library level, numbering, and link form by render target. |
| [[02-obsidian\|obsidian]] | The `.obsidian` vault-config source, the two shapes, and the symlink-vs-copy picker. |
| `_example-repo/` | A worked `docs/` tree — `.obsidian`, `documentation/` (subject), `operations/` (machinery sibling) — the shape a real repo lands on. |

fm ⊂ md ⊂ **lib**.

Used by [[../../scaffold/02-scaffold-docs/INDEX|scaffold/02-scaffold-docs/]] — the scaffolding workflow that reads this canon. This package doesn't live there to keep the `kol-docs` tier family together.
