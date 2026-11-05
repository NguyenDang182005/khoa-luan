---
tags: [khoa-luan, n8n, deepseek, ai-agents, security, ui, bugfix, verified]
created: 2026-11-03
---

# 🔄 Chuyển AI Agent Sang DeepSeek & Rà Soát Logic UI (03-11-2026)

> [!IMPORTANT]
> Gemini 3.1 Flash Lite trả **503 "high demand"** và bị giới hạn request/ngày → chat HR báo "Agent AI không phản hồi". Toàn bộ agent WF02/03/04 đã chuyển sang **DeepSeek `deepseek-flash`**. Đồng thời sửa intent WF01, chặn LLM tự chọn `employee_id`, rồi rà soát toàn bộ web: 11 lỗi logic + thông tin thừa. Đã kiểm thử trên hệ thống thật. **Chưa commit.**

## 1. Chẩn đoán lỗi chat

| Triệu chứng | Nguyên nhân thật |
|---|---|
| UI: "Agent AI (n8n) không phản hồi" | Gemini `gemini-3.1-flash-lite` trả 503 (quá tải phía Google), retry x3 vẫn lỗi |
| WF01 trả `HTTP 200` body rỗng | Sub-workflow lỗi → node `Respond Chat Webhook` không chạy |
| Lỗi 403 `/agents/pii-audit` | `saveSession` không xóa phiên cũ ở storage còn lại; `client.ts` đọc `localStorage` trước → gửi token của user cũ |
| Câu HR bị xếp `OTHER` khi test | **Do curl trên Git Bash/Windows làm hỏng UTF-8**, không phải lỗi WF01 — test bằng Node `fetch` mới đúng |

Wiring live 4 WF đều đúng, file JSON trong repo khớp 100% bản live; hôm 02/11 cả 4 WF chạy thành công.

## 2. Chuyển model sang DeepSeek

- Credential n8n: `DeepSeek account` (người dùng tự tạo — không dán API key vào chat).
- API key chỉ thấy 2 model: `deepseek-flash` và `deepseek-v4-pro`. `deepseek-chat` là **alias trỏ tới `deepseek-flash`**; `v4-pro` treo >45s → không dùng cho chat.
- Node `Gemini Flash` → `DeepSeek Chat` (`@n8n/n8n-nodes-langchain.lmChatDeepSeek`), giữ temperature (HR 0.3 / Training 0.8 / CSKH 0.5), `maxTokens: 1024`.
- RAG vẫn dùng **`gemini-embedding-001`** (768 chiều) — chỉ tốn quota embedding.
- Script: `scripts/swap-llm-deepseek.cjs <credId> <file.json...>` — đổi node, connection, `metadata.model`.

| Agent | Model | Temperature |
|---|---|---|
| WF01 Router | Rule-based, không LLM | — |
| WF02 HR Q&A | deepseek-flash | 0.3 |
| WF03 Training | deepseek-flash | 0.8 |
| WF04 CSKH | deepseek-flash | 0.5 |

## 3. Sửa WF01–WF04

| # | Vấn đề | Sửa |
|---|---|---|
| 1 | **Bảo mật:** tool `GetEmployeeContext` / `GetPayrollContext` nhận `employee_id` do LLM điền → hỏi "lương EMP003" có thể lộ dữ liệu | URL lấy `employeeId` từ node `Normalize Input` (phiên đăng nhập), bỏ placeholder |
| 2 | Retry ở cả Agent lẫn model → 503 làm chạy lại cả vòng tool-calling (92s) | Bỏ retry ở node Agent, giữ ở node model |
| 3 | Agent con lỗi → body rỗng | Execute nodes `onError: continueErrorOutput` → node `Agent Error Fallback` trả "⚠️ Hệ thống AI đang bận…" |
| 4 | Đang ở module HR gõ "khách hàng/dịch vụ" bị đẩy sang CSKH | `sessionType === 'HR_QA'` được ưu tiên trước từ khóa |
| 5 | Thiếu từ khóa HR | Thêm: phòng ban, trưởng phòng, mã số thuế, giờ làm, ca làm, thâm niên, nghỉ hưu, kỷ luật… |

**Cách đẩy lên n8n live (CLI trong container):** `n8n export:workflow --id` → vá JSON → `n8n import:workflow` → `n8n publish:workflow --id` → `docker restart hr_n8n`.

> [!WARNING]
> File tạo bằng `docker cp` thuộc quyền root → `n8n export` (user `node`) không ghi đè được. Xóa trước bằng `docker exec -u root hr_n8n rm -f /home/node/*.json`. Trên Git Bash phải đặt `MSYS_NO_PATHCONV=1`.

## 4. Kết quả kiểm thử (qua portal NestJS, sau khi sửa)

| Kịch bản | Kết quả | Thời gian |
|---|---|---|
| Lương T10/2026 của tôi | Bảng lương EMP006 | 6.0s |
| Xem lương của EMP003 | **Từ chối** | 2.1s |
| Phép còn lại | 11/12 ngày | 4.2s |
| Module HR + từ khóa CSKH | Vẫn `HR_QA` | 7.0s |
| Training role-play | Nhập vai đúng kịch bản | 4.1s |
| CSKH "bị trừ tiền 2 lần" | Trả lời + **tự escalate** | 3.9s |
| Intent unit test (24 câu UTF-8) | **24/24** | — |

Trước khi sửa: 60–92s hoặc 502.

## 5. Rà soát logic & giao diện web

**Nút "Tạo đơn":** form có 8 loại (phép năm, ốm, không lương, việc khẩn, **OT, đến muộn/về sớm, công tác**, khác) nhưng mọi nơi ghi "nghỉ phép".
- "Tạo Đơn Mới", "Loại đơn", nhãn thời gian theo loại; "Đơn Của Tôi".
- Đơn OT hiển thị **theo giờ** (`requestDurationLabel`); thêm `overtimeHours` vào schema web.
- KPI "Tổng Ngày Nghỉ" không cộng OT / đi muộn / công tác.
- "Quỹ phép năm" trong modal chỉ hiện với đơn phép năm.
- Bỏ chặn `approverId` (backend lấy người duyệt từ JWT); lỗi duyệt hiện trong modal (`apiErrorMessage`).

**Lỗi logic khác:**

| Màn hình | Lỗi | Sửa |
|---|---|---|
| Trợ Lý AI | Nhân viên gọi API admin → 403 liên tục | Nhân viên chỉ thấy WF02/WF03, không gọi API admin |
| Trợ Lý AI | Tin nhắn luôn ghi "Admin / Tester" | Tên + vai trò người đăng nhập |
| Trợ Lý AI | Ping ghi tin rác vào lịch sử | Dùng `settingsApi.testAiConnection()` |
| Bảo mật | "Đăng xuất thiết bị khác" đếm phiên mọi user | Chỉ đếm phiên của mình; đánh dấu "Phiên hiện tại" |
| CSKH | Chat đang mở không cập nhật theo poll 10s | Poll cả lịch sử chat (chống request chồng) |
| CSKH | Bật/tắt bot lỗi im lặng | Hiện lỗi |
| Bảng lương | Lỗi tính lương luôn đổ cho "chưa có hợp đồng" | Hiện `result.errors` thật |
| Bảng lương | Quy chế không theo năm đang chọn | Lấy theo năm |
| Hồ sơ NS | Xuất Excel chỉ 10 dòng trang hiện tại | Xuất toàn bộ theo bộ lọc |
| Hội nhập | Danh sách gồm cả nhân viên cũ / đã nghỉ | Chỉ thử việc hoặc vào ≤ 90 ngày |
| Cài đặt | Load lỗi → spinner quay mãi; chấm "chưa lưu" không mất | Nút "Thử lại"; xóa dirty khi rời |
| Đào tạo | Dòng điểm trống, bài chưa làm hiện 0 | 4 tiêu chí cố định, hiện "--" |

**Thông tin thừa đã gỡ:** "Gemini 3.1 Flash Lite" (→ DeepSeek), "API :3001 • n8n :5678", "NestJS", "x-api-key", "Rule Engine", "SalaryConfig", tên biến môi trường, nhãn trạng thái giả ("Hoạt động ổn định", "PII Sanitizer: BẬT", "Socket Mode Live"), khối bảo mật lặp 3 lần, nhãn tiếng Anh trùng ("(Employee Portal)", "(HR Management)", "(ESS)"); menu "AI Multi-Agents Sandbox" → "Trợ Lý AI".

**Kiểm chứng:** `tsc` web + API sạch, `eslint` sạch; chạy 8 màn hình (admin) + Cổng Nhân Viên / Trợ Lý AI (nhân viên) trên trình duyệt — 0 lỗi console.

## 6. Mock tạm check-in/check-out (bỏ geofence)

> [!WARNING]
> Đang **bật mock**: chấm công ở mọi vị trí, kể cả không có GPS. Đặt cả hai cờ về `false` để bật lại kiểm tra bán kính.

| Nơi | Cờ | Tác dụng |
|---|---|---|
| `apps/api/.env` | `ATTENDANCE_GEOFENCE_MOCK=true` | `assertInsideGeofence()` bỏ qua → không 400 (thiếu tọa độ) / 403 (ngoài bán kính) |
| `apps/web/.env.local` | `NEXT_PUBLIC_GEOFENCE_MOCK=true` | Portal bỏ so khoảng cách; GPS lỗi vẫn gửi check-in không tọa độ |

- `location` lưu vết: `GPS lat,lng (mock, bỏ qua geofence)` hoặc `Mock (không có GPS, bỏ qua geofence)` → lọc được dữ liệu chấm công lúc mock.
- `apps/api/.env.example` thêm `ATTENDANCE_GEOFENCE_MOCK=false`.
- Kiểm thử: check-in tọa độ Hà Nội (cách 1.141 km) 403 → **201**; check-in không tọa độ **201**; check-out **201**; trên UI (employee1, trình duyệt không có GPS) Check-in + Check-out thành công. Đã xóa bản ghi test.

> [!NOTE]
> `nest start --watch` chỉ đọc lại `.env` khi process khởi động lại; `touch` file không đủ (nội dung không đổi → không biên dịch lại). Đổi cờ xong cần restart API.

## 7. Cập nhật báo cáo khóa luận (Google Docs)

- 46 thay đổi dạng **suggestion**: DeepSeek là model chính (Ch.1–5, sơ đồ Mermaid, bảng công nghệ, NFR); số liệu đo ở 4.5 giữ nguyên, ghi rõ đo bằng Gemini 02/11; đoạn mới ở 5.3 (lý do chuyển + 5 bản sửa); thêm tài liệu tham khảo **[42] DeepSeek API Docs**.
- Sửa sai từ trước ở 3.4: WF03 dùng **1 node mô hình chung** cho 3 agent, không phải 3 node riêng.
- Mục lục (gõ tay, không có số trang): thêm dòng **MỞ ĐẦU** — nay khớp 99/99 tiêu đề.
- API Google Docs không Accept suggestion hộ được → duyệt trong Docs: Công cụ → Xem lại nội dung đề xuất chỉnh sửa → Chấp nhận tất cả.

## 8. Còn lại

- [ ] Tắt mock geofence trước khi demo/triển khai thật
- [ ] Xuất lại ảnh sơ đồ Mermaid trong báo cáo (ảnh cũ còn chữ Gemini)
- [ ] Commit (web, API, n8n JSON, `settings.service.ts`, script)
- [ ] Test nhánh `Agent Error Fallback` bằng lỗi 503 thật
- [ ] Dữ liệu lương T10 của EMP006: lương cơ bản 0, ngày công 0 (lỗi dữ liệu chấm công/seed)
- [ ] Rebuild/restart API để áp dụng kiểm tra kết nối Gemini embedding mới
- [ ] 3 bản workflow cũ đang tắt (`NOEC…`, `bEC5…`, `ioUQ…`) có thể xóa khỏi n8n

---

*Liên kết:* [[32 - Rà Soát & Sửa 16 Lỗi Mã Nguồn (02-11-2026)]] | [[06 - n8n Workflows & AI Agents]] | [[09 - Task Checklist]] | [[03 - Web Portal (Next.js)]]
