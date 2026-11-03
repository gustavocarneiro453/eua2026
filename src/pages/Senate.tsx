import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n'
import { raceKey, useRaces } from '@/hooks/useElections'
import { SENATE_SEATS, STATE_BY_CODE } from '@/data/states'
import { displayStatus } from '@/lib/race'
import { RaceCard } from '@/components/election'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader, SearchInput } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'

export default function Senate() {
  const { t } = useI18n()
  const { map, coverage, feed } = useRaces()
  const [q, setQ] = useState('')
  const seats = useMemo(() => SENATE_SEATS.filter((s) => (STATE_BY_CODE[s.state].name + s.state).toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={<>{t('sum.seatsUp', { n: SENATE_SEATS.length })} · {t('sum.majority', { n: 51 })}</>} title={<>{t('senate.title')}<InfoTip term="senate" className="[&_svg]:h-5 [&_svg]:w-5" /></>} lede={t('senate.lede')}>
        <div className="mt-5"><SearchInput value={q} onChange={setQ} placeholder={t('states.search')} /></div>
      </PageHeader>
      <div className="container-x mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {seats.map((s) => {
          const r = map.get(raceKey('senate', s.state, null, s.special))
          return <RaceCard key={s.state + s.special} office="senate" state={s.state} special={s.special} heldBy={s.heldBy} race={r} status={displayStatus(r, coverage, !!feed.snapshot, s.state)} />
        })}
        {!seats.length && <p className="text-sm text-muted">{t('common.none')}</p>}
      </div>
    </>
  )
}
