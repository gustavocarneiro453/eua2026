import { cleanTitle, dedupKey, EBC_SITE, type NewsItem } from './newsNormalize'

/**
 * Agência Brasil (EBC, Brazilian public news agency) — official RSS, Internacional section:
 * https://agenciabrasil.ebc.com.br/rss/internacional/feed.xml
 * Verified 2026-11-03: free, no key, Access-Control-Allow-Origin: *, newest 10 items only, items carry
 * title, link, pubDate, description, category. EBC terms (ebc.com.br/termos-de-uso-e-condicoes-gerais-do-portal-da-ebc):
 * "Reprodução autorizada mediante indicação da fonte." (the same terms also say portal use is for personal,
 * non-commercial purposes, so written confirmation from EBC is recommended: sepub@ebc.com.br).
 * We keep only title, link and publication time, show the source on every item, and never copy the text.
 */
const decodeEntities = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (m) => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[m] ?? m))

const tag = (block: string, name: string) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i').exec(block)
  if (!m) return ''
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1])
  return decodeEntities((cdata ? cdata[1] : m[1]).trim())
}

// Strong phrases that only occur in coverage of US elections (title or summary).
const STRONG = /(elei[çc](ão|ões) (nos|dos|nas|do|da) (EUA|Estados Unidos)|elei[çc](ão|ões) (norte-)?americanas?|eleitores (dos|nos) (EUA|Estados Unidos)|eleitores (norte-)?americanos|midterms?|elei[çc][õo]es de meio de mandato|Congresso (dos EUA|americano|norte-americano)|Senado (dos EUA|americano|norte-americano)|C[âa]mara dos Representantes)/i
// Otherwise the TITLE itself must pair a US term with an election term.
const TITLE_US = /\b(EUA|Estados Unidos|norte-americano|norte-americana|americano|americana|Trump|Casa Branca)\b/i
const TITLE_ELECTION = /(elei[çc]|eleitor|urnas|Senado|Congresso|governador|democratas?|republicanos?)/i

/** Title/summary talk about US elections (the summary is used only to decide, never stored). */
export function isUsElectionStory(title: string, summary: string) {
  const text = `${title} ${summary.replace(/<[^>]+>/g, ' ')}`
  return STRONG.test(text) || (TITLE_US.test(title) && TITLE_ELECTION.test(title))
}

export function parseEbcRss(xml: string, limit = 12): NewsItem[] {
  if (!/<rss[\s>]/i.test(xml)) throw new Error('ebc_not_rss')
  const out: NewsItem[] = []
  const seen = new Set<string>()
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]
    const title = cleanTitle(tag(b, 'title'))
    const link = tag(b, 'link')
    const d = Date.parse(tag(b, 'pubDate'))
    let u: URL
    try { u = new URL(link) } catch { continue }
    // Only links on EBC's own domain, over http(s).
    if (!/^https?:$/.test(u.protocol) || !(u.hostname === 'ebc.com.br' || u.hostname.endsWith('.ebc.com.br'))) continue
    if (!title || Number.isNaN(d) || !isUsElectionStory(title, tag(b, 'description'))) continue
    const key = dedupKey(title)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ id: u.href, title, url: u.href, domain: new URL(EBC_SITE).hostname, seenAt: new Date(d).toISOString().replace('.000Z', 'Z'), country: 'Brasil', source: 'ebc' })
  }
  return out.sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt)).slice(0, limit)
}

/** Merge lists from several sources: drop duplicates (same URL or same headline), newest first. */
export function mergeNews(lists: NewsItem[][], limit = 40): NewsItem[] {
  const seenUrl = new Set<string>(), seenTitle = new Set<string>(), out: NewsItem[] = []
  for (const it of lists.flat().sort((a, b) => Date.parse(b.seenAt) - Date.parse(a.seenAt))) {
    const k = dedupKey(it.title)
    if (seenUrl.has(it.url) || seenTitle.has(k)) continue
    seenUrl.add(it.url); seenTitle.add(k); out.push(it)
  }
  return out.slice(0, limit)
}
