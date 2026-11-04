/**
 * Company-name → domain matching helpers (pure, shared by server and client).
 * Goal: never present another company's logo just because the names look alike. A candidate is accepted
 * automatically only when it is clearly the best; otherwise the user must pick from the list.
 */
const LEGAL = new Set(['ltda', 'me', 'epp', 'eireli', 'sa', 'inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'cia', 'gmbh', 'srl'])

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/** Trailing legal forms written with dots or commas: "Acme S.A.", "Foo, Inc.", "Bar Ltda." */
const TRAILING_LEGAL = /[\s,]+(s\.\s?a\.?|ltda\.?|me|epp|eireli|inc\.?|llc|ltd\.?|corp\.?|co\.?|gmbh)\s*$/i
/** "G4 Educação Ltda." → "g4 educacao" */
export function normalizeName(input: string): string {
  let s = input
  for (let i = 0; i < 2 && TRAILING_LEGAL.test(s); i++) s = s.replace(TRAILING_LEGAL, '')
  const tokens = strip(s).replace(/['’`]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean)
  const kept = tokens.filter((t) => !LEGAL.has(t))
  return (kept.length ? kept : tokens).join(' ')
}
const compact = (s: string) => normalizeName(s).replace(/ /g, '')

function lev(a: string, b: string): number {
  if (a === b) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return prev[b.length]
}

/** 0..1 similarity between two names (accent/case/punctuation-insensitive). */
export function nameSimilarity(a: string, b: string): number {
  const ca = compact(a), cb = compact(b)
  if (!ca || !cb) return 0
  if (ca === cb) return 1
  const ta = new Set(normalizeName(a).split(' ')), tb = new Set(normalizeName(b).split(' '))
  const inter = [...ta].filter((t) => tb.has(t)).length
  const jaccard = inter / (ta.size + tb.size - inter)
  const edit = 1 - lev(ca, cb) / Math.max(ca.length, cb.length)
  return Math.max(jaccard, edit)
}

const SECOND_LEVEL = new Set(['com', 'co', 'org', 'net', 'gov', 'edu', 'ac', 'ind', 'inf', 'mil'])

/** "www.loja.g4educacao.com.br" → "g4educacao.com.br"; null for public suffixes or single labels. */
export function registrableDomain(host: string): string | null {
  const labels = host.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length < 2 || labels.some((l) => !l)) return null
  const tld = labels[labels.length - 1], sld = labels[labels.length - 2]
  const twoPart = tld.length === 2 && SECOND_LEVEL.has(sld) // com.br, co.uk, org.au …
  const take = twoPart ? 3 : 2
  if (labels.length < take) return null // e.g. "com.br" itself
  return labels.slice(-take).join('.')
}

/** The brand-like label of a domain: "g4educacao.com.br" → "g4educacao". */
export const domainLabel = (domain: string) => (registrableDomain(domain) ?? domain).split('.')[0]

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
/** Public, resolvable-looking hostnames only: no IPs, localhost, internal names, ports or credentials. */
export function isPublicHost(host: string): boolean {
  const h = host.toLowerCase()
  if (!h.includes('.') || h.length > 253 || IPV4.test(h) || h.includes(':') || h.includes('[')) return false
  if (/(^|\.)(localhost|local|internal|lan|home|corp|intranet|test|invalid|example)$/.test(h)) return false
  return h.split('.').every((l) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(l) || /^xn--[a-z0-9-]+$/.test(l))
}

/** Accepts "nike.com", "https://www.nike.com/br?x=1" or "www.nike.com"; returns the bare host or null. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim()
  if (!raw || raw.length > 300 || /\s/.test(raw)) return null
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`)
    if (u.username || u.password || u.port || !/^https?:$/.test(u.protocol)) return null
    const host = u.hostname.replace(/^www\./, '')
    return isPublicHost(host) && registrableDomain(host) ? host : null
  } catch { return null }
}

/** Looks like a domain/URL rather than a company name (then no name search is needed). */
export const looksLikeDomain = (s: string) => normalizeDomain(s) !== null && /\.[a-z]{2,}(\/|$)/i.test(s.trim())

/**
 * A logo may only be attached to an ad whose destination is the same site: the logo's domain must equal the
 * link's registrable domain (www/subdomains of the same registrable domain are fine). This is what prevents
 * showing a famous brand's logo on an ad that leads somewhere else.
 */
export function sameSite(urlHost: string, logoDomain: string): boolean {
  const a = registrableDomain(urlHost.replace(/^www\./, '')), b = registrableDomain(logoDomain.replace(/^www\./, ''))
  return !!a && !!b && a === b
}

export interface RawCandidate { name: string; domain: string; source: 'logodev' | 'brandfetch' | 'wikidata' }
export interface Candidate { name: string; domain: string; sources: RawCandidate['source'][]; score: number }

/** How well a candidate fits the typed name: the name itself (70%) and the domain's brand label (30%). */
export function scoreCandidate(query: string, c: { name: string; domain: string }): number {
  return Math.round((0.7 * nameSimilarity(query, c.name) + 0.3 * nameSimilarity(query, domainLabel(c.domain))) * 1000) / 1000
}

export const MIN_SCORE = 0.5
export const CONFIDENT_SCORE = 0.9
export const CONFIDENT_MARGIN = 0.09 // 1.0 vs 0.9 must count as a clear lead despite floating-point rounding

/** Dedupes by registrable domain (merging sources), scores, drops weak matches and says if the best is clear-cut. */
export function rankCandidates(query: string, raw: RawCandidate[], limit = 6): { candidates: Candidate[]; confident: boolean } {
  const by = new Map<string, Candidate>()
  for (const r of raw) {
    const d = normalizeDomain(r.domain)
    if (!d) continue
    const key = registrableDomain(d) as string
    const score = scoreCandidate(query, { name: r.name, domain: d })
    const cur = by.get(key)
    if (!cur) by.set(key, { name: r.name, domain: d, sources: [r.source], score })
    else {
      if (!cur.sources.includes(r.source)) cur.sources.push(r.source)
      if (score > cur.score) { cur.score = score; cur.name = r.name; cur.domain = d }
    }
  }
  const candidates = [...by.values()].filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score || b.sources.length - a.sources.length).slice(0, limit)
  const [top, second] = candidates
  // More than one independent source agreeing on a domain makes it more trustworthy than a lone result.
  const confident = !!top && top.score >= CONFIDENT_SCORE && (!second || top.score - second.score >= CONFIDENT_MARGIN)
  return { candidates, confident }
}

/** Initials for the monogram placeholder: "Padaria Sol" → "PS", "Nike" → "N". */
export function initials(name: string): string {
  const t = normalizeName(name).split(' ').filter(Boolean)
  return (t.length > 1 ? t[0][0] + t[1][0] : (t[0] ?? '?').slice(0, 1)).toUpperCase()
}
