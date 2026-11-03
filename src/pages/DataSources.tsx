import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useFeed } from '@/hooks/useElections'
import { OA_ATTRIBUTION, OA_BASE, OA_COVERAGE, OA_DOCS, OA_OFFICES, oaUrl } from '@/services/openamerica'
import { feedConfig } from '@/services/elections'
import { STATES } from '@/data/states'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line/60 py-3 last:border-0 sm:grid-cols-[200px_1fr] sm:gap-4">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="text-sm leading-relaxed text-ink/90">{children}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><h2 className="font-serif text-xl font-semibold">{title}</h2></CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  )
}

export default function DataSources() {
  const { t, date, ago } = useI18n()
  const feed = useFeed()
  const covered = new Set(OA_COVERAGE)
  const stateKey: DictKey =
    feed.snapshot?.isDemo ? 'live.demo'
    : feed.status === 'error' ? 'live.offline'
    : feed.status === 'loading' ? 'live.loading'
    : feed.snapshot?.sourceState === 'live' ? 'live.live'
    : feed.snapshot?.sourceState === 'stale' ? 'live.stale'
    : feed.snapshot?.sourceState === 'final' ? 'live.final'
    : feed.snapshot?.sourceState === 'waiting' ? 'live.waiting'
    : 'live.notConfigured'
  const links: [string, DictKey][] = [
    [OA_DOCS, 'dsrc.linkApi'], [`${OA_BASE}/terms/`, 'dsrc.linkTerms'], [`${OA_BASE}/acceptable-use/`, 'dsrc.linkAup'], [`${OA_BASE}/methodology/`, 'dsrc.linkMeth'],
  ]
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-serif text-3xl font-semibold">{t('dsrc.title')}</h2>
        <p className="mt-2 text-base leading-relaxed text-ink/80">{t('dsrc.lede')}</p>
      </div>

      <Section title={t('dsrc.results')}>
        <dl>
          <Row label={t('dsrc.provider')}><a href={OA_BASE} target="_blank" rel="noreferrer" className="text-accent hover:underline">{t('dsrc.providerVal')}</a></Row>
          <Row label={t('dsrc.origin')}>{t('dsrc.originVal')}</Row>
          <Row label={t('dsrc.queries')}>
            <ul className="space-y-1">
              {OA_OFFICES.map((o) => <li key={o.param}><code className="break-all rounded bg-surface-2 px-1.5 py-0.5 text-xs">{oaUrl(feedConfig.year, o.param)}</code></li>)}
            </ul>
          </Row>
          <Row label={t('dsrc.cadence')}>{t('dsrc.cadenceVal')}</Row>
          <Row label={t('dsrc.access')}>{t('dsrc.accessVal')}</Row>
          <Row label={t('dsrc.license')}>{t('dsrc.licenseVal')}</Row>
          <Row label={t('dsrc.attr')}><span className="italic">“{OA_ATTRIBUTION}”</span></Row>
        </dl>
      </Section>

      <Section title={t('dsrc.status')}>
        <dl>
          <Row label={t('dsrc.state')}>{t(stateKey)}</Row>
          <Row label={t('data.lastSuccess')}>
            {feed.lastSuccessAt ? <span className="num">{date(feed.lastSuccessAt)} <span className="text-muted">({ago(feed.lastSuccessAt)})</span></span> : <span className="text-muted">{t('data.never')}</span>}
          </Row>
          <Row label={t('data.generated')}>{feed.snapshot?.generatedAt ? <span className="num">{date(feed.snapshot.generatedAt)}</span> : <span className="text-muted">{t('common.dash')}</span>}</Row>
        </dl>
      </Section>

      <Section title={t('dsrc.cov')}>
        <p className="text-sm leading-relaxed text-ink/80">{t('dsrc.covLede', { n: OA_COVERAGE.length, m: 50 - OA_COVERAGE.length })}</p>
        {[[t('dsrc.covered'), true], [t('dsrc.uncovered'), false]].map(([label, on]) => (
          <div key={String(on)} className="mt-4">
            <p className="eyebrow mb-2">{label as string}</p>
            <ul className="flex flex-wrap gap-1.5">
              {STATES.filter((s) => covered.has(s.code) === on).map((s) => (
                <li key={s.code}>
                  <Link to={`/states/${s.code}`} className={cn('inline-block rounded-md px-2 py-1 text-xs ring-1 ring-line hover:text-ink', on ? 'bg-success/10 text-green-200' : 'bg-surface-2 text-muted')}>{s.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title={t('dsrc.inst')}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/90">
          {(['dsrc.inst1', 'dsrc.inst2', 'dsrc.inst3', 'dsrc.inst4'] as DictKey[]).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </Section>

      <Section title={t('dsrc.limits')}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/90">
          {(['dsrc.lim1', 'dsrc.lim2', 'dsrc.lim3', 'dsrc.lim4'] as DictKey[]).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </Section>

      <Section title={t('dsrc.links')}>
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {links.map(([href, k]) => (
            <li key={k}><a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-accent hover:underline">{t(k)}<ExternalLink className="h-3 w-3" /></a></li>
          ))}
        </ul>
      </Section>
    </div>
  )
}
