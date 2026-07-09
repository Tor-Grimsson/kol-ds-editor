---
title: Example repo — docs home
type: index
status: active
updated: 2026-07-05
description: Front door to a repo's docs/ — documentation/ is the subject, operations/ is machinery, .kol/ is agent state.
aliases:
  - docs
tags:
  - framework/conventions
---

# Example repo — docs home

Worked reference tree showing the three-layer split.

- **[[documentation/INDEX|documentation/]]** — what this repo is about (numbered sections).
- **[[operations/INDEX|operations/]]** — repo machinery (release, CI, workbench) — a sibling, not a numbered section.
- `.kol/llm-context/` — agent state, outside this vault, at the repo root.

`.obsidian/` here is a real local dir, its files symlinked per-file from `~/.dotfiles/claude/packages/scaffold/02-scaffold-docs/obsidian-shapes/<shape>` — see the `kol-docs-lib` package's obsidian doc.
