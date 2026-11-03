import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react'
import { useI18n } from '@/i18n'
import { NEWS_STALE_MS, retryNews, useNews } from '@/services/news'
import { GDELT_SITE, type NewsLang } from '@/services/newsNormalize'
import { cn } from '@/lib/utils'

export function NewsAttribution({ className }: { className?: string }) {
  const { t } = useI18n()
  return <a href={GDELT_SITE} target="_blank" rel="noreferrer" className={cn('hover:text-ink hover:underline', className)}>{t('news.source')}</a>
}

export function NewsList({ lang, limit, columns = false }: { lang: NewsLang; limit: number; columns?: boolean }) {
  const { t, time, ago } = useI18n()
  const news = useNews(lang)
  const items = news.payload?.items.slice(0, limit) ?? []
  const stale = !!news.lastSuccessAt && Date.now() - news.lastSuccessAt > NEWS_STALE_MS
  // The source's own index can stall even when our fetch succeeds: warn when the newest headline is old.
  const lagH = news.payload?.items[0] ? Math.floor((Date.now() - Date.parse(news.payload.items[0].seenAt)) / 3_600_000) : 0

  return (
    <div>
      {news.status === 'error' && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-warn/15 px-3 py-2 text-xs text-amber-200">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>{t('news.error')}{news.lastSuccessAt ? ` ${t('news.errorStale', { t: time(news.lastSuccessAt) })}` : ''}</span>
          <button onClick={() => retryNews(lang)} className="ml-auto inline-flex items-center gap-1 font-semibold hover:text-white"><RefreshCw className="h-3 w-3" />{t('news.retry')}</button>
        </div>
      )}
      {news.status !== 'error' && stale && news.lastSuccessAt && <p className="mb-3 text-xs text-amber-300">{t('news.staleWarn', { t: time(news.lastSuccessAt) })}</p>}

      {lagH >= 3 && <p className="mb-3 rounded-lg bg-warn/15 px-3 py-2 text-xs leading-relaxed text-amber-200">{t('news.lagWarn', { h: lagH })}</p>}
      {!items.length && news.status === 'loading' && (
        <ul className={cn('grid gap-3', columns && 'sm:grid-cols-2 lg:grid-cols-3')} aria-busy="true" aria-label={t('news.loading')}>
          {Array.from({ length: Math.min(limit, 6) }, (_, i) => <li key={i} className="h-24 animate-pulse rounded-xl border border-line bg-surface" />)}
        </ul>
      )}
      {!items.length && news.status === 'ok' && <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{t('news.empty')}</p>}

      {items.length > 0 && (
        <ul className={cn('grid gap-3', columns && 'sm:grid-cols-2 lg:grid-cols-3')}>
          {items.map((n) => (
            <li key={n.id}>
              <a href={n.url} target="_blank" rel="noopener noreferrer" className="group flex h-full flex-col rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
                <p className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wider text-muted">
                  <span className="truncate font-semibold">{n.domain}</span>
                  <span className="num shrink-0" title={`${t('news.seenAt')} ${new Date(n.seenAt).toLocaleString()}`}>{ago(Date.parse(n.seenAt))}</span>
                </p>
                <p className="mt-2 font-serif text-lg font-semibold leading-snug group-hover:text-accent">{n.title}</p>
                <span className="mt-auto inline-flex items-center gap-1 pt-3 text-[11px] text-muted"><ExternalLink className="h-3 w-3" />{t('news.opensNew')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {news.payload && (
        <p className="mt-3 text-[11px] text-muted">{t('news.updated', { t: time(news.payload.fetchedAt) })} · <NewsAttribution /></p>
      )}
    </div>
  )
}
