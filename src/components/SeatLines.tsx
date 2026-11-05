import { useI18n } from '@/i18n'
import type { SeatInfo } from '@/services/seats'
import { PartyDot } from '@/components/election'

export const REDISTRICTED = new Set(['AL', 'CA', 'FL', 'LA', 'NC', 'OH', 'TN', 'TX', 'UT'])

export function SeatLines({ seat, state }: { seat: SeatInfo | 'error' | undefined; state: string }) {
  const { t, pct, dec } = useI18n()
  if (!seat) return <p className="text-xs text-muted">{t('race.seatLoading')}</p>
  if (seat === 'error') return <p className="text-xs text-amber-300">{t('race.seatError')}</p>
  return (
    <div className="space-y-0.5 text-xs">
      <p className="flex items-center gap-1.5 text-ink/90">{seat.party && <PartyDot party={seat.party} />}{seat.vacant ? t('race.vacant') + (seat.reason ? ` (${seat.reason})` : '') : t('race.holder', { name: seat.member ?? '—' })}</p>
      {seat.last
        ? <p className="num text-muted">{t('race.last2024')}: {seat.last.winner} {seat.last.share != null ? pct(seat.last.share) : ''}{seat.last.unopposed ? ` (${t('race.unopposed')})` : seat.last.runnerUp ? ` · ${seat.last.runnerUp}${seat.last.margin != null ? ` (+${dec(seat.last.margin)} ${t('race.pp')})` : ''}` : ''}</p>
        : <p className="text-muted">{REDISTRICTED.has(state) ? t('race.redistricted') : t('common.dash')}</p>}
    </div>
  )
}

