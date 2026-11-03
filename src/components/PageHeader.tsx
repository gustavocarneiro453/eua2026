import type { ReactNode } from 'react'
export function PageHeader({ eyebrow, title, lede, children }: { eyebrow?: ReactNode; title: ReactNode; lede?: ReactNode; children?: ReactNode }) {
  return (
    <section className="border-b border-line">
      <div className="container-x py-8 sm:py-10">
        {eyebrow && <p className="eyebrow flex items-center gap-2">{eyebrow}</p>}
        <h1 className="mt-2 flex items-center gap-2 font-serif text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
        {lede && <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink/80">{lede}</p>}
        {children}
      </div>
    </section>
  )
}
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none sm:w-64" />
  )
}
