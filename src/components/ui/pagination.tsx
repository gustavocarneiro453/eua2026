import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useI18n } from '@/i18n'
import { cn } from '@/lib/utils'

/** 1 … 4 5 6 … 20 */
function pages(page: number, count: number): (number | '…')[] {
  const set = new Set([1, count, page - 1, page, page + 1].filter((n) => n >= 1 && n <= count))
  const sorted = [...set].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  sorted.forEach((n, i) => { if (i && n - sorted[i - 1] > 1) out.push('…'); out.push(n) })
  return out
}

export function Pagination({ page, pageSize, total, onPage, className }: { page: number; pageSize: number; total: number; onPage: (p: number) => void; className?: string }) {
  const { t, num } = useI18n()
  const count = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const a = (page - 1) * pageSize + 1, b = Math.min(total, page * pageSize)
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40'
  return (
    <nav aria-label={t('page.label')} className={cn('flex flex-col items-center justify-between gap-3 sm:flex-row', className)}>
      <p className="num text-xs text-muted">{t('page.showing', { a: num(a), b: num(b), n: num(total) })}</p>
      {count > 1 && (
        <ul className="flex flex-wrap items-center gap-1">
          <li><button className={cn(btn, 'border-line hover:bg-surface-2')} disabled={page <= 1} onClick={() => onPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /><span className="hidden sm:inline">{t('page.prev')}</span><span className="sr-only sm:hidden">{t('page.prev')}</span></button></li>
          {pages(page, count).map((n, i) => n === '…'
            ? <li key={`e${i}`} className="px-1 text-xs text-muted" aria-hidden>…</li>
            : <li key={n}><button className={cn(btn, n === page ? 'border-accent bg-accent text-white' : 'border-line hover:bg-surface-2')} aria-current={n === page ? 'page' : undefined} aria-label={t('page.go', { n })} onClick={() => onPage(n)}>{n}</button></li>)}
          <li><button className={cn(btn, 'border-line hover:bg-surface-2')} disabled={page >= count} onClick={() => onPage(page + 1)}><span className="hidden sm:inline">{t('page.next')}</span><span className="sr-only sm:hidden">{t('page.next')}</span><ChevronRight className="h-3.5 w-3.5" /></button></li>
        </ul>
      )}
    </nav>
  )
}
