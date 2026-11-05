import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useFeed } from '@/hooks/useElections'
import { OA_ATTRIBUTION, OA_BASE, OA_COVERAGE, OA_DOCS, OA_OFFICES, oaUrl } from '@/services/openamerica'
import { feedConfig } from '@/services/elections'
import { useCountdown } from '@/services/countdown'
import { COUNTDOWN_SOURCE_URL } from '@/config/election'
import { STATE_OFFICES } from '@/data/stateOffices'
import { EBC_FEED, EBC_SITE, EBC_TERMS, GDELT_SITE } from '@/services/newsNormalize'
import { SENATE_XML } from '@/services/senateNormalize'
import { VOTEHUB_API, VOTEHUB_SITE } from '@/services/pollsNormalize'
import { useNews } from '@/services/news'
import { usePolls } from '@/services/polls'
import { useSenate } from '@/services/senate'
import { STATES } from '@/data/states'
import { Badge } from '@/components/ui/badge'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

type Nature = 'official' | 'preliminary' | 'certified' | 'poll' | 'news' | 'reference'
const NATURE_VARIANT: Record<Nature, 'success' | 'warn' | 'accent' | 'neutral'> = { official: 'success', certified: 'success', preliminary: 'warn', poll: 'accent', news: 'neutral', reference: 'neutral' }

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-line/60 py-3 last:border-0 sm:grid-cols-[170px_1fr] sm:gap-4">
      <dt className="eyebrow pt-0.5">{label}</dt>
      <dd className="text-sm leading-relaxed text-ink/90">{children}</dd>
    </div>
  )
}
const Code = ({ children }: { children: React.ReactNode }) => <code className="block break-all rounded bg-surface-2 px-1.5 py-0.5 text-xs">{children}</code>
const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">{children}<ExternalLink className="h-3 w-3" /></a>
)

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader><h2 className="font-serif text-xl font-semibold">{title}</h2></CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  )
}

interface SourceView {
  id: string; nameKey: DictKey; providesKey: DictKey; cadenceKey: DictKey; natures: Nature[]
  endpoints?: string[]; last: React.ReactNode
  links: { href: string; label: DictKey }[]
  extra?: React.ReactNode
}

export default function DataSources() {
  const { t, date, ago, lang } = useI18n()
  const feed = useFeed()
  const polls = usePolls()
  const senate = useSenate()
  const news = useNews(lang)
  const newsPt = useNews('pt') // Agência Brasil is part of the Portuguese feed
  const ebcStatus = newsPt.payload?.sources?.find((s) => s.id === 'ebc')
  const cd = useCountdown()
  // Integrated-feed states = the source's documented list + any state that shows up in its live payload
  const covered = new Set([...OA_COVERAGE, ...(feed.snapshot?.coverage ?? [])])
  const fmtTarget = new Intl.DateTimeFormat(lang === 'pt' ? 'pt-BR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })
  const never = <span className="text-muted">{t('src.notYet')}</span>
  const copyOf = (iso?: string) => (iso ? <span className="num">{t('src.fetchedAt', { t: date(iso) })}</span> : never)
  const stateKey: DictKey =
    feed.snapshot?.isDemo ? 'live.demo' : feed.status === 'error' ? 'live.offline' : feed.status === 'loading' ? 'live.loading'
    : feed.snapshot?.sourceState === 'live' ? 'live.live' : feed.snapshot?.sourceState === 'stale' ? 'live.stale'
    : feed.snapshot?.sourceState === 'final' ? 'live.final' : feed.snapshot?.sourceState === 'waiting' ? 'live.waiting' : 'live.notConfigured'

  const sources: SourceView[] = [
    {
      id: 'oa', nameKey: 'src.oa.name', providesKey: 'src.oa.provides', cadenceKey: 'src.oa.cadence', natures: ['preliminary'],
      endpoints: OA_OFFICES.map((o) => oaUrl(feedConfig.year, o.param)),
      last: (
        <div className="space-y-1">
          <p>{t(stateKey)}</p>
          <p>{feed.lastSuccessAt ? <span className="num">{date(feed.lastSuccessAt)} <span className="text-muted">({ago(feed.lastSuccessAt)})</span></span> : <span className="text-muted">{t('data.never')}</span>}</p>
          <p className="text-xs text-muted">{t('data.generated')}: <span className="num">{feed.snapshot?.generatedAt ? date(feed.snapshot.generatedAt) : '—'}</span></p>
        </div>
      ),
      links: [{ href: OA_BASE, label: 'src.site' }, { href: OA_DOCS, label: 'src.docs' }, { href: `${OA_BASE}/terms/`, label: 'src.terms' }],
      extra: <Row label={t('dsrc.attr')}><span className="italic">“{OA_ATTRIBUTION}”</span></Row>,
    },
    {
      id: 'cd', nameKey: 'src.cd.name', providesKey: 'src.cd.provides', cadenceKey: 'src.cd.cadence', natures: ['reference'],
      endpoints: ['/api/config'], last: <span className="num">{fmtTarget.format(new Date(cd.targetMs))} · {cd.source === 'configured' ? t('cd.sourceConfigured') : t('src.cd.terms')}</span>,
      links: [{ href: COUNTDOWN_SOURCE_URL, label: 'src.site' }],
    },
    {
      id: 'seat', nameKey: 'src.seat.name', providesKey: 'src.seat.provides', cadenceKey: 'src.seat.cadence', natures: ['official', 'certified'],
      endpoints: [`${OA_BASE}/elections/seat/<UF-NN>.json`], last: <span className="text-muted">{t('src.onDemand')}</span>,
      links: [{ href: OA_DOCS, label: 'src.docs' }, { href: 'https://clerk.house.gov/', label: 'src.site' }],
    },
    {
      id: 'senate', nameKey: 'src.senate.name', providesKey: 'src.senate.provides', cadenceKey: 'src.senate.cadence', natures: ['official'],
      endpoints: [SENATE_XML], last: senate.data?.fallback ? <span className="num">{t('src.embedded', { t: date(senate.data.fetchedAt) })}</span> : copyOf(senate.data?.fetchedAt),
      links: [{ href: 'https://www.senate.gov/', label: 'src.site' }, { href: SENATE_XML, label: 'src.docs' }],
    },
    {
      id: 'polls', nameKey: 'src.polls.name', providesKey: 'src.polls.provides', cadenceKey: 'src.polls.cadence', natures: ['poll'],
      endpoints: [`${VOTEHUB_API}?poll_type=us-senator | governor | us-representative | generic-ballot`], last: copyOf(polls.data?.fetchedAt),
      links: [{ href: VOTEHUB_SITE, label: 'src.site' }, { href: 'https://votehub.com/polls/api/', label: 'src.docs' }],
    },
    {
      id: 'states', nameKey: 'src.states.name', providesKey: 'src.states.provides', cadenceKey: 'src.states.cadence', natures: ['official'],
      last: <span className="text-muted">{t('common.dash')}</span>, links: [],
      extra: <Row label={t('src.links')}><Link to="/states" className="text-accent hover:underline">{t('nav.states')}</Link></Row>,
    },
    {
      id: 'news', nameKey: 'src.news.name', providesKey: 'src.news.provides', cadenceKey: 'src.news.cadence', natures: ['news'],
      endpoints: ['https://api.gdeltproject.org/api/v2/doc/doc?mode=ArtList&…'], last: copyOf(news.payload?.fetchedAt),
      links: [{ href: GDELT_SITE, label: 'src.site' }, { href: 'https://www.gdeltproject.org/about.html', label: 'src.terms' }],
    },
    {
      id: 'ebc', nameKey: 'src.ebc.name', providesKey: 'src.ebc.provides', cadenceKey: 'src.ebc.cadence', natures: ['news'],
      endpoints: [EBC_FEED], last: !newsPt.payload ? never : ebcStatus?.ok ? copyOf(newsPt.payload.fetchedAt) : <span className="text-amber-300">{t('src.ebc.down')}</span>,
      links: [{ href: EBC_SITE, label: 'src.site' }, { href: 'https://agenciabrasil.ebc.com.br/rss', label: 'src.docs' }, { href: EBC_TERMS, label: 'src.terms' }],
      extra: <Row label={t('dsrc.attr')}>{t('src.ebc.terms')}</Row>,
    },
    {
      id: 'decl', nameKey: 'src.decl.name', providesKey: 'src.decl.provides', cadenceKey: 'src.decl.cadence', natures: ['news'],
      endpoints: ['/declarations.json'], last: <span className="text-muted">{t('src.onDemand')}</span>, links: [],
    },
    {
      id: 'ref', nameKey: 'src.ref.name', providesKey: 'src.ref.provides', cadenceKey: 'src.ref.cadence', natures: ['reference'], last: <span className="text-muted">{t('common.dash')}</span>,
      links: [{ href: 'https://www.senate.gov/', label: 'src.site' }, { href: 'https://www.census.gov/', label: 'src.site' }],
    },
  ]

  const natures: Nature[] = ['official', 'preliminary', 'certified', 'poll', 'news', 'reference']
  const where: [DictKey, DictKey][] = [
    ['where.votes', 'where.v.votes'], ['where.rank', 'where.v.rank'], ['where.house', 'where.v.house'], ['where.senate', 'where.v.senate'], ['where.seats', 'where.v.seats'],
    ['where.countdown', 'where.v.countdown'], ['where.status', 'where.v.status'], ['where.history', 'where.v.history'], ['where.polls', 'where.v.polls'], ['where.news', 'where.v.news'], ['where.coverage', 'where.v.coverage'], ['where.offices', 'where.v.offices'],
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="font-serif text-3xl font-semibold">{t('dsrc.title')}</h2>
        <p className="mt-2 text-base leading-relaxed text-ink/80">{t('dsrc.lede')}</p>
      </div>

      <Section title={t('nat.title')}>
        <dl className="grid gap-x-8 sm:grid-cols-2">
          {[...natures, 'projection' as const, 'derived' as const].map((n) => (
            <div key={n} className="border-b border-line/60 py-3 last:border-0">
              <dt><Badge variant={n === 'projection' || n === 'derived' ? 'neutral' : NATURE_VARIANT[n]}>{t(`nat.${n}` as DictKey)}</Badge></dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink/80">{t(`nat.${n}.d` as DictKey)}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold">{t('src.catalog')}</h2>
        {sources.map((s) => (
          <Card key={s.id} id={`src-${s.id}`}>
            <CardHeader>
              <h3 className="font-serif text-lg font-semibold">{t(s.nameKey)}</h3>
              <div className="flex flex-wrap justify-end gap-1.5">{s.natures.map((n) => <Badge key={n} variant={NATURE_VARIANT[n]}>{t(`nat.${n}` as DictKey)}</Badge>)}</div>
            </CardHeader>
            <CardBody>
              <dl>
                <Row label={t('src.provides')}>{t(s.providesKey)}</Row>
                {s.endpoints && <Row label={t('dsrc.queries')}><div className="space-y-1">{s.endpoints.map((e) => <Code key={e}>{e}</Code>)}</div></Row>}
                <Row label={t('src.cadence')}>{t(s.cadenceKey)}</Row>
                <Row label={t('src.last')}>{s.last}</Row>
                {s.extra}
                {s.links.length > 0 && <Row label={t('src.links')}><ul className="flex flex-wrap gap-x-5 gap-y-1">{s.links.map((l) => <li key={l.href}><Ext href={l.href}>{t(l.label)}</Ext></li>)}</ul></Row>}
              </dl>
            </CardBody>
          </Card>
        ))}
      </div>

      <Section title={t('where.title')}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead><tr className="border-b border-line text-left"><th className="eyebrow py-2 pr-4 font-semibold">{t('where.what')}</th><th className="eyebrow py-2 font-semibold">{t('where.from')}</th></tr></thead>
            <tbody>{where.map(([a, b]) => <tr key={a} className="border-b border-line/60 align-top last:border-0"><td className="py-2.5 pr-4 font-medium">{t(a)}</td><td className="py-2.5 text-ink/80">{t(b)}</td></tr>)}</tbody>
          </table>
        </div>
      </Section>

      <Section title={t('srcx.title')}>
        <p className="text-sm leading-relaxed text-ink/80">{t('srcx.lede')}</p>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed">
          {(['srcx.oa', 'srcx.ap', 'srcx.cbs', 'srcx.oe', 'srcx.states', 'srcx.decl'] as const).map((k) => <li key={k} className="border-l-2 border-accent/50 pl-3 text-ink/85">{t(k)}</li>)}
        </ul>
      </Section>

      <Section title={t('dsrc.cov')}>
        <p className="text-sm leading-relaxed text-ink/80">{t('dsrc.covLede', { n: OA_COVERAGE.length, m: 50 - OA_COVERAGE.length })}</p>
        {[[t('dsrc.covered'), true], [t('dsrc.uncovered'), false]].map(([label, on]) => (
          <div key={String(on)} className="mt-4">
            <p className="eyebrow mb-2">{label as string}</p>
            <ul className="flex flex-wrap gap-1.5">
              {STATES.filter((s) => covered.has(s.code) === on).map((s) => (
                <li key={s.code}><Link to={`/states/${s.code}`} className={cn('inline-block rounded-md px-2 py-1 text-xs ring-1 ring-line hover:text-ink', on ? 'bg-success/10 text-green-200' : 'bg-surface-2 text-muted')}>{s.name}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </Section>

      <Section title={t('dsrc.portals')}>
        <p className="text-sm leading-relaxed text-ink/80">{t('dsrc.portalsNote')}</p>
        <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {STATES.filter((s) => !covered.has(s.code) && STATE_OFFICES[s.code]).map((s) => {
            const o = STATE_OFFICES[s.code]
            return (
              <li key={s.code} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink/90">{s.name}:</span>
                <Ext href={o.results ?? o.url}>{o.name}</Ext>
                {o.results && !o.resultsVerified || !o.results ? <span className="text-[11px] text-muted">({t('dsrc.unverified')})</span> : null}
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title={t('gaps.title')}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/90">{(['gaps.1', 'gaps.2', 'gaps.3', 'gaps.4'] as DictKey[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </Section>

      <Section title={t('dsrc.limits')}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-ink/90">{(['dsrc.lim1', 'dsrc.lim2', 'dsrc.lim3', 'dsrc.lim4'] as DictKey[]).map((k) => <li key={k}>{t(k)}</li>)}</ul>
      </Section>
    </div>
  )
}
