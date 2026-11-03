import type { D1Like } from './auction'
import { mpConfigured, type MpEnv } from './mercadopago'

export interface AdsEnv extends MpEnv { DB?: D1Like; ADMIN_TOKEN?: string; SITE_URL?: string; PAYMENTS_MODE?: string }
export type Ctx = { request: Request; env: AdsEnv; waitUntil(p: Promise<unknown>): void }

export const getDb = (env: AdsEnv) => env.DB ?? null
/** mock = local/demo checkout (only when PAYMENTS_MODE=mock is set explicitly); off = payments not configured. */
export const paymentsMode = (env: AdsEnv): 'mock' | 'mercadopago' | 'off' => (env.PAYMENTS_MODE === 'mock' ? 'mock' : mpConfigured(env) ? 'mercadopago' : 'off')
export const siteOrigin = (env: AdsEnv, request: Request) => (env.SITE_URL?.trim().replace(/\/+$/, '') || new URL(request.url).origin)

export function json(body: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } })
}
/** Browsers always send Origin on POST: it must be this site (blocks cross-site form posts). */
export const sameOrigin = (request: Request) => { const o = request.headers.get('origin'); return !o || o === new URL(request.url).origin }

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}
export const isAdId = (s: string | null): s is string => !!s && /^[0-9a-f-]{36}$/.test(s)
