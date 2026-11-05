import { useState } from 'react'
import type { AppData, Attendance, ClassEvent, SessionNote } from '@shared/types'
import { FIELD } from '@/lib/constants'
import {
  addBreakDay,
  breakOn,
  endOn,
  removeBreakDay,
  sessionNumber,
  startOn,
  vnDate,
  withAttendance,
  ymd
} from '@shared/schedule'
import { TYPE_ICON } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  ev: ClassEvent
  date: Date
  now: Date
  update: (fn: (d: AppData) => AppData) => void
  onEdit: (ev: ClassEvent) => void
  onClose: () => void
}

/** Một buổi cụ thể: điểm danh, báo nghỉ / hủy nghỉ, vào học */
export default function SessionDialog({ ev, date, now, update, onEdit, onClose }: Props): React.JSX.Element {
  const t = useT()
  const key = ymd(date)
  const brk = breakOn(ev, date)
  // Bản trước tự lưu chữ "Nghỉ" làm lý do; coi như không có lý do để khỏi lặp chữ
  const brkNote = brk?.note && brk.note !== 'Nghỉ' ? brk.note : undefined
  const no = brk ? null : sessionNumber(ev, date)
  const started = now >= startOn(ev, date)
  const ended = now >= endOn(ev, date)
  const mark: Attendance | undefined = ev.attendance?.[key]
  const lesson = no ? ev.syllabus?.find((s) => s.no === no) : undefined
  const isToday = key === ymd(now)

  const patch = (fn: (e: ClassEvent) => ClassEvent): void =>
    update((d) => ({ ...d, events: d.events.map((e) => (e.id === ev.id ? fn(e) : e)) }))
  const setMark = (s: Attendance | undefined): void => patch((e) => withAttendance(e, key, s))

  // Ghi chú buổi: gõ trong ô tạm, ra khỏi ô mới lưu (đỡ ghi đĩa mỗi phím)
  const saved: SessionNote = ev.sessionNotes?.[key] ?? {}
  const [noteText, setNoteText] = useState(saved.note ?? '')
  const [recText, setRecText] = useState(saved.recordingUrl ?? '')
  const setNote = (p: Partial<SessionNote>): void =>
    patch((e) => ({ ...e, sessionNotes: { ...(e.sessionNotes ?? {}), [key]: { ...(e.sessionNotes?.[key] ?? {}), ...p } } }))
  const toggleBreak = (): void =>
    patch((e) => ({
      ...e,
      breaks: brk ? removeBreakDay(e.breaks, key) : addBreakDay(e.breaks, key)
    }))

  const status = brk ? 'break' : mark ?? (ended ? 'unmarked' : started ? 'inprogress' : 'upcoming')
  const statusColor: Record<string, string> = {
    present: 'bg-ok/15 text-ok',
    absent: 'bg-bad/15 text-bad',
    unmarked: 'bg-warn/15 text-warn',
    inprogress: 'bg-accent-soft text-accent',
    upcoming: 'bg-hover text-muted',
    break: 'bg-hover text-muted'
  }

  const markBtn = (s: Attendance, label: string, active: string): React.JSX.Element => (
    <button
      onClick={() => setMark(mark === s ? undefined : s)}
      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold ${
        mark === s ? active : 'border-line text-soft hover:bg-hover'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-[460px] flex-col gap-4 overflow-y-auto rounded-2xl border border-line bg-bar p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-2xl" style={{ background: ev.color }}>
            {TYPE_ICON[ev.type]}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold">{ev.title}</div>
            <div className="text-sm text-muted">
              {no ? `${t('grid.session', { no })}${ev.totalSessions ? `/${ev.totalSessions}` : ''} · ` : ''}
              {t(`day.${date.getDay()}`)} {vnDate(key)} · {ev.time}
            </div>
          </div>
        </div>

        <div className={`rounded-lg px-3 py-2 text-sm font-semibold ${statusColor[status]}`}>
          {t(`status.${status}`)}
          {brkNote ? ` · ${brkNote}` : ''}
        </div>

        {lesson && (
          <div className="rounded-lg bg-hover p-3 text-sm">
            {lesson.lesson && <div className="mb-1 font-semibold text-accent">{lesson.lesson}</div>}
            <ul className="list-disc space-y-0.5 pl-5 text-soft">
              {lesson.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
            {lesson.homework && (
              <div className="mt-2 text-warn">
                <b>{t('panel.homework')}:</b> {lesson.homework}
              </div>
            )}
          </div>
        )}

        {!brk && (
          <div className="space-y-2">
            <textarea
              className={`${FIELD} h-16 resize-none`}
              placeholder={t('session.notePh')}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={() => noteText !== (saved.note ?? '') && setNote({ note: noteText || undefined })}
            />
            <div className="flex gap-2">
              <input
                className={FIELD}
                placeholder={t('session.recordingPh')}
                value={recText}
                onChange={(e) => setRecText(e.target.value)}
                onBlur={() => recText !== (saved.recordingUrl ?? '') && setNote({ recordingUrl: recText.trim() || undefined })}
              />
              {saved.recordingUrl && (
                <button onClick={() => void window.api.openUrl(saved.recordingUrl as string)} className="shrink-0 rounded-lg border border-line px-3 text-sm hover:bg-hover">
                  ↗
                </button>
              )}
            </div>
            {mark === 'absent' && (
              <label className="flex cursor-pointer items-center gap-2 text-sm text-soft">
                <input type="checkbox" className="h-4 w-4" checked={!!saved.watched} onChange={(e) => setNote({ watched: e.target.checked })} />
                {t('session.watched')}
              </label>
            )}
          </div>
        )}

        {!brk && started && (
          <div>
            <div className="mb-1 text-xs text-muted">{t('session.attendance')}</div>
            <div className="flex gap-2">
              {markBtn('present', `✓ ${t('status.present')}`, 'border-ok bg-ok/15 text-ok')}
              {markBtn('absent', `✗ ${t('status.absent')}`, 'border-bad bg-bad/15 text-bad')}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button onClick={toggleBreak} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            🌴 {brk ? t('session.unbreak') : t('session.break')}
          </button>
          {!brk && isToday && (
            <button
              onClick={() => {
                void window.api.join(ev)
                onClose()
              }}
              className="rounded-lg btn-accent px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              ▶ {t('panel.join')}
            </button>
          )}
          <span className="flex-1" />
          <button onClick={() => onEdit(ev)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            ✎ {t('session.editClass')}
          </button>
          <button onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
