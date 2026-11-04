import { useEffect, useRef, useState } from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { useI18n } from '@/i18n'
import { type Candidate, normalizeDomain, sameSite } from '@/services/logoMatch'
import { detectSiteLogo, resolveLogoSrc, searchCompanies, useLogoConfig } from '@/services/logos'
import type { AdLogo } from '@/services/auction'
import { CompanyLogo } from '@/components/CompanyLogo'
import { Button } from '@/components/ui/button'
import type { DictKey } from '@/i18n/dict'

type Phase = 'idle' | 'searching' | 'detecting'

/**
 * Finds the advertiser's logo without any upload: by name (Logo.dev, Brandfetch, Wikidata), or from the website
 * the ad links to. The user always sees which company/domain a logo belongs to when the match is not clear-cut,
 * and a logo is only kept while the ad's link leads to that same site.
 */
export function LogoPicker({ advertiser, url, committedUrl, logo, onChange, onSuggestUrl }: {
  advertiser: string; url: string; committedUrl: string; logo: AdLogo | null
  onChange: (l: AdLogo | null) => void; onSuggestUrl: (url: string) => void
}) {
  const { t, lang } = useI18n()
  const cfg = useLogoConfig()
  const [phase, setPhase] = useState<Phase>('idle')
  const [results, setResults] = useState<{ candidates: Candidate[]; confident: boolean } | null>(null)
  const [msg, setMsg] = useState<{ key: DictKey; vars?: Record<string, string> } | null>(null)
  const triedSites = useRef(new Set<string>())
  const urlHost = (u: string) => { try { const x = new URL(u); return x.protocol === 'https:' ? normalizeDomain(x.hostname) : null } catch { return null } }

  // The ad's link must stay on the logo's site: if the link changes to another site, the logo goes away.
  useEffect(() => {
    const h = urlHost(url)
    if (logo && h && !sameSite(h, logo.domain)) { onChange(null); setMsg({ key: 'logo.mismatch' }) }
  }, [url, logo, onChange])

  // When the link is committed (field left), look for the logo on that very site, unless one is already chosen.
  useEffect(() => {
    const host = urlHost(committedUrl)
    if (!host || logo || triedSites.current.has(host)) return
    triedSites.current.add(host)
    let on = true
    setPhase('detecting')
    detectSiteLogo(`https://${host}`).then((r) => {
      if (!on) return
      setPhase('idle')
      if (r?.found) { onChange({ domain: host, src: 'site' }); setMsg({ key: 'logo.fromSite' }) }
    })
    return () => { on = false; setPhase('idle') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedUrl])

  const choose = async (domain: string) => {
    const h = urlHost(url)
    if (h && !sameSite(h, domain)) { setMsg({ key: 'logo.urlOther', vars: { url: `https://${domain}/` } }); return }
    setPhase('detecting'); setResults(null)
    const src = await resolveLogoSrc(domain, cfg)
    setPhase('idle')
    onSuggestUrl(`https://${domain}/`)
    if (src) { onChange({ domain, src }); setMsg({ key: 'logo.chosen', vars: { domain } }) } else { onChange(null); setMsg({ key: 'logo.none' }) }
  }

  const search = async () => {
    const q = advertiser.trim()
    if (q.length < 2) { setMsg({ key: 'logo.noName' }); return }
    setPhase('searching'); setMsg(null); setResults(null)
    try {
      const r = await searchCompanies(q, lang, cfg)
      setPhase('idle')
      if (r.typedDomain) { await choose(r.typedDomain); return }
      if (!r.candidates.length) { setMsg({ key: 'logo.noResults' }); return }
      setResults({ candidates: r.candidates, confident: r.confident })
    } catch { setPhase('idle'); setMsg({ key: 'logo.error' }) }
  }

  const thumbSrc = cfg.logodevToken ? 'logodev' as const : cfg.brandfetchClientId ? 'brandfetch' as const : null
  const busy = phase !== 'idle'
  return (
    <div className="rounded-lg border border-line bg-bg/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">{t('logo.title')}</p>
        {logo ? (
          <button type="button" onClick={() => { onChange(null); setMsg(null); setResults(null) }} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="h-3.5 w-3.5" />{t('logo.remove')}</button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={search} disabled={busy}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}{phase === 'searching' ? t('logo.searching') : phase === 'detecting' ? t('logo.detecting') : t('logo.search')}
          </Button>
        )}
      </div>
      {logo && <div className="mt-2 flex items-center gap-3"><CompanyLogo name={advertiser || logo.domain} logo={logo} size={40} /><p className="num text-sm text-ink/90">{logo.domain}</p></div>}
      {results && (
        <div className="mt-3">
          <p className="mb-2 text-xs leading-relaxed text-muted">{t('logo.pick')}</p>
          <ul className="space-y-1.5">
            {results.candidates.map((c, i) => (
              <li key={c.domain} className="flex items-center gap-3 rounded-lg border border-line bg-surface px-2.5 py-2">
                <CompanyLogo name={c.name} logo={thumbSrc ? { domain: c.domain, src: thumbSrc } : null} size={32} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{c.name}</p><p className="num truncate text-xs text-muted">{c.domain}{i === 0 && results.confident ? ` · ${t('logo.best')}` : ''}</p></div>
                <Button type="button" size="sm" variant={i === 0 && results.confident ? 'default' : 'outline'} onClick={() => choose(c.domain)} disabled={busy}>{t('logo.use')}</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {msg && <p role="status" className="mt-2 text-xs leading-relaxed text-ink/80">{t(msg.key, msg.vars)}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">{t('logo.same')} {t('logo.privacy')}</p>
    </div>
  )
}
