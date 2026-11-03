import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { dict, type DictKey, type Lang } from './dict'
import { GLOSSARY } from './glossary'

const LOCALE: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US' }
const KEY = 'eua2026:lang'

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'en' || q === 'pt') { localStorage.setItem(KEY, q); return q }
    const s = localStorage.getItem(KEY)
    if (s === 'en' || s === 'pt') return s
  } catch { /* ignore */ }
  return 'pt'
}

function makeApi(lang: Lang) {
  const locale = LOCALE[lang]
  const nf = new Intl.NumberFormat(locale)
  const pf = new Intl.NumberFormat(locale, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const dtf = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' })
  const tf = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const df = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const t = (key: DictKey, vars?: Record<string, string | number>) => {
    let s: string = dict[lang][key] ?? key
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
  return {
    lang, locale, t,
    glossary: GLOSSARY[lang],
    /** null/undefined → "—" (missing is never 0) */
    num: (n: number | null | undefined) => (n == null ? '—' : nf.format(n)),
    dec: (n: number) => df.format(n),
    /** input 0–100 */
    pct: (n: number | null | undefined) => (n == null ? '—' : pf.format(n / 100)),
    date: (d: string | number | Date | null | undefined) => (d == null ? '—' : dtf.format(new Date(d))),
    time: (d: string | number | Date) => tf.format(new Date(d)),
    /** 'YYYY-MM-DD' (UTC) → "3 nov." */
    shortDate: (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(iso)),
    longDate: (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso)),
    ago: (ms: number) => {
      const s = Math.round((ms - Date.now()) / 1000)
      if (Math.abs(s) < 60) return rtf.format(s, 'second')
      if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute')
      return rtf.format(Math.round(s / 3600), 'hour')
    },
  }
}

type Api = ReturnType<typeof makeApi> & { setLang: (l: Lang) => void }
const Ctx = createContext<Api | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    document.documentElement.lang = LOCALE[lang]
    document.title = `EUA 2026 — ${dict[lang].headline}`
  }, [lang])
  const api = useMemo(() => ({ ...makeApi(lang), setLang }), [lang, setLang])
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>
}

export function useI18n() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}
export type { Lang, DictKey }
