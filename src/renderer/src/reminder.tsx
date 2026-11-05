import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { I18nBundle } from '@shared/types'
import './assets/main.css'

interface Info {
  title: string
  time: string
  hasUrl: boolean
}

function Reminder(): React.JSX.Element {
  const [info, setInfo] = useState<Info | null>(null)
  const [bundle, setBundle] = useState<I18nBundle | null>(null)

  useEffect(() => {
    void window.api.reminderInfo().then(async (i) => {
      if (!i) return
      setBundle(await window.api.i18nLoad(i.lang))
      setInfo(i)
    })
  }, [])

  const t = (k: string, v?: Record<string, string>): string => {
    let s = bundle?.dict[k] ?? ''
    for (const [a, b] of Object.entries(v ?? {})) s = s.split(`{${a}}`).join(b)
    return s
  }
  const act = (a: 'join' | 'snooze' | 'dismiss') => () => void window.api.reminderAction(a)

  return (
    <div
      className="flex h-screen flex-col gap-1 rounded-xl border-2 border-indigo-500 bg-[#161735] p-4 text-white"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="text-xs text-indigo-300">📚 {t('reminder.title')}</div>
      <div className="text-xl font-bold">{info?.title}</div>
      <div className="text-sm text-slate-300">{info && t('reminder.startAt', { time: info.time })}</div>
      <div className="min-h-4 text-xs text-rose-300">{info && !info.hasUrl && `⚠ ${t('reminder.noLink')}`}</div>
      <div className="mt-auto flex gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={act('join')} className="flex-1 rounded-lg bg-indigo-500 px-3 py-2 font-bold hover:bg-indigo-400">
          {t('reminder.join')}
        </button>
        <button onClick={act('snooze')} className="rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600">
          {t('reminder.snooze')}
        </button>
        <button onClick={act('dismiss')} className="rounded-lg bg-slate-700 px-3 py-2 hover:bg-slate-600">
          {t('reminder.dismiss')}
        </button>
      </div>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Reminder />
  </StrictMode>
)
