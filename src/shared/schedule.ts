import type { Attendance, Break, ClassEvent } from './types'

export const pad = (n: number): string => String(n).padStart(2, '0')

const midnight = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const ymd = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** "2026-11-05" -> "05/11/2026" */
export const vnDate = (key: string): string => key.split('-').reverse().join('/')

const addDays = (key: string, n: number): string => {
  const d = parseYmd(key)
  d.setDate(d.getDate() + n)
  return ymd(d)
}

/** Đợt nghỉ chứa ngày `day` (nếu có), không xét lớp có học hôm đó hay không */
function findBreak(ev: ClassEvent, day: Date): Break | undefined {
  const k = ymd(day)
  return ev.breaks?.find((b) => k >= b.from && k <= b.to)
}

/** Số buổi đã học từ startDate đến hết ngày `day` (tính cả `day`); ngày nghỉ không được tính */
function countSessions(ev: ClassEvent, day: Date): number {
  const start = parseYmd(ev.startDate as string)
  const end = midnight(day)
  let n = 0
  for (const c = new Date(start); c <= end; c.setDate(c.getDate() + 1)) {
    if (ev.days.includes(c.getDay()) && !findBreak(ev, c)) n++
  }
  return n
}

/** Hôm `day` có buổi học không (tính cả ngày bắt đầu, ngày nghỉ và số buổi tối đa) */
export function occursOn(ev: ClassEvent, day: Date): boolean {
  if (!ev.days.includes(day.getDay())) return false
  if (ev.startDate && midnight(day) < parseYmd(ev.startDate)) return false
  if (findBreak(ev, day)) return false
  if (!ev.startDate) return true
  return !ev.totalSessions || countSessions(ev, day) <= ev.totalSessions
}

/** Nếu hôm `day` đáng lẽ có buổi học nhưng đang nghỉ thì trả về đợt nghỉ đó */
export function breakOn(ev: ClassEvent, day: Date): Break | undefined {
  if (!ev.days.includes(day.getDay())) return undefined
  if (ev.startDate && midnight(day) < parseYmd(ev.startDate)) return undefined
  return findBreak(ev, day)
}

/** Buổi thứ mấy (1, 2, 3...). null nếu lớp không đánh số hoặc hôm đó không có buổi. */
export function sessionNumber(ev: ClassEvent, day: Date): number | null {
  if (!ev.startDate || !occursOn(ev, day)) return null
  return countSessions(ev, day)
}

/** Giờ bắt đầu của lớp trong ngày `day` */
export function startOn(ev: ClassEvent, day: Date): Date {
  const [h, m] = ev.time.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h, m, 0, 0)
  return d
}

export function endOn(ev: ClassEvent, day: Date): Date {
  return new Date(startOn(ev, day).getTime() + ev.duration * 60_000)
}

/** Lần học kế tiếp (hoặc đang diễn ra) kể từ `from`; null nếu không có trong 45 ngày tới (đủ qua một đợt nghỉ dài) */
export function nextOccurrence(ev: ClassEvent, from: Date = new Date()): Date | null {
  // Chưa tới ngày khai giảng thì bắt đầu tìm từ ngày khai giảng
  const begin = ev.startDate && parseYmd(ev.startDate) > from ? parseYmd(ev.startDate) : from
  for (let i = 0; i < 45; i++) {
    const d = new Date(begin)
    d.setDate(d.getDate() + i)
    if (!occursOn(ev, d)) continue
    if (endOn(ev, d) > from) return startOn(ev, d)
  }
  return null
}

/** Nếu lúc `now` đã tới giờ nhắc của lớp (và lớp chưa kết thúc) thì trả về giờ bắt đầu */
export function dueNow(ev: ClassEvent, now: Date = new Date()): Date | null {
  if (!ev.enabled || !occursOn(ev, now)) return null
  const start = startOn(ev, now)
  const remindAt = new Date(start.getTime() - ev.remind * 60_000)
  return now >= remindAt && now < endOn(ev, now) ? start : null
}

export function formatRange(ev: ClassEvent): string {
  const end = endOn(ev, new Date())
  return `${ev.time} – ${pad(end.getHours())}:${pad(end.getMinutes())}`
}

// ---------- Nghỉ ----------

/** Thêm nghỉ đúng một ngày */
export function addBreakDay(breaks: Break[] | undefined, key: string, note?: string): Break[] {
  return [...(breaks ?? []), { from: key, to: key, note }]
}

/** Bỏ nghỉ đúng một ngày; nếu ngày đó nằm giữa một đợt nghỉ dài thì tách đợt đó làm hai */
export function removeBreakDay(breaks: Break[] | undefined, key: string): Break[] {
  const out: Break[] = []
  for (const b of breaks ?? []) {
    if (key < b.from || key > b.to) {
      out.push(b)
      continue
    }
    if (b.from < key) out.push({ ...b, to: addDays(key, -1) })
    if (b.to > key) out.push({ ...b, from: addDays(key, 1) })
  }
  return out
}

// ---------- Điểm danh ----------

export type SessionStatus = 'present' | 'absent' | 'unmarked' | 'inprogress' | 'upcoming'

export interface SessionInfo {
  no: number
  date: Date
  key: string
  status: SessionStatus
}

/**
 * Danh sách các buổi của lớp từ ngày bắt đầu. Có tổng số buổi thì liệt kê đủ cả buổi tương lai,
 * không có thì chỉ liệt kê tới hôm nay. Chỉ lớp có startDate mới có danh sách.
 */
export function listSessions(ev: ClassEvent, now: Date = new Date()): SessionInfo[] {
  if (!ev.startDate || ev.days.length === 0) return []
  const out: SessionInfo[] = []
  const today = midnight(now)
  const c = parseYmd(ev.startDate)
  for (let guard = 0; guard < 3000; guard++, c.setDate(c.getDate() + 1)) {
    if (ev.totalSessions ? out.length >= ev.totalSessions : c > today) break
    if (!ev.days.includes(c.getDay()) || findBreak(ev, c)) continue
    const date = new Date(c)
    const key = ymd(date)
    const mark = ev.attendance?.[key]
    let status: SessionStatus
    if (mark) status = mark
    else if (now >= endOn(ev, date)) status = 'unmarked'
    else if (now >= startOn(ev, date)) status = 'inprogress'
    else status = 'upcoming'
    out.push({ no: out.length + 1, date, key, status })
  }
  return out
}

/** Các ngày đáng lẽ có học nhưng nghỉ (tới hết buổi cuối, hoặc hôm nay nếu lớp chưa có tổng số buổi) */
export function breakDates(ev: ClassEvent, now: Date = new Date()): Date[] {
  if (!ev.startDate || !ev.breaks?.length) return []
  const sessions = listSessions(ev, now)
  const last = sessions.length ? sessions[sessions.length - 1].date : midnight(now)
  const bound = ev.totalSessions ? last : midnight(now) > last ? midnight(now) : last
  const out: Date[] = []
  for (const c = parseYmd(ev.startDate); c <= bound; c.setDate(c.getDate() + 1)) {
    if (ev.days.includes(c.getDay()) && findBreak(ev, c)) out.push(new Date(c))
  }
  return out
}

export interface ClassStats {
  total: number | null
  present: number
  absent: number
  unmarked: number
  inprogress: number
  upcoming: number
  breaks: number
  /** Số buổi đã diễn ra (có mặt + vắng + chưa ghi nhận) */
  past: number
  /** Tỉ lệ có mặt trên các buổi đã diễn ra, 0..100; null nếu chưa có buổi nào */
  rate: number | null
}

export function classStats(ev: ClassEvent, now: Date = new Date()): ClassStats {
  const s = listSessions(ev, now)
  const count = (st: SessionStatus): number => s.filter((x) => x.status === st).length
  const present = count('present')
  const absent = count('absent')
  const unmarked = count('unmarked')
  const past = present + absent + unmarked
  return {
    total: ev.totalSessions ?? null,
    present,
    absent,
    unmarked,
    inprogress: count('inprogress'),
    upcoming: count('upcoming'),
    breaks: breakDates(ev, now).length,
    past,
    rate: past ? Math.round((present / past) * 100) : null
  }
}

/** Trả về bản sao của lớp với điểm danh đã đổi (status undefined = bỏ đánh dấu) */
export function withAttendance(ev: ClassEvent, key: string, status: Attendance | undefined): ClassEvent {
  const attendance = { ...(ev.attendance ?? {}) }
  if (status) attendance[key] = status
  else delete attendance[key]
  return { ...ev, attendance }
}
