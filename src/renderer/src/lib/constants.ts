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

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  x.setDate(x.getDate() + n)
  return x
}

/** 7 ngày Thứ 2 → Chủ nhật của tuần chứa `d` */
export const weekDays = (d: Date): Date[] => {
  const mon = addDays(d, -((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i))
}

/** Lưới 6 tuần x 7 ngày (từ Thứ 2) phủ tháng chứa `d` */
export const monthCells = (d: Date): Date[] => {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  const start = addDays(first, -((first.getDay() + 6) % 7))
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

/** Gán các buổi chồng giờ vào các làn song song để không đè lên nhau */
export function layoutLanes<T extends { start: number; end: number }>(items: T[]): { item: T; lane: number; lanes: number }[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end)
  const out: { item: T; lane: number; lanes: number }[] = []
  let cluster: { item: T; lane: number; lanes: number }[] = []
  let clusterEnd = -Infinity
  const flush = (): void => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1))
    for (const c of cluster) out.push({ ...c, lanes })
    cluster = []
  }
  for (const item of sorted) {
    if (item.start >= clusterEnd) flush()
    const used = new Set(cluster.filter((c) => c.item.end > item.start).map((c) => c.lane))
    let lane = 0
    while (used.has(lane)) lane++
    cluster.push({ item, lane, lanes: 1 })
    clusterEnd = Math.max(clusterEnd, item.end)
  }
  flush()
  return out
}

/** Lớp CSS dùng chung cho ô nhập */
export const FIELD =
  'w-full rounded-lg border border-line bg-field px-3 py-2 text-sm text-ink outline-none focus:border-accent'
