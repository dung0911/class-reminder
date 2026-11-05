import { useT } from '@/lib/i18n'

export type Page = 'calendar' | 'courses' | 'tasks' | 'dashboard' | 'accounts' | 'settings'

const ITEMS: { id: Page; icon: string }[] = [
  { id: 'calendar', icon: '🗓️' },
  { id: 'courses', icon: '📚' },
  { id: 'tasks', icon: '📝' },
  { id: 'dashboard', icon: '📊' },
  { id: 'accounts', icon: '👤' },
  { id: 'settings', icon: '⚙️' }
]

interface Props {
  page: Page
  collapsed: boolean
  /** Thanh bên đổ màu chuyển sắc theo màu nhấn */
  tinted?: boolean
  /** Tên hiện ở thẻ trên cùng (lấy từ tài khoản đầu tiên) */
  userName: string
  /** Các lớp để chọn nhanh ở mục "Lớp của tôi" */
  classes: { id: string; title: string; color: string }[]
  /** Lớp đang lọc trên trang Lịch ('all' = tất cả) */
  filter: string
  /** Số ngày tới kỳ thi (đếm ngược) và tên kỳ thi; không đặt thì ẩn */
  exam?: { title: string; days: number }
  /** Số bài tập chưa xong (hiện huy hiệu ở mục Bài tập) */
  openTasks: number
  onPage: (p: Page) => void
  onPickClass: (id: string) => void
  onToggle: () => void
}

const initials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

export default function Sidebar({ page, collapsed, tinted, userName, classes, filter, exam, openTasks, onPage, onPickClass, onToggle }: Props): React.JSX.Element {
  const t = useT()
  const label = 'px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted'
  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 overflow-y-auto border-r border-line p-3 transition-[width] duration-200 ${
        tinted ? 'sb-accent' : 'bg-side'
      } ${collapsed ? 'w-[72px]' : 'w-64'}`}
    >
      {/* Thẻ người dùng */}
      <div className={`mb-1 flex items-center gap-3 card p-2.5 shadow-sm ${collapsed ? 'justify-center' : ''}`}>
        <div className="btn-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
          {initials(userName) || '🎓'}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold">{userName || t('app.name')}</div>
            <div className="truncate text-xs text-muted">{t('sidebar.student')}</div>
          </div>
        )}
      </div>

      {!collapsed && <div className={label}>{t('sidebar.menu')}</div>}
      {ITEMS.map((it) => {
        const on = page === it.id
        return (
          <button
            key={it.id}
            onClick={() => onPage(it.id)}
            title={t(`nav.${it.id}`)}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
              collapsed ? 'justify-center' : ''
            } ${on ? 'bg-accent-soft font-semibold text-accent' : 'text-soft hover:bg-hover'}`}
          >
            {on && <span className="absolute left-0 top-2 h-[calc(100%-16px)] w-1 rounded-full bg-accent" />}
            <span className="relative text-lg">
              {it.icon}
              {it.id === 'tasks' && openTasks > 0 && (
                <span className="absolute -right-2 -top-1.5 rounded-full bg-bad px-1 text-[10px] font-bold leading-4 text-white">{openTasks}</span>
              )}
            </span>
            {!collapsed && <span className="truncate">{t(`nav.${it.id}`)}</span>}
          </button>
        )
      })}

      {classes.length > 0 && (
        <>
          {!collapsed && <div className={label}>{t('sidebar.myClasses')}</div>}
          {collapsed && <div className="my-2 h-px bg-line" />}
          {classes.map((c) => {
            const on = page === 'calendar' && filter === c.id
            return (
              <button
                key={c.id}
                onClick={() => onPickClass(c.id)}
                title={c.title}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${collapsed ? 'justify-center' : ''} ${
                  on ? 'bg-hover font-semibold text-ink' : 'text-soft hover:bg-hover'
                }`}
              >
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{ background: c.color }}
                >
                  {c.title.trim()[0]?.toUpperCase()}
                </span>
                {!collapsed && <span className="truncate">{c.title}</span>}
              </button>
            )
          })}
        </>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-3">
        {exam &&
          (collapsed ? (
            <div className="flex flex-col items-center rounded-xl bg-hover py-2 text-xs" title={exam.title}>
              🎓<b className="text-accent">{exam.days}</b>
            </div>
          ) : (
            <div className="card p-3 text-xs text-muted shadow-sm">
              <div className="truncate font-semibold text-soft">🎓 {exam.title}</div>
              <div className="mt-0.5">
                <b className="text-2xl text-accent">{exam.days}</b> {t('exam.daysLeft')}
              </div>
            </div>
          ))}
        {collapsed ? (
          <div className="flex justify-center py-2" title={t('sidebar.running')}>
            <span className="h-2.5 w-2.5 rounded-full bg-ok" />
          </div>
        ) : (
          <div className="rounded-xl bg-hover p-3 text-xs text-muted">
            <div className="mb-1 flex items-center gap-2 font-semibold text-ok">
              <span className="h-2 w-2 rounded-full bg-ok" /> {t('sidebar.running')}
            </div>
            {t('sidebar.runningHint')}
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover ${collapsed ? 'justify-center' : ''}`}
        >
          <span>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>{t('sidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  )
}
