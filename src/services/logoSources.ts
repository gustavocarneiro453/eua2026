import { isPublicHost, normalizeDomain, type RawCandidate } from './logoMatch'

/**
 * Server-side logo/brand lookups. Contracts checked against the providers' docs on 2026-11-03:
 *  - Logo.dev Search:  GET https://api.logo.dev/v2/search?q=&limit=&method=match|typeahead
 *                      Authorization: Bearer sk_…  → { data: [{ object, name, domain, logo_url }] }
 *                      (secret key stays on the server; results may be cached; ~US$0.00001 per search)
 *  - Wikidata:         wbsearchentities + wbgetentities, property P856 (official website). CC0 data, no key.
 *  - Brandfetch Search is NOT called here: its terms require live, uncached calls from the user's browser.
 *  - Logo.dev CDN images are NOT fetched here either: its fair-use policy forbids scripts/servers/proxies for them.
 */
export interface LogoEnv { LOGODEV_SECRET_KEY?: string; LOGODEV_PUBLISHABLE_KEY?: string; BRANDFETCH_CLIENT_ID?: string }
type F = typeof fetch

// One honest, descriptive User-Agent. If a site answers 403/blocks it, that is the site's choice and is respected:
// no retries, no disguised User-Agent. That company then falls back to the Logo.dev/Brandfetch logos or a monogram.
const UA = 'eua2026-logo/1.0 (company logo lookup for an election-coverage site)'

async function getJson(fetchImpl: F, url: string, init: RequestInit = {}, ms = 6000): Promise<unknown> {
  let res: Response
  try { res = await fetchImpl(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(ms) }) } catch (e) {
    throw new Error(`unreachable_${(e as Error).name === 'TimeoutError' ? 'timeout' : 'network'}`)
  }
  if (!res.ok) throw new Error(`http_${res.status}`)
  try { return await res.json() } catch { throw new Error('not_json') }
}

export async function logodevSearch(env: LogoEnv, q: string, fetchImpl: F = fetch): Promise<RawCandidate[]> {
  if (!env.LOGODEV_SECRET_KEY) return []
  const j = (await getJson(fetchImpl, `https://api.logo.dev/v2/search?${new URLSearchParams({ q, limit: '6', method: 'match' })}`, { headers: { Authorization: `Bearer ${env.LOGODEV_SECRET_KEY}` } })) as { data?: unknown }
  if (!Array.isArray(j?.data)) throw new Error('unexpected_shape')
  return (j.data as Record<string, unknown>[])
    .filter((r) => typeof r?.name === 'string' && typeof r?.domain === 'string')
    .map((r) => ({ name: r.name as string, domain: r.domain as string, source: 'logodev' as const }))
}

/** Companies/organizations with an official website (P856): items without one (people, given names…) are ignored. */
export async function wikidataSearch(q: string, lang: 'pt' | 'en', fetchImpl: F = fetch): Promise<RawCandidate[]> {
  const s = (await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbsearchentities', search: q, language: lang, uselang: lang, type: 'item', limit: '6', format: 'json' })}`)) as { search?: { id: string }[] }
  const ids = (s.search ?? []).map((r) => r.id).filter((id) => /^Q\d+$/.test(id))
  if (!ids.length) return []
  const e = (await getJson(fetchImpl, `https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'claims|labels', languages: `${lang}|en`, format: 'json' })}`)) as { entities?: Record<string, any> }
  const out: RawCandidate[] = []
  for (const id of ids) {
    const ent = e.entities?.[id]
    const site = ent?.claims?.P856?.map((c: any) => c?.mainsnak?.datavalue?.value).find((v: unknown) => typeof v === 'string')
    const label = (ent?.labels?.[lang] ?? ent?.labels?.en)?.value
    if (site && label && normalizeDomain(site)) out.push({ name: label, domain: site, source: 'wikidata' })
  }
  return out
}

// ---------------------------------------------------------------------------------------------------------
// Logo from the company's own website (JSON-LD logo, apple-touch-icon, icons). Used when name search finds
// nothing, and always for the ad's own destination site.
// ---------------------------------------------------------------------------------------------------------
export interface LogoCandidate { url: string; kind: 'logo' | 'icon'; rank: number }
export interface SiteLogo { found: boolean; kind?: 'logo' | 'icon'; contentType?: string; bytes?: Uint8Array; sourceUrl?: string }

const MAX_HTML = 300_000
export const MAX_LOGO_BYTES = 150_000
const MAX_REDIRECTS = 4
const ORG_TYPES = /^(Organization|Corporation|LocalBusiness|Restaurant|Store|OnlineBusiness|EducationalOrganization|NGO|Brand|ProfessionalService|Dentist|MedicalBusiness|FoodEstablishment|LodgingBusiness|AutomotiveBusiness|FinancialService|HealthAndBeautyBusiness)$/

const abs = (base: string, ref: string) => { try { return new URL(ref.trim(), base).href } catch { return null } }

/** Pure: picks logo/icon URLs out of a page's HTML, best first. */
export function extractLogoCandidates(baseUrl: string, html: string): LogoCandidate[] {
  const out: LogoCandidate[] = []
  const add = (ref: unknown, kind: LogoCandidate['kind'], rank: number) => {
    if (typeof ref !== 'string' || !ref || ref.startsWith('data:')) return
    const u = abs(baseUrl, ref)
    if (u && /^https:/.test(u) && !out.some((o) => o.url === u)) out.push({ url: u, kind, rank })
  }
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try { data = JSON.parse(m[1]) } catch { continue }
    const stack: unknown[] = [data]
    let guard = 0
    while (stack.length && guard++ < 500) {
      const x = stack.pop()
      if (Array.isArray(x)) stack.push(...x)
      else if (x && typeof x === 'object') {
        const o = x as Record<string, any>
        const types = ([] as unknown[]).concat(o['@type'] ?? []).map(String)
        if (o.logo && types.some((t) => ORG_TYPES.test(t))) {
          const ref = typeof o.logo === 'object' ? (o.logo.url ?? o.logo.contentUrl) : o.logo
          // Some sites declare a social-share banner as their "logo": try real icons first, banners last.
          add(ref, 'logo', typeof ref === 'string' && /(share|banner|og[-_]?image|cover|hero|social|thumb|background)/i.test(ref) ? 2.5 : 0)
        }
        stack.push(...Object.values(o))
      }
    }
  }
  const icons: (LogoCandidate & { size: number })[] = []
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0]
    const rel = /\brel=["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? ''
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]
    if (!href || !/(^|\s)(apple-touch-icon(-precomposed)?|icon|shortcut icon|mask-icon)(\s|$)/.test(rel) || /mask-icon/.test(rel)) continue
    const u = abs(baseUrl, href)
    if (!u || !/^https:/.test(u)) continue
    const size = Number(/\bsizes=["'](\d+)x\d+/i.exec(tag)?.[1] ?? (/svg/i.test(tag + href) ? 512 : 0))
    const isApple = rel.includes('apple-touch-icon')
    icons.push({ url: u, kind: 'icon', rank: isApple ? 1 : /\.ico(\?|$)/i.test(u) ? 3 : 2, size })
  }
  icons.sort((a, b) => a.rank - b.rank || b.size - a.size)
  for (const i of icons) add(i.url, 'icon', i.rank)
  add('/apple-touch-icon.png', 'icon', 4)
  add('/favicon.ico', 'icon', 5)
  return out.sort((a, b) => a.rank - b.rank)
}

/** Fetch with manual, validated redirects (https + public host at every hop) and a hard byte cap. */
async function safeGet(fetchImpl: F, url: string, accept: string, maxBytes: number, truncate: boolean): Promise<{ finalUrl: string; contentType: string; bytes: Uint8Array }> {
  let cur = url
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = new URL(cur)
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !isPublicHost(u.hostname)) throw new Error('blocked_url')
    const res = await fetchImpl(cur, { redirect: 'manual', headers: { 'User-Agent': UA, Accept: accept }, signal: AbortSignal.timeout(8000) })
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location'); const next = loc && abs(cur, loc)
      if (!next) throw new Error('bad_redirect')
      cur = next; continue
    }
    if (!res.ok) throw new Error(`http_${res.status}`)
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (!truncate && declared > maxBytes) throw new Error('too_large')
    const reader = res.body?.getReader(); if (!reader) throw new Error('no_body')
    const chunks: Uint8Array[] = []; let total = 0
    for (;;) {
      const { done, value } = await reader.read(); if (done) break
      total += value.length
      if (total > maxBytes) { if (truncate) { chunks.push(value.slice(0, value.length - (total - maxBytes))); await reader.cancel(); break } await reader.cancel(); throw new Error('too_large') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0)); let o = 0
    for (const c of chunks) { bytes.set(c, o); o += c.length }
    return { finalUrl: cur, contentType: (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase(), bytes }
  }
  throw new Error('too_many_redirects')
}

const UNSAFE_SVG = /<script|javascript:|\son[a-z]+\s*=|<foreignObject|<iframe|<embed|<object|<!ENTITY|xlink:href=["'](?!#)|href=["']https?:/i
/** Sniffs the real type from the bytes (never trusts the server's header) and rejects anything that is not a safe image. */
export function sniffImage(bytes: Uint8Array): { type: string } | null {
  const b = bytes, ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e))
  if (b.length < 8) return null
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return { type: 'image/png' }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: 'image/jpeg' }
  if (ascii(0, 3) === 'GIF') return { type: 'image/gif' }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { type: 'image/webp' }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { type: 'image/x-icon' }
  const head = new TextDecoder().decode(b.slice(0, 600)).trimStart()
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) {
    const text = new TextDecoder().decode(b)
    return UNSAFE_SVG.test(text) ? null : { type: 'image/svg+xml' }
  }
  return null
}

export function b64(bytes: Uint8Array): string { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }
export function fromB64(s: string): Uint8Array { const bin = atob(s); const out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out }

/** Looks for the company's logo on its own site: homepage → candidates → first one that is a valid, small image. */
export async function findSiteLogo(input: string, fetchImpl: F = fetch): Promise<SiteLogo> {
  const host = normalizeDomain(input)
  if (!host) throw new Error('blocked_url')
  let page: Awaited<ReturnType<typeof safeGet>>
  // The typed input was validated above; anything that goes wrong from here (a blocked redirect, a 403, a timeout)
  // simply means "no logo found on this site".
  try { page = await safeGet(fetchImpl, `https://${host}/`, 'text/html,application/xhtml+xml', MAX_HTML, true) } catch { return { found: false } }
  if (page.contentType && !/html|xml/.test(page.contentType)) return { found: false }
  const html = new TextDecoder().decode(page.bytes)
  for (const c of extractLogoCandidates(page.finalUrl, html).slice(0, 6)) {
    try {
      const img = await safeGet(fetchImpl, c.url, 'image/*', MAX_LOGO_BYTES, false)
      const kind = sniffImage(img.bytes)
      if (kind) return { found: true, kind: c.kind, contentType: kind.type, bytes: img.bytes, sourceUrl: img.finalUrl }
    } catch { /* try the next candidate */ }
  }
  return { found: false }
}
