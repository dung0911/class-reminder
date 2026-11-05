import { useEffect, useRef, useState } from 'react'
import type { ClassEvent, ClassType } from '@shared/types'
import { vnDate, ymd } from '@shared/schedule'
import { DAY_ORDER, FIELD, TYPE_ICON } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  /** Ô lịch được bấm */
  date: Date
  hour: number
  /** Vị trí chuột lúc bấm (toạ độ cửa sổ), để đặt khung ngay cạnh ô */
  x: number
  y: number
  onSave: (ev: ClassEvent) => void
  /** Mở hộp thoại đầy đủ với các giá trị đã nhập */
  onMore: (draft: Partial<ClassEvent>) => void
  onClose: () => void
}

const TYPES: ClassType[] = ['zoom', 'meet', 'web', 'other']
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#ef4444']
const W = 340
const H = 500

const hhmm = (h: number, m = 0): string => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
const mins = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

/** Khung thêm lớp nhanh hiện ngay cạnh ô bạn bấm trên lịch (kiểu "New Schedule"/"New Appointment") */
export default function QuickAdd({ date, hour, x, y, onSave, onMore, onClose }: Props): React.JSX.Element {
  const t = useT()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<ClassType>('zoom')
  const [days, setDays] = useState<number[]>([date.getDay()])
  const [start, setStart] = useState(hhmm(hour))
  const [end, setEnd] = useState(hhmm(Math.min(hour + 2, 23)))
  const [url, setUrl] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [remind, setRemind] = useState(true)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  useEffect(() => {
    const on = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [onClose])

  const duration = mins(end) - mins(start)
  const valid = title.trim() !== '' && days.length > 0 && duration >= 5
  const build = (): Partial<ClassEvent> => ({
    title: title.trim(),
    type,
    url: url.trim(),
    days,
    time: start,
    duration: duration >= 5 ? duration : 60,
    remind: remind ? 5 : 0,
    color,
    startDate: ymd(date)
  })
  const save = (): void => {
    if (!valid) return
    onSave({ ...build(), id: `ev${Date.now()}`, enabled: true, camOff: true, micOff: true } as ClassEvent)
  }

  // Đặt khung cạnh chuột nhưng không tràn ra ngoài cửa sổ
  const left = Math.max(8, Math.min(x + 14, window.innerWidth - W - 8))
  const top = Math.max(52, Math.min(y - 24, window.innerHeight - H - 8))
  const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted'

  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        className="absolute flex flex-col gap-3 rounded-2xl border border-line bg-bar p-4 shadow-2xl"
        style={{ left, top, width: W }}
      >
        <div className="-mx-4 -mt-4 mb-0 flex items-center rounded-t-2xl bg-accent-soft px-4 py-2.5">
          <div className="text-sm font-bold text-accent">＋ {t('quick.title')}</div>
          <div className="ml-auto text-xs font-medium text-soft">{vnDate(ymd(date))}</div>
        </div>

        <input
          ref={input}
          className={`${FIELD} !text-base font-semibold`}
          placeholder={t('quick.name')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <div>
          <span className={label}>{t('quick.type')}</span>
          <div className="seg w-full">
            {TYPES.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  type === k ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
                }`}
              >
                {TYPE_ICON[k]} {t(`type.${k}`).split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>{t('quick.days')}</span>
          <div className="flex gap-1">
            {DAY_ORDER.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays((p) => (p.includes(d) ? p.filter((x) => x !== d) : [...p, d]))}
                className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                  days.includes(d) ? 'btn-accent' : 'border border-line text-soft hover:bg-hover'
                }`}
              >
                {t(`day.${d}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={label}>{t('quick.time')}</span>
          <div className="flex items-center gap-2">
            <input type="time" className={FIELD} value={start} onChange={(e) => setStart(e.target.value)} required />
            <span className="text-muted">→</span>
            <input type="time" className={FIELD} value={end} onChange={(e) => setEnd(e.target.value)} required />
          </div>
          {duration < 5 && <div className="mt-1 text-xs text-bad">{t('quick.badTime')}</div>}
        </div>

        <input className={FIELD} placeholder={t('quick.link')} value={url} onChange={(e) => setUrl(e.target.value)} />

        <div className="flex items-center gap-2">
          <span className={`${label} !mb-0`}>{t('quick.color')}</span>
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-6 w-6 rounded-full transition ${color === c ? 'scale-110 ring-2 ring-offset-2 ring-offset-transparent' : 'opacity-80 hover:opacity-100'}`}
                style={{ background: c, ['--tw-ring-color' as string]: c }}
              />
            ))}
          </div>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-lg bg-hover px-3 py-2 text-sm font-medium text-soft">
          🔔 {t('quick.remind')}
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${remind ? 'bg-accent' : 'bg-muted/40'}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${remind ? 'left-[18px]' : 'left-0.5'}`} />
            <input type="checkbox" className="sr-only" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          </span>
        </label>

        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={() => onMore(build())} className="text-xs font-medium text-accent hover:underline">
            {t('quick.more')}
          </button>
          <span className="flex-1" />
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            {t('common.cancel')}
          </button>
          <button type="submit" disabled={!valid} className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold hover:opacity-90 disabled:opacity-40">
            {t('quick.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
