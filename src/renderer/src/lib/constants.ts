import type { ClassType } from '@shared/types'

/** Thứ tự cột trong tuần: T2 ... CN (getDay: 1..6, 0). Tên ngày lấy từ file ngôn ngữ: day.1 ... day.0 */
export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
export const CLASS_TYPES: ClassType[] = ['zoom', 'meet', 'teams', 'web', 'other']

export const TYPE_ICON: Record<ClassType, string> = {
  zoom: '🎥',
  meet: '📹',
  teams: '👥',
  web: '🌐',
  other: '📌'
}

export function weekStart(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + offset * 7) // về Thứ 2
  return d
}

export const sameDay = (a: Date, b: Date): boolean => a.toDateString() === b.toDateString()

/** Lớp CSS dùng chung cho ô nhập */
export const FIELD =
  'w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink outline-none focus:border-accent'
