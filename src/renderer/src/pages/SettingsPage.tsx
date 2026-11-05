import { useEffect, useState } from 'react'
import type { Accent, AppData, GoogleStatus, ThemeMode } from '@shared/types'
import { FIELD } from '@/lib/constants'
import { useI18n } from '@/lib/i18n'

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  onToast: (msg: string) => void
}

const ACCENTS: { id: Accent; color: string }[] = [
  { id: 'indigo', color: '#5558ee' },
  { id: 'blue', color: '#2f7de1' },
  { id: 'purple', color: '#8052e8' },
  { id: 'green', color: '#14a360' },
  { id: 'rose', color: '#e0356f' }
]
const THEMES: ThemeMode[] = ['system', 'light', 'dark']
const ICON: Record<ThemeMode, string> = { system: '🖥️', light: '☀️', dark: '🌙' }

export default function SettingsPage({ data, update, onToast }: Props): React.JSX.Element {
  const { t, languages, reload } = useI18n()
  const [autostart, setAutostart] = useState(false)
  const [g, setG] = useState<GoogleStatus | null>(null)
  const [gForm, setGForm] = useState({ clientId: '', clientSecret: '' })
  const [busy, setBusy] = useState('')
  useEffect(() => {
    void window.api.getAutostart().then(setAutostart)
    void window.api.googleStatus().then((s) => {
      setG(s)
      setGForm((f) => ({ ...f, clientId: s.clientId }))
    })
  }, [])

  const run = async (name: string, fn: () => Promise<{ message: string } | void>): Promise<void> => {
    setBusy(name)
    try {
      const r = await fn()
      if (r) onToast(r.message)
    } finally {
      setBusy('')
      setG(await window.api.googleStatus())
    }
  }
  const saveGoogle = (auto = g?.auto ?? true): Promise<GoogleStatus> =>
    window.api.googleSetConfig({ clientId: gForm.clientId, clientSecret: gForm.clientSecret || undefined, auto })

  const btn = 'rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover disabled:opacity-50'
  const toggle = (label: string, hint: string, on: boolean, set: (v: boolean) => void): React.JSX.Element => (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5">
      <div>
        <div className="font-semibold">{label}</div>
        <div className="text-sm text-muted">{hint}</div>
      </div>
      <input type="checkbox" className="h-5 w-5 shrink-0" checked={on} onChange={(e) => set(e.target.checked)} />
    </label>
  )

  const set = (patch: Partial<AppData['settings']>): void =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const card = 'mb-4 card p-5'
  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto pr-1">
      <h1 className="mb-5 text-3xl font-bold">{t('settings.title')}</h1>

      <section className={card}>
        <div className="mb-2 font-semibold">{t('settings.theme')}</div>
        <div className="flex gap-2">
          {THEMES.map((m) => (
            <button
              key={m}
              onClick={() => set({ theme: m })}
              className={`flex-1 rounded-xl px-3 py-3 text-sm ${
                data.settings.theme === m ? 'bg-accent font-semibold text-white' : 'border border-line text-soft hover:bg-hover'
              }`}
            >
              {ICON[m]} {t(`theme.${m}`)}
            </button>
          ))}
        </div>
      </section>

      <section className={card}>
        <div className="mb-3 font-semibold">🎨 {t('settings.accent')}</div>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => {
            const on = (data.settings.accent ?? 'indigo') === a.id
            return (
              <button
                key={a.id}
                onClick={() => set({ accent: a.id })}
                title={t(`accent.${a.id}`)}
                className={`flex flex-col items-center gap-1.5 rounded-xl px-3 py-2 text-xs transition ${
                  on ? 'bg-hover font-semibold text-ink' : 'text-muted hover:bg-hover'
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-white shadow ${on ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''}`}
                  style={{ background: a.color, ['--tw-ring-color' as string]: a.color }}
                >
                  {on ? '✓' : ''}
                </span>
                {t(`accent.${a.id}`)}
              </button>
            )
          })}
        </div>
        <div className="mt-2 border-t border-line pt-2">
          {toggle(t('settings.sidebarAccent'), t('settings.sidebarAccentHint'), data.settings.sidebarStyle === 'accent', (v) =>
            set({ sidebarStyle: v ? 'accent' : 'plain' })
          )}
        </div>
      </section>

      <section className={card}>
        <div className="mb-2 font-semibold">{t('settings.language')}</div>
        <select className={FIELD} value={data.settings.lang} onChange={(e) => set({ lang: e.target.value })}>
          {languages.map((l) => (
            <option key={l.code} value={l.code}>
              {l.name} ({l.code})
            </option>
          ))}
        </select>
        <p className="mt-2 text-sm text-muted">{t('settings.languageHint')}</p>
        <div className="mt-3 flex gap-2">
          <button onClick={() => void window.api.openLocalesFolder()} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            📂 {t('settings.openLocales')}
          </button>
          <button onClick={reload} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            ⟳ {t('settings.reloadLocales')}
          </button>
        </div>
      </section>

      <section className={card}>
        <label className="flex cursor-pointer items-center justify-between">
          <div>
            <div className="font-semibold">{t('settings.autostart')}</div>
            <div className="text-sm text-muted">{t('settings.autostartHint')}</div>
          </div>
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={autostart}
            onChange={(e) => void window.api.setAutostart(e.target.checked).then(setAutostart)}
          />
        </label>
      </section>

      <section className={card}>
        <div className="mb-2 font-semibold">🎓 {t('exam.settingTitle')}</div>
        <div className="flex gap-2">
          <input className={FIELD} placeholder={t('exam.namePh')} value={data.settings.examTitle ?? ''} onChange={(e) => set({ examTitle: e.target.value || undefined })} />
          <input type="date" className={`${FIELD} !w-48`} value={data.settings.examDate ?? ''} onChange={(e) => set({ examDate: e.target.value || undefined })} />
        </div>
      </section>

      <section className={card}>
        <div className="mb-1 font-semibold">▶ {t('join.title')}</div>
        {toggle(t('join.inApp'), t('join.inAppHint'), data.settings.joinInApp, (v) => set({ joinInApp: v }))}
        {toggle(t('join.meetInApp'), t('join.meetInAppHint'), data.settings.meetInApp, (v) => set({ meetInApp: v }))}
        {toggle(t('join.focus'), t('join.focusHint'), data.settings.focusOnJoin, (v) => set({ focusOnJoin: v }))}
      </section>

      <section className={card}>
        <div className="mb-1 font-semibold">⟳ {t('sync.daymaiTitle')}</div>
        <p className="mb-3 text-sm text-muted">{t('sync.daymaiHint')}</p>
        <button className={btn} disabled={busy === 'daymai'} onClick={() => void run('daymai', () => window.api.syncDaymai())}>
          {busy === 'daymai' ? t('tasks.syncing') : t('tasks.sync')}
        </button>
      </section>

      <section className={card}>
        <div className="mb-1 font-semibold">📱 {t('google.title')}</div>
        <p className="mb-3 text-sm text-muted">{t('google.hint')}</p>

        {g?.connected ? (
          <>
            <div className="mb-2 text-sm text-ok">● {t('google.connected')}</div>
            {g.lastSync && <div className="text-xs text-muted">{t('google.lastSync', { time: new Date(g.lastSync).toLocaleString() })}</div>}
            {toggle(t('google.auto'), t('google.autoHint'), g.auto, (v) => void saveGoogle(v).then(setG))}
            <div className="mt-2 flex flex-wrap gap-2">
              <button className={btn} disabled={!!busy} onClick={() => void run('gsync', () => window.api.googleSync())}>
                {busy === 'gsync' ? t('tasks.syncing') : `⟳ ${t('google.syncNow')}`}
              </button>
              <button className={`${btn} !border-bad/50 !text-bad`} disabled={!!busy} onClick={() => void run('gdis', async () => void (await window.api.googleDisconnect()))}>
                {t('google.disconnect')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-2 flex flex-col gap-2">
              <input className={FIELD} placeholder="Client ID" value={gForm.clientId} onChange={(e) => setGForm({ ...gForm, clientId: e.target.value })} />
              <input
                type="password"
                autoComplete="off"
                className={FIELD}
                placeholder={g?.hasSecret ? t('acc.keepPassword') : 'Client secret'}
                value={gForm.clientSecret}
                onChange={(e) => setGForm({ ...gForm, clientSecret: e.target.value })}
              />
            </div>
            <button
              className={`${btn} !bg-accent font-semibold !text-white`}
              disabled={!gForm.clientId.trim() || !!busy}
              onClick={() =>
                void run('gcon', async () => {
                  await saveGoogle()
                  setGForm((f) => ({ ...f, clientSecret: '' }))
                  const s = await window.api.googleConnect()
                  return { message: s.connected ? t('google.connectedToast') : s.lastError ?? t('google.failed') }
                })
              }
            >
              {busy === 'gcon' ? t('google.waiting') : t('google.connect')}
            </button>
            {g?.lastError && <div className="mt-2 text-sm text-bad">⚠ {g.lastError}</div>}
            <details className="mt-3 text-sm text-soft">
              <summary className="cursor-pointer font-semibold">{t('google.guideTitle')}</summary>
              <div className="mt-2 whitespace-pre-line">{t('google.guide')}</div>
            </details>
          </>
        )}
        {g?.connected && g.lastError && <div className="mt-2 text-sm text-bad">⚠ {g.lastError}</div>}

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-1 text-sm font-semibold">{t('ics.title')}</div>
          <p className="mb-2 text-sm text-muted">{t('ics.hint')}</p>
          <button
            className={btn}
            onClick={() => void window.api.exportIcs().then((p) => p && onToast(t('ics.saved', { path: p })))}
          >
            📄 {t('ics.export')}
          </button>
        </div>
      </section>

      <section className={`${card} text-sm text-soft`}>
        <div className="mb-1 font-semibold">{t('settings.zoomTitle')}</div>
        {t('settings.zoomBody')}
      </section>
    </div>
  )
}
