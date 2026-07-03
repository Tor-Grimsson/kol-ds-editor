# @kolkrabbi/design-editor

The Kolkrabbi design editor as an embeddable React component — a DOM/SVG
vector + generative compositor (canvas, layers, palette/pattern/type
generators, kinetic type, boolean geometry, image export).

Consumes the published `@kolkrabbi/kol-*` design system as peer dependencies.

**Live:** [editor.kolkrabbi.io](https://editor.kolkrabbi.io)

## Install

```sh
npm install @kolkrabbi/design-editor
```

Peer dependencies (install if you don't already have them):

```sh
npm install react react-dom react-router-dom \
  @kolkrabbi/kol-component @kolkrabbi/kol-framework \
  @kolkrabbi/kol-theme @kolkrabbi/kol-loader
```

## Usage

```jsx
import { DesignEditor } from '@kolkrabbi/design-editor'
import '@kolkrabbi/design-editor/style.css'

export default function EditorPage() {
  return <DesignEditor mediaProxyBase="/media/" />
}
```

The editor mounts wherever you place it and owns no route — it runs on an
internal `MemoryRouter`, so it never touches the host app's URL bar.

## Host requirements

The editor loads media and fonts **same-origin** on purpose: the Kolkrabbi
CDN sends no CORS headers, so a cross-origin image load taints the canvas and
breaks photo filters and export. Your host must proxy two paths:

| Path | Proxy target | Why |
|---|---|---|
| `/media/*` | `https://media.kolkrabbi.io/*` | image/video sources for filters + export |
| `/fonts/*` | the bundled `dist/fonts/*` | `@font-face` (JetBrains Mono etc.) for text/morph render |

Point `mediaProxyBase` at whatever path you proxy (`/media/` is the default).
On Vercel, that's a `vercel.json` rewrite; any static host has an equivalent.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `mediaProxyBase` | `string` | `/media/` | Same-origin path your host proxies to the media CDN. |

## Build

- `pnpm build:lib` — build the library (`dist/design-editor.{js,css}`).
- `pnpm build` — build the standalone app (deploy target, not published).
- `pnpm dev` — run the standalone editor locally.

## License

MIT — see [LICENSE](./LICENSE).
