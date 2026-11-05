import { useState } from 'react'
import type { Break, ClassEvent, ClassType, Site } from '@shared/types'
import { vnDate } from '@shared/schedule'
import { CLASS_TYPES, DAY_ORDER, FIELD } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  initial: ClassEvent | null
  sites: Site[]
  onSave: (ev: ClassEvent) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const BLANK: ClassEvent = {
  id: '',
  title: '',
  type: 'zoom',
  url: '',
  days: [],
  time: '19:00',
  duration: 90,
  remind: 5,
  color: '#6366f1',
  enabled: true,
  camOff: true,
  micOff: true
}

const label = 'text-xs text-muted'

export default function ClassDialog({ initial, sites, onSave, onDelete, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [ev, setEv] = useState<ClassEvent>(initial ?? { ...BLANK, id: `ev${Date.now()}` })
  const set = <K extends keyof ClassEvent>(k: K, v: ClassEvent[K]): void => setEv((p) => ({ ...p, [k]: v }))
  const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const valid = ev.title.trim() !== '' && ev.days.length > 0

  // Ngày nghỉ
  const [bFrom, setBFrom] = useState('')
  const [bTo, setBTo] = useState('')
  const [bNote, setBNote] = useState('')
  const addBreak = (): void => {
    if (!bFrom) return
    const to = bTo && bTo >= bFrom ? bTo : bFrom
    const next: Break[] = [...(ev.breaks ?? []), { from: bFrom, to, note: bNote.trim() || undefined }]
    set('breaks', next.sort((a, b) => a.from.localeCompare(b.from)))
    setBFrom('')
    setBTo('')
    setBNote('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ ...ev, title: ev.title.trim(), url: ev.url.trim() })
        }}
        className="flex max-h-[92vh] w-[520px] flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-bar p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold">{initial ? t('dialog.editTitle') : t('dialog.addTitle')}</h3>

        <label className={label}>
          {t('dialog.name')}
          <input className={FIELD} value={ev.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </label>

        <label className={label}>
          {t('dialog.type')}
          <select className={FIELD} value={ev.type} onChange={(e) => set('type', e.target.value as ClassType)}>
            {CLASS_TYPES.map((k) => (
              <option key={k} value={k}>
                {t(`type.${k}`)}
              </option>
            ))}
          </select>
        </label>

        {sites.length > 0 && (
          <div className={label}>
            {t('dialog.sites')}
            <div className="mt-1 flex flex-wrap gap-2">
              {sites.map((s) => {
                const on = ev.siteIds?.includes(s.id) ?? false
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => set('siteIds', toggle(ev.siteIds ?? [], s.id))}
                    className={`rounded-lg px-3 py-1.5 text-sm ${
                      on ? 'bg-accent text-white' : 'border border-line text-soft hover:bg-hover'
                    }`}
                  >
                    🌐 {s.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <label className={label}>
          {t('dialog.link')}
          <input className={FIELD} placeholder="https://..." value={ev.url} onChange={(e) => set('url', e.target.value)} />
          <span className="mt-1 block text-[11px] opacity-80">{t('dialog.linkHint')}</span>
        </label>

        <div className={label}>
          {t('dialog.days')}
          <div className="mt-1 flex gap-2">
            {DAY_ORDER.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => set('days', toggle(ev.days, d))}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  ev.days.includes(d) ? 'bg-accent text-white' : 'border border-line text-soft hover:bg-hover'
                }`}
              >
                {t(`day.${d}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <label className={`flex-1 ${label}`}>
            {t('dialog.time')}
            <input type="time" className={FIELD} value={ev.time} onChange={(e) => set('time', e.target.value)} required />
          </label>
          <label className={`flex-1 ${label}`}>
            {t('dialog.duration')}
            <input type="number" min={5} max={600} className={FIELD} value={ev.duration} onChange={(e) => set('duration', Number(e.target.value) || 60)} />
          </label>
          <label className={`flex-1 ${label}`}>
            {t('dialog.remind')}
            <input type="number" min={0} max={120} className={FIELD} value={ev.remind} onChange={(e) => set('remind', Number(e.target.value) || 0)} />
          </label>
        </div>

        <div className="flex gap-3">
          <label className={`flex-1 ${label}`}>
            {t('dialog.startDate')}
            <input type="date" className={FIELD} value={ev.startDate ?? ''} onChange={(e) => set('startDate', e.target.value || undefined)} />
          </label>
          <label className={`flex-1 ${label}`}>
            {t('dialog.total')}
            <input
              type="number"
              min={1}
              className={FIELD}
              value={ev.totalSessions ?? ''}
              onChange={(e) => set('totalSessions', Number(e.target.value) || undefined)}
            />
          </label>
        </div>

        <label className={label}>
          {t('dialog.examDate')}
          <input type="date" className={FIELD} value={ev.examDate ?? ''} onChange={(e) => set('examDate', e.target.value || undefined)} />
        </label>

        <label className={label}>
          {t('dialog.note')}
          <input className={FIELD} value={ev.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </label>

        <div className={label}>
          {t('dialog.breaks')}
          <div className="mt-1 flex items-center gap-2">
            <input type="date" className={`${FIELD} flex-1`} value={bFrom} onChange={(e) => setBFrom(e.target.value)} />
            <span>→</span>
            <input type="date" className={`${FIELD} flex-1`} value={bTo} min={bFrom} onChange={(e) => setBTo(e.target.value)} />
          </div>
          <div className="mt-2 flex gap-2">
            <input className={`${FIELD} flex-1`} placeholder={t('dialog.breakReason')} value={bNote} onChange={(e) => setBNote(e.target.value)} />
            <button type="button" onClick={addBreak} disabled={!bFrom} className="rounded-lg bg-hover px-3 text-sm text-ink hover:opacity-80 disabled:opacity-40">
              + {t('dialog.addBreak')}
            </button>
          </div>
          {(ev.breaks ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {(ev.breaks ?? []).map((b, i) => (
                <span key={i} className="flex items-center gap-2 rounded-full bg-hover px-3 py-1 text-soft">
                  🌴 {vnDate(b.from)}
                  {b.to !== b.from && ` – ${vnDate(b.to)}`}
                  {b.note && ` · ${b.note}`}
                  <button
                    type="button"
                    onClick={() => set('breaks', (ev.breaks ?? []).filter((_, idx) => idx !== i))}
                    className="text-muted hover:text-bad"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-soft">
          <label className="flex items-center gap-2">
            {t('dialog.color')}
            <input type="color" value={ev.color} onChange={(e) => set('color', e.target.value)} className="h-8 w-12 rounded" />
          </label>
          <label className="ml-auto flex items-center gap-2">
            <input type="checkbox" checked={ev.enabled} onChange={(e) => set('enabled', e.target.checked)} /> {t('dialog.enabled')}
          </label>
        </div>

        <div className="flex items-center gap-2">
          {initial && (
            <button
              type="button"
              onClick={() => confirm(t('dialog.confirmDelete')) && onDelete(ev.id)}
              className="rounded-lg border border-bad/50 px-3 py-2 text-sm text-bad hover:bg-bad/10"
            >
              {t('common.delete')}
            </button>
          )}
          <span className="flex-1" />
          {initial && (
            <button type="button" onClick={() => void window.api.join(ev)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
              {t('panel.join')}
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            {t('common.cancel')}
          </button>
          <button
            type="submit"
            disabled={!valid}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
          >
            {t('common.save')}
          </button>
        </div>
        {!valid && <p className="-mt-2 text-xs text-muted">{t('dialog.needNameDays')}</p>}
      </form>
    </div>
  )
}
