import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppData } from '@shared/types'

/** Giữ dữ liệu trong state và tự lưu xuống đĩa (qua main) sau mỗi lần sửa */
export function useData(): { data: AppData | null; update: (fn: (d: AppData) => AppData) => void } {
  const [data, setData] = useState<AppData | null>(null)
  const ref = useRef<AppData | null>(null)

  const load = useCallback(() => {
    void window.api.getData().then((d) => {
      ref.current = d
      setData(d)
    })
  }, [])

  useEffect(() => {
    load()
    // Main tự sửa dữ liệu (ví dụ ghi nhận có mặt khi bấm Vào học) thì nạp lại
    return window.api.onDataChanged(load)
  }, [load])

  const update = useCallback((fn: (d: AppData) => AppData) => {
    if (!ref.current) return
    const next = fn(ref.current)
    ref.current = next
    setData(next)
    void window.api.saveData(next)
  }, [])

  return { data, update }
}

/** Đồng hồ: render lại mỗi `ms` mili giây */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** Áp chế độ sáng/tối cho cả trang (và cho 3 nút cửa sổ). 'system' theo Windows. */
export function useTheme(mode: 'system' | 'dark' | 'light'): 'dark' | 'light' {
  const query = '(prefers-color-scheme: dark)'
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = (e: MediaQueryListEvent): void => setSystemDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const theme = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    void window.api.setWindowTheme(theme)
  }, [theme])
  return theme
}
