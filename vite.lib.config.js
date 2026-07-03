import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

// Library build — emits the embeddable @kolkrabbi/design-editor package
// (dist/design-editor.js + dist/design-editor.css). The standalone app build
// stays in vite.config.js (the deploy target); the two never overlap.
//   pnpm build:lib
export default defineConfig({
  plugins: [react(), svgr(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  build: {
    lib: {
      entry: 'src/index.jsx',
      formats: ['es'],
      fileName: () => 'design-editor.js',
      cssFileName: 'design-editor',
    },
    // One stylesheet the consumer imports, not per-chunk fragments.
    cssCodeSplit: false,
    rollupOptions: {
      // Singletons the host must own a single copy of. React (+ router) share
      // one instance or the DS peer-deps crash with a null dispatcher; the
      // @kolkrabbi/* JS stays the host's so editor and host use ONE DS build.
      // ponytail: DS *CSS* is still bundled into design-editor.css (self-
      // contained visuals) — a host also importing kol-theme gets idempotent
      // duplicate custom-props. Externalize the css too if that ever matters.
      external: [/^react($|\/|-)/, /^@kolkrabbi\//],
    },
  },
})
