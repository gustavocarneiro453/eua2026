import { useMemo, useState } from 'react'
import { useI18n } from '@/i18n'
import { useBallot } from '@/hooks/useBallot'
import { STATE_BY_CODE } from '@/data/states'
import type { SitKind } from '@/lib/classify'
import type { Office } from '@/services/types'
import { RaceCard } from '@/components/election'
import { OfficeSummary } from '@/components/OfficeSummary'
import { MethodNote } from '@/components/MethodNote'
import { MapLegend } from '@/components/MapLegend'
import { SearchInput } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'declared' | 'lead' | 'awaiting' | 'unavailable'
const MATCH: Record<Filter, (k: SitKind) => boolean> = {
  all: () => true,
  declared: (k) => k === 'projected' || k === 'official' || k === 'certified',
  lead: (k) => k === 'lead' || k === 'tied',
  awaiting: (k) => k === 'awaiting',
  unavailable: (k) => k === 'unavailable',
}

/** Senate and Governors share this page: summary, filter by situation, one card per contest, method and legend. */
export function RacesPage({ office }: { office: 'senate' | 'governor' }) {
  const { t, num } = useI18n()
  const { by } = useBallot()
  const [q, setQ] = useState('')
  const [f, setF] = useState<Filter>('all')
  const rows = by(office as Office)
  const counts = useMemo(() => Object.fromEntries((Object.keys(MATCH) as Filter[]).map((k) => [k, rows.filter((r) => MATCH[k](r.sit.kind)).length])) as Record<Filter, number>, [rows])
  const list = rows.filter((r) => MATCH[f](r.sit.kind) && (STATE_BY_CODE[r.seat.state].name + r.seat.state).toLowerCase().includes(q.toLowerCase()))
  return (
    <>
      <div className="container-x mt-6 space-y-4">
        <section className="rounded-xl border border-line bg-surface p-4" aria-label={t('sum.national')}><OfficeSummary office={office} /></section>
        <MethodNote office={office} />
      </div>
      <div className="container-x mt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 sm:max-w-xs"><SearchInput value={q} onChange={setQ} placeholder={t('states.search')} /></div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('flt.title')}>
            {(Object.keys(MATCH) as Filter[]).map((k) => (
              <button key={k} onClick={() => setF(k)} aria-pressed={f === k}
                className={cn('rounded-full px-3 py-1 text-xs font-semibold', f === k ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink')}>{t(`flt.${k}`)} <span className="num font-normal">{num(counts[k])}</span></button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((r) => <RaceCard key={r.seat.key} office={office} state={r.seat.state} special={r.seat.special} heldBy={r.seat.heldBy} race={r.race} sit={r.sit} />)}
          {!list.length && <p className="text-sm text-muted">{t('common.none')}</p>}
        </div>
        <MapLegend />
      </div>
    </>
  )
}
