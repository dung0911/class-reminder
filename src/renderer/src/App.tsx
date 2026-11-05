import { useEffect, useState } from 'react'
import type { AppData, ClassEvent } from '@shared/types'
import { useData, useNow, useTheme } from '@/lib/useData'
import { I18nProvider, useT } from '@/lib/i18n'
import Sidebar, { type Page } from '@/components/Sidebar'
import TitleBar from '@/components/TitleBar'
import ClassDialog from '@/components/ClassDialog'
import SessionDialog from '@/components/SessionDialog'
import CalendarPage from '@/pages/CalendarPage'
import CoursesPage from '@/pages/CoursesPage'
import DashboardPage from '@/pages/DashboardPage'
import AccountsPage from '@/pages/AccountsPage'
import SettingsPage from '@/pages/SettingsPage'
import TasksPage from '@/pages/TasksPage'
import QuickAdd from '@/components/QuickAdd'
import { upcomingExams } from '@shared/extras'

export default function App(): React.JSX.Element | null {
  const { data, update } = useData()
  useTheme(data?.settings.theme ?? 'system', data?.settings.accent)
  if (!data) return null
  return (
    <I18nProvider lang={data.settings.lang}>
      <Shell data={data} update={update} />
    </I18nProvider>
  )
}

interface ShellProps {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
}

function Shell({ data, update }: ShellProps): React.JSX.Element {
  const t = useT()
  const [page, setPage] = useState<Page>('calendar')
  const [editing, setEditing] = useState<ClassEvent | 'new' | null>(null)
  const [draft, setDraft] = useState<Partial<ClassEvent> | null>(null) // điền sẵn khi thêm lớp từ ô trống trên lịch
  const [filter, setFilter] = useState('all') // lớp đang lọc trên trang Lịch
  const [quick, setQuick] = useState<{ date: Date; hour: number; x: number; y: number } | null>(null) // khung thêm nhanh
  const [session, setSession] = useState<{ id: string; date: Date } | null>(null)
  const [toast, setToast] = useState('')
  const now = useNow(15_000)
  const nextExam = upcomingExams(data, now)[0]

  // Esc đóng hộp thoại đang mở (buổi học, thêm/sửa lớp); khung thêm nhanh tự xử lý Esc riêng
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      setSession(null)
      setEditing(null)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])

  // Cửa sổ hẹp (dưới 1100 px) thì tự thu nhỏ thanh bên để lịch còn chỗ; không đổi cài đặt của bạn
  const [narrow, setNarrow] = useState(() => window.innerWidth < 1100)
  useEffect(() => {
    const on = (): void => setNarrow(window.innerWidth < 1100)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const showToast = (msg: string): void => {
    setToast(msg)
    setTimeout(() => setToast(''), 4000)
  }
  useEffect(() => window.api.onToast(showToast), [])

  const setSettings = (patch: Partial<AppData['settings']>): void =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  const saveEvent = (ev: ClassEvent): void =>
    update((d) => ({
      ...d,
      events: d.events.some((e) => e.id === ev.id) ? d.events.map((e) => (e.id === ev.id ? ev : e)) : [...d.events, ev]
    }))
  const deleteEvent = (id: string): void => update((d) => ({ ...d, events: d.events.filter((e) => e.id !== id) }))

  const onSelect = (ev: ClassEvent, date: Date): void => setSession({ id: ev.id, date })
  const sessionEv = session ? data.events.find((e) => e.id === session.id) : undefined

  return (
    <div className="app-bg flex h-full flex-col">
      <TitleBar
        theme={data.settings.theme}
        lang={data.settings.lang}
        onToggleSidebar={() => setSettings({ sidebarCollapsed: !data.settings.sidebarCollapsed })}
        onTheme={(theme) => setSettings({ theme })}
        onLang={(lang) => setSettings({ lang })}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          page={page}
          collapsed={data.settings.sidebarCollapsed || narrow}
          tinted={data.settings.sidebarStyle === 'accent'}
          userName={data.accounts.find((a) => a.fullName)?.fullName ?? ''}
          classes={data.events.map((e) => ({ id: e.id, title: e.title, color: e.color }))}
          filter={filter}
          onPickClass={(id) => {
            setFilter(filter === id && page === 'calendar' ? 'all' : id)
            setPage('calendar')
          }}
          exam={nextExam ? { title: nextExam.title || t('exam.default'), days: nextExam.days } : undefined}
          openTasks={data.tasks.filter((x) => !x.done).length}
          onPage={setPage}
          onToggle={() => setSettings({ sidebarCollapsed: !data.settings.sidebarCollapsed })}
        />
        <main className="min-w-0 flex-1 overflow-hidden p-6">
          {page === 'calendar' && (
            <CalendarPage
              data={data}
              update={update}
              filter={filter}
              onFilter={setFilter}
              onSelect={onSelect}
              onAdd={() => {
                setDraft(null)
                setEditing('new')
              }}
              onSlot={(date, hour, x, y) => setQuick({ date, hour, x, y })}
            />
          )}
          {page === 'courses' && (
            <CoursesPage
              data={data}
              onEdit={setEditing}
              onAdd={() => {
                setDraft(null)
                setEditing('new')
              }}
            />
          )}
          {page === 'tasks' && <TasksPage data={data} update={update} onToast={showToast} />}
          {page === 'dashboard' && <DashboardPage data={data} update={update} onSelect={onSelect} />}
          {page === 'accounts' && <AccountsPage data={data} update={update} onToast={showToast} />}
          {page === 'settings' && <SettingsPage data={data} update={update} onToast={showToast} />}
        </main>
      </div>

      {sessionEv && session && (
        <SessionDialog
          ev={sessionEv}
          date={session.date}
          now={now}
          update={update}
          onEdit={(ev) => {
            setSession(null)
            setEditing(ev)
          }}
          onClose={() => setSession(null)}
        />
      )}

      {quick && (
        <QuickAdd
          date={quick.date}
          hour={quick.hour}
          x={quick.x}
          y={quick.y}
          onSave={(ev) => {
            saveEvent(ev)
            setQuick(null)
            showToast(t('quick.saved', { title: ev.title }))
          }}
          onMore={(d) => {
            setDraft(d)
            setQuick(null)
            setEditing('new')
          }}
          onClose={() => setQuick(null)}
        />
      )}

      {editing && (
        <ClassDialog
          initial={editing === 'new' ? null : editing}
          draft={editing === 'new' ? draft : null}
          sites={data.sites}
          onSave={(ev) => {
            saveEvent(ev)
            setEditing(null)
          }}
          onDelete={(id) => {
            deleteEvent(id)
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
