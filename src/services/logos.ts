import { useEffect, useState } from 'react'
import { type Candidate, normalizeDomain, rankCandidates, type RawCandidate } from './logoMatch'
import { peekConfig, readConfig } from './config'
import type { AdLogo, LogoSrc } from './auction'

/**
 * Browser side of the company-logo feature. Rules from the providers' terms that shape this file:
 *  - Logo.dev CDN images and Brandfetch search/CDN are loaded by the VISITOR'S browser (never by our server);
 *  - Brandfetch search is live and never cached;
 *  - an image that does not exist is detected with fallback=404 / onerror, so the UI never shows a broken image.
 */
export interface LogoConfig { logodevToken: string | null; brandfetchClientId: string | null }
const NONE: LogoConfig = { logodevToken: null, brandfetchClientId: null }
const fromJson = (j: { logo?: { logodevToken?: string | null; brandfetchClientId?: string | null } } | undefined): LogoConfig => ({
  logodevToken: j?.logo?.logodevToken ?? null, brandfetchClientId: j?.logo?.brandfetchClientId ?? null,
})

export function useLogoConfig(): LogoConfig {
  const [cfg, setCfg] = useState<LogoConfig>(() => fromJson(peekConfig()?.json))
  useEffect(() => { let on = true; readConfig().then((r) => { if (on && r) setCfg(fromJson(r.json)) }); return () => { on = false } }, [])
  return cfg ?? NONE
}

/** Image URL for a given source, or null when that source is not configured. */
export function logoImageUrl(src: LogoSrc, domain: string, cfg: LogoConfig, px = 32): string | null {
  const d = normalizeDomain(domain)
  if (!d) return null
  if (src === 'logodev') return cfg.logodevToken ? `https://img.logo.dev/${d}?${new URLSearchParams({ token: cfg.logodevToken, size: String(px * 2), format: 'png', fallback: '404' })}` : null
  if (src === 'brandfetch') return cfg.brandfetchClientId ? `https://cdn.brandfetch.io/domain/${d}/w/${px * 4}/h/${px * 4}/fallback/404?c=${encodeURIComponent(cfg.brandfetchClientId)}` : null
  return `/api/logo/img?d=${encodeURIComponent(d)}`
}

export function canLoad(url: string, ms = 6000): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    const done = (ok: boolean) => { img.onload = img.onerror = null; clearTimeout(t); resolve(ok) }
    const t = setTimeout(() => done(false), ms)
    img.onload = () => done(img.naturalWidth > 0)
    img.onerror = () => done(false)
    img.src = url
  })
}

export interface SiteLogoResult { domain: string; found: boolean }
/** Asks our server to look for the logo on the company's own website (and keep it). */
export async function detectSiteLogo(url: string): Promise<SiteLogoResult | null> {
  try {
    const res = await fetch('/api/logo/site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
    if (!res.ok) return null
    const j = await res.json()
    return typeof j?.domain === 'string' ? { domain: j.domain, found: j.found === true } : null
  } catch { return null }
}

/**
 * Which source actually has a logo for this domain? Tries Logo.dev, then Brandfetch, then the company's own site
 * (our server). Returns null when none has one: the caller then shows a monogram.
 */
export async function resolveLogoSrc(domain: string, cfg: LogoConfig): Promise<LogoSrc | null> {
  for (const src of ['logodev', 'brandfetch'] as const) {
    const u = logoImageUrl(src, domain, cfg)
    if (u && (await canLoad(u))) return src
  }
  const site = await detectSiteLogo(`https://${domain}`)
  return site?.found ? 'site' : null
}

export interface SearchOutcome { candidates: Candidate[]; confident: boolean; typedDomain: string | null; sources: Record<string, string> }

/** Brandfetch search: live, from the browser, never stored (its usage guidelines). */
async function brandfetchSearch(q: string, clientId: string): Promise<RawCandidate[]> {
  const res = await fetch(`https://api.brandfetch.io/v2/search/${encodeURIComponent(q)}?c=${encodeURIComponent(clientId)}`, { signal: AbortSignal.timeout(6000) })
  if (!res.ok) throw new Error(`http_${res.status}`)
  const j = await res.json()
  if (!Array.isArray(j)) throw new Error('unexpected_shape')
  return j.filter((r: any) => typeof r?.name === 'string' && typeof r?.domain === 'string').map((r: any) => ({ name: r.name, domain: r.domain, source: 'brandfetch' as const }))
}

export async function searchCompanies(q: string, lang: 'pt' | 'en', cfg: LogoConfig): Promise<SearchOutcome> {
  const server = (async () => {
    const res = await fetch(`/api/logo/search?${new URLSearchParams({ q, lang })}`)
    if (!res.ok) throw new Error(`http_${res.status}`)
    return res.json() as Promise<{ typedDomain?: string; candidates: Candidate[]; sources: Record<string, string> }>
  })()
  const bf = cfg.brandfetchClientId ? brandfetchSearch(q, cfg.brandfetchClientId) : Promise.resolve([] as RawCandidate[])
  const [s, b] = await Promise.allSettled([server, bf])
  if (s.status === 'rejected' && b.status === 'rejected') throw new Error('search_failed')
  const sv = s.status === 'fulfilled' ? s.value : null
  if (sv?.typedDomain) return { candidates: [], confident: false, typedDomain: sv.typedDomain, sources: sv.sources ?? {} }
  const raw: RawCandidate[] = []
  for (const c of sv?.candidates ?? []) for (const source of c.sources) raw.push({ name: c.name, domain: c.domain, source })
  if (b.status === 'fulfilled') raw.push(...b.value)
  const { candidates, confident } = rankCandidates(q, raw)
  return { candidates, confident, typedDomain: null, sources: { ...(sv?.sources ?? {}), brandfetch: cfg.brandfetchClientId ? (b.status === 'fulfilled' ? 'ok' : 'error') : 'off' } }
}

export type { AdLogo }
