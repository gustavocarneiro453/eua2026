import { memo } from 'react'
import { useI18n } from '@/i18n'
import type { Row } from '@/hooks/useBallot'
import { paint } from '@/lib/sitStyle'
import { STATE_BY_CODE } from '@/data/states'
import { raceLabel } from '@/components/election'
import { cn } from '@/lib/utils'

/**
 * The 435 districts, one tile each, grouped by state. It is deliberately not geographic: congressional lines changed in
 * nine states for 2026, and an approximate outline would suggest boundaries we cannot source. Each tile carries its own
 * result, so a state is never painted as a whole just because some of its districts have data.
 */
export const DistrictGrid = memo(function DistrictGrid({ rows, selected, onSelect, size = 20 }: {
  rows: Row[]; selected?: string | null; onSelect?: (row: Row) => void; size?: number
}) {
  const { t } = useI18n()
  const groups = new Map<string, Row[]>()
  for (const r of rows) (groups.get(r.seat.state) ?? groups.set(r.seat.state, []).get(r.seat.state)!).push(r)
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-3" role="group" aria-label={t('map.districtsAria')}>
      {[...groups.entries()].map(([code, list]) => (
        <div key={code} className="min-w-0">
          <p className="mb-1 flex items-baseline gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{code}<span className="num font-normal">{list.length}</span></p>
          <div className="flex max-w-[11.5rem] flex-wrap gap-[3px]" style={{ maxWidth: `${Math.min(list.length, 8) * (size + 3)}px` }}>
            {list.map((r) => {
              const p = paint(r.sit)
              const sel = selected === r.seat.key
              return (
                <button key={r.seat.key} type="button" onClick={() => onSelect?.(r)} aria-pressed={sel}
                  aria-label={`${raceLabel('house', r.seat.state, r.seat.district)}: ${t(`sit.${r.sit.kind}`)}${r.sit.party ? ` · ${t(`party.${r.sit.party}`)}` : ''}`}
                  title={`${raceLabel('house', r.seat.state, r.seat.district)} · ${STATE_BY_CODE[r.seat.state]?.name} — ${t(`sit.${r.sit.kind}`)}${r.sit.party ? ` · ${t(`party.${r.sit.party}`)}` : ''}`}
                  className={cn('rounded-[3px] outline-offset-2 hover:ring-2 hover:ring-ink', sel && 'ring-2 ring-ink')}
                  style={{ width: size, height: size, ...p.css }} />
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
})
