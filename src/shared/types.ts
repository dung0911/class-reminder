// Kiểu dữ liệu dùng chung cho main, preload và renderer.

export type ClassType = 'zoom' | 'meet' | 'teams' | 'web' | 'other'

/** Nội dung một buổi trong lộ trình (đọc từ bảng lộ trình của lớp) */
export interface SyllabusItem {
  no: number
  lesson: string
  koma?: string
  items: string[]
  homework: string
}

/** Đợt nghỉ (gồm cả ngày đầu và ngày cuối). Nghỉ một ngày thì from = to. Định dạng "YYYY-MM-DD". */
export interface Break {
  from: string
  to: string
  note?: string
}

/** Trạng thái đã ghi nhận của một buổi đã/đang diễn ra */
export type Attendance = 'present' | 'absent'

/** Một lớp học lặp theo tuần. days: 0 = Chủ nhật, 1 = Thứ 2 ... 6 = Thứ 7 */
export interface ClassEvent {
  id: string
  title: string
  type: ClassType
  /** Các trang/nền tảng học của lớp (xem Site), ví dụ Daymai.vn, Azota.vn */
  siteIds?: string[]
  /** Link vào lớp. Để trống thì dùng link của trang đầu tiên trong siteIds. */
  url: string
  days: number[]
  /** "HH:mm" */
  time: string
  /** phút */
  duration: number
  /** nhắc trước (phút) */
  remind: number
  color: string
  enabled: boolean
  /** Tuỳ chọn vào lớp với cam/mic tắt (dùng khi có tự động hoá) */
  camOff: boolean
  micOff: boolean
  /** Ngày học buổi đầu "YYYY-MM-DD". Có thì buổi được đánh số từ ngày này; không có thì lặp mãi. */
  startDate?: string
  /** Tổng số buổi của khoá; học đủ thì dừng */
  totalSessions?: number
  /** Ngày thi của môn này "YYYY-MM-DD" (đếm ngược, đưa lên Google Calendar) */
  examDate?: string
  /** Lộ trình theo số buổi (buổi n = phần tử có no = n) */
  syllabus?: SyllabusItem[]
  /** Các đợt nghỉ. Buổi rơi vào ngày nghỉ không được tính: các buổi sau tự lùi lại. */
  breaks?: Break[]
  /** Điểm danh theo ngày "YYYY-MM-DD" */
  attendance?: Record<string, Attendance>
  /**
   * Link vào lớp riêng của từng ngày "YYYY-MM-DD" (ví dụ Daymai: mỗi buổi một link cố định,
   * phía sau là phòng Zoom luôn thay đổi). Ngày nào không có thì dùng `url`.
   */
  sessionLinks?: Record<string, string>
  /** Giờ bắt đầu của từng buổi trên web nguồn (Daymai) lần đồng bộ gần nhất, để phát hiện buổi bị đổi giờ */
  sessionTimes?: Record<string, string>
  /** Ghi chú từng buổi theo ngày "YYYY-MM-DD": ghi chú, link xem lại, đã xem bù chưa */
  sessionNotes?: Record<string, SessionNote>
  /** Ghi chú, ví dụ ID phòng và mật mã Zoom */
  note?: string
}

/** Ghi chú của một buổi học */
export interface SessionNote {
  note?: string
  /** Link bản ghi hình để xem bù */
  recordingUrl?: string
  /** Đã xem bù (dùng cho buổi vắng) */
  watched?: boolean
}

/** Bài tập / bài thi cần nộp */
export interface Task {
  id: string
  title: string
  /** Hạn nộp, giờ địa phương "YYYY-MM-DDTHH:mm"; có thể không có */
  due?: string
  /** Thuộc lớp nào */
  eventId?: string
  /** Link làm bài */
  url?: string
  done: boolean
  source: 'manual' | 'daymai'
  /** Mã của bài trên web nguồn, để lần đồng bộ sau không tạo trùng */
  remoteId?: string
  /** Các mốc đã nhắc: '1d' (trước 1 ngày), '2h' (trước 2 giờ) */
  reminded?: string[]
}

/** Một bước của công thức đăng nhập/vào lớp trên web */
export interface RecipeStep {
  do: 'click' | 'type' | 'wait'
  selector?: string
  /** Chữ trên nút, dùng khi selector không còn khớp */
  text?: string
  /** Nội dung gõ. Có thể chứa {{username}} và {{password}} (thay lúc chạy) */
  value?: string
  ms?: number
}

/** Một nền tảng học: Daymai.vn, Azota.vn, Zoom của trường... Nhiều lớp dùng chung một Site. */
export interface Site {
  id: string
  name: string
  /** Địa chỉ trang (dùng để mở nhanh / đăng nhập) */
  url: string
  /** Dùng để làm gì */
  note?: string
  /** Công thức tự thao tác (ghi bằng chế độ Record); có thì chạy sau khi trang mở */
  recipe?: RecipeStep[]
}

/** Tài khoản đăng nhập một Site. Mật khẩu được mã hoá bằng Windows (safeStorage), không lưu chữ rõ. */
export interface Account {
  id: string
  siteId: string
  fullName?: string
  phone?: string
  username: string
  /** Mật khẩu đã mã hoá (base64). Chỉ main giải mã được. */
  passwordEnc?: string
  note?: string
}

export type ThemeMode = 'system' | 'dark' | 'light'

/** Màu nhấn của giao diện */
export type Accent = 'indigo' | 'blue' | 'purple' | 'green' | 'rose'

export interface Settings {
  theme: ThemeMode
  accent: Accent
  /** Thanh bên: 'plain' = nền thường, 'accent' = đổ màu chuyển sắc theo màu nhấn */
  sidebarStyle?: 'plain' | 'accent'
  /** mã ngôn ngữ: vi, en, ja, hoặc file tự thêm */
  lang: string
  sidebarCollapsed: boolean
  /** Kỳ thi cuối cùng cần đếm ngược */
  examTitle?: string
  /** "YYYY-MM-DD" */
  examDate?: string
  /** Vào học bằng cửa sổ riêng của app (nhớ đăng nhập, tự đăng nhập, bắt link Zoom). Tắt = dùng trình duyệt mặc định. */
  joinInApp: boolean
  /** Google Meet cũng mở trong cửa sổ của app để tự tắt mic/camera (Google có thể chặn đăng nhập trong cửa sổ này) */
  meetInApp: boolean
  /** Bấm Vào học thì thu nhỏ app và tạm im các nhắc khác tới hết buổi */
  focusOnJoin: boolean
}

export interface AppData {
  version: 1
  events: ClassEvent[]
  sites: Site[]
  accounts: Account[]
  tasks: Task[]
  settings: Settings
}

/** Kết quả một lần đồng bộ (Daymai, Google Calendar) */
export interface SyncResult {
  ok: boolean
  message: string
}

/** Tình trạng liên kết Google Calendar (token nằm riêng trong google.json, không đưa sang giao diện) */
export interface GoogleStatus {
  clientId: string
  hasSecret: boolean
  auto: boolean
  connected: boolean
  calendarId?: string
  lastSync?: string
  lastError?: string
}

export interface LangInfo {
  code: string
  name: string
}

export interface I18nBundle {
  lang: string
  dict: Record<string, string>
  languages: LangInfo[]
}

/** API mà preload mở ra cho renderer (window.api) */
export interface Api {
  getData(): Promise<AppData>
  saveData(data: AppData): Promise<void>
  join(ev: ClassEvent): Promise<void>
  getAutostart(): Promise<boolean>
  setAutostart(on: boolean): Promise<boolean>
  reminderInfo(): Promise<{ lang: string; title: string; time: string; hasUrl: boolean } | null>
  reminderAction(action: 'join' | 'snooze' | 'dismiss'): Promise<void>
  onToast(cb: (msg: string) => void): () => void
  /** Main đã tự sửa dữ liệu (ví dụ ghi nhận có mặt khi bấm Vào học): renderer nạp lại */
  onDataChanged(cb: () => void): () => void
  i18nLoad(lang: string): Promise<I18nBundle>
  openLocalesFolder(): Promise<void>
  setWindowTheme(theme: 'dark' | 'light'): Promise<void>
  /** Mã hoá mật khẩu bằng Windows; null nếu máy không hỗ trợ */
  encryptSecret(plain: string): Promise<string | null>
  /** Giải mã rồi chép vào clipboard, tự xoá sau 30 giây */
  copySecret(enc: string): Promise<boolean>
  revealSecret(enc: string): Promise<string | null>
  copyText(text: string): Promise<void>
  openUrl(url: string): Promise<void>
  /** Mở một nền tảng trong cửa sổ riêng của app (tự đăng nhập nếu có mật khẩu, chạy công thức nếu có) */
  openSite(siteId: string): Promise<void>
  /** Ghi lại thao tác của bạn trên nền tảng thành công thức; lưu khi đóng cửa sổ */
  recipeRecord(siteId: string): Promise<void>
  recipeRun(siteId: string): Promise<void>
  /** Lấy buổi học và bài tập mới từ Daymai */
  syncDaymai(): Promise<SyncResult>
  googleStatus(): Promise<GoogleStatus>
  googleSetConfig(cfg: { clientId: string; clientSecret?: string; auto: boolean }): Promise<GoogleStatus>
  /** Mở trình duyệt để bạn cấp quyền, chờ xong rồi trả tình trạng */
  googleConnect(): Promise<GoogleStatus>
  googleDisconnect(): Promise<GoogleStatus>
  googleSync(): Promise<SyncResult>
  /** Lưu lịch ra file .ics; trả về đường dẫn, null nếu bạn huỷ */
  exportIcs(): Promise<string | null>
}
