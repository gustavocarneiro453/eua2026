import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '@/i18n'
import type { TermKey } from '@/i18n/glossary'
import { PageHeader } from '@/components/PageHeader'
import { MethodNote } from '@/components/MethodNote'
import { swatch } from '@/lib/sitStyle'
import DataSources from './DataSources'
import { cn } from '@/lib/utils'

const ORDER: TermKey[] = ['midterm', 'senate', 'house', 'district', 'majority', 'governor', 'stateLevel', 'special', 'reporting', 'resultTypes', 'electoralCollege']

export default function Learn() {
  const { t, glossary } = useI18n()
  const { hash } = useLocation()
  const tab = hash === '#dados' ? 'data' : hash === '#como' ? 'how' : 'guide'
  useEffect(() => {
    if (!hash || hash === '#dados' || hash === '#como') return
    const id = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [hash])
  return (
    <>
      <PageHeader eyebrow={t('nav.learn')} title={t('learn.title')} lede={t('learn.lede')}>
        <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
          {([['guide', '/learn', 'learn.tab.guide'], ['how', '/learn#como', 'learn.tab.how'], ['data', '/learn#dados', 'learn.tab.data']] as const).map(([k, to, label]) => (
            <Link key={k} to={to} role="tab" aria-selected={tab === k}
              className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === k ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{t(label)}</Link>
          ))}
        </div>
      </PageHeader>
      {tab === 'how' ? (
        <div className="container-x mt-8 max-w-4xl space-y-4">
          <section className="rounded-xl border border-line bg-surface p-4">
            <h2 className="font-serif text-xl font-semibold">{t('how.defs.title')}</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed">
              {(['noRace', 'awaiting', 'unavailable', 'lead', 'tied', 'projected', 'official', 'certified'] as const).map((k) => (
                <li key={k} className="flex items-start gap-3"><span aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm ring-1 ring-line" style={swatch(k)} /><span><strong className="font-semibold">{t(`sit.${k}`)}.</strong> <span className="text-ink/85">{t(`sit.tip.${k}`)}</span></span></li>
              ))}
            </ul>
          </section>
          {(['senate', 'governor', 'house'] as const).map((o) => (
            <section key={o}><h2 className="mb-2 font-serif text-xl font-semibold">{t(`sum.${o === 'governor' ? 'gov' : o}`)}</h2><MethodNote office={o} open /></section>
          ))}
        </div>
      ) : tab === 'data' ? <div className="container-x mt-8"><DataSources /></div> : (
      <div className="container-x mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <nav className="hidden lg:block"><ul className="sticky top-20 space-y-1 text-sm">
          {ORDER.map((k) => <li key={k}><a href={`#${k}`} className="block rounded px-2 py-1 text-muted hover:bg-surface hover:text-ink">{glossary[k].term}</a></li>)}
        </ul></nav>
        <div className="max-w-3xl space-y-10">
          {ORDER.map((k, i) => (
            <section key={k} id={k} className="scroll-mt-20 border-b border-line pb-10 last:border-0">
              <p className="eyebrow num">{String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-1 font-serif text-3xl font-semibold">{glossary[k].term}</h2>
              <p className="mt-3 text-lg leading-relaxed text-ink">{glossary[k].short}</p>
              <ul className="mt-4 space-y-3">
                {glossary[k].long.map((p) => <li key={p} className="border-l-2 border-accent/50 pl-4 leading-relaxed text-ink/80">{p}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </div>
      )}
    </>
  )
}
