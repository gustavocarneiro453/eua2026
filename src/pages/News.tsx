import { useState } from 'react'
import { useI18n } from '@/i18n'
import type { NewsLang } from '@/services/newsNormalize'
import { NewsAttribution, NewsList } from '@/components/NewsList'
import { PageHeader } from '@/components/PageHeader'
import { cn } from '@/lib/utils'

export default function News() {
  const { t, lang } = useI18n()
  const [feed, setFeed] = useState<NewsLang>(lang)
  return (
    <>
      <PageHeader eyebrow={t('news.latest')} title={t('news.title')} lede={t('news.lede')}>
        <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label={t('news.feedLabel')}>
          {(['pt', 'en'] as const).map((l) => (
            <button key={l} role="tab" aria-selected={feed === l} onClick={() => setFeed(l)}
              className={cn('rounded-full px-3 py-1.5 text-xs font-semibold transition-colors', feed === l ? 'bg-ink text-bg' : 'bg-surface-2 text-muted hover:text-ink')}>{t(`news.feed.${l}`)}</button>
          ))}
        </div>
      </PageHeader>
      <div className="container-x mt-6">
        <NewsList lang={feed} limit={36} columns />
        <p className="mt-8 max-w-3xl border-t border-line pt-4 text-xs leading-relaxed text-muted">{t('news.disclaimer')} <NewsAttribution /></p>
      </div>
    </>
  )
}
