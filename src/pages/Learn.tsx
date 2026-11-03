import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useI18n } from '@/i18n'
import type { TermKey } from '@/i18n/glossary'
import { PageHeader } from '@/components/PageHeader'
import DataSources from './DataSources'
import { cn } from '@/lib/utils'

const ORDER: TermKey[] = ['midterm', 'senate', 'house', 'district', 'majority', 'governor', 'stateLevel', 'special', 'reporting', 'resultTypes', 'electoralCollege']

export default function Learn() {
  const { t, glossary } = useI18n()
  const { hash } = useLocation()
  const tab = hash === '#dados' ? 'data' : 'guide'
  useEffect(() => {
    if (!hash || hash === '#dados') return
    const id = requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' }))
    return () => cancelAnimationFrame(id)
  }, [hash])
  return (
    <>
      <PageHeader eyebrow={t('nav.learn')} title={t('learn.title')} lede={t('learn.lede')}>
        <div className="mt-6 flex gap-1 border-b border-line" role="tablist">
          {([['guide', '/learn', 'learn.tab.guide'], ['data', '/learn#dados', 'learn.tab.data']] as const).map(([k, to, label]) => (
            <Link key={k} to={to} role="tab" aria-selected={tab === k}
              className={cn('-mb-px border-b-2 px-4 py-2 text-sm font-medium', tab === k ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink')}>{t(label)}</Link>
          ))}
        </div>
      </PageHeader>
      {tab === 'data' ? <div className="container-x mt-8"><DataSources /></div> : (
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
