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
  /** Số ngày tới kỳ thi (đếm ngược) và tên kỳ thi; không đặt thì ẩn */
  exam?: { title: string; days: number }
  /** Số bài tập chưa xong (hiện huy hiệu ở mục Bài tập) */
  openTasks: number
  onPage: (p: Page) => void
  onToggle: () => void
}

export default function Sidebar({ page, collapsed, exam, openTasks, onPage, onToggle }: Props): React.JSX.Element {
  const t = useT()
  return (
    <aside
      className={`flex shrink-0 flex-col gap-1 border-r border-line bg-side p-3 transition-[width] duration-200 ${
        collapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      {ITEMS.map((it) => (
        <button
          key={it.id}
          onClick={() => onPage(it.id)}
          title={t(`nav.${it.id}`)}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
            collapsed ? 'justify-center' : ''
          } ${page === it.id ? 'bg-accent font-semibold text-white' : 'text-soft hover:bg-hover'}`}
        >
          <span className="relative text-lg">
            {it.icon}
            {it.id === 'tasks' && openTasks > 0 && (
              <span className="absolute -right-2 -top-1.5 rounded-full bg-bad px-1 text-[10px] font-bold leading-4 text-white">{openTasks}</span>
            )}
          </span>
          {!collapsed && <span className="truncate">{t(`nav.${it.id}`)}</span>}
        </button>
      ))}

      <div className="mt-auto flex flex-col gap-2">
        {exam &&
          (collapsed ? (
            <div className="flex flex-col items-center rounded-xl bg-hover py-2 text-xs" title={exam.title}>
              🎓<b className="text-accent">{exam.days}</b>
            </div>
          ) : (
            <div className="rounded-xl bg-hover p-3 text-xs text-muted">
              <div className="truncate font-semibold text-soft">🎓 {exam.title}</div>
              <div>
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
          className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted hover:bg-hover ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <span>{collapsed ? '»' : '«'}</span>
          {!collapsed && <span>{t('sidebar.collapse')}</span>}
        </button>
      </div>
    </aside>
  )
}
