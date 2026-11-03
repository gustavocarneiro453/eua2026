import { useEffect, useSyncExternalStore } from 'react'
import { gdeltUrl, normalizeGdelt, validateNews, type NewsLang, type NewsPayload } from './newsNormalize'

/**
 * Client for headlines. Production reads our cached endpoint /api/news (functions/api/news.ts),
 * never GDELT directly: GDELT allows one request per 5 s and returns 429 under load.
 * Direct mode exists only for local development (vite dev) or VITE_NEWS_DIRECT=1.
 */
const DIRECT = import.meta.env.DEV || import.meta.env.VITE_NEWS_DIRECT === '1'
const POLL_MS = 5 * 60_000
const MAX_BACKOFF_MS = 30 * 60_000
const REUSE_MS = 3 * 60_000
export const NEWS_STALE_MS = 30 * 60_000
const key = (l: NewsLang) => `eua2026:news:${l}:v1`

export interface NewsState {
  status: 'loading' | 'ok' | 'error'
  payload: NewsPayload | null
  lastSuccessAt: number | null
  error: string | null
}

const states: Record<NewsLang, NewsState> = { pt: init('pt'), en: init('en') }
const listeners = new Set<() => void>()
const inflight: Partial<Record<NewsLang, Promise<void>>> = {}
const fails: Record<NewsLang, number> = { pt: 0, en: 0 }
const timers: Partial<Record<NewsLang, ReturnType<typeof setTimeout>>> = {}
const users: Record<NewsLang, number> = { pt: 0, en: 0 }

function init(lang: NewsLang): NewsState {
  try {
    const s = JSON.parse(localStorage.getItem(key(lang)) || 'null')
    if (s) return { status: 'loading', payload: validateNews(s.payload, lang), lastSuccessAt: s.at, error: null }
  } catch { /* storage unavailable or invalid */ }
  return { status: 'loading', payload: null, lastSuccessAt: null, error: null }
}
function set(lang: NewsLang, patch: Partial<NewsState>) {
  states[lang] = { ...states[lang], ...patch }
  listeners.forEach((l) => l())
}

async function load(lang: NewsLang): Promise<NewsPayload> {
  if (!DIRECT) {
    const res = await fetch(`/api/news?lang=${lang}`, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`http_${res.status}`)
    return validateNews(await res.json(), lang)
  }
  const res = await fetch(gdeltUrl(lang), { credentials: 'omit' })
  const text = await res.text()
  if (res.status === 429 || /^\s*Please limit requests/i.test(text)) throw new Error('http_429')
  if (!res.ok) throw new Error(`http_${res.status}`)
  return { api: 1, lang, fetchedAt: new Date().toISOString(), source: 'GDELT', items: normalizeGdelt(JSON.parse(text)) }
}

function fetchNews(lang: NewsLang): Promise<void> {
  return (inflight[lang] ??= (async () => {
    try {
      const payload = await load(lang)
      const now = Date.now()
      // An empty answer never replaces a non-empty list we already hold.
      const keep = payload.items.length === 0 && (states[lang].payload?.items.length ?? 0) > 0
      fails[lang] = 0
      set(lang, { status: 'ok', payload: keep ? states[lang].payload : payload, lastSuccessAt: now, error: null })
      if (!keep) try { localStorage.setItem(key(lang), JSON.stringify({ at: now, payload })) } catch { /* quota */ }
    } catch (e) {
      fails[lang]++
      set(lang, { status: 'error', error: e instanceof Error ? e.message : 'unknown' })
    } finally {
      delete inflight[lang]
    }
  })())
}

function schedule(lang: NewsLang) {
  clearTimeout(timers[lang])
  if (!users[lang]) return
  const delay = Math.min(MAX_BACKOFF_MS, POLL_MS * 2 ** Math.min(fails[lang], 3))
  timers[lang] = setTimeout(async () => {
    if (document.visibilityState === 'visible') await fetchNews(lang)
    schedule(lang)
  }, delay)
}

function start(lang: NewsLang) {
  users[lang]++
  const s = states[lang]
  if (!s.lastSuccessAt || Date.now() - s.lastSuccessAt > REUSE_MS) fetchNews(lang).then(() => schedule(lang))
  else schedule(lang)
  return () => { users[lang]--; if (!users[lang]) clearTimeout(timers[lang]) }
}

export function useNews(lang: NewsLang) {
  useEffect(() => start(lang), [lang])
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l) } }, () => states[lang])
}
export const retryNews = (lang: NewsLang) => fetchNews(lang)
