import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import { useI18n, type Lang } from '@/i18n'
import { useFeed } from '@/hooks/useElections'
import { cn } from '@/lib/utils'
import type { DictKey } from '@/i18n/dict'

const NAV: [string, DictKey][] = [
  ['/', 'nav.overview'], ['/senate', 'nav.senate'], ['/house', 'nav.house'], ['/governors', 'nav.governors'], ['/states', 'nav.states'], ['/learn', 'nav.learn'],
]

export function LiveIndicator() {
  const { t } = useI18n()
  const feed = useFeed()
  const [label, color, pulse] =
    feed.status === 'not_configured' ? [t('live.notConfigured'), 'text-muted', false]
    : feed.stale ? [t('live.stale'), 'text-amber-400', false]
    : feed.status === 'error' ? [t('live.offline'), 'text-amber-400', false]
    : feed.status === 'loading' ? [t('live.loading'), 'text-muted', true]
    : [t('live.live'), 'text-red-500', true]
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]" role="status">
      <span className={cn('relative inline-block h-2 w-2 rounded-full bg-current', color, pulse && 'live-dot')} />
      <span className={feed.status === 'ok' && !feed.stale ? 'text-ink' : 'text-muted'}>{label}</span>
    </span>
  )
}

export function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  const opt = (l: Lang, label: string) => (
    <button onClick={() => setLang(l)} aria-pressed={lang === l} className={cn('px-2 py-1 text-xs font-semibold tracking-wider transition-colors', lang === l ? 'text-ink' : 'text-muted hover:text-ink')}>{label}</button>
  )
  return (
    <div role="group" aria-label={t('lang.label')} className="flex items-center rounded-md border border-line">
      {opt('pt', 'PT')}<span className="h-4 w-px bg-line" />{opt('en', 'EN')}
    </div>
  )
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-7 w-7" aria-hidden><rect width="32" height="32" rx="6" fill="#182438" /><rect x="6" y="8" width="9" height="16" rx="1.5" fill="var(--color-dem)" /><rect x="17" y="8" width="9" height="16" rx="1.5" fill="var(--color-rep)" /></svg>
      <span className="font-serif text-xl font-bold tracking-tight">EUA <span className="text-accent">2026</span></span>
    </Link>
  )
}

export function Layout() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => { setOpen(false); window.scrollTo(0, 0) }, [pathname])
  const link = ({ isActive }: { isActive: boolean }) =>
    cn('relative px-3 py-2 text-sm font-medium transition-colors', isActive ? 'text-ink after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:bg-accent' : 'text-muted hover:text-ink')
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="container-x flex h-14 items-center gap-4">
          <Logo />
          <span className="hidden h-5 w-px bg-line sm:block" />
          <span className="hidden sm:block"><LiveIndicator /></span>
          <nav className="ml-auto hidden items-center lg:flex">
            {NAV.map(([to, k]) => <NavLink key={to} to={to} end={to === '/'} className={link}>{t(k)}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-2">
            <LangSwitch />
            <button className="rounded-md p-2 text-muted hover:text-ink lg:hidden" onClick={() => setOpen((o) => !o)} aria-label={t('nav.menu')} aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="border-t border-line bg-bg lg:hidden">
            <div className="container-x flex flex-col py-2">
              <span className="py-2 sm:hidden"><LiveIndicator /></span>
              {NAV.map(([to, k]) => (
                <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('rounded-md px-2 py-2.5 text-sm', isActive ? 'bg-surface text-ink' : 'text-muted')}>{t(k)}</NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main className="flex-1"><Outlet /></main>
      <footer className="mt-16 border-t border-line">
        <div className="container-x flex flex-col gap-3 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><Logo /><span className="max-w-md">{t('footer.note')}</span></div>
          <span>{t('footer.rights')}</span>
        </div>
      </footer>
    </div>
  )
}
