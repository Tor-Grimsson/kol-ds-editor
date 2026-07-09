---
title: kol-zine — setup
type: index
status: active
updated: 2026-05-18
description: Sequential playbook to bootstrap kol-zine on a fresh machine. Read top-to-bottom.
audience: agency-internal
tags:
  - project/zine
  - domain/setup
related:
  - "[[kol-knowledge/_framework/_example/01-architecture/INDEX|architecture]]"
---

# kol-zine — setup

Sequential playbook. Read top-to-bottom, copy-paste commands as you go.

## Sequence

| #   | Step              | What it covers                                          |
| --- | ----------------- | ------------------------------------------------------- |
| 01  | [[01-prerequisites|prerequisites]] | Accounts, tooling, env vars needed before anything else |
| 02  | [[02-install|install]]       | Clone, install deps, run dev server                     |
| 03  | [[03-deploy|deploy]]        | Vercel + Printful wiring, first deploy                  |

Each step assumes the previous has shipped clean.
