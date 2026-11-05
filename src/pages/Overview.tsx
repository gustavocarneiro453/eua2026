import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useBallot } from '@/hooks/useBallot'
import { ELECTION_DATE, GOVERNOR_STATES, HOUSE, SENATE, SENATE_SEATS } from '@/data/states'
import { daysToElection } from '@/lib/tally'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { OfficeSummary } from '@/components/OfficeSummary'
import { USMap } from '@/components/USMap'
import { InfoTip } from '@/components/InfoTip'
import { RaceCard } from '@/components/election'
import { NewsList } from '@/components/NewsList'
import { Countdown } from '@/components/Countdown'
import { PollsBlock } from '@/components/PollsBlock'
import { DataBanner, DataPanel, UpdatesFeed } from '@/components/DataPanel'
import type { TermKey } from '@/i18n/glossary'

function Big({ value, label }: { value: string; label: string }) {
  return <div><p className="num font-serif text-3xl font-semibold leading-none">{value}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-muted">{label}</p></div>
}

// contests with something to show first: declared > counting > the rest
const order = (k: string) => (['certified', 'official', 'projected'].includes(k) ? 0 : k === 'lead' || k === 'tied' ? 1 : k === 'awaiting' ? 2 : 3)

function SummaryCard({ title, term, sub, children, to }: { title: string; term: TermKey; sub: string; children: React.ReactNode; to: string }) {
  const { t } = useI18n()
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div><h2 className="flex items-center gap-1.5 font-serif text-xl font-semibold">{title}<InfoTip term={term} /></h2><p className="mt-0.5 text-xs text-muted">{sub}</p></div>
        <Link to={to} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline">{t('common.seeAll')}<ArrowRight className="h-3 w-3" /></Link>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-4">{children}</CardBody>
    </Card>
  )
}

export default function Overview() {
  const { t, num, longDate, glossary, lang } = useI18n()
  const { by } = useBallot()
  const days = daysToElection(ELECTION_DATE)

  return (
    <>
      <DataBanner />
      {/* HERO */}
      <section className="border-b border-line bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.12),transparent_60%)]">
        <div className="container-x py-10 sm:py-14">
          <p className="eyebrow flex flex-wrap items-center gap-2">
            {t('hero.eyebrow', { date: longDate(ELECTION_DATE) })}<InfoTip term="midterm" />
            <span className="rounded-full bg-surface-2 px-2 py-0.5 normal-case tracking-normal text-ink">{days > 0 ? t('hero.countdown', { n: days }) : days === 0 ? t('hero.today') : t('hero.after')}</span>
          </p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl font-bold leading-[1.02] tracking-tight sm:text-7xl">{t('headline')}</h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink/80 sm:text-lg">
            {t('hero.lede', { senate: SENATE_SEATS.length, house: HOUSE.total, gov: GOVERNOR_STATES.length })}
          </p>
          <div className="mt-6"><Countdown /></div>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-6 border-t border-line pt-6">
            <Big value={num(SENATE_SEATS.length)} label={t('sum.senate')} />
            <Big value={num(HOUSE.total)} label={t('race.house')} />
            <Big value={num(GOVERNOR_STATES.length)} label={t('sum.gov')} />
          </div>
          <Link to="/learn" className="mt-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm hover:border-accent">
            <BookOpen className="h-4 w-4 text-accent" />{t('hero.learnCta')}<ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <div className="container-x mt-8 space-y-8">
        {/* NATIONAL SUMMARIES */}
        <section className="grid gap-4 lg:grid-cols-3" aria-label={t('sum.national')}>
          <SummaryCard title={t('sum.senate')} term="senate" sub={`${t('sum.seatsUp', { n: SENATE_SEATS.length })} · ${t('sum.majority', { n: SENATE.majority })}`} to="/senate">
            <OfficeSummary office="senate" />
            <p className="text-[11px] text-muted">{t('sum.before')}: {t('party.REP')} {SENATE.before.REP} · {t('party.DEM')} {SENATE.before.DEM} · {t('party.IND')} {SENATE.before.IND}. {t('sum.tiebreak')}</p>
          </SummaryCard>
          <SummaryCard title={t('sum.house')} term="house" sub={`${t('sum.seatsUp', { n: HOUSE.total })} · ${t('sum.majority', { n: HOUSE.majority })}`} to="/house">
            <OfficeSummary office="house" />
            <p className="text-[11px] text-muted">{t('sum.houseNote')}</p>
          </SummaryCard>
          <SummaryCard title={t('sum.gov')} term="governor" sub={t('sum.racesUp', { n: GOVERNOR_STATES.length })} to="/governors">
            <OfficeSummary office="governor" />
            <p className="text-[11px] text-muted">{t('sum.govNote')}</p>
          </SummaryCard>
        </section>

        {/* LATEST NEWS */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
            <h2 className="font-serif text-2xl font-semibold">{t('news.latest')}</h2>
            <Link to="/news" className="text-xs font-medium text-accent hover:underline">{t('common.seeAll')} →</Link>
          </div>
          <NewsList lang={lang} limit={6} columns />
        </section>

        {/* MAP + SIDEBAR */}
        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Card className="min-w-0">
            <CardHeader>
              <div><h2 className="font-serif text-xl font-semibold">{t('map.title')}</h2><p className="mt-0.5 text-xs text-muted">{t('map.hint')}</p></div>
            </CardHeader>
            <CardBody><USMap /></CardBody>
          </Card>
          <div className="space-y-4">
            <UpdatesFeed />
            <DataPanel />
          </div>
        </section>

        {/* POLLS: generic ballot */}
        <section>
          <Card>
            <CardHeader>
              <div><h2 className="font-serif text-xl font-semibold">{t('polls.generic')}</h2><p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted">{t('polls.genericLede')}</p></div>
            </CardHeader>
            <CardBody>
              <PollsBlock kind="generic" limit={5} expandable title={false} />
              <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">{t('polls.note')}</p>
            </CardBody>
          </Card>
        </section>

        {/* SENATE HIGHLIGHTS */}
        <section>
          <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
            <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">{t('senate.highlights')}<InfoTip term="resultTypes" /></h2>
            <Link to="/senate" className="text-xs font-medium text-accent hover:underline">{t('common.seeAll')} →</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {by('senate').slice().sort((a, b) => order(a.sit.kind) - order(b.sit.kind) || a.seat.state.localeCompare(b.seat.state)).slice(0, 8).map((row) => (
              <RaceCard key={row.seat.key} office="senate" state={row.seat.state} special={row.seat.special} race={row.race} heldBy={row.seat.heldBy} compact sit={row.sit} />
            ))}
          </div>
        </section>

        {/* EXPLAINERS */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(['midterm', 'district', 'reporting', 'resultTypes'] as TermKey[]).map((k) => (
            <Link key={k} to={`/learn#${k}`} className="group rounded-xl border border-line bg-surface p-4 hover:border-accent">
              <p className="eyebrow">{t('nav.learn')}</p>
              <p className="mt-1 font-serif text-lg font-semibold group-hover:text-accent">{glossary[k].term}</p>
              <p className="mt-1 text-sm text-muted">{glossary[k].short}</p>
            </Link>
          ))}
        </section>
      </div>
    </>
  )
}
