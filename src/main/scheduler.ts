import type { ClassEvent } from '@shared/types'
import { dueNow, pad } from '@shared/schedule'
import { loadData } from './store'

const fired = new Set<string>() // "id|YYYY-MM-DD" để mỗi buổi chỉ nhắc một lần

/**
 * Quét mỗi 15 giây thay vì hẹn giờ một lần tới buổi kế: chịu được máy ngủ/đánh thức,
 * đổi múi giờ hay sửa lịch giữa chừng, mà tốn CPU không đáng kể.
 */
export function startScheduler(onDue: (ev: ClassEvent, start: Date) => void): NodeJS.Timeout {
  const tick = (): void => {
    const now = new Date()
    const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
    for (const ev of loadData().events) {
      const start = dueNow(ev, now)
      if (!start) continue
      const key = `${ev.id}|${day}`
      if (fired.has(key)) continue
      fired.add(key)
      onDue(ev, start)
    }
  }
  tick()
  return setInterval(tick, 15_000)
}
