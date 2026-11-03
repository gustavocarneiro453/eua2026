import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n'
import { raceKey, useRaces } from '@/hooks/useElections'
import { GOVERNOR_STATES, STATE_BY_CODE } from '@/data/states'
import { displayStatus } from '@/lib/race'
import { RaceCard } from '@/components/election'
import { InfoTip } from '@/components/InfoTip'
import { PageHeader, SearchInput } from '@/components/PageHeader'
import { DataBanner } from '@/components/DataPanel'

export default function Governors() {
  const { t } = useI18n()
  const { map, coverage, feed } = useRaces()
  const [q, setQ] = useState('')
  const list = useMemo(() => GOVERNOR_STATES.filter((s) => (STATE_BY_CODE[s].name + s).toLowerCase().includes(q.toLowerCase())), [q])
  return (
    <>
      <DataBanner />
      <PageHeader eyebrow={t('sum.racesUp', { n: GOVERNOR_STATES.length })} title={<>{t('gov.title')}<InfoTip term="governor" className="[&_svg]:h-5 [&_svg]:w-5" /></>} lede={t('gov.lede')}>
        <div className="mt-5"><SearchInput value={q} onChange={setQ} placeholder={t('states.search')} /></div>
      </PageHeader>
      <div className="container-x mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((s) => {
          const r = map.get(raceKey('governor', s))
          return <RaceCard key={s} office="governor" state={s} race={r} status={displayStatus(r, coverage, !!feed.snapshot, s)} />
        })}
        {!list.length && <p className="text-sm text-muted">{t('common.none')}</p>}
      </div>
    </>
  )
}
