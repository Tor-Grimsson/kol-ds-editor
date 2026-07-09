---
title: Repo docs-library structure
type: reference
status: canonical
updated: 2026-07-05
description: The repo layer — how a whole docs/ tree is split (documentation vs machinery vs .kol), foldered, INDEXed, numbered, and linked by render target.
tags:
  - framework/conventions
aliases:
  - structure
related:
  - "[[02-obsidian|obsidian]]"
---

# Repo docs-library structure

Where the `kol-docs-md` package governs one file, this governs the **whole `docs/` tree**.

## The three layers

| Layer | Home | Holds |
|---|---|---|
| **Subject** | `docs/documentation/` | What the repo *is about* — numbered sections `00-overview … NN`. |
| **Machinery** | `docs/<sibling>/` (e.g. `docs/operations/`) | Repo/CI/tooling process. A **sibling** of `documentation/`, never a numbered section inside it. |
| **Agent state** | `.kol/llm-context/` (repo root) | Architecture, context, session logs. **Outside** the Obsidian vault. |

The dividing question for any doc: *"is this the repo's subject, or the machinery around the repo?"* Subject → `documentation/`. Machinery → its own sibling folder. Agent-only → `.kol/`.

## Folder + INDEX law (library level)

- **Every section folder gets an `INDEX.md`.** At the single-doc tier "INDEX is a position, not a default"; at the library tier, any folder something *navigates into* is a routing position — so it earns one. **Missing INDEXes are the most common drift — reinforce it.**
- **Subfolders XOR loose files** at every level still holds.
- **Docs home** `docs/INDEX.md` routes to `documentation/` + each sibling. `documentation/INDEX.md` routes the numbered sections.

## Numbering

Contiguous `00-…NN`, no gaps. Remove or move a section → **renumber the rest and repoint refs.** A gap is a rule set but not kept.

## Link form by render target

| File renders… | Use | Why |
|---|---|---|
| Inside the Obsidian vault (`docs/**`) | wikilinks `[[path\|display]]` | backlinks, graph, survives moves |
| Outside the vault (root `README.md`, `LLM_RULES.md`, GitHub-facing) | markdown `[text](path.md)` | wikilinks render as dead `[[…]]` there |
| Pointing *out of* the vault (to `.kol/…`) | markdown `[text](path)` | target isn't in the vault index |

`related:` frontmatter stays wikilinks regardless (metadata, never rendered outside Obsidian).

**Heading anchors are where this matters most.** GitHub/VS Code auto-slug headings to kebab-case (`#some-heading`) — Obsidian doesn't understand that form at all and fails silently (`"Unable to find selection"`). Obsidian only resolves anchors against the **literal heading text** (`#Some Heading`, case and spacing preserved). No core Obsidian setting fixes this — it's a long-standing open feature request, not a toggle. So any in-vault link that jumps to a section **must** be a wikilink with the literal heading text (`[[file#Some Heading|display]]`) — a markdown link with a GFM-slug anchor (`[display](file.md#some-heading)`) will silently fail to jump inside Obsidian even though the file-level link itself resolves fine.

## Out of scope

`LLM_RULES.md` is owned by the `scaffold-llm-context` skill, not this one — don't author it here.
