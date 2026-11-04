import { useEffect, useState } from 'react'
import { initials } from '@/services/logoMatch'
import { logoImageUrl, useLogoConfig } from '@/services/logos'
import type { AdLogo } from '@/services/auction'
import { cn } from '@/lib/utils'

/** Deterministic, calm background for the monogram (same name → same color). */
function hue(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360; return h }

export function Monogram({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-md font-semibold text-white', className)}
      style={{ width: size, height: size, background: `hsl(${hue(name)} 38% 34%)`, fontSize: Math.round(size * 0.4) }}>{initials(name)}</span>
  )
}

/**
 * The company's logo on a light tile (keeps its original colors and proportions on the dark UI). Never a broken image:
 * with no logo, an unconfigured source, or an image that fails to load, it shows a monogram of the company's initials.
 */
export function CompanyLogo({ name, logo, size = 32, className }: { name: string; logo: AdLogo | null; size?: number; className?: string }) {
  const cfg = useLogoConfig()
  const url = logo ? logoImageUrl(logo.src, logo.domain, cfg, size) : null
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [url])
  if (!url || failed) return <Monogram name={name} size={size} className={className} />
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-white p-[3px]', className)} style={{ width: size, height: size }}>
      <img src={url} alt={name} width={size} height={size} loading="lazy" decoding="async" referrerPolicy="strict-origin-when-cross-origin"
        onError={() => setFailed(true)} className="max-h-full max-w-full object-contain" />
    </span>
  )
}
