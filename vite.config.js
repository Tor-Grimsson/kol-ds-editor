import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), svgr(), tailwindcss()],
  // Single react / react-dom copy — the published DS packages peer-depend on
  // React, and a duplicated copy crashes at runtime with a null dispatcher.
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  // kol-icons's Icon builds its registry via `import.meta.glob(...svg)`.
  // Globs only expand when Vite source-transforms a file — a pre-bundled
  // node_modules dep leaves them empty, so every kol-icons icon resolves to
  // "not found". Excluding it from dep-optimization makes Vite process the
  // package source directly (globs + ?raw both work), populating the registry.
  optimizeDeps: {
    exclude: ['@kolkrabbi/kol-icons'],
  },
  // /media → the kol-media CDN, same-origin so photo filters can getImageData
  // without tainting the canvas (the CDN sends NO CORS headers; a cross-origin
  // load poisons every filtered/export path). Labs model (kol-labs-single).
  // Prod note: a static build needs an equivalent rewrite at the host, e.g.
  // vercel.json { "source": "/media/:path*", "destination": "https://media.kolkrabbi.io/:path*" }.
  server: {
    proxy: {
      '/media': { target: 'https://media.kolkrabbi.io', changeOrigin: true, rewrite: (p) => p.replace(/^\/media/, '') },
    },
  },
  preview: {
    proxy: {
      '/media': { target: 'https://media.kolkrabbi.io', changeOrigin: true, rewrite: (p) => p.replace(/^\/media/, '') },
    },
  },
})
