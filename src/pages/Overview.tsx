import { Link } from 'react-router-dom'
import { ArrowRight, BookOpen } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useRaces, raceKey } from '@/hooks/useElections'
import { ELECTION_DATE, GOVERNOR_STATES, HOUSE, SENATE, SENATE_SEATS } from '@/data/states'
import { daysToElection, SENATE_NOT_UP, tally } from '@/lib/tally'
import { displayStatus } from '@/lib/race'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { SeatBalance, type Segment } from '@/components/SeatBalance'
import { USMap } from '@/components/USMap'
import { InfoTip } from '@/components/InfoTip'
import { RaceCard } from '@/components/election'
import { NewsList } from '@/components/NewsList'
import { Countdown } from '@/components/Countdown'
import { PollsBlock } from '@/components/PollsBlock'
import { DataBanner, DataPanel, UpdatesFeed } from '@/components/DataPanel'
import type { TermKey } from '@/i18n/glossary'
import type { Party } from '@/services/types'

function Big({ value, label }: { value: string; label: string }) {
  return <div><p className="num font-serif text-3xl font-semibold leading-none">{value}</p><p className="mt-1 text-[11px] uppercase tracking-wider text-muted">{label}</p></div>
}

function useSegments() {
  const { t } = useI18n()
  const { list, feed } = useRaces()
  const has = !!feed.snapshot
  const calls = !!feed.snapshot?.callsSupported
  const party = (p: Party, n: number | undefined, op = 1): Segment => ({ key: p, label: t(`party.${p}`), value: n ?? 0, color: `var(--color-${p === 'REP' ? 'rep' : p === 'DEM' ? 'dem' : 'ind'})`, opacity: op })
  const s = tally(list, 'senate'), h = tally(list, 'house'), g = tally(list, 'governor')
  const pending = (n: number): Segment => ({ key: 'pending', label: calls ? t('sum.undecided') : t('sum.onBallot'), value: n, color: '#2A3850' })
  const senate: Segment[] = [
    { ...party('DEM', SENATE_NOT_UP.DEM, 0.45), key: 'dNotUp', label: `${t('party.DEM')} · ${t('sum.notUp')}` },
    ...(calls ? [{ ...party('DEM', s.won.DEM), key: 'dWon', label: `${t('party.DEM')} · ${t('sum.projected')}` }] : []),
    ...(calls && s.won.IND ? [{ ...party('IND', s.won.IND), key: 'iWon' }] : []),
    pending(s.undecided),
    ...(calls ? [{ ...party('REP', s.won.REP), key: 'rWon', label: `${t('party.REP')} · ${t('sum.projected')}` }] : []),
    { ...party('REP', SENATE_NOT_UP.REP, 0.45), key: 'rNotUp', label: `${t('party.REP')} · ${t('sum.notUp')}` },
  ].filter((x) => x.value > 0)
  const house: Segment[] = calls
    ? [party('DEM', h.won.DEM), pending(h.undecided), party('REP', h.won.REP)].filter((x) => x.value > 0)
    : [{ key: 'pending', label: t('sum.awaiting'), value: HOUSE.total, color: '#2A3850' }]
  return { senate, house, s, h, g, has, calls }
}

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
  const { map, coverage, feed } = useRaces()
  const { senate, house, s, h, g, has, calls } = useSegments()
  const days = daysToElection(ELECTION_DATE)
  // Projections: '—' unless the source can declare winners (missing is never shown as zero)
  const dash = (n: number | undefined) => (calls ? num(n ?? 0) : '—')

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
        <section className="grid gap-4 lg:grid-cols-3">
          <SummaryCard title={t('sum.senate')} term="senate" sub={`${t('sum.seatsUp', { n: SENATE_SEATS.length })} · ${t('sum.majority', { n: SENATE.majority })}`} to="/senate">
            <SeatBalance segments={senate} total={SENATE.total} majority={SENATE.majority} />
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
              <Big value={dash(s.won.DEM)} label={`${t('party.short.DEM')} · ${t('sum.projected')}`} />
              <Big value={dash(s.won.REP)} label={`${t('party.short.REP')} · ${t('sum.projected')}`} />
              {calls ? <Big value={num(s.undecided)} label={t('sum.undecided')} /> : <Big value={has ? num(s.withData) : '—'} label={t('sum.withData')} />}
            </div>
            <p className="text-[11px] text-muted">{t('sum.before')}: {t('party.REP')} {SENATE.before.REP} · {t('party.DEM')} {SENATE.before.DEM} · {t('party.IND')} {SENATE.before.IND}. {t('sum.tiebreak')}</p>
          </SummaryCard>
          <SummaryCard title={t('sum.house')} term="house" sub={`${t('sum.seatsUp', { n: HOUSE.total })} · ${t('sum.majority', { n: HOUSE.majority })}`} to="/house">
            <SeatBalance segments={house} total={HOUSE.total} majority={HOUSE.majority} />
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
              <Big value={dash(h.won.DEM)} label={`${t('party.short.DEM')} · ${t('sum.projected')}`} />
              <Big value={dash(h.won.REP)} label={`${t('party.short.REP')} · ${t('sum.projected')}`} />
              <Big value={has ? num(h.withData) : '—'} label={t('sum.withData')} />
            </div>
            <p className="text-[11px] text-muted">{t('sum.houseNote')}</p>
          </SummaryCard>
          <SummaryCard title={t('sum.gov')} term="governor" sub={t('sum.racesUp', { n: GOVERNOR_STATES.length })} to="/governors">
            <div className="flex h-10 gap-[2px]" aria-hidden>
              {GOVERNOR_STATES.map((st) => {
                const r = map.get(raceKey('governor', st))
                const w = r?.winnerId && ['projected', 'official', 'certified'].includes(r.status) ? r.candidates.find((c) => c.id === r.winnerId)?.party : null
                return <span key={st} title={st} className="flex-1 rounded-[2px]" style={{ background: w ? `var(--color-${w === 'REP' ? 'rep' : w === 'DEM' ? 'dem' : 'ind'})` : '#2A3850' }} />
              })}
            </div>
            <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
              <Big value={dash(g.won.DEM)} label={`${t('party.short.DEM')} · ${t('sum.projected')}`} />
              <Big value={dash(g.won.REP)} label={`${t('party.short.REP')} · ${t('sum.projected')}`} />
              {calls ? <Big value={num(g.undecided)} label={t('sum.undecided')} /> : <Big value={has ? num(g.withData) : '—'} label={t('sum.withData')} />}
            </div>
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
            {SENATE_SEATS.slice().sort((a, b) => {
              const ra = map.get(raceKey('senate', a.state, null, a.special)), rb = map.get(raceKey('senate', b.state, null, b.special))
              const rank = (r?: { status: string }) => (r && r.status !== 'no_data' ? 0 : r ? 1 : 2)
              return rank(ra) - rank(rb) || a.state.localeCompare(b.state)
            }).slice(0, 8).map((seat) => {
              const r = map.get(raceKey('senate', seat.state, null, seat.special))
              return <RaceCard key={seat.state + seat.special} office="senate" state={seat.state} special={seat.special} race={r} heldBy={seat.heldBy} compact
                status={displayStatus(r, coverage, !!feed.snapshot, seat.state)} />
            })}
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
