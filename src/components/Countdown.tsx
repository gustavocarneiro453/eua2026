import { Activity, Clock } from 'lucide-react'
import { useI18n } from '@/i18n'
import { COUNTDOWN_SOURCE_URL, formatCountdown } from '@/config/election'
import { useCountdown } from '@/services/countdown'
import { useFeed } from '@/hooks/useElections'
import { cn } from '@/lib/utils'

/** After the countdown ends: what the page is doing and what the sources have published so far. */
export function PhaseStrip({ className }: { className?: string }) {
  const { t, time } = useI18n()
  const feed = useFeed()
  const withVotes = feed.snapshot?.races.filter((r) => r.status !== 'no_data').length ?? 0
  const [msg, tone] =
    feed.status === 'error' && !feed.snapshot ? [t('phase.error'), 'warn']
    : !feed.snapshot ? [t('phase.loading'), 'wait']
    : withVotes === 0 ? [t('phase.waiting'), 'wait']
    : feed.snapshot.sourceState === 'final' ? [t('phase.final'), 'ok']
    : [t('phase.counting', { n: withVotes, t: time(feed.lastSuccessAt ?? Date.now()) }), 'ok']
  return (
    <div role="status" aria-live="polite" className={cn('flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm leading-relaxed', tone === 'ok' ? 'border-success/40 bg-success/10 text-green-100' : tone === 'warn' ? 'border-warn/40 bg-warn/10 text-amber-100' : 'border-line bg-surface/70 text-ink/90', className)}>
      <Activity className="mt-0.5 h-4 w-4 shrink-0" />
      <div><p>{msg}</p><p className="mt-0.5 text-xs text-muted">{t('phase.partial')}</p></div>
    </div>
  )
}

/** Countdown to the expected start of the count, as HH:MM:SS. It ends by itself and then shows the phase strip. */
export function Countdown({ className }: { className?: string }) {
  const { t, locale } = useI18n()
  const c = useCountdown()
  // Reserve the space while the server time is being read: no layout jump, no wrong countdown flash.
  if (!c.ready) return <div className={cn('h-[148px]', className)} aria-hidden />
  if (c.phase === 'started') return <PhaseStrip className={className} />
  const zone = (timeZone: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(c.targetMs))
  const h = Math.floor(c.remainingMs / 3_600_000), m = Math.floor((c.remainingMs % 3_600_000) / 60_000)
  return (
    <section aria-label={t('cd.label')} className={cn('inline-block max-w-full rounded-xl border border-line bg-surface/70 px-5 py-4', className)}>
      <p className="eyebrow flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{t('cd.label')}</p>
      <p role="timer" aria-label={t('cd.sr', { h, m })} className="num mt-1 font-mono text-5xl font-medium leading-none tracking-tight text-ink sm:text-6xl">{formatCountdown(c.remainingMs)}</p>
      <p className="mt-2 text-sm text-ink/85">{t('cd.target', { ny: zone('America/New_York'), br: zone('America/Sao_Paulo') })}</p>
      <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
        {c.source === 'configured' ? t('cd.sourceConfigured') : <>{t('cd.sourceDefault')} <a href={COUNTDOWN_SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-ink">CBS News</a>.</>} {t('cd.note')}
      </p>
    </section>
  )
}
