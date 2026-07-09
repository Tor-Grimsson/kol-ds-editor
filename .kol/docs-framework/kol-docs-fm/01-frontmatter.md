---
title: Frontmatter
type: reference
status: canonical
updated: 2026-07-05
description: The YAML frontmatter contract every kol-docs file carries — required/recommended/optional fields, the status enum, in-frontmatter link form, and the date rule.
tags:
  - framework/conventions
  - domain/conventions
aliases:
  - frontmatter
related:
  - "[[02-tags|tags]]"
---

# Frontmatter

The frontmatter contract every doc in `kol-docs/` conforms to. Tags → [[02-tags|tags]]. Filenames, folders, assets, and body-link form → the doc-anatomy doc in the `kol-docs-md` package.

## Frontmatter

All keys lowercase. YAML, between `---` fences, at top of file.

```yaml
---
title: Colors
type: reference
status: canonical
updated: 2026-05-18
verified: 2026-05-18
description: Brand palette + semantic tokens. Two ramps, identity, UI state.
aliases:
  - colors
tags:
  - project/zine
  - domain/design-system
  - domain/color
covers:
  - 2 brand ramps (primary, accent × 5 stops each)
  - identity tokens
sources:
  - packages/brand-data/colors.css
related:
  - "[[02-typography|typography]]"
---
```

### Required (every doc)

| Field | Type | Purpose |
|---|---|---|
| `title` | string | Human title, distinct from filename. |
| `type` | enum | Archetype — one of the 9 in [[../kol-docs-md/01-archetypes\|archetypes]]. |
| `status` | enum | Lifecycle. See below. |
| `updated` | date | ISO `YYYY-MM-DD`. Last meaningful edit. |
| `tags` | list | List-form, hierarchical. See [[02-tags\|tags]]. |

### Recommended

| Field | Type | Purpose |
|---|---|---|
| `description` | string | One-sentence summary. Indexability, previews. |
| `related` | list | Wikilinks to related docs. |
| `aliases` | list | Recommended on every file with a `NN-` prefix. Supports Obsidian's Quick Switcher + search autocomplete. Not required for wikilink resolution. |

### Optional

| Field | Type | Purpose |
|---|---|---|
| `created` | date | When the doc first appeared. |
| `verified` | date | Last reality-check (canonical references). |
| `audience` | enum | `internal` `agency-internal` `client` `public`. |
| `superseded_by` | wikilink | If `status: superseded`, point to the replacement. |
| `drift` | list | Known stale spots. `drift: []` means clean. |

Archetype-specific fields (`providers:`, `repos:`, `themes:`, `covers:`, `sources:`, `tier:`, etc.) — see [[../kol-docs-md/01-archetypes\|archetypes]] for the full list per type.

## Status enum

| Status | Meaning |
|---|---|
| `draft` | In progress, not yet trustworthy. |
| `active` | Live, evolving, trustworthy now. |
| `canonical` | Locked. Source of truth. Edits require a status bump out of canonical first. |
| `superseded` | Replaced by another doc. Set `superseded_by:`. |
| `archived` | No longer relevant. Kept for history. |

**`active` vs `canonical`:** if you'd be comfortable an agent or teammate reading this doc and taking action without verifying, it's `canonical`. If it might still shift under their feet, it's `active`.

## Tags

- **List-form**, not bracket-array.
- **Hierarchical** with `/` where structure helps.
- Top-level namespace must come from [[02-tags\|tags]].
- Don't duplicate `type:` or `status:` as tags.

```yaml
tags:
  - domain/typography
  - project/acyr
  - provider/sanity
```

## Cross-references (in frontmatter)

- **`related:` field** — flat list of wikilinks. No graph structure.
- **Explicit-with-display form** — `[[01-colors|colors]]` binds to the filename, immune to Obsidian's index state.
- **External URLs** — standard markdown `[text](url)`.

```yaml
related:
  - "[[01-colors|colors]]"
  - "[[02-typography|typography]]"
```

Body link form (wikilink vs markdown by render target) lives in the `kol-docs-md` doc-anatomy doc — including the heading-anchor gotcha (Obsidian needs the literal heading text, not a GitHub kebab-slug).

## Dates

- ISO `YYYY-MM-DD`. No timestamps, no timezones.
- One date field required (`updated:`). `created:` and `verified:` optional.
