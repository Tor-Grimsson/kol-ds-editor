---
title: Deploy
type: playbook
status: active
updated: 2026-05-18
description: First Vercel deploy + Printful wiring.
audience: agency-internal
tags:
  - project/zine
  - domain/setup
  - domain/deploy
  - provider/vercel
  - provider/printful
aliases:
  - deploy
providers:
  - vercel
  - printful
related:
  - "[[01-prerequisites|prerequisites]]"
  - "[[02-install|install]]"
---

# Deploy

Assumes [[02-install|install]] is done and the dev server runs clean.

## 1. Vercel project

```bash
vercel link
```

Choose **Create new project** → name `kol-zine` → select your team.

## 2. Env vars to Vercel

```bash
vercel env add PRINTFUL_API_KEY production
vercel env add BRAND_NAME production
vercel env add BRAND_DOMAIN production
```

Paste values when prompted. Repeat for `preview` if PR deploys are wanted.

## 3. First deploy

```bash
vercel --prod
```

Build takes ~60–90s. Deploy URL appears in stdout.

## 4. Wire Printful webhook

In Printful dashboard → Stores → API → Webhooks:

- **URL:** `https://{{BRAND_DOMAIN}}/api/printful-webhook`
- **Events:** Order created, Order updated, Order shipped

## Verification

- Production URL loads, catalog renders
- Place a test order ($0.01 SKU): button → Printful capture → email confirmation arrives
- Webhook events show up in `vercel logs --follow`

Setup complete. Routine ongoing work covered in [[01-build-system|build-system]].
