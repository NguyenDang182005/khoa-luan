---
tags: [khoa-luan, ui-ux, leave-policy, n8n, rag, wf01, wf02, wf03, wf04, e2e-test]
created: 2026-10-14
---

# 🚀 Nhật Ký Ngày 14-10-2026 (Đợt 2): Tối Ưu UI/UX, Bỏ Phép Thâm Niên & Chuẩn Hóa Context WF01–WF04

> **Mục tiêu đợt cập nhật:**
> 1. Tối ưu toàn bộ UX và dọn dẹp các nút thừa / icon trang trí không cần thiết trong các nút có nhãn văn bản trên toàn bộ Web Portal (`apps/web`).
> 2. Loại bỏ quy định **"+1 ngày phép mỗi 5 năm thâm niên cống hiến"** trên toàn hệ thống (Backend, Frontend Settings, AI Context, Database `leave_policies` và RAG `policy_chunks`).
> 3. Chuẩn hóa context và sửa lỗi định tuyến/tool trong cả 4 workflow n8n (`WF01`, `WF02`, `WF03`, `WF04`), kiểm thử E2E trực tiếp trên instance n8n live (`http://127.0.0.1:5678`).

---

## 1. Tối Ưu UI/UX & Dọn Dẹp Nút Thừa Trên Web Portal (`apps/web`)

Đóng vai người dùng thực tế (Admin HR & Nhân viên ESS) để rà soát toàn bộ 20+ màn hình/component trong `apps/web`:
- **Bỏ các nút thừa gây nhiễu UX:**
  - `app-header.tsx`: Bỏ cụm nút chuyển nhanh *"Quản trị / Cổng NV"* trùng lặp trên thanh header (đã có trong Sidebar) và bỏ nút chuông thông báo tĩnh chưa gắn sự kiện.
  - `dashboard-view.tsx`: Bỏ các nút *"Báo cáo"* và *"Hồ sơ"* không có hành động trong bảng cảnh báo chấm công.
  - `payroll-view.tsx`: Bỏ nút *"Bộ lọc"* thừa khi thanh tìm kiếm và chọn kỳ lương đã hiển thị trực tiếp.
  - `employee-portal-view.tsx`: Thay nút *"Tải PDF"* giả bằng `window.print()` xuất phiếu lương thực tế; tự động điền `startDate` và `endDate` mặc định bằng ngày hôm nay khi mở form xin nghỉ phép để giảm thao tác nhập liệu.
- **Loại bỏ icon trang trí thừa trong các nút có text label:**
  - Chỉ giữ lại spinner `Loader2` khi đang xử lý bất đồng bộ (`busy`/`loading`) và giữ icon cho các nút thuần icon (`size="icon"`).
  - Áp dụng đồng bộ trên toàn bộ các view: `login-view`, `dashboard-view`, `employees-view`, `payroll-view`, `cskh-escalation-view`, `training-view`, `training-analytics-view`, `my-training-view`, `onboarding-view`, `ai-agents-view`, `settings-view` và toàn bộ 7 phân mục trong `components/views/settings/*`.

---

## 2. Loại Bỏ Quy Định "+1 Ngày Phép Mỗi 5 Năm Thâm Niên"

| Tầng | File / Bảng | Thay đổi chi tiết |
|---|---|---|
| **Backend Logic** | `apps/api/src/leave/leave-entitlement.ts` | Trong `computeBaseQuota()`, cố định `seniorityBonus = 0` và `base = policy.annualQuotaDays`. Giữ nguyên chuẩn 12 ngày/năm dương lịch và tính tỷ lệ `pro-rate` theo tháng vào làm trong năm đầu tiên. |
| **Unit Tests** | `apps/api/src/leave/leave-entitlement.spec.ts` | Cập nhật bộ kiểm thử đơn vị theo chính sách mới (**17/17 tests pass**). |
| **AI Context** | `apps/api/src/ai-context/ai-context.service.ts` | Loại bỏ trường `seniorityBonus` khỏi `leaveBalance.annual` trả về từ endpoint `GET /api/v1/n8n/employee-context/:id`. |
| **DB & Default** | `packages/database/prisma/schema.prisma`, `single-row.utils.ts` | Đổi `@default(0)` cho `seniorityBonusEveryYears` và `seniorityBonusDays`; cập nhật bản ghi `id = 'default'` trong bảng `leave_policies` về `0`. |
| **Frontend UI** | `leave-policy-section.tsx`, `settings-view.tsx` | Xóa 2 ô nhập *"Mỗi N năm thâm niên"* và *"Cộng thêm (ngày)"*, rút gọn bố cục còn 2 cột (*Ngày phép chuẩn/năm* và *Chuyển thừa tối đa*), cập nhật mô tả công thức tính phép. |
| **RAG Knowledge** | `packages/database/scripts/knowledge-docs.cjs` | Cập nhật tài liệu *"Chế độ nghỉ phép và ngày nghỉ"* (`QUY CHE LD 2024 - MUC 4`): chuẩn 12 ngày/năm, pro-rate năm đầu, không cộng phép thâm niên 5 năm. Chạy lại `seed-knowledge.cjs` nạp 10/10 chunks (`pgvector: ON`). |

---

## 3. Chuẩn Hóa Context & Sửa Lỗi Trên 4 Workflow n8n (`WF01` – `WF04`)

### 3.1. WF02 — `02 - HR Q&A Agent` (`JubiKeUfr46oqGAr`)
- **Đồng bộ `systemMessage` & `options.systemMessage`:** Trong node `@n8n/n8n-nodes-langchain.agent` (v1.7), n8n ưu tiên đọc `options.systemMessage`. Trước đó `options.systemMessage` bị thiếu hướng dẫn gọi tool `SearchPolicyKnowledge`. Đã đồng bộ cả 2 trường với quy định nghỉ phép mới (12 ngày/năm, pro-rate năm đầu, không cộng phép thâm niên 5 năm) và quy tắc bảo mật PII (chỉ tra cứu lương/hồ sơ của chính người đang hỏi).
- **Sửa lỗi URL trong tool `GetPayrollContext`:** Khôi phục URL placeholder `http://host.docker.internal:3001/api/v1/n8n/payroll-context/{employee_id}` kèm `placeholderDefinitions` (trước đó bị ghi thành chuỗi tĩnh `{{ $json.employeeId }}` không có dấu `=` khiến API trả 404).

### 3.2. WF03 — `03 - Training Role-play Agent` (`aaCU1Zr00f506dcJ`)
- **Bổ sung `companyPolicy` vào toàn bộ 3 nhánh (Role-play, Quiz Gen, Quiz Grade):**
  - Thêm biến `companyPolicy` trong node `Load Scenario` chứa đầy đủ quy định cốt lõi: giờ làm việc T2–T6 (8:00–17:30), chấm công GPS bán kính văn phòng, thử việc tối đa 60 ngày hưởng 85% lương, phép năm chuẩn 12 ngày/năm (pro-rate năm đầu, **không cộng thêm 1 ngày phép mỗi 5 năm thâm niên**), BHXH 8% / BHYT 1.5% / BHTN 1%, OT x1.5/x2.0/x3.0, bảo mật PII.
  - Truyền `companyPolicy` vào `Build Quiz Gen Prompt`, `Build Quiz Grade Prompt`, `Prepare Agent Input` và `Training Agent`.
- **Chống tràn `maxOutputTokens: 1024` khi sinh/chấm Quiz:**
  - Yêu cầu `Quiz Generator Agent` và `Quiz Grader Agent` trả về **JSON minified trên 1 dòng duy nhất** (không xuống dòng/indent, giải thích ngắn gọn `<12 từ`, câu tự luận không kèm trường `explanation` thừa), giúp 7 câu hỏi chỉ tốn ~450 tokens và không bao giờ bị cắt cụt giữa chừng.

### 3.3. WF01 — `01 - Router Agent` (`TqHOhjYN24O819FF`)
- **Giữ ngữ cảnh phiên Đào tạo (`TRAINING`):** Ưu tiên kiểm tra `data.action === 'generate_quiz' || data.action === 'submit_quiz' || data.scenarioType || data.sessionType === 'TRAINING'` trước khi so khớp từ khóa `isHR`/`isCSKH`. Khắc phục triệt để lỗi nhân viên đang đóng vai hội nhập (`new_employee_onboarding`) nhắc tới từ *"nghỉ phép"* hoặc *"lương"* bị đẩy nhầm sang `HR_QA`.
- **Chuẩn hóa từ khóa `isCSKH` vs `isHR`:** Thay từ khóa trần `thuong|boi thuong` trong `isHR` bằng các cụm thưởng nhân sự cụ thể (`tien thuong|luong thuong|thuong tet|thuong thang|thuong nong|khen thuong`) và đưa `boi thuong|loi he thong|gap giam doc|gap lanh dao` vào `isCSKH` để tin nhắn khiếu nại khách hàng định tuyến chính xác vào `WF04`.

### 3.4. Tự động Retry khi Gemini API quá tải tạm thời
- Bật `retryOnFail: true`, `maxTries: 3`, `waitBetweenTries: 2000` trên toàn bộ các node Agent và Gemini của `WF02`, `WF03`, `WF04`.

---

## 4. Kết Quả Kiểm Thử E2E (`http://127.0.0.1:5678/webhook/chat`)

| # | Kịch bản kiểm thử | Luồng | Thời gian | Kết quả |
|---|---|---|---|---|
| 1 | Chào hỏi cơ bản (*"Xin chào"*) | `WF01 (OTHER)` | `146ms` | ✅ Trả về menu hướng dẫn tức thì (`intent: "OTHER"`). |
| 2 | Hỏi chính sách phép năm & thâm niên 5 năm | `WF01 → WF02 (RAG)` | `3.34s` | ✅ Tra cứu `SearchPolicyKnowledge` và trả lời chính xác: chuẩn 12 ngày/năm, pro-rate năm đầu, **không áp dụng cộng phép thâm niên 5 năm**. |
| 3 | Hỏi số ngày phép còn lại của bản thân (`EMP003`) | `WF01 → WF02 (EmployeeContext)` | `12.4s` | ✅ Gọi `GetEmployeeContext`: 12 ngày chuẩn + 5 ngày chuyển từ năm trước = 17 ngày (0 ngày thâm niên). |
| 4 | Hỏi bảng lương tháng 8/2026 (`EMP003`) | `WF01 → WF02 (PayrollContext)` | `2.22s` | ✅ Gọi `GetPayrollContext`: Lương cơ bản 30tr, phụ cấp 3tr, OT 1.956.522đ, BHXH 3.150.000đ, thuế TNCN 1.920.978đ, thực nhận **29.885.544 VNĐ**. |
| 5 | Role-play Hội nhập nhân viên mới (`new_employee_onboarding`) | `WF01 → WF03 (Roleplay)` | `2.42s` | ✅ Phản hồi đúng vai hướng dẫn hội nhập theo chính sách mới + chấm điểm 4 tiêu chí (`total: 9.75`). |
| 6 | Sinh đề kiểm tra & Chấm điểm (`generate_quiz` / `submit_quiz`) | `WF01 → WF03 (Quiz)` | `2.35s / 2.45s` | ✅ Sinh đủ 7 câu hỏi (5 MCQ + 2 tự luận bám sát chính sách mới) và chấm điểm trả về đầy đủ `score_percent`, `results`, `criteria`. |
| 7 | Tư vấn gói cước & Leo thang khiếu nại CSKH | `WF01 → WF04 (CSKH)` | `1.48s / 5.53s` | ✅ Tư vấn chính xác 3 gói Basic/Pro/Enterprise (`shouldEscalate: false`) và tự động bật `shouldEscalate: true` kèm `escalateReason` khi khách đòi bồi thường/gặp giám đốc. |

---

> Liên kết: [[00 - Tổng Quan Dự Án]] · [[06 - n8n Workflows & AI Agents]] · [[09 - Task Checklist]] · [[26 - Nhật Ký Ngày 14-10-2026 (Audit 20 Lỗi & Debug n8n Live)]]
