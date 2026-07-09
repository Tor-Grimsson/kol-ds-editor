---
title: kol-docs-md package
type: index
status: active
updated: 2026-07-05
description: Canon for the kol-docs-md skill — the 9 archetypes, doc anatomy (filenames, folders, links, assets), and a worked example folder. The middle tier.
tags:
  - framework/conventions
aliases:
  - kol-docs-md-package
---

# kol-docs-md — package

The **one-whole-doc tier**. What the `kol-docs-md` skill reads to author or normalise a single markdown doc. Includes the frontmatter tier ([[../kol-docs-fm/INDEX|kol-docs-fm]]) by reference — don't restate it.

| File | Holds |
|---|---|
| [[01-archetypes\|archetypes]] | The 9 doc types, their extra fields, body shapes, and the decision tree. |
| [[02-doc-anatomy\|doc anatomy]] | Filename/prefix law, folder law, INDEX-is-a-position, `_assets`/`_files`, wikilink vs markdown link, the maintenance pass. |
| `_example/` | A fully-applied fictional vault — one folder per archetype (architecture · audit · setup · guides · reference · plans · log) + `_assets/` embed demos. Copy shapes from here. |
| `_templates/` | Obsidian Templater files — folder-note + gallery layouts. |

fm ⊂ **md** ⊂ lib. For a whole repo's docs library (the `documentation/`-vs-machinery split, `.obsidian`, numbering) → the `kol-docs-lib` package.
