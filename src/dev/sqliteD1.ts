import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'
import type { D1Like, D1Result, D1Stmt } from '../services/auction'

/**
 * D1-compatible wrapper over node:sqlite (Node 22+), for `npm run dev` and tests only.
 * Production uses the real Cloudflare D1 binding. The schema is loaded from db/schema.sql.
 */
export function openDevD1(file: string | ':memory:', schemaPath = path.resolve(process.cwd(), 'db/schema.sql')): D1Like {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec(fs.readFileSync(schemaPath, 'utf8'))
  // Local files created before logos existed: add the columns (production databases use the ALTERs in schema.sql).
  const cols = (db.prepare('PRAGMA table_info(ads)').all() as { name: string }[]).map((c) => c.name)
  if (!cols.includes('logo_domain')) db.exec('ALTER TABLE ads ADD COLUMN logo_domain TEXT')
  if (!cols.includes('logo_src')) db.exec('ALTER TABLE ads ADD COLUMN logo_src TEXT')
  const stmt = (sql: string, params: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    first: async <T>() => ((db.prepare(sql).get(...(params as never[])) as T | undefined) ?? null),
    all: async <T>() => ({ results: db.prepare(sql).all(...(params as never[])) as T[] }) as D1Result<T>,
    run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(params as never[])).changes) } }),
  })
  return { prepare: (sql) => stmt(sql) }
}
