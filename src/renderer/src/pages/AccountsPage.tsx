import { useEffect, useState } from 'react'
import type { Account, AppData, Site } from '@shared/types'
import { FIELD } from '@/lib/constants'
import { useT } from '@/lib/i18n'

interface Props {
  data: AppData
  update: (fn: (d: AppData) => AppData) => void
  onToast: (msg: string) => void
}

const normUrl = (u: string): string => {
  const s = u.trim()
  return s && !/^https?:\/\//i.test(s) ? `https://${s}` : s
}

/** Nền tảng học (Daymai.vn, Azota.vn...) và tài khoản đăng nhập từng nền tảng. Mật khẩu mã hoá bằng Windows. */
export default function AccountsPage({ data, update, onToast }: Props): React.JSX.Element {
  const t = useT()
  const [site, setSite] = useState({ name: '', url: '', note: '' })
  const [editing, setEditing] = useState<Account | 'new' | null>(null)
  const [shown, setShown] = useState<Record<string, string>>({}) // id -> mật khẩu đang hiện

  // Mật khẩu tự ẩn lại sau 10 giây
  useEffect(() => {
    if (!Object.keys(shown).length) return
    const timer = setTimeout(() => setShown({}), 10_000)
    return () => clearTimeout(timer)
  }, [shown])

  const addSite = (): void => {
    if (!site.name.trim()) return
    const s: Site = { id: `site${Date.now()}`, name: site.name.trim(), url: normUrl(site.url), note: site.note.trim() || undefined }
    update((d) => ({ ...d, sites: [...d.sites, s] }))
    setSite({ name: '', url: '', note: '' })
  }

  const removeSite = (id: string): void => {
    if (!confirm(t('acc.confirmDeleteSite'))) return
    update((d) => ({
      ...d,
      sites: d.sites.filter((s) => s.id !== id),
      accounts: d.accounts.filter((a) => a.siteId !== id),
      events: d.events.map((e) => (e.siteIds?.includes(id) ? { ...e, siteIds: e.siteIds.filter((x) => x !== id) } : e))
    }))
  }

  const saveAccount = async (acc: Account, password: string): Promise<boolean> => {
    let next = acc
    if (password) {
      const enc = await window.api.encryptSecret(password)
      if (!enc) {
        onToast(t('acc.noEncryption'))
        return false
      }
      next = { ...acc, passwordEnc: enc }
    }
    update((d) => ({
      ...d,
      accounts: d.accounts.some((a) => a.id === next.id) ? d.accounts.map((a) => (a.id === next.id ? next : a)) : [...d.accounts, next]
    }))
    return true
  }

  const toggleShow = async (a: Account): Promise<void> => {
    if (shown[a.id] !== undefined) return setShown({})
    if (!a.passwordEnc) return
    const plain = await window.api.revealSecret(a.passwordEnc)
    if (plain !== null) setShown({ [a.id]: plain })
  }

  const copy = async (what: 'user' | 'pass', a: Account): Promise<void> => {
    if (what === 'user') await window.api.copyText(a.username)
    else if (!a.passwordEnc || !(await window.api.copySecret(a.passwordEnc))) return
    onToast(t(what === 'user' ? 'acc.copiedUser' : 'acc.copiedPass'))
  }

  const siteOf = (id: string): Site | undefined => data.sites.find((s) => s.id === id)
  const btn = 'rounded-lg border border-line px-3 py-1 text-sm text-soft hover:bg-hover'

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <h1 className="text-3xl font-bold">{t('acc.title')}</h1>
      <p className="mb-4 text-sm text-muted">{t('acc.subtitle')}</p>

      <div className="flex-1 space-y-6 overflow-y-auto pr-1">
        {/* ----- Nền tảng ----- */}
        <section>
          <h2 className="mb-2 text-lg font-bold">🌐 {t('acc.sites')}</h2>
          <div className="mb-3 flex flex-wrap gap-2">
            <input className={`${FIELD} !w-48`} placeholder={t('acc.siteName')} value={site.name} onChange={(e) => setSite({ ...site, name: e.target.value })} />
            <input className={`${FIELD} !w-56`} placeholder={t('acc.siteUrl')} value={site.url} onChange={(e) => setSite({ ...site, url: e.target.value })} />
            <input className={`${FIELD} min-w-48 flex-1`} placeholder={t('acc.siteNote')} value={site.note} onChange={(e) => setSite({ ...site, note: e.target.value })} />
            <button onClick={addSite} className="rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90">
              + {t('common.add')}
            </button>
          </div>
          <div className="space-y-2">
            {data.sites.length === 0 && <p className="text-sm text-muted">{t('acc.noSites')}</p>}
            {data.sites.map((s) => {
              const used = data.events.filter((e) => e.siteIds?.includes(s.id))
              return (
                <div key={s.id} className="flex items-center gap-3 rounded-xl border border-line bg-panel p-4">
                  <span className="text-2xl">🌐</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{s.name}</div>
                    <div className="truncate text-xs text-muted">{s.url || t('acc.noUrl')}</div>
                    {s.note && <div className="text-xs text-soft">{s.note}</div>}
                    {used.length > 0 && <div className="text-xs text-muted">{t('acc.usedBy', { names: used.map((e) => e.title).join(', ') })}</div>}
                  </div>
                  {s.url && (
                    <button className={btn} onClick={() => void window.api.openSite(s.id)}>
                      ↗ {t('acc.open')}
                    </button>
                  )}
                  {s.url && (
                    <button className={btn} title={t('recipe.recordHint')} onClick={() => void window.api.recipeRecord(s.id)}>
                      ⏺ {t('recipe.record')}
                    </button>
                  )}
                  {!!s.recipe?.length && (
                    <>
                      <button className={btn} onClick={() => void window.api.recipeRun(s.id)}>
                        ▶ {t('recipe.run', { n: s.recipe.length })}
                      </button>
                      <button
                        className={btn}
                        title={t('recipe.clear')}
                        onClick={() => update((d) => ({ ...d, sites: d.sites.map((x) => (x.id === s.id ? { ...x, recipe: undefined } : x)) }))}
                      >
                        ✕
                      </button>
                    </>
                  )}
                  <button className={`${btn} !border-bad/50 !text-bad`} onClick={() => removeSite(s.id)}>
                    {t('common.delete')}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ----- Tài khoản ----- */}
        <section>
          <div className="mb-2 flex items-center">
            <h2 className="text-lg font-bold">👤 {t('acc.accounts')}</h2>
            <button
              onClick={() => setEditing('new')}
              disabled={data.sites.length === 0}
              className="ml-auto rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              + {t('acc.addAccount')}
            </button>
          </div>
          {data.sites.length === 0 && <p className="text-sm text-muted">{t('acc.needSite')}</p>}
          <div className="space-y-2">
            {data.accounts.map((a) => {
              const s = siteOf(a.siteId)
              return (
                <div key={a.id} className="rounded-xl border border-line bg-panel p-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-semibold">{s?.name ?? '?'}</span>
                    <span className="text-sm text-soft">
                      {t('acc.username')}: <b className="select-text">{a.username}</b>
                    </span>
                    <span className="text-sm text-soft">
                      {t('acc.password')}:{' '}
                      {a.passwordEnc ? (
                        <b className="select-text">{shown[a.id] ?? '••••••••'}</b>
                      ) : (
                        <span className="text-bad">⚠ {t('acc.noPassword')}</span>
                      )}
                    </span>
                  </div>
                  {(a.fullName || a.phone) && (
                    <div className="mt-1 text-sm text-muted">
                      {a.fullName}
                      {a.fullName && a.phone && ' · '}
                      {a.phone}
                    </div>
                  )}
                  {a.note && <div className="text-xs text-muted">{a.note}</div>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className={btn} onClick={() => void copy('user', a)}>
                      ⧉ {t('acc.copyUser')}
                    </button>
                    {a.passwordEnc && (
                      <>
                        <button className={btn} onClick={() => void copy('pass', a)}>
                          ⧉ {t('acc.copyPass')}
                        </button>
                        <button className={btn} onClick={() => void toggleShow(a)}>
                          {shown[a.id] !== undefined ? `🙈 ${t('acc.hide')}` : `👁 ${t('acc.show')}`}
                        </button>
                      </>
                    )}
                    {s?.url && (
                      <button className={btn} onClick={() => void window.api.openSite(s.id)}>
                        ↗ {t('acc.open')}
                      </button>
                    )}
                    <span className="flex-1" />
                    <button className={btn} onClick={() => setEditing(a)}>
                      ✎ {t('common.edit')}
                    </button>
                    <button
                      className={`${btn} !border-bad/50 !text-bad`}
                      onClick={() => confirm(t('acc.confirmDelete')) && update((d) => ({ ...d, accounts: d.accounts.filter((x) => x.id !== a.id) }))}
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-xs text-muted">🔒 {t('acc.securityNote')}</p>
          <p className="mt-1 text-xs text-muted">🔑 {t('acc.autoLoginNote')}</p>
        </section>
      </div>

      {editing && (
        <AccountDialog
          initial={editing === 'new' ? null : editing}
          sites={data.sites}
          onSave={async (a, pw) => {
            if (await saveAccount(a, pw)) setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function AccountDialog({
  initial,
  sites,
  onSave,
  onClose
}: {
  initial: Account | null
  sites: Site[]
  onSave: (a: Account, password: string) => void
  onClose: () => void
}): React.JSX.Element {
  const t = useT()
  const [a, setA] = useState<Account>(initial ?? { id: `acc${Date.now()}`, siteId: sites[0]?.id ?? '', username: '' })
  const [pw, setPw] = useState('')
  const set = <K extends keyof Account>(k: K, v: Account[K]): void => setA((p) => ({ ...p, [k]: v }))
  const label = 'text-xs text-muted'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (a.siteId && a.username.trim()) onSave({ ...a, username: a.username.trim() }, pw)
        }}
        className="flex w-[460px] flex-col gap-3 rounded-2xl border border-line bg-bar p-6 shadow-2xl"
      >
        <h3 className="text-xl font-bold">{initial ? t('acc.editAccount') : t('acc.addAccount')}</h3>
        <label className={label}>
          {t('acc.site')}
          <select className={FIELD} value={a.siteId} onChange={(e) => set('siteId', e.target.value)}>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-3">
          <label className={`flex-1 ${label}`}>
            {t('acc.fullName')}
            <input className={FIELD} value={a.fullName ?? ''} onChange={(e) => set('fullName', e.target.value || undefined)} />
          </label>
          <label className={`flex-1 ${label}`}>
            {t('acc.phone')}
            <input className={FIELD} value={a.phone ?? ''} onChange={(e) => set('phone', e.target.value || undefined)} />
          </label>
        </div>
        <label className={label}>
          {t('acc.username')}
          <input className={FIELD} value={a.username} onChange={(e) => set('username', e.target.value)} autoFocus />
        </label>
        <label className={label}>
          {t('acc.password')}
          <input
            type="password"
            autoComplete="new-password"
            className={FIELD}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder={initial?.passwordEnc ? t('acc.keepPassword') : ''}
          />
        </label>
        <label className={label}>
          {t('dialog.note')}
          <input className={FIELD} value={a.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </label>
        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">
            {t('common.cancel')}
          </button>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            {t('common.save')}
          </button>
        </div>
      </form>
    </div>
  )
}
