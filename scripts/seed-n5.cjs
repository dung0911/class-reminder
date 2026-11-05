// Nạp lớp "Tiếng Nhật N5 VIP" (từ bảng lộ trình + thông tin Zoom) vào data.json của app.
// Chạy:  node scripts/seed-n5.cjs      (đóng app trước khi chạy)
// Chạy lại thì chỉ thay lớp có id "tiengnhat", các lớp khác giữ nguyên.
const fs = require('fs')
const path = require('path')

const dataFile = path.join(process.env.APPDATA, 'lich-hoc', 'data.json')
const syllabus = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed', 'n5-vip-syllabus.json'), 'utf8'))

const event = {
  id: 'tiengnhat',
  title: 'Tiếng Nhật N5 VIP',
  type: 'zoom',
  url: 'https://zoom.us/j/91282809021?pwd=XPrl50caMCIjUwbTipvwrvFl9zIoJv.1',
  days: [2, 4, 6], // T3, T5, T7
  time: '19:00',
  duration: 120, // 19:00 - 21:00
  remind: 5,
  color: '#6366f1',
  enabled: true,
  camOff: true,
  micOff: true,
  startDate: '2026-10-24', // buổi 1: Thứ 7
  totalSessions: syllabus.length, // 55
  syllabus,
  note: 'ID cuộc họp: 912 8280 9021 · Mật mã: 241026'
}

let data = { version: 1, sites: [], events: [] }
try {
  data = JSON.parse(fs.readFileSync(dataFile, 'utf8'))
} catch {
  /* chưa có file: tạo mới */
}
// Giữ điểm danh và ngày nghỉ bạn đã nhập nếu lớp đã có sẵn
const old = (data.events || []).find((e) => e.id === event.id)
if (old && old.attendance) event.attendance = old.attendance
if (old && old.breaks) event.breaks = old.breaks
data.events = (data.events || []).filter((e) => e.id !== event.id)
data.events.push(event)
fs.mkdirSync(path.dirname(dataFile), { recursive: true })
fs.writeFileSync(dataFile, JSON.stringify(data, null, 2), 'utf8')
console.log(`Đã nạp "${event.title}": ${syllabus.length} buổi, bắt đầu ${event.startDate} -> ${dataFile}`)
