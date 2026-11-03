import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const button = cva('inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none', {
  variants: {
    variant: {
      default: 'bg-accent text-white hover:bg-blue-500',
      ghost: 'text-muted hover:text-ink hover:bg-surface-2',
      outline: 'border border-line text-ink hover:bg-surface-2',
    },
    size: { sm: 'h-8 px-3', md: 'h-9 px-4', icon: 'h-9 w-9' },
  },
  defaultVariants: { variant: 'default', size: 'md' },
})

export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button>>(
  ({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />,
)
Button.displayName = 'Button'
