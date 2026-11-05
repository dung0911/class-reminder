import { shell } from 'electron'

/** https://zoom.us/j/123?pwd=abc  ->  zoommtg://zoom.us/join?action=join&confno=123&pwd=abc */
export function toZoomDeepLink(url: string): string | null {
  try {
    const u = new URL(url)
    if (!/(^|\.)zoom\.(us|com)$/.test(u.hostname)) return null
    const m = u.pathname.match(/\/(?:j|wc\/join)\/(\d+)/)
    if (!m) return null
    const pwd = u.searchParams.get('pwd')
    return `zoommtg://${u.hostname}/join?action=join&confno=${m[1]}${pwd ? `&pwd=${pwd}` : ''}`
  } catch {
    return null
  }
}

/** Mở một link Zoom bằng app Zoom trên máy; không được thì mở bằng trình duyệt */
export async function openZoom(url: string): Promise<void> {
  const deep = toZoomDeepLink(url)
  if (deep) {
    try {
      await shell.openExternal(deep)
      return
    } catch {
      /* rơi xuống mở bằng trình duyệt */
    }
  }
  await shell.openExternal(url)
}
