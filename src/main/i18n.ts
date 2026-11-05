import { app, shell } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'fs'
import { basename, join } from 'path'
import type { I18nBundle, LangInfo } from '@shared/types'
import { loadData } from './store'

type Dict = Record<string, string>

/** Ngôn ngữ gốc: mọi khoá thiếu ở ngôn ngữ khác sẽ lấy từ đây */
const BASE_LANG = 'vi'

/** Ngôn ngữ đi kèm app (đóng gói trong resources/locales) */
const builtinDir = (): string =>
  app.isPackaged ? join(process.resourcesPath, 'locales') : join(app.getAppPath(), 'resources', 'locales')

/** Ngôn ngữ do người dùng thêm/sửa: %APPDATA%\lich-hoc\locales\<mã>.json */
export const userLocalesDir = (): string => join(app.getPath('userData'), 'locales')

function readDir(dir: string): Record<string, Dict> {
  const out: Record<string, Dict> = {}
  if (!existsSync(dir)) return out
  for (const f of readdirSync(dir)) {
    if (!f.toLowerCase().endsWith('.json')) continue
    try {
      out[basename(f, '.json')] = JSON.parse(readFileSync(join(dir, f), 'utf8')) as Dict
    } catch {
      /* file hỏng thì bỏ qua, không làm sập app */
    }
  }
  return out
}

/**
 * Ghép từ điển theo thứ tự ưu tiên (cao -> thấp):
 * file của người dùng > file đi kèm app > tiếng Việt gốc. Thiếu khoá nào thì lùi xuống tầng dưới.
 */
export function loadBundle(lang: string): I18nBundle {
  const builtin = readDir(builtinDir())
  const user = readDir(userLocalesDir())
  const codes = [...new Set([...Object.keys(builtin), ...Object.keys(user)])]
  const languages: LangInfo[] = codes
    .map((code) => ({ code, name: user[code]?._name ?? builtin[code]?._name ?? code }))
    .sort((a, b) => a.code.localeCompare(b.code))
  const dict: Dict = { ...builtin[BASE_LANG], ...user[BASE_LANG], ...builtin[lang], ...user[lang] }
  delete dict._name
  return { lang, dict, languages }
}

/** Dịch trong tiến trình main (thông báo Windows...) theo ngôn ngữ đang chọn */
export function currentLang(): string {
  return loadData().settings.lang
}

export function tr(key: string, vars?: Record<string, string | number>): string {
  const lang = currentLang()
  let s = loadBundle(lang).dict[key] ?? key
  for (const [k, v] of Object.entries(vars ?? {})) s = s.split(`{${k}}`).join(String(v))
  return s
}

/** Mở thư mục ngôn ngữ của người dùng; lần đầu chép sẵn các file mẫu để sửa */
export async function openLocalesFolder(): Promise<void> {
  const dir = userLocalesDir()
  mkdirSync(dir, { recursive: true })
  if (readdirSync(dir).length === 0 && existsSync(builtinDir())) {
    for (const f of readdirSync(builtinDir())) {
      if (f.toLowerCase().endsWith('.json')) copyFileSync(join(builtinDir(), f), join(dir, f))
    }
  }
  await shell.openPath(dir)
}
