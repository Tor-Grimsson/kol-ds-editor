---
title: Prerequisites
type: playbook
status: active
updated: 2026-05-18
description: Accounts, tooling, and env vars needed before installing kol-zine.
audience: agency-internal
tags:
  - project/zine
  - domain/setup
  - provider/vercel
  - provider/printful
aliases:
  - prerequisites
providers:
  - vercel
  - printful
  - github
placeholders:
  - "{{BRAND_NAME}}"
  - "{{BRAND_DOMAIN}}"
related:
  - "[[02-install|install]]"
  - "[[03-deploy|deploy]]"
---

# Prerequisites

Set these up before [[02-install|install]]. None of them require the codebase.

## 0. Accounts

- **GitHub** — repo access, ability to create branches.
- **Vercel** — connected to GitHub org. Hobby tier is enough.
- **Printful** — API store created. Currency set to EUR. Note the API key — needed in step 03.

## 1. Local tooling

```bash
node --version    # ≥ 20
pnpm --version    # ≥ 9
```

If either fails: `brew install node pnpm`.

## 2. Env vars

You'll need these later in [[03-deploy|deploy]]. Collect now:

| Var | Source |
|---|---|
| `PRINTFUL_API_KEY` | Printful → Settings → API → Generate token |
| `VERCEL_TOKEN` | Vercel → Account → Tokens → Create |
| `BRAND_NAME` | `{{BRAND_NAME}}` from the engagement brief |
| `BRAND_DOMAIN` | `{{BRAND_DOMAIN}}` from the engagement brief |

Store in `.env.local` (gitignored).

## Verification

- `pnpm --version` returns ≥ 9
- All four env values are written down somewhere (not in chat history)

Next: [[02-install|install]].
