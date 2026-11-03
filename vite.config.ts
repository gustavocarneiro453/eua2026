import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Dev only: serves the Cloudflare Pages Functions in functions/api/*.ts through Vite, so `npm run dev`
 * behaves like production (same code, same cache logic) without wrangler. The Workers `caches.default`
 * is replaced by an in-memory store.
 */
function pagesFunctionsDev(): Plugin {
  const store = new Map<string, string>()
  return {
    name: 'pages-functions-dev',
    apply: 'serve',
    configureServer(server) {
      ;(globalThis as any).caches ??= {
        default: {
          match: async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url), { headers: { 'content-type': 'application/json' } }) : undefined),
          put: async (r: Request, res: Response) => { store.set(r.url, await res.text()) },
        },
      }
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z]+)(?:\?.*)?$/.exec(req.url ?? '')
        const file = m && path.resolve(__dirname, 'functions/api', `${m[1]}.ts`)
        if (!m || !file || !fs.existsSync(file)) return next()
        try {
          const mod = await server.ssrLoadModule(`/functions/api/${m[1]}.ts`)
          const pending: Promise<unknown>[] = []
          const r: Response = await mod.onRequestGet({ request: new Request(`http://${req.headers.host}${req.url}`), waitUntil: (p: Promise<unknown>) => pending.push(p.catch(() => {})) })
          await Promise.all(pending)
          res.statusCode = r.status
          r.headers.forEach((val, key) => res.setHeader(key, val))
          res.end(Buffer.from(await r.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), pagesFunctionsDev()],
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
