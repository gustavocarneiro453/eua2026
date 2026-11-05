import { useI18n } from '@/i18n'
import { type OfficeStats, useBallot } from '@/hooks/useBallot'
import { SENATE, HOUSE } from '@/data/states'
import { SENATE_NOT_UP } from '@/lib/tally'
import { paint } from '@/lib/sitStyle'
import { PARTY_COLOR } from '@/lib/race'
import { SeatBalance, type Segment } from '@/components/SeatBalance'
import type { Office } from '@/services/types'

function Stat({ value, label, hint, strong }: { value: string; label: string; hint?: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dd className={`num font-serif leading-none ${strong ? 'text-3xl font-semibold' : 'text-2xl font-semibold'}`}>{value}</dd>
      <dt className="mt-1 text-[11px] leading-snug text-muted">{label}</dt>
      {hint && <p className="num text-[10px] leading-snug text-muted/80">{hint}</p>}
    </div>
  )
}

/** Seat composition bar for an office. Declared wins are solid, leads are translucent, undecided is grey. */
function useSegments(office: Office, s: OfficeStats): { segments: Segment[]; total: number; majority: number } | null {
  const { t } = useI18n()
  const unknown = s.total - s.declaredTotal - s.leadingTotal
  const seg = (key: string, label: string, value: number, color: string, opacity = 1): Segment => ({ key, label, value, color, opacity })
  const D = PARTY_COLOR.DEM, R = PARTY_COLOR.REP, I = PARTY_COLOR.IND
  if (office === 'senate') {
    return {
      total: SENATE.total, majority: SENATE.majority,
      segments: [
        seg('dNotUp', `${t('party.DEM')} · ${t('sum.notUp')}`, SENATE_NOT_UP.DEM, '#1E3A8A'),
        seg('dDec', `${t('party.DEM')} · ${t('sum.declared')}`, s.declared.DEM, D),
        seg('dLead', `${t('party.DEM')} · ${t('sum.leading')}`, s.leading.DEM, D, 0.45),
        seg('pending', t('sum.noWinnerYet'), unknown, '#2A3850'),
        seg('oLead', `${t('party.IND')} · ${t('sum.leading')}`, s.leading.IND + s.leading.OTH + s.leading.LIB + s.leading.GRN, I, 0.45),
        seg('oDec', `${t('party.IND')} · ${t('sum.declared')}`, s.declared.IND + s.declared.OTH + s.declared.LIB + s.declared.GRN, I),
        seg('rLead', `${t('party.REP')} · ${t('sum.leading')}`, s.leading.REP, R, 0.45),
        seg('rDec', `${t('party.REP')} · ${t('sum.declared')}`, s.declared.REP, R),
        seg('rNotUp', `${t('party.REP')} · ${t('sum.notUp')}`, SENATE_NOT_UP.REP, '#7F1D1D'),
      ].filter((x) => x.value > 0),
    }
  }
  if (office === 'house') {
    return {
      total: HOUSE.total, majority: HOUSE.majority,
      segments: [
        seg('dDec', `${t('party.DEM')} · ${t('sum.declared')}`, s.declared.DEM, D),
        seg('dLead', `${t('party.DEM')} · ${t('sum.leading')}`, s.leading.DEM, D, 0.45),
        seg('pending', t('sum.noWinnerYet'), unknown, '#2A3850'),
        seg('oLead', `${t('party.IND')} · ${t('sum.leading')}`, s.leading.IND + s.leading.OTH + s.leading.LIB + s.leading.GRN, I, 0.45),
        seg('oDec', `${t('party.IND')} · ${t('sum.declared')}`, s.declared.IND + s.declared.OTH + s.declared.LIB + s.declared.GRN, I),
        seg('rLead', `${t('party.REP')} · ${t('sum.leading')}`, s.leading.REP, R, 0.45),
        seg('rDec', `${t('party.REP')} · ${t('sum.declared')}`, s.declared.REP, R),
      ].filter((x) => x.value > 0),
    }
  }
  return null
}

/** Count of the contests of an office by situation. Availability of data is never presented as a result. */
export function OfficeSummary({ office, bar = true, className }: { office: Office; bar?: boolean; className?: string }) {
  const { t, num } = useI18n()
  const { stats, by } = useBallot()
  const s = stats[office]
  const comp = useSegments(office, s)
  const seats = office === 'governor' ? by('governor') : null
  return (
    <div className={className}>
      {bar && comp && <SeatBalance segments={comp.segments} total={comp.total} majority={comp.majority} />}
      {bar && seats && (
        <div className="flex h-9 gap-[2px]" role="img" aria-label={t('sum.govStrip')}>
          {seats.map((r) => <span key={r.seat.key} title={`${r.seat.state}: ${t(`sit.${r.sit.kind}`)}${r.sit.party ? ` · ${t(`party.${r.sit.party}`)}` : ''}`} className="flex-1 rounded-[2px]" style={paint(r.sit).css} />)}
        </div>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <Stat strong value={num(s.declaredTotal)} label={t('sum.declaredWins')} hint={s.declaredTotal ? `${t('party.short.DEM')} ${s.declared.DEM} · ${t('party.short.REP')} ${s.declared.REP}${s.declared.IND + s.declared.OTH + s.declared.LIB + s.declared.GRN ? ` · ${t('party.short.IND')} ${s.declared.IND + s.declared.OTH + s.declared.LIB + s.declared.GRN}` : ''}` : t('sum.declaredNone')} />
        <Stat strong value={num(s.leadingTotal)} label={t('sum.leadingNow')} hint={`${t('party.short.DEM')} ${s.leading.DEM} · ${t('party.short.REP')} ${s.leading.REP}${s.leading.IND + s.leading.OTH + s.leading.LIB + s.leading.GRN ? ` · ${t('party.short.IND')} ${s.leading.IND + s.leading.OTH + s.leading.LIB + s.leading.GRN}` : ''}`} />
        <Stat value={num(s.pending)} label={t('sum.pending')} hint={t('sum.ofTotal', { n: num(s.total) })} />
        <Stat value={num(s.complete)} label={t('sum.complete')} hint={t('sum.completeHint')} />
        <Stat value={num(s.withVotes)} label={t('sum.withVotes')} />
        <Stat value={num(s.awaiting)} label={t('sum.awaitingCount')} />
        <Stat value={num(s.unavailable)} label={t('sum.unavailableCount')} />
        <Stat value={num(s.tied)} label={t('sum.tiedCount')} />
      </dl>
    </div>
  )
}
