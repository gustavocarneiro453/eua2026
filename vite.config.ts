import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // /api/* are Cloudflare Pages Functions (functions/): run `npx wrangler pages dev dist --port 8788` next to `npm run dev`.
  server: { proxy: { '/api': 'http://localhost:8788' } },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          map: ['react-simple-maps'],
        },
      },
    },
  },
})
