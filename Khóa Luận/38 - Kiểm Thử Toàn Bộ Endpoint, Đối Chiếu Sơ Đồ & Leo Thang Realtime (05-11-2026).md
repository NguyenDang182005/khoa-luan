---
tags: [khoa-luan, kiem-thu, endpoint, uml, bao-cao, websocket, cskh, bug, verified]
created: 2026-11-05
---

# 🧪 Kiểm Thử Toàn Bộ Endpoint, Đối Chiếu Sơ Đồ & Leo Thang Realtime (05-11-2026)

> [!IMPORTANT]
> Chạy thật toàn bộ endpoint và các luồng đã vẽ trong báo cáo, đối chiếu 22 sơ đồ với mã nguồn + workflow n8n. Tìm ra **7 lỗi hệ thống** (sửa 2) và **16 sơ đồ lệch code** (đã vẽ lại, thay ảnh trong báo cáo). Thêm cảnh báo leo thang CSKH realtime cho ADMIN. Tiếp nối [[37 - Vẽ Lại 22 Sơ Đồ UML & Chèn Vào Báo Cáo (05-11-2026)]]. **Chưa commit.**

## 1. Kết quả kiểm thử

| Bộ test | Kết quả |
|---|---|
| `scripts/test-all-endpoints.mjs` (có sẵn) | **59/59** — cần `N8N_API_KEY` trong shell, thiếu thì 4 test n8n báo lỗi giả |
| `scripts/test-diagram-flows.mjs` (mới) | **189/191** — 2 fail là lỗi leo thang CSKH (mục 2.3) |

- Quét 50 route GET × 3 vai trò (admin / nhân viên / không token): không 5xx; thiếu token → 401; route ADMIN chặn nhân viên → 403; route `/n8n/*` thiếu `x-api-key` → 401/403.
- Chạy thật các luồng Hình 3.9, 4.2–4.12: tạo nhân viên, đăng nhập/sid/RefreshToken 30 ngày, khóa 5 lần sai, logout thu hồi phiên, chấm công (LATE, 409, bước 0,25), nghỉ phép (đếm ngày, trùng, vượt số dư, duyệt → ON_LEAVE, hủy, từ chối), lương (DRAFT → APPROVED → PAID, khóa tính lại), audit cấu hình, RAG pgvector, hỏi lương qua HR Agent, sinh + chấm quiz, CSKH leo thang + bot muted.
- **Trước khi test ghi dữ liệu luôn snapshot DB và khôi phục sau** (số liệu báo cáo không bị lệch):

```bash
docker exec hr_system_db pg_dump -U postgres -Fc hr_system_db -f /tmp/pretest.dump
docker exec hr_system_db sh -c 'pg_restore -U postgres -d hr_system_db --clean --if-exists --single-transaction /tmp/pretest.dump'
```

Chạy test luồng:

```bash
export N8N_API_KEY=$(grep '^N8N_API_KEY=' apps/api/.env | cut -d= -f2-)
node scripts/test-diagram-flows.mjs
```

## 2. Lỗi hệ thống tìm được

### 2.1 Không tạo được nhân viên mới — ĐÃ SỬA
- `POST /employees` luôn 409 "Không sinh được mã nhân viên" từ 25/09.
- Nguyên nhân: seed dùng mã 3 chữ số (`EMP001`–`EMP030`), hàm sinh mã tạo 4 chữ số và lấy max bằng **sắp xếp chuỗi** → `EMP030` > `EMP0031` → sinh lặp lại `EMP0031` đã tồn tại.
- Sửa `employees.service.ts` `generateCode()`: lấy số lớn nhất theo giá trị số.

### 2.2 DeepSeek trả rỗng do hết token — CHƯA SỬA (cần quyết định)
- `deepseek-flash` dùng hết 1024 token (`finish_reason: length`) mà nội dung rỗng (token bị tiêu cho suy luận).
- 60 execution gần nhất: **sinh đề rỗng 6/7** (dùng bộ đề viết cứng), **chấm bài rỗng 4/7** (mọi tiêu chí 5/10), role-play 1/5. HR và CSKH không bị.
- Muốn sửa phải tăng `maxTokens` cho WF03 → trái quy định 1024 trong `AGENTS.md`.

### 2.3 Leo thang CSKH không ổn định — CHƯA SỬA
- Cùng câu "cho tôi gặp người thật ngay": lần 1 leo thang, lần 2 AI nói "xin phép chuyển bộ phận CSKH" nhưng **không gắn `[CAN_ESCALATE]`** → bot không tắt, admin không được báo.
- Hướng sửa: thêm luật từ khóa dự phòng trong Parse CSKH Output.

### 2.4 Các lỗi khác
- **HR Agent đọc phiếu DRAFT cũ:** EMP005 T10 tạo 14/10 có thực lĩnh **−50.000đ** (trừ BH khi 0 ngày công). Code hiện tại tính đúng; cần generate lại các phiếu DRAFT cũ.
- **User mồ côi:** User tạo ngoài transaction, tạo nhân viên lỗi vẫn để lại User.
- **Geofence đang tắt:** `.env` bật `ATTENDANCE_GEOFENCE_MOCK=true` → check-in ở (0,0) vẫn 201.
- **Admin không nhận WebSocket** — ĐÃ SỬA ở mục 4.

## 3. Đối chiếu & sửa 16 sơ đồ

3 subagent đọc code + workflow n8n cho đủ 22 sơ đồ. Workflow live trên n8n trùng khớp hoàn toàn với `n8n-workflows/*.json`.

| Hình | Sửa |
|---|---|
| 3.1 | Generalization ADMIN → EMPLOYEE (ADMIN dùng được mọi chức năng nhân viên) |
| 3.2 | WF05 → WF04; Slack DM → Slack channel; tách DeepSeek và Google embedding |
| 3.3 | Slack channel; ghi chú Agent Error Fallback và nhánh `/n8n/outbound-reply` |
| 3.4 | LoginHistory, SettingsAuditLog, phòng ban cấp trên, người quản lý là `0..1` |
| 3.5 | Thêm luật `sessionType HR_QA`; bỏ "giữ sessionType"; bước tự đặt `generate_quiz` |
| 3.7 | AI chỉ chấm 2 tự luận, MCQ chấm bằng code; dự phòng 5/10 mỗi câu (không phải 60%) |
| 3.8 | Các nhánh sau Parse chạy lần lượt; Bot Muted dừng luôn |
| 3.10 | AuthProvider ở `page.tsx`; EMPLOYEE có 3 màn; useAiSocket dùng cho cả cảnh báo CSKH |
| 4.1 | Tách DeepSeek / Google; thêm WebSocket, `verifyIdToken` |
| 4.2 | 409 khi trùng, PROBATION, hợp đồng thử việc; điều kiện "có truyền role" |
| 4.3 | GET geofence ở SettingsService; check-out 201; overtime = max; nhánh cuối tuần/lễ |
| 4.5 | Trùng ngày / vượt số dư → 400 |
| 4.7 | adjust không tính lại thuế/BH; APPROVED không sửa được |
| 4.8 | 4 kiểu thao tác: PATCH có audit, ngày lễ, cấu hình lương, kiểm tra tích hợp |
| 4.11 | Màn `ai-agents-view`; WF01 suy ra `generate_quiz` từ từ khóa |
| 4.12 | WebSocket `notification:new` tới Admin Portal → cảnh báo → mở Tiếp quản CSKH |

> [!NOTE]
> Ảnh bản mới nằm trên repo public `NguyenDang182005/khoa-luan-figures` với hậu tố `-v2`/`-v3` (tránh cache của Google). Docs đã giữ bản sao, repo này xóa được.

Sửa chữ trong báo cáo: "khách nhắn Slack DM" → "khách nhắn vào Slack channel"; "EMPLOYEE thấy 4 phân hệ" → "3 phân hệ".

## 4. Cảnh báo leo thang CSKH realtime cho ADMIN

Trước đây server phát `notification:new` nhưng web không nghe; màn CSKH chỉ poll 10s → các câu "thông báo WebSocket real-time" trong báo cáo (MT4, đóng góp, 2.5.2, kết luận) sai với code.

| File | Thay đổi |
|---|---|
| `apps/web/lib/hooks/useAiSocket.ts` | Thêm `onNotification` cho `notification:new` |
| `apps/web/components/shell/escalation-alert.tsx` (mới) | Thẻ cảnh báo góc dưới phải (tối đa 3), nút "Mở Tiếp quản CSKH", phát sự kiện `hr:escalation` |
| `apps/web/app/page.tsx` | Gắn cảnh báo cho mọi ADMIN |
| `apps/web/components/views/cskh-escalation-view.tsx` | Nghe `hr:escalation` → tải lại hàng đợi ngay; poll 10s giữ làm dự phòng |
| `apps/web/lib/schemas/escalation.schema.ts` | `metadata` → `.nullish()`: một phiên thiếu metadata từng làm sập cả màn CSKH |

**Nội dung cảnh báo:** "🚨 Khiếu nại cần xử lý thủ công", `Kênh | User Slack | lý do AI`, tin nhắn cuối của khách. Chỉ ADMIN thấy.

**Đã kiểm thử trên trình duyệt:** cảnh báo hiện ngay khi gọi `/n8n/escalate`; đứng ở màn CSKH thì phiên mới vào hàng đợi < 1,5s. Typecheck + eslint sạch.

> [!WARNING]
> `POST /notifications/send` cũng phát `notification:new`. Chưa workflow nào gọi, nhưng nếu dùng sau này thì cảnh báo sẽ hiện cả thông báo không phải leo thang → nên lọc theo `data.sessionId`.

## 5. Việc còn mở

- Quyết định tăng `maxTokens` cho WF03 (và sửa `AGENTS.md`).
- Luật dự phòng cho leo thang CSKH.
- Generate lại các phiếu lương DRAFT cũ.
- Báo cáo: `POST /ai-context/outbound-reply` → đúng là `/n8n/outbound-reply`.
- Lọc cảnh báo theo `data.sessionId`; mỗi admin ở dashboard đang có 2 kết nối socket.
- Xem bố cục trang trong Docs (Hình 3.7, 4.2 cao ~555pt).
- Commit: tách code (sinh mã nhân viên, listener) và tài liệu (sơ đồ, script test).
