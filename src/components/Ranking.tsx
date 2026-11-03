import { useI18n } from '@/i18n'
import type { Race } from '@/services/types'
import { hasCountedVotes, PARTY_COLOR, rankCandidates, type RankedCandidate, winLabelKey, winner } from '@/lib/race'
import { PartyTag, ReportingBar } from '@/components/election'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function Bar({ c, max, strong }: { c: RankedCandidate['c']; max: number; strong?: boolean }) {
  return (
    <div className={cn('overflow-hidden rounded-full bg-surface-2', strong ? 'h-2' : 'h-1')}>
      {c.votes != null && max > 0 && <div className="h-full" style={{ width: `${(c.votes / max) * 100}%`, background: PARTY_COLOR[c.party] }} />}
    </div>
  )
}

function TopCard({ r, race, max }: { r: RankedCandidate; race: Race; max: number }) {
  const { t, num, pct } = useI18n()
  const w = winner(race)
  const isWinner = w?.id === r.c.id
  return (
    <div className={cn('rounded-xl border p-4', r.rank === 1 ? 'border-ink/30 bg-surface-2' : 'border-line bg-surface')}>
      <div className="flex items-start justify-between gap-2">
        <span className="num font-serif text-2xl font-semibold text-muted">{t('rank.n', { n: r.rank ?? '–' })}</span>
        <div className="flex flex-wrap justify-end gap-1.5">
          {r.tied && <Badge variant="warn">{t('rank.tied')}</Badge>}
          {isWinner && <Badge variant="success">{t(winLabelKey(race.status))}</Badge>}
          {r.c.incumbent && <Badge>inc.</Badge>}
        </div>
      </div>
      <p className="mt-2 font-serif text-xl font-semibold leading-tight">{r.c.name}</p>
      <p className="mt-1"><PartyTag party={r.c.party} original={r.c.partyOriginal} /></p>
      <p className="num mt-3 font-serif text-4xl font-semibold leading-none">{pct(r.c.pct)}</p>
      <p className="num mt-1 text-sm text-muted">{num(r.c.votes)} {t('race.votes')}</p>
      <div className="mt-3"><Bar c={r.c} max={max} strong /></div>
    </div>
  )
}

/** Ranking of one race by votes counted so far: 1st and 2nd highlighted, the rest below in descending order. */
export function RaceRanking({ race }: { race: Race }) {
  const { t, num, pct, dec } = useI18n()
  if (!hasCountedVotes(race)) return <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">{t('rank.noVotes')}</p>
  const ranked = rankCandidates(race)
  const top = ranked.slice(0, 2), rest = ranked.slice(2)
  const max = Math.max(0, ...ranked.map((r) => r.c.votes ?? 0))
  const [a, b] = top
  const gapVotes = a?.c.votes != null && b?.c.votes != null ? a.c.votes - b.c.votes : null
  const gapPct = a?.c.pct != null && b?.c.pct != null ? a.c.pct - b.c.pct : null
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">{top.map((r) => <TopCard key={r.c.id} r={r} race={race} max={max} />)}</div>
      {gapVotes != null && (
        <p className="num mt-3 text-sm text-muted">{t('race.margin')}: <span className="font-semibold text-ink">{num(gapVotes)} {t('race.votes')}</span>{gapPct != null ? <> · <span className="font-semibold text-ink">{dec(Math.abs(gapPct))} {t('race.pp')}</span></> : null}</p>
      )}
      {rest.length > 0 && (
        <div className="mt-4">
          <p className="eyebrow mb-1">{t('rank.others')}</p>
          <ol className="divide-y divide-line/60">
            {rest.map((r) => (
              <li key={r.c.id} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-x-3 gap-y-1 py-2">
                <span className="num text-sm text-muted">{r.rank != null ? t('rank.n', { n: r.rank }) : '—'}</span>
                <span className="flex min-w-0 flex-wrap items-center gap-x-2"><span className="text-sm">{r.c.name}</span><PartyTag party={r.c.party} original={r.c.partyOriginal} />{r.tied && <span className="text-[10px] uppercase text-amber-300">{t('rank.tied')}</span>}</span>
                <span className="num text-right text-sm"><span className="font-semibold">{pct(r.c.pct)}</span> <span className="ml-1 text-xs text-muted">{num(r.c.votes)}</span></span>
                <span className="col-span-3"><Bar c={r.c} max={max} /></span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <div className="mt-4 space-y-1.5">
        <ReportingBar pct={race.reportingPct} />
        <p className="text-[11px] text-muted">{t('rank.note')} {t('rank.auto')}</p>
      </div>
    </div>
  )
}
