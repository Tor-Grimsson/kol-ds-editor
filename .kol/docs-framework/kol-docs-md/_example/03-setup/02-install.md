---
title: Install
type: playbook
status: active
updated: 2026-05-18
description: Clone the repo, install deps, run dev server.
audience: agency-internal
tags:
  - project/zine
  - domain/setup
aliases:
  - install
related:
  - "[[01-prerequisites|prerequisites]]"
  - "[[03-deploy|deploy]]"
---

# Install

Assumes [[01-prerequisites|prerequisites]] is done.

## 1. Clone

```bash
git clone git@github.com:kolkrabbi/kol-zine.git
cd kol-zine
```

## 2. Install deps

```bash
pnpm install
```

First install: ~90s on warm npm cache. Resolves a single workspace with `apps/web` + `packages/{ds,brand-data}`.

## 3. Env

```bash
cp .env.example .env.local
```

Fill in `PRINTFUL_API_KEY`, `BRAND_NAME`, `BRAND_DOMAIN` from the values collected in [[01-prerequisites|prerequisites]].

## 4. Dev server

```bash
pnpm dev
```

Vite spins up on `http://localhost:5173`. Hot reload on save.

## Verification

- `http://localhost:5173` shows the kol-zine landing page
- Browser console clean (no red)
- Hot reload: edit `apps/web/src/Home.jsx`, save, page updates without reload

Next: [[03-deploy|deploy]].
