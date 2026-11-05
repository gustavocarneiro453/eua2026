import { Link } from 'react-router-dom'
import { X } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { Row } from '@/hooks/useBallot'
import { useBallot } from '@/hooks/useBallot'
import { STATE_BY_CODE } from '@/data/states'
import { hasCountedVotes } from '@/lib/race'
import { useSeats } from '@/services/seats'
import { useSenate } from '@/services/senate'
import { DistrictGrid } from '@/components/DistrictGrid'
import { EmptyRace, PartyDot, raceLabel, SourceLine, StatusBadge } from '@/components/election'
import { RaceRanking } from '@/components/Ranking'
import { SeatLines } from '@/components/SeatLines'
import type { Layer } from '@/lib/ballot'

/** Full detail of one contest: candidates, parties, votes, percentages, % reporting, status, source and update time. */
export function RacePanel({ row, onClose }: { row: Row; onClose?: () => void }) {
  const { t } = useI18n()
  const senate = useSenate()
  const { seat, race, sit } = row
  const seatOf = useSeats(seat.office === 'house' ? [`${seat.state}-${String(seat.district).padStart(2, '0')}`] : [])
  const inc = seat.office === 'senate' ? senate.incumbent(seat.state, seat.special) : null
  return (
    <article className="rounded-xl border border-line bg-surface p-4" aria-live="polite">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{t(`race.${seat.office}`)}{seat.special ? ` · ${t('race.special')}` : ''}</p>
          <h3 className="mt-0.5 font-serif text-xl font-semibold">{raceLabel(seat.office, seat.state, seat.district)}{seat.office === 'house' && <span className="ml-2 text-sm font-normal text-muted">{STATE_BY_CODE[seat.state]?.name}</span>}</h3>
        </div>
        <div className="flex shrink-0 items-start gap-2"><StatusBadge sit={sit} />{onClose && <button onClick={onClose} aria-label={t('common.close')} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"><X className="h-4 w-4" /></button>}</div>
      </header>
      {inc && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><PartyDot party={inc.party} />{t('race.holder', { name: `${inc.first} ${inc.last}` })}</p>}
      {!inc && seat.heldBy && <p className="mt-2 text-xs text-muted">{t('race.heldBy')}: {t(`party.${seat.heldBy}`)}</p>}
      {seat.office === 'house' && !hasCountedVotes(race) && <div className="mt-2"><SeatLines seat={seatOf(`${seat.state}-${String(seat.district).padStart(2, '0')}`)} state={seat.state} /></div>}
      <div className="mt-3">{hasCountedVotes(race) && race ? <RaceRanking race={race} /> : <EmptyRace state={seat.state} sit={sit} race={race} />}</div>
      <div className="mt-3 border-t border-line/60 pt-3"><SourceLine race={race} sit={sit} /></div>
      <Link to={`/states/${seat.state}`} className="mt-3 inline-block text-xs font-medium text-accent hover:underline">{t('map.open')} →</Link>
    </article>
  )
}

/** Panel for a clicked state, per map layer. House: the delegation, its districts, and any district chosen. */
export function StatePanel({ code, layer, district, onDistrict, onClose }: { code: string; layer: Layer; district: number | null; onDistrict: (d: number | null) => void; onClose: () => void }) {
  const { t, num } = useI18n()
  const { by } = useBallot()
  const s = STATE_BY_CODE[code]
  const rows = by(layer).filter((r) => r.seat.state === code)
  if (!s) return null
  if (layer !== 'house') {
    return rows.length ? (
      <div className="space-y-3">{rows.map((r) => <RacePanel key={r.seat.key} row={r} onClose={onClose} />)}</div>
    ) : (
      <article className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
        <div className="flex items-start justify-between gap-2"><h3 className="font-serif text-lg font-semibold text-ink">{s.name}</h3><button onClick={onClose} aria-label={t('common.close')} className="rounded-md p-1 hover:bg-surface-2"><X className="h-4 w-4" /></button></div>
        <p className="mt-1">{t(layer === 'senate' ? 'states.noSenate' : 'states.noGov')}</p>
        <Link to={`/states/${code}`} className="mt-2 inline-block text-xs font-medium text-accent hover:underline">{t('map.open')} →</Link>
      </article>
    )
  }
  const d = district != null ? rows.find((r) => r.seat.district === district) : null
  const counts = { DEM: 0, REP: 0, other: 0, declared: 0, awaiting: 0, unavailable: 0, tied: 0 }
  for (const r of rows) {
    if (['projected', 'official', 'certified'].includes(r.sit.kind)) counts.declared++
    if (r.sit.kind === 'lead') { if (r.sit.party === 'DEM') counts.DEM++; else if (r.sit.party === 'REP') counts.REP++; else counts.other++ }
    else if (r.sit.kind === 'awaiting') counts.awaiting++
    else if (r.sit.kind === 'unavailable') counts.unavailable++
    else if (r.sit.kind === 'tied') counts.tied++
  }
  return (
    <div className="space-y-3">
      <article className="rounded-xl border border-line bg-surface p-4">
        <header className="flex items-start justify-between gap-3">
          <div><p className="eyebrow">{t('race.house')}</p><h3 className="mt-0.5 font-serif text-xl font-semibold">{s.name}</h3><p className="text-xs text-muted">{s.houseSeats === 1 ? t('map.district1') : t('map.districts', { n: s.houseSeats })}</p></div>
          <button onClick={onClose} aria-label={t('common.close')} className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"><X className="h-4 w-4" /></button>
        </header>
        <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div><dt className="text-[11px] text-muted">{t('del.declared')}</dt><dd className="font-semibold">{num(counts.declared)}</dd></div>
          <div><dt className="text-[11px] text-muted">{t('del.leadDEM')}</dt><dd className="font-semibold">{num(counts.DEM)}</dd></div>
          <div><dt className="text-[11px] text-muted">{t('del.leadREP')}</dt><dd className="font-semibold">{num(counts.REP)}</dd></div>
          <div><dt className="text-[11px] text-muted">{t('del.awaiting')}</dt><dd className="font-semibold">{num(counts.awaiting)}</dd></div>
          <div><dt className="text-[11px] text-muted">{t('del.unavailable')}</dt><dd className="font-semibold">{num(counts.unavailable)}</dd></div>
          {(counts.other + counts.tied) > 0 && <div><dt className="text-[11px] text-muted">{t('del.other')}</dt><dd className="font-semibold">{num(counts.other + counts.tied)}</dd></div>}
        </dl>
        <p className="mt-3 text-[11px] text-muted">{t('del.pick')}</p>
        <div className="mt-2"><DistrictGrid rows={rows} selected={d?.seat.key ?? null} onSelect={(r) => onDistrict(r.seat.district)} size={24} /></div>
      </article>
      {d && <RacePanel row={d} onClose={() => onDistrict(null)} />}
    </div>
  )
}
