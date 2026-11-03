import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badge = cva('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap', {
  variants: {
    variant: {
      neutral: 'bg-surface-2 text-muted ring-1 ring-line',
      live: 'bg-dem/15 text-red-300 ring-1 ring-dem/40',
      success: 'bg-success/15 text-green-300 ring-1 ring-success/40',
      warn: 'bg-warn/15 text-amber-300 ring-1 ring-warn/40',
      accent: 'bg-accent/15 text-blue-300 ring-1 ring-accent/40',
      demo: 'bg-amber-400 text-black',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ variant }), className)} {...props} />
}
