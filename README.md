# Lịch học

Desktop app (Electron + TypeScript + React + Tailwind) nhắc giờ học và mở lớp Zoom / web bằng một cú bấm.
Chạy nền ở khay hệ thống, tự khởi động cùng Windows.

## Lệnh

```bash
npm install        # cài thư viện
npm run dev        # chạy chế độ phát triển (tự nạp lại khi sửa code)
npm run typecheck  # kiểm tra kiểu TypeScript
npm run build      # build ra thư mục out/
npm run build:win  # đóng gói file cài đặt .exe vào dist/
```

Kiểm thử nhanh popup nhắc giờ: `npx electron . --test-reminder`

## Cài trên máy khác (ví dụ máy ở nhà)

Cần: [Node.js](https://nodejs.org) 20 trở lên, [Git](https://git-scm.com), và app Zoom nếu muốn mở thẳng vào Zoom.

```bash
git clone <địa-chỉ-repo-của-bạn> LichHoc
cd LichHoc
npm install
node scripts/seed-n5.cjs     # lớp Tiếng Nhật (tuỳ chọn)
node scripts/seed-ca1.cjs    # lớp CA1 + Daymai/Azota (tuỳ chọn)
npm run build
npx electron .
```

- Dữ liệu cá nhân **không** nằm trong repo: lịch, điểm danh, mật khẩu nằm ở `%APPDATA%\lich-hoc`. Muốn mang sang máy mới thì chép thư mục đó (mật khẩu thì phải nhập lại, vì được mã hoá riêng cho từng máy/tài khoản Windows).
- Sửa code rồi muốn thấy ngay: `npm run dev`.
- Đóng gói file cài `.exe`: `npm run build:win` (kết quả trong `dist/`).
- Repo có Zoom link/mật mã lớp tiếng Nhật và tên đăng nhập CA1 trong thư mục `scripts/`: hãy để repo ở chế độ **Private**.

## Cấu trúc

```
src/
  shared/      kiểu dữ liệu + hàm tính giờ dùng chung (types.ts, schedule.ts)
  main/        tiến trình chính: lịch nhắc, thông báo, popup, tray, mở lớp, lưu dữ liệu
    store.ts       đọc/ghi data.json (ghi nguyên tử, có migrate từ bản 0.1)
    scheduler.ts   quét 15 giây/lần, bắn nhắc giờ mỗi buổi một lần
    notifier.ts    thông báo Windows + popup góc màn hình
    launcher.ts    "vào học": Zoom deep link, mặc định mở trình duyệt (chỗ gắn recipe sau này)
    windows.ts     cửa sổ chính (đóng = huỷ để nhả RAM) và popup
  preload/     cầu nối an toàn main <-> giao diện (window.api)
  renderer/    giao diện React: Lịch, Lớp học, Thống kê (điểm danh), Tài khoản, Cài đặt + popup nhắc giờ
resources/locales/   file ngôn ngữ (vi, en, ja)
scripts/             nạp dữ liệu mẫu
```

Dữ liệu nằm ở `%APPDATA%\lich-hoc\data.json` (mật khẩu trong đó chỉ là chuỗi đã mã hoá bằng Windows).

## Ngôn ngữ

Chữ trong app không viết cứng: mỗi ngôn ngữ là một file JSON.
- File đi kèm app: `resources/locales/vi.json`, `en.json`, `ja.json`.
- Muốn sửa chữ hoặc thêm ngôn ngữ (ví dụ `ko.json`): vào Cài đặt → "Mở thư mục ngôn ngữ" (`%APPDATA%\lich-hoc\locales`), sửa rồi bấm "Tải lại ngôn ngữ".
  Khoá nào thiếu thì lấy từ file của app, rồi từ tiếng Việt.
- Dòng `_name` trong file là tên hiện ở danh sách chọn ngôn ngữ.

## Nạp dữ liệu mẫu

```bash
node scripts/seed-n5.cjs    # lớp Tiếng Nhật N5 VIP (55 buổi, từ bảng lộ trình)
node scripts/seed-ca1.cjs   # lớp CA1 Toán cao cấp + Daymai.vn, Azota.vn + tài khoản (không có mật khẩu)
```
Đóng app trước khi chạy. Chạy lại không làm mất điểm danh, ngày nghỉ, mật khẩu đã nhập.

## Tính năng nền (bản 0.3)

| Việc | Ở đâu trong code |
|---|---|
| Vào học bằng cửa sổ riêng, nhớ đăng nhập, tự điền mật khẩu, bắt link Zoom → mở app Zoom | `src/main/webwin.ts`, `launcher.ts` |
| Lấy link từng buổi, phát hiện đổi giờ/huỷ, bài tập mới từ Daymai (3 tiếng/lần) | `src/main/daymai.ts` |
| Google Calendar (OAuth + PKCE, chỉ đụng lịch "Lịch học" do app tạo) và xuất `.ics` | `src/main/gcal.ts`, `src/shared/extras.ts` |
| Công thức web + chế độ ghi thao tác (Meet, web trường mới) | `src/main/webwin.ts` (`recordRecipe`, `runRecipe`) |
| Nhắc bài tập (trước 1 ngày, 2 giờ), nhắc xem bù buổi vắng, báo cáo tuần (CN 20:00) | `src/main/background.ts` |
| Chế độ tập trung (thu nhỏ app, im các nhắc khác tới hết buổi) | `src/main/focus.ts` |

Dữ liệu thêm: `%APPDATA%\lich-hoc\google.json` (token Google đã mã hoá bằng Windows), `state.json` (đã nhắc gì hôm nay).
Phiên đăng nhập từng nền tảng nằm trong thư mục `Partitions` cùng chỗ (xoá thư mục đó = đăng xuất hết).

### Liên kết Google Calendar (làm một lần)
Xem hướng dẫn ngay trong app: Cài đặt → "Lịch trên điện thoại" → "Cách lấy Client ID".
Không muốn làm: bấm "Xuất file .ics" rồi nhập file vào Google Calendar (chỉ là bản chụp, không tự cập nhật).

### Thêm buổi mới của Daymai
App tự lấy mỗi 3 tiếng (cần đã lưu mật khẩu Daymai ở trang Tài khoản, hoặc đã đăng nhập một lần trong cửa sổ của app).
Muốn lấy ngay: trang Bài tập → "Lấy từ Daymai".

## Lộ trình

1. (xong) Khung sườn, lịch tuần, nhắc giờ, mở Zoom, chạy nền.
2. (xong) Cửa sổ đăng nhập riêng cho từng nền tảng, tự đăng nhập, công thức + ghi thao tác.
3. (xong) Google Calendar, Daymai, bài tập, báo cáo tuần.
4. Azota (lấy bài tập tự động), SQLite, tự cập nhật (`electron-updater` + GitHub Releases), icon thật, đóng gói `.exe`.
