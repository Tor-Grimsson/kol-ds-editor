---
title: Doc anatomy
type: reference
status: canonical
updated: 2026-07-05
description: The mechanics of a doc and its folder — filenames/prefix, folder structure, INDEX's role, H1, supporting files (_assets/_files), maintenance, and wikilink form.
tags:
  - framework/conventions
  - domain/conventions
aliases:
  - doc-anatomy
related:
  - "[[01-archetypes|archetypes]]"
  - "[[../kol-docs-fm/01-frontmatter|frontmatter]]"
---

# Doc anatomy

Everything about a single doc and its folder *except* the frontmatter contract (that's the [[../kol-docs-fm/01-frontmatter|frontmatter]] doc in the kol-docs-fm package).

## Filenames

- Kebab-case, lowercase, `.md` extension. No spaces.
- **Every file gets a numeric or date prefix.** Exception: `INDEX.md` is exempt.
  - **Sequential folders** (playbook, ordered guide): `NN-` two-digit prefix = reading order.
  - **Catalog folders** (reference, guides): `NN-` = display priority (most-referenced first, alphabetical, or added-order — pick one per folder, stick to it).
  - **Dated folders** (plans, log): ISO date prefix (`YYYY-MM-DD-`) replaces `NN-`.
- **Wikilinks use the explicit-with-display form** so they always resolve regardless of Obsidian's index state: `[[01-colors|colors]]` renders as "colors" but binds to `01-colors.md`. See *Maintenance* for why.
- **Optionally add `aliases:`** with the un-prefixed name for Obsidian Quick Switcher / search autocomplete. Doesn't affect wikilink resolution.

```yaml
aliases:
  - colors
```

## Folder structure

At any folder level, you have:

- `INDEX.md` (when it adds signal — see *INDEX's role* below; exempt from prefix rule when present)
- `_assets/` and/or `_files/` (when needed — infrastructure, exempt from prefix rule)
- **Either** subfolders **or** loose content files. **Never both.**

Reason: Finder and Obsidian both group folders before files. Mixing breaks the numeric sequence visually — `01-foo.md, 02-bar/, 03-baz.md` displays as `02-bar/, INDEX.md, 01-foo.md, 03-baz.md`.

**Single-doc folders are fine.** `01-architecture/INDEX.md` IS the architecture doc, with `type: decisions` in frontmatter. The folder reserves the namespace for future growth.

## INDEX's role

INDEX.md is a **position**, not an archetype. It exists **when it adds signal** — not as a default at every folder level.

**Have an INDEX when:**
- The folder has multiple subfolders that need framing (a pillar entry routing to sections)
- The folder has a substantive "why this section exists" story worth telling
- The folder contains one substantive doc that IS the folder's content (single-doc subfolder)

**Skip an INDEX when:**
- The folder is a leaf with a handful of related files and the parent's INDEX can list them directly
- The folder content is self-evident from filenames (sequential playbook, simple reference catalog)
- The INDEX would only duplicate what the parent INDEX already says

**Types based on role:**

- Single-doc folder → INDEX *is* that doc, with the relevant `type:` in frontmatter (`decisions`, `audit`, etc.)
- Multi-doc folder with substantive framing → INDEX is `type: index` and routes to children
- No INDEX → parent INDEX describes the folder's contents directly

**Default is no INDEX.** Add one when a child listing alone isn't enough. (At the whole-repo *library* level this tightens — every section folder gets one; see the `kol-docs-lib` package.)

## H1

- `# Title` — matches `title:` in frontmatter, optionally extended with ` — qualifier` for subtitle.
- No leading numbering in the H1. Filename carries any numbering.

## Supporting files — `_assets/` and `_files/`

Two folder names, picked by what's inside:

| Folder | Holds | Embed behavior |
|---|---|---|
| `_assets/` | Renderable media — images (`.png/.jpg/.svg`), video (`.mp4/.webm`), PDFs, audio (`.mp3`) | `![[name.png]]` renders inline |
| `_files/` | Non-renderable supporting files — configs (`.txt/.json/.yaml`), code (`.css/.jsx`), raw data, exports | `[[name.txt]]` links; doesn't render. Contents go in fenced code blocks if you need them visible. |

Both follow the same placement, prefix, and naming rules below.

### Placement — closest common ancestor

The folder lives at the closest common ancestor of the docs that reference its contents:

- Used by one doc → in that doc's immediate folder
- Used by multiple docs in same section → at the section root
- Used across multiple sections → at the pillar root

```
kol-docs/<pillar>/
├── _assets/                        ← pillar-wide images (logo, recurring diagrams)
│   └── brand-logo.svg
├── 03-setup/
│   ├── _assets/                    ← section-wide images
│   │   └── deploy-flow.png
│   ├── _files/                     ← section-wide non-renderables (sibling, when both kinds present)
│   │   └── env-template.txt
│   └── 01-prerequisites.md
└── 05-reference/
    ├── _assets/
    │   └── color-ramp.png
    └── 01-colors.md
```

**Both folders coexist as siblings** in the same parent when a section has both kinds. They serve different purposes and have different embed behavior — separating them is honest.

**Promotion:** if a supporting file starts in a section's `_assets/` or `_files/` and ends up referenced from another section, move it up to the pillar level. Don't link across sibling section folders.

### Within a single folder

Flat until ~10 files, then subfolder. **Prefer topic-based subfolders** (`_assets/screenshots/`, `_assets/diagrams/`) over **type-based** (`_assets/images/`, `_assets/svgs/`). Topic carries more signal.

### `_` prefix

Sorts above content folders, matches `_example/`. Exempt from the `NN-` prefix rule.

### Embed syntax — `_assets/` (renderable)

Obsidian wikilink-embed. Two real files live in `_example/_assets/` — used here as live demos.

**Bare embed:**

```markdown
![[architecture-diagram.png]]
```

**With width constraint** (pixels after `|`):

```markdown
![[color-ramp.png|400]]
```

**Caption pattern** — italic line directly below the embed:

```markdown
![[color-ramp.png]]
*Brand ramp — primary hue, 5 stops.*
```

### Showing `_files/` contents inline

Obsidian doesn't render `.txt/.css/.jsx/.html/.json` etc. To show their contents in a doc, paste them into a fenced code block. The actual file in `_files/` stays as the canonical source-of-truth.

````markdown
```
$ORIGIN another-creation.xyz.
@  IN  MX  10  mail.protonmail.ch.
```

Full file: `[[../_files/proton-records.txt]]` (link only; Obsidian won't render this inline).
````

### Naming

- Kebab-case, descriptive.
- **No `NN-` prefix.** Supporting files aren't navigated by file tree — they're embedded or linked by name. The numbering rule is doc-only.
- Namespace where ambiguity would otherwise exist (`acyr-logo-mark.svg` over `logo.svg`). Obsidian resolves embeds by filename across the vault — unique names avoid path management.
- When names must collide, use path-qualified embed: `![[03-setup/_assets/flow.png]]`. Path-qualified is friction; descriptive-unique names are the goal.

## Maintenance

Bulk moves and renames will outrun Obsidian's metadata cache. After any restructure (rename, move, prefix change):

1. **Reload Obsidian.** Command Palette (`Cmd-P`) → "Reload app without saving". Forces a metadata reindex. Pure-alias wikilinks like `[[colors]]` won't resolve until the cache catches up. Explicit-form wikilinks (`[[01-colors|colors]]`) are immune.
2. **Grep for old filenames** across `.md` files in the affected scope. Body-text references that aren't wikilinks (prose mentions, code blocks) won't auto-update — only Obsidian-managed wikilinks do.
3. **Spot-check wikilinks** in moved/renamed files. Broken links render unstyled in preview.
4. **`aliases:` must be kept in sync.** Slug rename = update the alias.

### Wikilink form

Two forms render identically in preview but behave differently in resolution.

| Form | Source | Resolves via |
|---|---|---|
| Pure alias | `[[colors]]` | Obsidian's metadata cache + the target file's `aliases:` field |
| Explicit with display | `[[01-colors\|colors]]` | The filename directly. Display text after `\|` |

**Default: explicit with display.** Always resolves, immune to index state, survives renames at the alias level.

**Pure alias is acceptable when:** you're inside Obsidian and the index is current, the alias is reliably unique vault-wide, and you value brevity over reliability.

The framework's own cross-references all use the explicit form. External links use standard markdown `[text](url)`. Body link form by render target (wikilinks in-vault, markdown for GitHub-rendered files) is a whole-library concern — see the `kol-docs-lib` package.

### Heading anchors — GitHub slug vs Obsidian literal text

| Anchor form | Resolves in |
|---|---|
| `#kebab-case-slug` (GitHub/VS Code auto-slug from the heading) | GitHub, VS Code preview — **not** Obsidian |
| `#Literal Heading Text` (heading exactly as written) | Obsidian only |

The two render targets don't share an anchor format — there's no setting that reconciles them, it's a genuine incompatibility (open Obsidian feature request, unresolved). Since in-vault body links are already wikilinks by the render-target rule, this rarely bites: just always anchor with the **literal heading text**, never a slug — `[[file#Heading Text|display]]`. A stray markdown-style anchor link (`[display](file.md#heading-text)`) will still open the right file in Obsidian but silently fail to jump to the section.
