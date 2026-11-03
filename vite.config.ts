import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Dev only: serves the Cloudflare Pages Functions in functions/api/** through Vite, so `npm run dev` behaves
 * like production (same code) without wrangler. Workers' `caches.default` is an in-memory store, D1 is a local
 * SQLite file (.dev-data/ads.sqlite, Node 22+), and payments run in MOCK mode (a fake checkout page) unless
 * MP_ACCESS_TOKEN is set in .env.local, in which case real Mercado Pago calls are made.
 */
function pagesFunctionsDev(): Plugin {
  const store = new Map<string, string>()
  let env: Record<string, unknown> | null = null
  return {
    name: 'pages-functions-dev',
    apply: 'serve',
    configureServer(server) {
      ;(globalThis as any).caches ??= {
        default: {
          match: async (r: Request) => (store.has(r.url) ? new Response(store.get(r.url), { headers: { 'content-type': 'application/json' } }) : undefined),
          put: async (r: Request, res: Response) => { store.set(r.url, await res.text()) },
          delete: async (r: Request) => store.delete(r.url),
        },
      }
      const devEnv = async () => {
        if (env) return env
        const vars = loadEnv(server.config.mode, __dirname, '')
        let DB: unknown
        try { DB = (await server.ssrLoadModule('/src/dev/sqliteD1.ts')).openDevD1(path.resolve(__dirname, '.dev-data/ads.sqlite')) } catch (e) {
          server.config.logger.warn(`[ads] local database unavailable (needs Node 22+): ${(e as Error).message}`)
        }
        env = {
          DB, MP_ACCESS_TOKEN: vars.MP_ACCESS_TOKEN || undefined, MP_WEBHOOK_SECRET: vars.MP_WEBHOOK_SECRET || undefined,
          ADMIN_TOKEN: vars.ADMIN_TOKEN || 'dev-admin', PAYMENTS_MODE: vars.MP_ACCESS_TOKEN ? undefined : 'mock', COUNTDOWN_TARGET: vars.COUNTDOWN_TARGET || undefined,
        }
        return env
      }
      server.middlewares.use(async (req, res, next) => {
        const m = /^\/api\/([a-z]+(?:\/[a-z]+)?)(?:\?.*)?$/.exec(req.url ?? '')
        if (!m || !fs.existsSync(path.resolve(__dirname, 'functions/api', `${m[1]}.ts`))) return next()
        try {
          const method = (req.method ?? 'GET').toUpperCase()
          const mod = await server.ssrLoadModule(`/functions/api/${m[1]}.ts`)
          const handler = mod[`onRequest${method[0]}${method.slice(1).toLowerCase()}`]
          if (!handler) { res.statusCode = 405; return res.end() }
          const chunks: Buffer[] = []
          if (method !== 'GET' && method !== 'HEAD') for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(', ') : v)
          const request = new Request(`http://${req.headers.host}${req.url}`, { method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined })
          const pending: Promise<unknown>[] = []
          const r: Response = await handler({ request, env: await devEnv(), waitUntil: (p: Promise<unknown>) => pending.push(p.catch(() => {})) })
          await Promise.all(pending)
          if (r.status >= 500) console.warn(`[api/${m[1]}] ${r.status} ${await r.clone().text()}`) // shows WHY a call failed
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
