---
title: The release pipeline
type: playbook
status: active
updated: 2026-07-05
audience: internal
description: How a change becomes a published version — the Changesets → Version PR → CI-publish loop.
providers:
  - npm
  - GitHub Actions
tags:
  - domain/workflow
  - pattern/changesets-release
related:
  - "[[INDEX|operations]]"
---

# The release pipeline

Example machinery doc (a `playbook`, numbered sections). Lives in `operations/`, not `documentation/`, because it's process — not what the repo is about.

## 0. Prerequisites

npm org exists; CI has a publish token.

## 1. Add a changeset

```
pnpm changeset
```

## 2. Merge the Version PR

```
gh pr list
gh pr merge <n> --merge --delete-branch
```

## 3. Verification

CI run green; `npm view <pkg> version` shows the new version.
