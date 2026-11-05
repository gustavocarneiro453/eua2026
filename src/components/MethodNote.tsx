import { Info } from 'lucide-react'
import { useI18n } from '@/i18n'
import { useFeed } from '@/hooks/useElections'
import type { Office } from '@/services/types'
import type { DictKey } from '@/i18n/dict'

/** "How these results are calculated and shown", per office, with the live origin and last update of the data. */
export function MethodNote({ office, open }: { office: Office; open?: boolean }) {
  const { t, date } = useI18n()
  const feed = useFeed()
  const keys = [1, 2, 3, 4, 5, 6].map((n) => `how.${office}.${n}` as DictKey)
  return (
    <details open={open} className="group rounded-xl border border-line bg-surface p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium"><Info className="h-4 w-4 text-accent" />{t('how.title')}</summary>
      <ul className="mt-3 space-y-2 leading-relaxed text-ink/85">
        {keys.map((k) => <li key={k} className="border-l-2 border-accent/50 pl-3">{t(k)}</li>)}
        <li className="border-l-2 border-accent/50 pl-3">{t('how.origin')}{' '}
          <span className="num text-muted">{feed.lastSuccessAt ? t('how.lastCheck', { t: date(feed.lastSuccessAt) }) : t('how.noCheck')}{feed.snapshot?.generatedAt ? ` · ${t('how.sourceTime', { t: date(feed.snapshot.generatedAt) })}` : ''}</span></li>
      </ul>
    </details>
  )
}
