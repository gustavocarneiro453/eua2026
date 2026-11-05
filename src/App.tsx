import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { I18nProvider } from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Layout } from '@/components/Layout'
import { holdFeed, startFeed } from '@/services/elections'
import { initCountdown, onBefore, onStarted } from '@/services/countdown'
import Overview from '@/pages/Overview'

const Senate = lazy(() => import('@/pages/Senate'))
const House = lazy(() => import('@/pages/House'))
const Governors = lazy(() => import('@/pages/Governors'))
const States = lazy(() => import('@/pages/States').then((m) => ({ default: m.StatesIndex })))
const StateDetail = lazy(() => import('@/pages/States').then((m) => ({ default: m.StateDetail })))
const Learn = lazy(() => import('@/pages/Learn'))
const News = lazy(() => import('@/pages/News'))

export default function App() {
  // Results are only requested once the countdown has ended (the target comes from /api/config).
  useEffect(() => {
    const offBefore = onBefore(holdFeed), offStart = onStarted(startFeed)
    initCountdown()
    return () => { offBefore(); offStart() }
  }, [])
  return (
    <I18nProvider>
      <TooltipProvider delayDuration={150}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Suspense fallback={<div className="container-x py-16" />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Overview />} />
                <Route path="senate" element={<Senate />} />
                <Route path="house" element={<House />} />
                <Route path="governors" element={<Governors />} />
                <Route path="states" element={<States />} />
                <Route path="states/:code" element={<StateDetail />} />
                <Route path="learn" element={<Learn />} />
                <Route path="news" element={<News />} />
                <Route path="*" element={<Overview />} />
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </I18nProvider>
  )
}
