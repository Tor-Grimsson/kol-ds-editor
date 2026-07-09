---
title: kol-docs-fm package
type: index
status: active
updated: 2026-07-05
description: Canon for the kol-docs-fm skill — the frontmatter contract, the tag taxonomy, and copy-ready samples. The innermost tier of the kol-docs doll.
tags:
  - framework/conventions
aliases:
  - kol-docs-fm-package
---

# kol-docs-fm — package

The **frontmatter tier**. What the `kol-docs-fm` skill reads when all you need is a file's YAML block correct — no archetype body, no folder law.

| File | Holds |
|---|---|
| [[01-frontmatter\|frontmatter]] | The YAML contract — required / recommended / optional fields, the status enum, dates, in-frontmatter link form. |
| [[02-tags\|tags]] | The closed top-level tag set, nesting depth, and what is *not* a tag. |
| `_example/samples.md` | Copy-ready frontmatter blocks, one per common archetype. |

Contained by the **`kol-docs-md`** package (one whole doc) which is contained by **`kol-docs-lib`** (whole repo library). fm ⊂ md ⊂ lib.
