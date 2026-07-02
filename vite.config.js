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
  // kol-loader's Icon builds its registry via `import.meta.glob(...svg)`.
  // Globs only expand when Vite source-transforms a file — a pre-bundled
  // node_modules dep leaves them empty, so every kol-loader icon resolves to
  // "not found". Excluding it from dep-optimization makes Vite process the
  // package source directly (globs + ?raw both work), populating the registry.
  optimizeDeps: {
    exclude: ['@kolkrabbi/kol-loader'],
  },
})
