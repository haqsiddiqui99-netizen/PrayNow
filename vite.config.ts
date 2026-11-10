import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  // Production assets live under /_desk/ so they do not clash with the public app.
  base: command === 'build' ? '/_desk/' : '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        portal: 'portal/index.html',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
}))
