// Nạp lớp CA1 – Toán cao cấp (Khoá ôn Văn bằng 2 CAND 2027 – VB2.T10) cùng 2 nền tảng học
// (Daymai.vn, Azota.vn) và tài khoản vào data.json của app.
// Chạy:  node scripts/seed-ca1.cjs      (đóng app trước khi chạy)
//
// Mật khẩu KHÔNG ghi trong file này: hãy nhập trong app, trang "Tài khoản" (app tự mã hoá).
// Chạy lại thì chỉ cập nhật các mục cùng id, giữ nguyên mật khẩu đã lưu.
const fs = require('fs')
const path = require('path')

const dataFile = path.join(process.env.APPDATA, 'lich-hoc', 'data.json')

const sites = [
  {
    id: 'site-daymai',
    name: 'Daymai.vn',
    url: 'https://daymai.vn',
    note: 'Tham gia các buổi học trực tuyến và xem lại bài giảng'
  },
  {
    id: 'site-azota',
    name: 'Azota.vn',
    url: 'https://azota.vn',
    note: 'Làm bài tập, tham gia khảo sát và thi thử'
  }
]

const accounts = [
  {
    id: 'acc-daymai-ca1',
    siteId: 'site-daymai',
    fullName: 'Nguyễn Trung Dũng',
    phone: '094252597170',
    username: 'VB2.BCA10.02',
    note: 'Lớp VB2.T10 – CA1'
  },
  {
    id: 'acc-azota-ca1',
    siteId: 'site-azota',
    fullName: 'Nguyễn Trung Dũng',
    phone: '094252597170',
    username: 'VB2.BCA10.02',
    note: 'Dùng cùng mã học viên với Daymai.vn'
  }
]

const event = {
  id: 'ca1',
  title: 'CA1 – Toán cao cấp',
  type: 'web',
  siteIds: ['site-daymai', 'site-azota'],
  // Không có link của buổi thì mở danh sách buổi học của lớp trên Daymai
  url: 'https://daymai.vn/student/course/33967468/session',
  days: [3, 5], // Thứ 4, Thứ 6
  time: '20:30', // theo thời khoá biểu chính thức (Daymai mở phòng 20:20 → 23:00)
  duration: 120, // 20:30 - 22:30
  remind: 5,
  color: '#10b981',
  enabled: true,
  camOff: true,
  micOff: true,
  examDate: '2027-09-20', // ngày thi môn Toán cao cấp: 20/9 (năm 2027, lần 20/9 gần nhất sau khi khai giảng)
  startDate: '2026-11-06', // 05/11 chỉ là mốc khởi động, không có buổi học; buổi đầu là Thứ 6 06/11/2026
  // Mỗi buổi một link cố định trên Daymai (lấy từ danh sách buổi học ngày 05/11/2026).
  // Daymai mới công bố 9 buổi đầu; khi có buổi mới, thêm dòng "ngày": "mã buổi" vào đây rồi chạy lại.
  sessionLinks: Object.fromEntries(
    [
      ['2026-11-06', 33968068],
      ['2026-11-11', 33968069],
      ['2026-11-13', 33968070],
      ['2026-11-18', 33968071],
      ['2026-11-20', 33968072],
      ['2026-11-25', 33968073],
      ['2026-11-27', 33968074],
      ['2026-12-02', 33968075],
      ['2026-12-04', 33968076]
    ].map(([d, id]) => [d, `https://daymai.vn/student/session/${id}`])
  ),
  note: 'Lớp VB2.T10 · Khoá ôn Văn bằng 2 CAND 2027. Học trên Daymai.vn, bài tập và thi thử trên Azota.vn.'
}

let data = { version: 1, sites: [], accounts: [], events: [] }
try {
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
} catch {
  /* chưa có file: tạo mới */
}
data.sites = data.sites || []
data.accounts = data.accounts || []
data.events = data.events || []

const upsert = (list, item, keep = []) => {
  const old = list.find((x) => x.id === item.id)
  const merged = { ...item }
  for (const k of keep) if (old && old[k] !== undefined) merged[k] = old[k]
  return [...list.filter((x) => x.id !== item.id), merged]
}

for (const s of sites) data.sites = upsert(data.sites, s)
for (const a of accounts) data.accounts = upsert(data.accounts, a, ['passwordEnc']) // giữ mật khẩu đã nhập
// giữ điểm danh và ngày nghỉ đã có của lớp
data.events = upsert(data.events, event, ['attendance', 'breaks', 'totalSessions'])

fs.mkdirSync(path.dirname(dataFile), { recursive: true })
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
console.log(`Đã nạp lớp "${event.title}", ${sites.length} nền tảng, ${accounts.length} tài khoản (chưa có mật khẩu) -> ${dataFile}`)
