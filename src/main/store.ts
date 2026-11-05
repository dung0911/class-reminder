import { app } from 'electron'
import { join, dirname } from 'path'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { AppData, ClassEvent, Settings, Site } from '@shared/types'

const dataFile = (): string => join(app.getPath('userData'), 'data.json')
const legacyFile = (): string => join(app.getPath('userData'), 'events.json') // bản 0.1 chỉ lưu mảng lớp

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  accent: 'indigo',
  lang: 'vi',
  sidebarCollapsed: false,
  joinInApp: true,
  meetInApp: false,
  focusOnJoin: true
}

const DEFAULT_EVENT: ClassEvent = {
  id: 'tiengnhat',
  title: 'Tiếng Nhật',
  type: 'zoom',
  url: '', // dán link Zoom trong app
  days: [2, 4, 6], // T3, T5, T7
  time: '19:00',
  duration: 90,
  remind: 5,
  color: '#6366f1',
  enabled: true,
  camOff: true,
  micOff: true
}

type LooseEvent = Partial<ClassEvent> & { siteId?: string }
type LooseSite = Partial<Site> & { domain?: string }

function normEvent(e: LooseEvent): ClassEvent {
  const { siteId, ...rest } = e // bản cũ chỉ có một siteId
  const siteIds = rest.siteIds ?? (siteId ? [siteId] : undefined)
  return { ...DEFAULT_EVENT, camOff: true, micOff: true, ...rest, siteIds } as ClassEvent
}

function normSite(s: LooseSite): Site {
  const url = s.url ?? (s.domain ? (/^https?:/.test(s.domain) ? s.domain : `https://${s.domain}`) : '')
  return { id: s.id ?? `site${Date.now()}`, name: s.name ?? '', url, note: s.note }
}

function normalize(d: Partial<AppData>): AppData {
  return {
    version: 1,
    events: (d.events ?? []).map(normEvent),
    sites: (d.sites ?? []).map(normSite),
    accounts: d.accounts ?? [],
    tasks: d.tasks ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings ?? {}) }
  }
}

export function saveData(data: AppData): void {
  const file = dataFile()
  mkdirSync(dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
  renameSync(tmp, file) // ghi nguyên tử, tránh hỏng file nếu mất điện giữa chừng
}

export function loadData(): AppData {
  try {
    return normalize(JSON.parse(readFileSync(dataFile(), 'utf8')) as Partial<AppData>)
  } catch {
    /* chưa có data.json */
  }
  try {
    const old = JSON.parse(readFileSync(legacyFile(), 'utf8')) as Partial<ClassEvent>[]
    if (Array.isArray(old)) {
      const migrated = normalize({ events: old as ClassEvent[] })
      saveData(migrated)
      return migrated
    }
  } catch {
    /* cũng chưa có bản cũ */
  }
  const fresh = normalize({ events: [DEFAULT_EVENT] })
  saveData(fresh)
  return fresh
}

/** Sửa dữ liệu ngay trong main (ví dụ ghi nhận có mặt) rồi lưu */
export function mutateData(fn: (d: AppData) => void): AppData {
  const d = loadData()
  fn(d)
  saveData(d)
  return d
}
