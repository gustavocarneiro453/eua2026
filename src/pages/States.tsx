import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useI18n } from '@/i18n'
import { raceKey, useRaces } from '@/hooks/useElections'
import { GOVERNOR_STATES, SENATE_SEATS, STATES, STATE_BY_CODE } from '@/data/states'
import { displayStatus } from '@/lib/race'
import { USMap } from '@/components/USMap'
import { RaceCard } from '@/components/election'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader, SearchInput } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'
import { Card, CardBody } from '@/components/ui/card'
import { HouseTable } from './House'
import { cn } from '@/lib/utils'

export function StatesIndex() {
  const { t } = useI18n()
  const { coverage } = useRaces()
  const [q, setQ] = useState('')
  const list = useMemo(() => STATES.filter((s) => (s.name + s.code).toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={`50 ${t('nav.states').toLowerCase()}`} title={t('states.title')} lede={<>{t('states.lede')} <InfoTip term="stateLevel" /></>} />
      <div className="container-x mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card className="min-w-0"><CardBody><USMap /></CardBody></Card>
        <div>
          <SearchInput value={q} onChange={setQ} placeholder={t('states.search')} />
          <ul className="mt-3 grid max-h-[560px] grid-cols-1 gap-1 overflow-y-auto pr-1">
            {list.map((s) => {
              const sen = SENATE_SEATS.some((x) => x.state === s.code), gov = GOVERNOR_STATES.includes(s.code)
              return (
                <li key={s.code}>
                  <Link to={`/states/${s.code}`} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-surface">
                    <span className="flex items-center gap-2">
                      <span className={cn('h-1.5 w-1.5 rounded-full', coverage.has(s.code) ? 'bg-success' : 'bg-line')} title={coverage.has(s.code) ? t('map.covered') : t('map.notCovered')} />
                      {s.name}
                    </span>
                    <span className="flex gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">
                      {sen && <span className="rounded bg-surface-2 px-1.5 py-0.5">{t('race.senate')}</span>}
                      {gov && <span className="rounded bg-surface-2 px-1.5 py-0.5">{t('race.governor')}</span>}
                      <span className="num rounded bg-surface-2 px-1.5 py-0.5">{s.houseSeats}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </>
  )
}

export function StateDetail() {
  const { code = '' } = useParams()
  const { t, num } = useI18n()
  const { map, coverage, feed } = useRaces()
  const s = STATE_BY_CODE[code.toUpperCase()]
  if (!s) return <div className="container-x py-16 text-muted">{t('states.notFound')} <Link className="text-accent" to="/states">{t('states.back')}</Link></div>
  const seats = SENATE_SEATS.filter((x) => x.state === s.code)
  const gov = GOVERNOR_STATES.includes(s.code)
  const st = (r: Parameters<typeof displayStatus>[0]) => displayStatus(r, coverage, !!feed.snapshot, s.code)
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={<Link to="/states" className="inline-flex items-center gap-1 hover:text-ink"><ArrowLeft className="h-3 w-3" />{t('states.back')}</Link>} title={s.name}>
        <dl className="mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            [t('race.senate'), seats.length ? num(seats.length) : '—'],
            [t('race.governor'), gov ? t('common.yes') : t('common.no')],
            [t('states.houseDelegation'), num(s.houseSeats)],
            [t('map.coverage'), feed.snapshot ? (coverage.has(s.code) ? t('map.covered') : t('map.notCovered')) : '—'],
          ].map(([k, v]) => <div key={k}><dt className="eyebrow">{k}</dt><dd className="num mt-1 font-serif text-2xl font-semibold">{v}</dd></div>)}
        </dl>
      </PageHeader>
      <div className="container-x mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold">{t('states.racesHere')}<InfoTip term="resultTypes" /></h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {seats.map((x) => { const r = map.get(raceKey('senate', s.code, null, x.special)); return <RaceCard key={String(x.special)} office="senate" state={s.code} special={x.special} heldBy={x.heldBy} race={r} status={st(r)} /> })}
              {gov && (() => { const r = map.get(raceKey('governor', s.code)); return <RaceCard office="governor" state={s.code} race={r} status={st(r)} /> })()}
            </div>
            {!seats.length && <p className="mt-2 text-sm text-muted">{t('states.noSenate')}</p>}
            {!gov && <p className="mt-1 text-sm text-muted">{t('states.noGov')}</p>}
          </section>
          <section>
            <h2 className="mb-3 flex items-center gap-2 font-serif text-2xl font-semibold">{t('house.title')}<InfoTip term="district" /></h2>
            <HouseTable states={[s]} />
          </section>
        </div>
        <aside><Card className="sticky top-20"><CardBody><USMap showLayers={false} selected={s.code} /></CardBody></Card></aside>
      </div>
    </>
  )
}
