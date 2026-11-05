// Cửa sổ web riêng của app cho từng nền tảng học (Daymai, Azota, Meet...):
//  - mỗi nền tảng một "partition" riêng nên đăng nhập một lần là nhớ lâu dài, không lẫn với trình duyệt của bạn
//  - tự điền tên đăng nhập + mật khẩu đã lưu (mật khẩu giải mã trong main, chỉ đưa vào trang rồi bỏ)
//  - bắt link Zoom khi trang chuyển hướng và mở thẳng app Zoom
//  - chạy "công thức" (chuỗi bấm/gõ) đã ghi, hoặc ghi một công thức mới
import { BrowserWindow, session, shell } from 'electron'
import type { Account, RecipeStep, Site } from '@shared/types'
import { loadData } from './store'
import { decrypt } from './secrets'
import { sendToMain } from './windows'
import { toZoomDeepLink } from './zoom'

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export const partitionFor = (siteId: string): string => `persist:site-${siteId}`

const hostOf = (u: string): string => {
  try {
    return new URL(u).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Nền tảng ứng với một địa chỉ (cùng tên miền hoặc tên miền con) */
export function siteForUrl(url: string): Site | undefined {
  const h = hostOf(url)
  if (!h) return undefined
  return loadData().sites.find((s) => {
    const sh = hostOf(s.url)
    return sh && (h === sh || h.endsWith(`.${sh}`))
  })
}

/** Tài khoản dùng để đăng nhập một nền tảng: ưu tiên tài khoản đã có mật khẩu */
export function accountForSite(siteId: string): Account | undefined {
  const list = loadData().accounts.filter((a) => a.siteId === siteId)
  return list.find((a) => a.passwordEnc) ?? list[0]
}

/** Đừng để Google/web khác nhận ra "Electron" và chặn đăng nhập */
function userAgent(): string {
  return session.defaultSession.getUserAgent().replace(/\s(Electron|lich-hoc)\/\S+/g, '')
}

export function createWebWindow(site: Site | undefined, show: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show,
    autoHideMenuBar: true,
    title: site?.name ?? 'Lịch học',
    webPreferences: {
      partition: site ? partitionFor(site.id) : 'persist:site-misc',
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.webContents.setUserAgent(userAgent())
  return win
}

// ---------- Tự điền đăng nhập ----------

/** Đoạn JS chạy trong trang: tìm ô mật khẩu đang hiện, điền và bấm đăng nhập. Trả 'nologin' nếu trang không có form đăng nhập. */
export function autofillScript(username: string, password: string): string {
  return `(async () => {
    const USER = ${JSON.stringify(username)}, PASS = ${JSON.stringify(password)};
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    let pw = null;
    for (let i = 0; i < 10 && !pw; i++) {
      pw = [...document.querySelectorAll('input[type=password]')].find(visible) || null;
      if (!pw) await sleep(400);
    }
    if (!pw) return 'nologin';
    const texts = [...document.querySelectorAll('input')].filter(
      (el) => visible(el) && ['text', 'email', 'tel', 'number', ''].includes((el.type || '').toLowerCase())
    );
    const before = texts.filter((el) => el.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING);
    const user = before.length ? before[before.length - 1] : texts[0];
    const setVal = (el, v) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (user) setVal(user, USER);
    setVal(pw, PASS);
    await sleep(300);
    const scope = pw.form || document;
    const btn = [...scope.querySelectorAll('button, input[type=submit]')].find(
      (b) => visible(b) && !b.disabled && (b.type === 'submit' || /đăng nhập|login|log in|sign in/i.test(b.textContent || b.value || ''))
    );
    if (btn) btn.click();
    else if (pw.form) { pw.form.requestSubmit ? pw.form.requestSubmit() : pw.form.submit(); }
    return 'submitted';
  })()`
}

/** Tự đăng nhập nếu trang đang hiện form đăng nhập. Trả true nếu đã bấm đăng nhập. */
export async function tryAutoLogin(win: BrowserWindow, account: Account | undefined): Promise<boolean> {
  if (!account?.passwordEnc || win.isDestroyed()) return false
  const pass = decrypt(account.passwordEnc)
  if (pass === null) return false
  try {
    const r: unknown = await win.webContents.executeJavaScript(autofillScript(account.username, pass))
    return r === 'submitted'
  } catch {
    return false
  }
}

// ---------- Công thức: chạy ----------

const ACT_SCRIPT = (st: unknown): string => `((st) => {
  const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  let el = null;
  if (st.selector) { try { el = document.querySelector(st.selector); } catch (e) {} }
  if (!el && st.text) {
    el = [...document.querySelectorAll('button, a, [role=button], input[type=submit], label')].find(
      (e) => visible(e) && (e.innerText || e.value || '').trim() === st.text
    ) || null;
  }
  if (!el || !visible(el)) return false;
  if (st.do === 'click') { el.click(); return true; }
  if (st.do === 'type') {
    el.focus();
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, st.value || '');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }
  return false;
})(${JSON.stringify(st)})`

/** Chạy lần lượt các bước; mỗi bước chờ tối đa 15 giây cho phần tử xuất hiện (trang có thể đang chuyển). */
export async function runRecipe(
  win: BrowserWindow,
  steps: RecipeStep[],
  account: Account | undefined
): Promise<{ ok: boolean; failed?: RecipeStep }> {
  const pass = account?.passwordEnc ? decrypt(account.passwordEnc) ?? '' : ''
  const fill = (s?: string): string | undefined =>
    s?.split('{{username}}').join(account?.username ?? '').split('{{password}}').join(pass)
  for (const step of steps) {
    if (step.do === 'wait') {
      await sleep(step.ms ?? 1000)
      continue
    }
    const script = ACT_SCRIPT({ ...step, value: fill(step.value) })
    const deadline = Date.now() + 15_000
    let ok = false
    while (!ok && Date.now() < deadline && !win.isDestroyed()) {
      try {
        ok = (await win.webContents.executeJavaScript(script)) === true
      } catch {
        ok = false
      }
      if (!ok) await sleep(400)
    }
    if (!ok) return { ok: false, failed: step }
    await sleep(300)
  }
  return { ok: true }
}

// ---------- Công thức: ghi ----------

const RECORDER = (username: string): string => `(() => {
  if (window.__lhRec) return; window.__lhRec = true;
  const USER = ${JSON.stringify(username)};
  const log = (o) => console.log('__LH__' + JSON.stringify(o));
  const uniq = (css) => { try { return document.querySelectorAll(css).length === 1; } catch (e) { return false; } };
  const sel = (el) => {
    if (el.id && uniq('#' + CSS.escape(el.id))) return '#' + CSS.escape(el.id);
    const tag = el.tagName.toLowerCase();
    for (const a of ['data-testid', 'name', 'aria-label', 'placeholder']) {
      const v = el.getAttribute(a);
      if (v) { const c = tag + '[' + a + '=' + JSON.stringify(v) + ']'; if (uniq(c)) return c; }
    }
    const path = [];
    for (let n = el, d = 0; n && n.nodeType === 1 && n !== document.body && d < 6; n = n.parentElement, d++) {
      if (n.id && uniq('#' + CSS.escape(n.id))) { path.unshift('#' + CSS.escape(n.id)); break; }
      const same = n.parentElement ? [...n.parentElement.children].filter((c) => c.tagName === n.tagName) : [n];
      path.unshift(n.tagName.toLowerCase() + (same.length > 1 ? ':nth-of-type(' + (same.indexOf(n) + 1) + ')' : ''));
    }
    return path.join(' > ');
  };
  document.addEventListener('click', (e) => {
    const t = e.target.closest ? e.target.closest('button, a, [role=button], input, select, label, summary') || e.target : e.target;
    if (t.tagName === 'INPUT' && ['text', 'password', 'email', 'tel', 'number', 'search', ''].includes((t.type || '').toLowerCase())) return;
    log({ do: 'click', selector: sel(t), text: (t.innerText || t.value || '').trim().slice(0, 40) });
  }, true);
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !['INPUT', 'TEXTAREA'].includes(t.tagName) || ['checkbox', 'radio', 'file'].includes(t.type)) return;
    const v = t.type === 'password' ? '{{password}}' : (USER && t.value === USER ? '{{username}}' : t.value);
    log({ do: 'type', selector: sel(t), value: v });
  }, true);
})()`

/** Mở cửa sổ ghi thao tác. Mọi thứ bạn bấm/gõ thành một công thức, lưu khi bạn đóng cửa sổ. */
export function recordRecipe(site: Site, onDone: (steps: RecipeStep[]) => void): void {
  const account = accountForSite(site.id)
  const win = createWebWindow(site, true)
  const steps: RecipeStep[] = []
  win.setTitle(`⏺ ${site.name}`)
  win.webContents.on('console-message', (...args: unknown[]) => {
    // Electron cũ truyền (event, level, message), bản mới truyền message trong event
    const ev = args[0] as { message?: string }
    const msg = typeof args[2] === 'string' ? args[2] : ev?.message
    if (!msg?.startsWith('__LH__')) return
    try {
      const st = JSON.parse(msg.slice(6)) as RecipeStep
      const last = steps[steps.length - 1]
      if (st.do === 'type' && last?.do === 'type' && last.selector === st.selector) steps[steps.length - 1] = st
      else if (!(st.do === 'click' && last?.do === 'click' && last.selector === st.selector)) steps.push(st)
    } catch {
      /* bỏ qua dòng lỗi */
    }
  })
  const inject = (): void => void win.webContents.executeJavaScript(RECORDER(account?.username ?? '')).catch(() => {})
  win.webContents.on('dom-ready', inject)
  win.on('closed', () => onDone(steps))
  void win.loadURL(site.url)
}

// ---------- Mở một trang trong cửa sổ của app ----------

const open = new Map<string, BrowserWindow>() // site.id (hoặc "misc") -> cửa sổ đang mở

export interface OpenOptions {
  url: string
  /** Bắt link Zoom và mở bằng app Zoom, rồi đóng cửa sổ */
  handoffZoom?: boolean
  /** Google Meet: tự tắt camera/mic ở màn hình chờ */
  muteMeet?: { cam: boolean; mic: boolean }
}

const MEET_SCRIPT = (cam: boolean, mic: boolean): string => `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const done = new Set();
  for (let i = 0; i < 30; i++) {
    for (const el of document.querySelectorAll('[role=button][data-is-muted="false"]')) {
      const label = el.getAttribute('aria-label') || '';
      const isCam = /camera|máy ảnh|video/i.test(label), isMic = /microphone|micrô|micro/i.test(label);
      if (((${cam} && isCam) || (${mic} && isMic)) && !done.has(label)) { done.add(label); el.click(); }
    }
    await sleep(500);
  }
})()`

/**
 * Mở một trang cho một buổi học. Có công thức của nền tảng thì chạy công thức, không thì tự đăng nhập
 * (nếu đã lưu mật khẩu). Cửa sổ luôn hiện để bạn thấy và tự bấm tiếp nếu trang cần thêm bước.
 */
export function openWeb(opts: OpenOptions): BrowserWindow {
  const site = siteForUrl(opts.url)
  const key = site?.id ?? 'misc'
  const existing = open.get(key)
  if (existing && !existing.isDestroyed()) {
    existing.show()
    existing.focus()
    void existing.loadURL(opts.url)
    return existing
  }

  const win = createWebWindow(site, true)
  open.set(key, win)
  win.on('closed', () => open.delete(key))
  const wc = win.webContents

  if (opts.handoffZoom) {
    const handoff = (e: Electron.Event, url: string): void => {
      const deep = toZoomDeepLink(url) ?? (/^zoom(mtg|us):/i.test(url) ? url : null)
      if (!deep) return
      e.preventDefault()
      void shell.openExternal(deep)
      setTimeout(() => !win.isDestroyed() && win.close(), 1500)
    }
    wc.on('will-navigate', handoff)
    wc.on('will-redirect', handoff)
    wc.setWindowOpenHandler(({ url }) => {
      const deep = toZoomDeepLink(url)
      if (!deep) return { action: 'allow' }
      void shell.openExternal(deep)
      setTimeout(() => !win.isDestroyed() && win.close(), 1500)
      return { action: 'deny' }
    })
  }

  const account = site ? accountForSite(site.id) : undefined
  let started = false
  wc.on('did-finish-load', () => {
    if (started) return
    started = true
    if (opts.muteMeet) void wc.executeJavaScript(MEET_SCRIPT(opts.muteMeet.cam, opts.muteMeet.mic)).catch(() => {})
    if (site?.recipe?.length) {
      void runRecipe(win, site.recipe, account).then((r) => {
        if (!r.ok) sendToMain('toast', `Công thức "${site.name}" dừng ở bước: ${r.failed?.selector ?? r.failed?.text ?? '?'}`)
      })
    } else {
      void tryAutoLogin(win, account)
    }
  })
  // Trang đăng nhập có thể hiện sau khi chuyển trang (SPA): thử lại tối đa 2 lần
  let again = 0
  wc.on('did-navigate-in-page', () => {
    if (!site?.recipe?.length && again < 2) {
      again++
      void tryAutoLogin(win, account)
    }
  })
  void win.loadURL(opts.url)
  return win
}
