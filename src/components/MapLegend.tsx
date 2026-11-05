import { useI18n } from '@/i18n'
import { swatch } from '@/lib/sitStyle'
import type { Party } from '@/services/types'
import type { SitKind } from '@/lib/classify'
import type { DictKey } from '@/i18n/dict'

const ITEMS: { kind: SitKind; party?: Party; label: DictKey }[] = [
  { kind: 'noRace', label: 'leg.noRace' },
  { kind: 'awaiting', label: 'leg.awaiting' },
  { kind: 'unavailable', label: 'leg.unavailable' },
  { kind: 'lead', party: 'REP', label: 'leg.leadREP' },
  { kind: 'lead', party: 'DEM', label: 'leg.leadDEM' },
  { kind: 'projected', party: 'REP', label: 'leg.projectedREP' },
  { kind: 'projected', party: 'DEM', label: 'leg.projectedDEM' },
  { kind: 'official', party: 'REP', label: 'leg.officialREP' },
  { kind: 'official', party: 'DEM', label: 'leg.officialDEM' },
  { kind: 'certified', party: 'DEM', label: 'leg.certified' },
]

/** One legend for every map, tile grid and bar: each situation has its own texture, not only its own color. */
export function MapLegend({ house }: { house?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="mt-3 space-y-2">
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[11px] text-muted min-[460px]:grid-cols-2 lg:grid-cols-3" aria-label={t('leg.title')}>
        {ITEMS.map((i) => (
          <li key={i.label} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 shrink-0 rounded-sm ring-1 ring-line" style={swatch(i.kind, i.party)} />{t(i.label)}
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted">{t('leg.note')}{house ? ` ${t('leg.houseNote')}` : ''}</p>
    </div>
  )
}
