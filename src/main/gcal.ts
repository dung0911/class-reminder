// Liên kết Google Calendar để lịch học hiện (và nhắc) ngay trên điện thoại.
//  - Đăng nhập kiểu app máy tính của Google (OAuth + PKCE, nhận mã qua cổng 127.0.0.1 tạm thời); bạn tự đăng nhập
//    và bấm cho phép trên trang của Google, app không bao giờ thấy mật khẩu Google của bạn.
//  - Chỉ xin quyền "calendar.app.created": app tạo MỘT lịch riêng tên "Lịch học" và chỉ đụng tới lịch đó,
//    không đọc hay sửa các lịch khác của bạn.
//  - Đồng bộ một chiều: app -> Google. Sửa lịch học trong app thì Google cập nhật theo (thêm/sửa/xoá).
import { app, dialog, shell } from 'electron'
import { createHash, randomBytes } from 'crypto'
import { createServer } from 'http'
import { join } from 'path'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import type { GoogleStatus, SyncResult } from '@shared/types'
import { buildCalendarItems, buildIcs, type CalItem } from '@shared/extras'
import { tr } from './i18n'
import { decrypt, encrypt } from './secrets'
import { loadData } from './store'

const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'
const CAL_NAME = 'Lịch học'
const TZ = 'Asia/Ho_Chi_Minh'
const RANGE_DAYS = 400 // đồng bộ từ hôm nay tới 400 ngày sau (đủ phủ ngày thi cuối khoá)

interface GState {
  clientId: string
  /** đã mã hoá bằng Windows */
  clientSecretEnc?: string
  auto: boolean
  calendarId?: string
  /** JSON {access_token, refresh_token, expiry} đã mã hoá bằng Windows */
  tokenEnc?: string
  lastSync?: string
  lastError?: string
}

interface Tokens {
  access_token: string
  refresh_token: string
  expiry: number
}

const file = (): string => join(app.getPath('userData'), 'google.json')

function read(): GState {
  try {
    return { clientId: '', auto: true, ...(JSON.parse(readFileSync(file(), 'utf8')) as Partial<GState>) }
  } catch {
    return { clientId: '', auto: true }
  }
}

function write(s: GState): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const tmp = `${file()}.tmp`
  writeFileSync(tmp, JSON.stringify(s, null, 2), 'utf8')
  renameSync(tmp, file())
}

function patch(p: Partial<GState>): GState {
  const s = { ...read(), ...p }
  write(s)
  return s
}

export function googleStatus(): GoogleStatus {
  const s = read()
  return {
    clientId: s.clientId,
    hasSecret: !!s.clientSecretEnc,
    auto: s.auto,
    connected: !!s.tokenEnc,
    calendarId: s.calendarId,
    lastSync: s.lastSync,
    lastError: s.lastError
  }
}

export function setGoogleConfig(cfg: { clientId: string; clientSecret?: string; auto: boolean }): GoogleStatus {
  const p: Partial<GState> = { clientId: cfg.clientId.trim(), auto: cfg.auto }
  if (cfg.clientSecret) p.clientSecretEnc = encrypt(cfg.clientSecret.trim()) ?? undefined
  patch(p)
  return googleStatus()
}

const secretOf = (s: GState): string => (s.clientSecretEnc ? decrypt(s.clientSecretEnc) ?? '' : '')
const b64u = (b: Buffer): string => b.toString('base64url')

// ---------- Đăng nhập ----------

async function tokenRequest(params: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.error_description ?? json.error ?? res.status))
  return json
}

export async function connectGoogle(): Promise<GoogleStatus> {
  const s = read()
  if (!s.clientId) throw new Error(tr('google.needClient'))
  const verifier = b64u(randomBytes(32))
  const challenge = b64u(createHash('sha256').update(verifier).digest())
  const state = b64u(randomBytes(12))
  let redirect = ''

  const code = await new Promise<string>((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (u.pathname !== '/') {
        res.writeHead(404).end()
        return
      }
      const c = u.searchParams.get('code')
      const ok = !!c && u.searchParams.get('state') === state
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<meta charset="utf-8"><body style="font-family:sans-serif;text-align:center;padding-top:15vh">
        <h2>${ok ? '✅ Xong rồi' : '⚠️ Chưa thành công'}</h2><p>${ok ? 'Bạn có thể đóng tab này và quay lại app Lịch học.' : 'Hãy thử lại trong app.'}</p></body>`)
      server.close()
      if (ok) resolve(c as string)
      else reject(new Error(u.searchParams.get('error') ?? 'state'))
    })
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port
      redirect = `http://127.0.0.1:${port}`
      const q = new URLSearchParams({
        client_id: s.clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPE,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent',
        state
      })
      void shell.openExternal(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
    })
    setTimeout(() => {
      server.close()
      reject(new Error(tr('google.timeout')))
    }, 180_000)
  })

  const secret = secretOf(s)
  const t = await tokenRequest({
    code,
    client_id: s.clientId,
    ...(secret ? { client_secret: secret } : {}),
    redirect_uri: redirect,
    grant_type: 'authorization_code',
    code_verifier: verifier
  })
  const tokens: Tokens = {
    access_token: String(t.access_token),
    refresh_token: String(t.refresh_token ?? ''),
    expiry: Date.now() + Number(t.expires_in ?? 3600) * 1000
  }
  if (!tokens.refresh_token) throw new Error(tr('google.noRefresh'))
  patch({ tokenEnc: encrypt(JSON.stringify(tokens)) ?? undefined, lastError: undefined })
  return googleStatus()
}

export async function disconnectGoogle(): Promise<GoogleStatus> {
  const tokens = readTokens()
  if (tokens) {
    // Thu hồi quyền ở phía Google (không bắt buộc, lỗi thì bỏ qua)
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tokens.refresh_token)}`, { method: 'POST' }).catch(() => {})
  }
  patch({ tokenEnc: undefined, calendarId: undefined, lastError: undefined })
  return googleStatus()
}

function readTokens(): Tokens | null {
  const enc = read().tokenEnc
  const plain = enc ? decrypt(enc) : null
  try {
    return plain ? (JSON.parse(plain) as Tokens) : null
  } catch {
    return null
  }
}

async function accessToken(): Promise<string> {
  const tokens = readTokens()
  if (!tokens) throw new Error(tr('google.notConnected'))
  if (tokens.expiry > Date.now() + 60_000) return tokens.access_token
  const s = read()
  const secret = secretOf(s)
  try {
    const t = await tokenRequest({
      client_id: s.clientId,
      ...(secret ? { client_secret: secret } : {}),
      refresh_token: tokens.refresh_token,
      grant_type: 'refresh_token'
    })
    const next: Tokens = { ...tokens, access_token: String(t.access_token), expiry: Date.now() + Number(t.expires_in ?? 3600) * 1000 }
    patch({ tokenEnc: encrypt(JSON.stringify(next)) ?? undefined })
    return next.access_token
  } catch (err) {
    // Quyền đã bị thu hồi hoặc hết hạn (app Google ở chế độ Testing chỉ giữ quyền 7 ngày)
    if (/invalid_grant/i.test(String(err))) patch({ tokenEnc: undefined, lastError: tr('google.expired') })
    throw err
  }
}

// ---------- Gọi Calendar API ----------

async function api(method: string, path: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await res.text()
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : {} }
}

async function ensureCalendar(): Promise<string> {
  const s = read()
  if (s.calendarId) return s.calendarId
  const r = await api('POST', '/calendars', { summary: CAL_NAME, timeZone: TZ, description: 'Tạo tự động bởi app Lịch học' })
  if (r.status >= 300) throw new Error(`Google ${r.status}: ${JSON.stringify(r.json.error ?? r.json)}`)
  const id = String(r.json.id)
  patch({ calendarId: id })
  return id
}

const eventId = (key: string): string => `lh${createHash('sha1').update(key).digest('hex').slice(0, 32)}`

const day = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function toBody(it: CalItem): Record<string, unknown> {
  const core = {
    summary: it.title,
    description: it.description,
    location: it.location,
    start: it.allDay ? { date: day(it.start) } : { dateTime: it.start.toISOString(), timeZone: TZ },
    end: it.allDay ? { date: day(it.end) } : { dateTime: it.end.toISOString(), timeZone: TZ },
    reminders: { useDefault: false, overrides: it.remind.slice(0, 5).map((minutes) => ({ method: 'popup', minutes })) }
  }
  const fp = createHash('sha1').update(JSON.stringify(core)).digest('hex').slice(0, 16)
  return { ...core, id: eventId(it.key), status: 'confirmed', extendedProperties: { private: { lichhoc: '1', fp } } }
}

async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length) await fn(items[i++])
    })
  )
}

let running = false

export async function syncGoogle(): Promise<SyncResult> {
  if (running) return { ok: false, message: tr('google.busy') }
  if (!read().tokenEnc) return { ok: false, message: tr('google.notConnected') }
  running = true
  try {
    const from = new Date()
    from.setHours(0, 0, 0, 0)
    const to = new Date(from.getTime() + RANGE_DAYS * 86_400_000)
    const desired = new Map(buildCalendarItems(loadData(), from, to).map((it) => [eventId(it.key), toBody(it)]))

    let calId = await ensureCalendar()
    const existing = new Map<string, string>() // id -> fp
    for (let attempt = 0; attempt < 2; attempt++) {
      existing.clear()
      let pageToken = ''
      let missing = false
      do {
        const q = new URLSearchParams({
          privateExtendedProperty: 'lichhoc=1',
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: 'true',
          maxResults: '2500'
        })
        if (pageToken) q.set('pageToken', pageToken)
        const r = await api('GET', `/calendars/${encodeURIComponent(calId)}/events?${q}`)
        if (r.status === 404 && attempt === 0) {
          // Bạn đã xoá lịch "Lịch học" trên Google: tạo lại
          patch({ calendarId: undefined })
          calId = await ensureCalendar()
          missing = true
          break
        }
        if (r.status >= 300) throw new Error(`Google ${r.status}: ${JSON.stringify(r.json.error ?? r.json)}`)
        for (const e of (r.json.items as Record<string, unknown>[] | undefined) ?? []) {
          const fp = (e.extendedProperties as { private?: { fp?: string } } | undefined)?.private?.fp ?? ''
          existing.set(String(e.id), fp)
        }
        pageToken = String(r.json.nextPageToken ?? '')
      } while (pageToken)
      if (!missing) break
    }

    let added = 0
    let changed = 0
    let removed = 0
    const base = `/calendars/${encodeURIComponent(calId)}/events`
    const fail: string[] = []
    const todo: (() => Promise<void>)[] = []

    for (const [id, body] of desired) {
      const fp = (body.extendedProperties as { private: { fp: string } }).private.fp
      if (!existing.has(id)) {
        todo.push(async () => {
          let r = await api('POST', base, body)
          if (r.status === 409) r = await api('PUT', `${base}/${id}`, body) // id đã từng dùng (đã xoá): khôi phục
          if (r.status >= 300) fail.push(`${r.status}`)
          else added++
        })
      } else if (existing.get(id) !== fp) {
        todo.push(async () => {
          const r = await api('PUT', `${base}/${id}`, body)
          if (r.status >= 300) fail.push(`${r.status}`)
          else changed++
        })
      }
    }
    for (const id of existing.keys()) {
      if (desired.has(id)) continue
      todo.push(async () => {
        const r = await api('DELETE', `${base}/${id}`)
        if (r.status >= 300 && r.status !== 404 && r.status !== 410) fail.push(`${r.status}`)
        else removed++
      })
    }
    await pool(todo, 4, (f) => f())

    if (fail.length) {
      const msg = tr('google.partial', { n: fail.length, code: fail[0] })
      patch({ lastError: msg })
      return { ok: false, message: msg }
    }
    patch({ lastSync: new Date().toISOString(), lastError: undefined })
    return { ok: true, message: tr('google.synced', { added, changed, removed }) }
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err)
    patch({ lastError: msg })
    return { ok: false, message: msg }
  } finally {
    running = false
  }
}

// ---------- Tự đồng bộ ----------

let timer: NodeJS.Timeout | null = null

/** Gọi sau mỗi lần dữ liệu đổi: đợi vài giây cho gọn rồi đẩy lên Google (nếu đã liên kết và bật tự đồng bộ) */
export function requestGoogleSync(): void {
  const s = read()
  if (!s.tokenEnc || !s.auto) return
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void syncGoogle(), 8_000)
}

// ---------- Xuất file .ics ----------

export async function exportIcs(): Promise<string | null> {
  const from = new Date()
  from.setHours(0, 0, 0, 0)
  const to = new Date(from.getTime() + 400 * 86_400_000)
  const items = buildCalendarItems(loadData(), from, to)
  const r = await dialog.showSaveDialog({
    defaultPath: join(app.getPath('downloads'), 'lich-hoc.ics'),
    filters: [{ name: 'iCalendar', extensions: ['ics'] }]
  })
  if (r.canceled || !r.filePath) return null
  writeFileSync(r.filePath, buildIcs(items, CAL_NAME), 'utf8')
  return r.filePath
}
