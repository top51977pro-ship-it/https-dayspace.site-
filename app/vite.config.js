import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Capacitor serves the bundle from the filesystem, so every asset URL must be relative.
  base: './',
  build: {
    outDir: 'dist',
    // Android WebView (Chrome 90+) — no need to down-compile further.
    target: 'es2020',
  },
  server: { host: true, port: 5175 },
})
