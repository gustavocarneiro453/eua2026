import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { useI18n } from '@/i18n'
import { usePolls } from '@/services/polls'
import type { Poll, PollKind } from '@/services/pollsNormalize'
import { VOTEHUB_SITE } from '@/services/pollsNormalize'
import { PARTY_COLOR } from '@/lib/race'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

const GENERIC_COLOR: Record<string, string> = { Dem: PARTY_COLOR.DEM, Rep: PARTY_COLOR.REP }

function PollRow({ p, answers = 3 }: { p: Poll; answers?: number }) {
  const { t, shortDate, num, pct } = useI18n()
  const pop = p.population && ['lv', 'rv', 'a'].includes(p.population) ? t(`polls.pop.${p.population}` as DictKey) : p.population
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium">{p.pollster}</p>
        <p className="num text-[11px] text-muted">
          {p.startDate && p.startDate !== p.endDate ? `${shortDate(p.startDate)}–${shortDate(p.endDate)}` : shortDate(p.endDate)}
          {pop ? ` · ${pop}` : ''}{p.sampleSize ? ` · ${t('polls.sample', { n: num(p.sampleSize) })}` : ''}
        </p>
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
        {p.answers.slice(0, answers).map((a) => (
          <li key={a.choice} className="inline-flex items-center gap-1.5 text-sm">
            <span className="h-2 w-2 rounded-full" style={{ background: GENERIC_COLOR[a.choice] ?? 'var(--color-muted)' }} />
            <span className="text-ink/90">{p.kind === 'generic' ? t(a.choice === 'Dem' ? 'party.DEM' : a.choice === 'Rep' ? 'party.REP' : ('party.OTH' as DictKey)) : a.choice}</span>
            <span className="num font-semibold">{pct(a.pct)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {p.internal && <Badge variant="warn">{t('polls.internal')}</Badge>}
        {p.partisan && <Badge variant="warn">{t(`polls.partisan.${p.partisan}` as DictKey)}</Badge>}
        {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline">{t('polls.original')}<ExternalLink className="h-3 w-3" /></a>}
      </div>
    </li>
  )
}

export function PollsAttribution({ className }: { className?: string }) {
  const { t } = useI18n()
  return <a href={VOTEHUB_SITE} target="_blank" rel="noreferrer" className={cn('hover:text-ink hover:underline', className)}>{t('polls.source')}</a>
}

/** Recent polls for one race (or the generic ballot). Polls are labeled as polls, never as results. */
export function PollsBlock({ kind, state = null, district = null, limit = 3, expandable = false, hideEmpty = false, title = true, footer = true }: {
  kind: PollKind; state?: string | null; district?: number | null; limit?: number; expandable?: boolean; hideEmpty?: boolean; title?: boolean; footer?: boolean
}) {
  const { t, time } = useI18n()
  const polls = usePolls()
  const [all, setAll] = useState(false)
  const list = polls.forRace(kind, state, district)
  const shown = all ? list : list.slice(0, limit)
  // Compact uses (hideEmpty) show nothing until polls exist for this race: no skeletons or empty notes per row.
  if (hideEmpty && !list.length) return null
  return (
    <section aria-label={t('polls.title')}>
      {title && <h4 className="eyebrow mb-2">{t('polls.title')}</h4>}
      {polls.status === 'loading' && !polls.data && <div className="h-16 animate-pulse rounded-lg bg-surface-2" aria-busy="true" aria-label={t('polls.loading')} />}
      {polls.status === 'error' && !polls.data && <p className="text-xs text-amber-300">{t('polls.error')}</p>}
      {polls.data && !list.length && <p className="text-xs leading-relaxed text-muted">{t('polls.empty')}</p>}
      {shown.length > 0 && <ul className="divide-y divide-line/60">{shown.map((p) => <PollRow key={p.id} p={p} answers={kind === 'generic' ? 2 : 3} />)}</ul>}
      {expandable && list.length > limit && (
        <button onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-accent hover:underline">{all ? t('polls.less') : t('polls.more', { n: list.length - limit })}</button>
      )}
      {polls.data && footer && <p className="mt-2 text-[11px] leading-relaxed text-muted">{t('polls.updated', { t: time(polls.data.fetchedAt) })} · <PollsAttribution /></p>}
    </section>
  )
}
