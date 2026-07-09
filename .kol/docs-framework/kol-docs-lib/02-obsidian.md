---
title: Obsidian vault-config source
type: reference
status: active
updated: 2026-07-05 (3)
description: The single .obsidian config source repos symlink (per-file) or copy into docs/.obsidian, its three shapes, and the six-choice picker.
tags:
  - framework/conventions
  - provider/obsidian
aliases:
  - obsidian
related:
  - "[[01-structure|structure]]"
---

# Obsidian vault-config source

The vault config lives once at **`~/.dotfiles/claude/packages/scaffold/02-scaffold-docs/obsidian-shapes/`** and repos symlink (or copy) it into their `docs/.obsidian/`. Edit the source → every symlinked repo inherits it.

## Shapes

| Shape | Seeded from | For |
|---|---|---|
| `01-vault-shape/.obsidian/` | kol-monorepo | Rich general vault — plugins, snippets, themes, hotkeys, folder-notes, dataview. |
| `02-kol-vault-shape/.obsidian/` | kol-vault | The actual dedicated Obsidian vault — 30 enabled plugins (`dataview`, `templater-obsidian`, `quickadd`, …). The richest shape. |
| `03-kol-ds-shape/.obsidian/` | kol-design-system | Minimal — core plugins only. Lightweight doc trees. |

Each shape is an openable mini-vault (a `.obsidian/` + a dummy note) — open it in Obsidian to test plugins; changes flow to linked repos.

## The picker (ask on setup)

Present six options (AskUserQuestion — symlink or copy, times 3 shapes):

1. **Symlink `01-vault-shape`** — per-file (see below). Shared, no drift.
2. **Symlink `02-kol-vault-shape`** — same, the rich kol-vault set.
3. **Symlink `03-kol-ds-shape`** — same, minimal.
4. **Copy `01-vault-shape`** — `cp -R`, repo owns it, drifts independently.
5. **Copy `02-kol-vault-shape`** — `cp -R`, the rich kol-vault set.
6. **Copy `03-kol-ds-shape`** — `cp -R`, minimal.

Symlink = one source of truth. Copy = independent, per-repo editable, drifts from source.

## Symlink mode is per-file, not whole-directory

`docs/.obsidian/` is a **real local directory** in the target repo. Symlink each file/folder inside it individually to the matching path in the chosen shape — never `ln -s .../.obsidian docs/.obsidian` as one directory symlink:

```sh
mkdir docs/.obsidian
SRC=~/.dotfiles/claude/packages/scaffold/02-scaffold-docs/obsidian-shapes/<shape>/.obsidian
for item in "$SRC"/*; do ln -s "$item" "docs/.obsidian/$(basename "$item")"; done
```

**Why:** a whole-directory symlink makes `workspace.json` — per-vault runtime state — the literal same file across every repo pointed at that shape, which breaks "per-vault local" outright (there's only one physical file to gitignore or diverge). Per-file symlinking lets the shared plugin config and the independent per-vault state coexist. Copy mode isn't affected — `cp -R` already produces an independent directory.

## Always excluded

Never seeded in any shape — per-vault local UI state / runtime caches, left absent so Obsidian creates them fresh per repo; **gitignore `docs/.obsidian/` wholesale in every target repo either way**:

`workspace.json`, `workspaces.json`, `workspace-mobile.json`, `plugin-data/`, `bookmarks.json`, `switcher.json`, `backlink.json`, `webviewer.json`, `note-composer.json`.
