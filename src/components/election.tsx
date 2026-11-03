import { Link } from 'react-router-dom'
import { AlertTriangle, Ban, CheckCircle2, CircleDashed, Clock, ExternalLink, Megaphone, ShieldCheck } from 'lucide-react'
import { useI18n } from '@/i18n'
import type { Candidate, Party, Race } from '@/services/types'
import { type DisplayStatus, hasCountedVotes, leader, PARTY_COLOR, sortedCandidates, winLabelKey, winner } from '@/lib/race'
import { useSenate } from '@/services/senate'
import { PollsBlock } from '@/components/PollsBlock'
import { STATE_OFFICES } from '@/data/stateOffices'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { STATE_BY_CODE } from '@/data/states'
import { cn } from '@/lib/utils'

const STATUS_STYLE: Record<DisplayStatus, { variant: 'neutral' | 'live' | 'success' | 'warn' | 'accent'; Icon: typeof Clock }> = {
  no_data: { variant: 'neutral', Icon: CircleDashed },
  notCovered: { variant: 'neutral', Icon: Ban },
  unavailable: { variant: 'warn', Icon: AlertTriangle },
  notStarted: { variant: 'neutral', Icon: Clock },
  counting: { variant: 'warn', Icon: Clock },
  projected: { variant: 'accent', Icon: Megaphone },
  official: { variant: 'success', Icon: CheckCircle2 },
  certified: { variant: 'success', Icon: ShieldCheck },
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  const { t } = useI18n()
  const { variant, Icon } = STATUS_STYLE[status]
  const tip = status === 'notCovered' ? t('data.coverageNote') : t(`status.tip.${status}`)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0}><Badge variant={variant}><Icon className="h-3 w-3" />{t(`status.${status}`)}</Badge></span>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  )
}

export function PartyDot({ party, className }: { party: Party; className?: string }) {
  return <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', className)} style={{ background: PARTY_COLOR[party] }} />
}

export function PartyTag({ party, original }: { party: Party; original?: string }) {
  const { t } = useI18n()
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted" title={original}>
      <PartyDot party={party} />{t(`party.${party}`)}
    </span>
  )
}

export function ReportingBar({ pct }: { pct: number | null }) {
  const { t, pct: fp } = useI18n()
  if (pct == null) return <span className="text-xs text-muted">{t('race.reportingUnknown')}</span>
  return (
    <div className="flex min-w-28 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-ink/70" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className="num text-xs text-muted">{t('race.reporting', { p: fp(pct) })}</span>
    </div>
  )
}

export function raceLabel(office: Race['office'], state: string, district?: number | null) {
  if (office !== 'house') return STATE_BY_CODE[state]?.name ?? state
  return `${state}-${district === 0 ? 'AL' : String(district).padStart(2, '0')}`
}

function CandidateRow({ c, race, max }: { c: Candidate; race: Race; max: number }) {
  const { t, num, pct } = useI18n()
  const w = winner(race)
  const l = leader(race)
  const isWinner = w?.id === c.id
  const isLeader = !w && l?.id === c.id && race.status === 'counting'
  return (
    <li className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 py-2">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <PartyDot party={c.party} />
        <span className={cn('break-words text-sm', isWinner ? 'font-semibold text-ink' : 'text-ink/90')}>{c.name}</span>
        {c.incumbent && <span className="text-[10px] uppercase tracking-wider text-muted">inc.</span>}
        {isWinner && <Badge variant="success"><CheckCircle2 className="h-3 w-3" />{t(winLabelKey(race.status))}</Badge>}
        {isLeader && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">{t('race.leader')}</span>}
      </div>
      <div className="num text-right text-sm">
        <span className="font-semibold">{pct(c.pct)}</span>
        <span className="ml-2 text-xs text-muted">{num(c.votes)}</span>
      </div>
      <div className="col-span-2 h-1 overflow-hidden rounded-full bg-surface-2">
        {c.votes != null && max > 0 && <div className="h-full" style={{ width: `${(c.votes / max) * 100}%`, background: PARTY_COLOR[c.party], opacity: isWinner || race.status !== 'counting' ? 1 : 0.6 }} />}
      </div>
    </li>
  )
}

/** Outbound link to the state's official election office (only for states outside the results feed). */
export function StateOfficeLink({ state }: { state: string }) {
  const { t } = useI18n()
  const o = STATE_OFFICES[state]
  if (!o) return null
  return <a href={o.results ?? o.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">{o.name}<ExternalLink className="h-3 w-3" /><span className="sr-only">{t('news.opensNew')}</span></a>
}

/** What a race shows when it has no votes yet: the reason, plus any real candidate names the state published. */
export function EmptyRace({ state, status, race, compact }: { state: string; status: DisplayStatus; race?: Race; compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-lg border border-dashed border-line px-3 py-3 text-xs leading-relaxed text-muted">
        {status === 'notCovered' ? <>{t('race.notCoveredMsg')} <StateOfficeLink state={state} /></>
          : status === 'unavailable' ? t('race.unavailableMsg') : status === 'notStarted' ? t('race.notStartedMsg') : t('race.await')}
      </div>
      {race && race.candidates.length > 0 && (
        <div><p className="eyebrow mb-1">{t('race.listed')}</p>
        <ul className="space-y-1" aria-label={t('race.listed')}>
          {race.candidates.slice(0, compact ? 3 : 12).map((c) => (
            <li key={c.id} className="flex items-center gap-2 text-sm"><PartyDot party={c.party} />{c.name}{c.incumbent && <span className="text-[10px] uppercase tracking-wider text-muted">inc.</span>}</li>
          ))}
        </ul></div>
      )}
    </div>
  )
}

export function RaceCard({ office, state, district, special, race, status, heldBy, compact }: {
  office: Race['office']; state: string; district?: number | null; special?: boolean
  race?: Race; status: DisplayStatus; heldBy?: Party; compact?: boolean
}) {
  const { t, date } = useI18n()
  const senate = useSenate()
  const cands = race ? sortedCandidates(race) : []
  const counted = hasCountedVotes(race)
  const max = Math.max(0, ...cands.map((c) => c.votes ?? 0))
  const inc = office === 'senate' ? senate.incumbent(state, !!special) : null
  return (
    <article className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{t(`race.${office}`)}{special ? ` · ${t('race.special')}` : ''}</p>
          <h3 className="mt-0.5 truncate font-serif text-lg font-semibold">
            <Link to={`/states/${state}`} className="hover:text-accent">{raceLabel(office, state, district)}</Link>
          </h3>
        </div>
        <StatusBadge status={status} />
      </header>
      {inc ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted" title="senate.gov"><PartyDot party={inc.party} />{t('race.holder', { name: `${inc.first} ${inc.last}` })}</p>
      ) : heldBy ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">{t('race.heldBy')}: <PartyTag party={heldBy} /></p>
      ) : null}
      {counted ? (
        <ul className="mt-2 divide-y divide-line/60">
          {(compact ? cands.slice(0, 3) : cands).map((c) => <CandidateRow key={c.id} c={c} race={race!} max={max} />)}
        </ul>
      ) : (
        <EmptyRace state={state} status={status} race={race} compact={compact} />
      )}
      {!counted && office !== 'house' && (
        <div className="mt-3 border-t border-line/60 pt-3">
          <PollsBlock kind={office} state={state} limit={compact ? 1 : 2} hideEmpty footer={!compact} />
        </div>
      )}
      <footer className="mt-auto space-y-1.5 pt-3">
        {race && counted && <ReportingBar pct={race.reportingPct} />}
        {race?.status === 'projected' && race.projectionSource && <p className="text-[11px] text-muted">{t('race.projectedBy', { src: race.projectionSource })}</p>}
        {race?.status === 'certified' && race.certificationSource && (
          <a href={race.certificationSource} target="_blank" rel="noreferrer" className="text-[11px] text-accent hover:underline">{t('race.certifiedBy')}</a>
        )}
        {race?.updatedAt && counted && <p className="text-[11px] text-muted">{t('race.updated', { t: date(race.updatedAt) })}</p>}
      </footer>
    </article>
  )
}
