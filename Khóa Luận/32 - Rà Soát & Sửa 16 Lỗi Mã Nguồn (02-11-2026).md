---
tags: [khoa-luan, audit, bugfix, security, n8n, verified]
created: 2026-11-02
---

# 🛠️ Rà Soát & Sửa 16 Lỗi Mã Nguồn (02-11-2026)

> [!IMPORTANT]
> Rà soát toàn repo theo thứ tự: đúng → an toàn → chịu tải → có test → nhanh → gọn. Phát hiện 16 vấn đề, **đã sửa toàn bộ** và kiểm thử lại trên hệ thống thật (Docker + NestJS + n8n live). Chưa commit.

## 1. Kết quả kiểm thử sau khi sửa

| Kiểm tra | Trước | Sau |
|---|---|---|
| `pnpm lint` | API hỏng (thiếu ESLint config), web 52 cảnh báo | 0 cảnh báo |
| `pnpm check-types` | Sạch | Sạch |
| Jest `apps/api` | 47/47 | **49/49** (thêm `payroll.service.spec.ts`) |
| `scripts/test-all-endpoints.mjs` | 55/57 | **59/59** (thêm kiểm tra webhook thiếu khóa) |
| `scripts/test-security.mjs` | 12/14 phần đổi mật khẩu | **12/12** |
| Kiểm tra riêng các bản sửa (API thật) | — | **9/9** |
| WF04 phiên đã leo thang | AI vẫn trả lời | Chỉ lưu tin (`botMuted`), AI im lặng |

## 2. Danh sách lỗi và cách sửa

| # | Vấn đề | Sửa | Tệp chính |
|---|---|---|---|
| 1 | Webhook `/chat`, `/zalo-webhook` không khóa → ai vào cổng 5678 cũng hỏi được lương người khác | Header Auth `x-api-key`; `SlackService` gửi khóa; Docker chỉ bind `127.0.0.1` | `n8n-workflows/01,04`, `slack.service.ts`, `docker-compose*.yml` |
| 2 | WF04 `Is Bot Active?` nối cả 2 nhánh → bot trả lời sau khi leo thang | Nhánh false → node `Save Message (Bot Muted)` | `n8n-workflows/04-zalo-cskh.json` |
| 3 | Form OT không có ô nhập giờ → mọi đơn OT bị 400 | Thêm ô ngày + số giờ | `employee-portal-view.tsx` |
| 4 | `POST /leave` nhận `employeeId` tùy ý | EMPLOYEE luôn tạo đơn cho chính mình | `leave.controller.ts`, `leave.service.ts` |
| 5 | Geofence chỉ ở client | Server tính Haversine với `OfficeGeofence` (400/403) | `attendance.service.ts`, `single-row.utils.ts` |
| 6 | Giảm trừ 11tr (Cài đặt) ≠ 15,5tr (Rule Engine); mốc 2025 sai | `defaultSalaryConfigFor()` dùng chung; mốc `2026-01-01` (NQ 110/2025) | `pit.ts`, `salary-config.service.ts` |
| 7 | Prompt WF02 còn 7 bậc / 11tr / 4,4tr | Cập nhật 5 bậc, 15,5tr / 6,2tr | `02-hr-qa-agent.json` |
| 8 | Socket nhận phiên đã thu hồi, role lấy từ token | Handshake dùng `JwtStrategy.validate` | `notifications.gateway.ts`, `auth.module.ts` |
| 9 | Lint hỏng; web gọi React hook sau `return` (CSKH view) | ESLint config API; tách `CskhEscalationPanel`; sửa 50 cảnh báo | `apps/api/eslint.config.mjs`, `cskh-escalation-view.tsx` |
| 10 | Tính lương chưa có test đầu-cuối | 2 test, số tính tay | `payroll.service.spec.ts` |
| 11 | Cron reset mọi phiên CSKH | Chỉ phiên `escalatedAt != null` | `ai-context.service.ts` |
| 12 | Intent stats tải toàn bộ tin nhắn | Đếm bằng SQL `GROUP BY` | `agents.service.ts` |
| 13 | So sánh `x-api-key` không hằng thời gian | `timingSafeEqual` | `ai-context.service.ts` |
| 14 | Route chấm điểm cần cả JWT + key, không ai dùng | Xóa route, service, hàm web | `training.*` |
| 15 | Gói thừa (`zustand`, `react-query`, devtools, 2 gói `@deepseek-ai` làm hỏng `pnpm install`) | Gỡ 5 gói | `package.json` |
| 16 | `FirebaseModule`, WF05, 42 script một lần | Xóa module + WF05; script chuyển ra `khoa-luan-scripts-archive/` | — |

## 3. Việc vận hành đã làm

- Tạo lại container Docker để áp dụng cổng `127.0.0.1` (volume giữ nguyên dữ liệu).
- Cập nhật live WF01, WF02, WF04 trên n8n bằng script tạm, giữ nguyên credential đang dùng.
- Dọn toàn bộ dữ liệu kiểm thử (đơn phép, bản ghi chấm công, phiên chat, thông báo); khôi phục mật khẩu và mở khóa `hr-admin@company.com`.

## 4. Còn lại

- [ ] `scripts/setup-n8n.mjs` gọi `/api/v1/credentials` — n8n hiện tại trả 404 (lỗi có từ trước)
- [ ] Cố định phiên bản image `n8nio/n8n` thay cho `latest`
- [ ] Router recall thấp với câu không chứa từ khóa; PII chưa nhận máy bàn / số có dấu cách / họ tên / địa chỉ
- [ ] Commit các thay đổi

---

*Liên kết:* [[31 - Báo Cáo Khóa Luận - Chương 4-5 & Biểu Đồ Mermaid (02-11-2026)]] | [[09 - Task Checklist]] | [[06 - n8n Workflows & AI Agents]] | [[02 - Backend NestJS (API)]]
