import { useState } from 'react'
import type { AppData, Task } from '@shared/types'
import { vnDate } from '@shared/schedule'
import { FIELD } from '@/lib/constants'
import { useNow } from '@/lib/useData'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  onToast: (msg: string) => void
}

const fmtDue = (due: string): string => `${due.slice(11, 16)} ${vnDate(due.slice(0, 10))}`

/** Bài tập, bài thi cần nộp: tự lấy từ Daymai hoặc tự thêm (Azota...). App nhắc trước hạn 1 ngày và 2 giờ. */
export default function TasksPage({ data, update, onToast }: Props): React.JSX.Element {
  const t = useT()
  const now = useNow(60_000)
  const [form, setForm] = useState({ title: '', due: '', eventId: '', url: '' })
  const [syncing, setSyncing] = useState(false)

  const add = (): void => {
    if (!form.title.trim()) return
    const task: Task = {
      id: `t${Date.now().toString(36)}`,
      title: form.title.trim(),
      due: form.due || undefined,
      eventId: form.eventId || undefined,
      url: form.url.trim() || undefined,
      done: false,
      source: 'manual'
    }
    update((d) => ({ ...d, tasks: [...d.tasks, task] }))
    setForm({ title: '', due: '', eventId: '', url: '' })
  }
  const patch = (id: string, p: Partial<Task>): void =>
    update((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === id ? { ...x, ...p } : x)) }))

  const sync = async (): Promise<void> => {
    setSyncing(true)
    const r = await window.api.syncDaymai()
    setSyncing(false)
    onToast(r.message)
  }

  const byDue = (a: Task, b: Task): number => (a.due ?? '9999').localeCompare(b.due ?? '9999')
  const open = data.tasks.filter((x) => !x.done).sort(byDue)
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const overdue = open.filter((x) => x.due && x.due < nowKey)
  const upcoming = open.filter((x) => !x.due || x.due >= nowKey)
  const done = data.tasks.filter((x) => x.done).sort(byDue).reverse()

  const left = (due: string): string => {
    const ms = new Date(due).getTime() - now.getTime()
    const h = Math.round(Math.abs(ms) / 3_600_000)
    const text = h >= 48 ? t('tasks.days', { n: Math.round(h / 24) }) : t('tasks.hours', { n: h })
    return ms < 0 ? t('tasks.late', { t: text }) : t('tasks.left', { t: text })
  }

  const Row = ({ x }: { x: Task }): React.JSX.Element => {
    const cls = data.events.find((e) => e.id === x.eventId)
    const late = !!x.due && !x.done && x.due < nowKey
    return (
      <div className="flex items-center gap-3 card p-3">
        <input type="checkbox" className="h-5 w-5 shrink-0" checked={x.done} onChange={(e) => patch(x.id, { done: e.target.checked })} />
        <div className="min-w-0 flex-1">
          <div className={`font-medium ${x.done ? 'text-muted line-through' : ''}`}>{x.title}</div>
          <div className="flex flex-wrap gap-x-3 text-xs text-muted">
            {cls && (
              <span>
                <span style={{ color: cls.color }}>●</span> {cls.title}
              </span>
            )}
            {x.due && (
              <span className={late ? 'font-semibold text-bad' : ''}>
                ⏰ {fmtDue(x.due)}
                {!x.done && ` · ${left(x.due)}`}
              </span>
            )}
            {x.source === 'daymai' && <span>Daymai</span>}
          </div>
        </div>
        {x.url && (
          <button onClick={() => void window.api.openUrl(x.url as string)} className="rounded-lg border border-line px-3 py-1 text-sm text-soft hover:bg-hover">
            ↗ {t('tasks.open')}
          </button>
        )}
        <button
          onClick={() => update((d) => ({ ...d, tasks: d.tasks.filter((y) => y.id !== x.id) }))}
          className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-hover hover:text-bad"
          title={t('common.delete')}
        >
          ✕
        </button>
      </div>
    )
  }

  const Group = ({ title, tone, list }: { title: string; tone: string; list: Task[] }): React.JSX.Element | null =>
    list.length ? (
      <section>
        <h2 className={`mb-2 text-sm font-semibold ${tone}`}>
          {title} ({list.length})
        </h2>
        <div className="space-y-2">{list.map((x) => <Row key={x.id} x={x} />)}</div>
      </section>
    ) : null

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <header className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t('tasks.title')}</h1>
          <p className="text-sm text-muted">{t('tasks.subtitle')}</p>
        </div>
        <button
          onClick={() => void sync()}
          disabled={syncing}
          className="ml-auto rounded-lg border border-line px-3 py-2 text-sm text-soft hover:bg-hover disabled:opacity-50"
        >
          ⟳ {syncing ? t('tasks.syncing') : t('tasks.sync')}
        </button>
      </header>

      <div className="mb-4 flex flex-wrap gap-2 card p-3">
        <input className={`${FIELD} min-w-56 flex-1`} placeholder={t('tasks.titlePh')} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input type="datetime-local" className={`${FIELD} !w-52`} value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
        <select className={`${FIELD} !w-48`} value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })}>
          <option value="">{t('tasks.noClass')}</option>
          {data.events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.title}
            </option>
          ))}
        </select>
        <input className={`${FIELD} min-w-48 flex-1`} placeholder={t('tasks.urlPh')} value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        <button onClick={add} className="rounded-lg btn-accent px-4 text-sm font-semibold text-white hover:opacity-90">
          + {t('common.add')}
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pr-1">
        {data.tasks.length === 0 && <p className="text-sm text-muted">{t('tasks.empty')}</p>}
        <Group title={t('tasks.overdue')} tone="text-bad" list={overdue} />
        <Group title={t('tasks.upcoming')} tone="text-accent" list={upcoming} />
        <Group title={t('tasks.done')} tone="text-muted" list={done} />
      </div>
    </div>
  )
}
