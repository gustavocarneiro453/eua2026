import { Info } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useI18n } from '@/i18n'
import type { TermKey } from '@/i18n/glossary'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export function InfoTip({ term, className }: { term: TermKey; className?: string }) {
  const { glossary, t } = useI18n()
  const g = glossary[term]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link to={`/learn#${term}`} aria-label={t('info.label', { term: g.term })} className={cn('inline-flex text-muted hover:text-accent align-middle', className)}>
          <Info className="h-3.5 w-3.5" />
        </Link>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-semibold">{g.term}</p>
        <p className="mt-1 text-muted">{g.short}</p>
      </TooltipContent>
    </Tooltip>
  )
}
