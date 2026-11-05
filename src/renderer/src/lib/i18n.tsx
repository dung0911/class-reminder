import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { I18nBundle, LangInfo } from '@shared/types'

type Vars = Record<string, string | number>
type T = (key: string, vars?: Vars) => string

interface I18nValue {
  t: T
  languages: LangInfo[]
  /** Nạp lại file ngôn ngữ (sau khi bạn sửa file trong thư mục ngôn ngữ) */
  reload: () => void
}

const Ctx = createContext<I18nValue>({ t: (k) => k, languages: [], reload: () => {} })

/** Toàn bộ chữ trong app đến từ file ngôn ngữ (resources/locales và thư mục ngôn ngữ của bạn), không viết cứng. */
export function I18nProvider({ lang, children }: { lang: string; children: React.ReactNode }): React.JSX.Element | null {
  const [bundle, setBundle] = useState<I18nBundle | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    void window.api.i18nLoad(lang).then((b) => alive && setBundle(b))
    return () => {
      alive = false
    }
  }, [lang, tick])

  const t = useCallback<T>(
    (key, vars) => {
      let s = bundle?.dict[key] ?? key
      for (const [k, v] of Object.entries(vars ?? {})) s = s.split(`{${k}}`).join(String(v))
      return s
    },
    [bundle]
  )

  const value = useMemo<I18nValue>(
    () => ({ t, languages: bundle?.languages ?? [], reload: () => setTick((n) => n + 1) }),
    [t, bundle]
  )

  if (!bundle) return null
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useI18n = (): I18nValue => useContext(Ctx)
export const useT = (): T => useContext(Ctx).t
