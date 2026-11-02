---
tags: [khoa-luan, audit, bug-fix, n8n, security, training, rbac, vn-date]
created: 2026-10-14
---

# 🛠️ Audit 20 Lỗi Toàn Hệ Thống & Debug n8n Live (14/10/2026)

> **Nhật ký 14/10/2026** — Audit "ponytail" toàn hệ thống: sửa **20 lỗi** theo plan (security → RBAC → date VN → n8n → UI), build + typecheck + **39/39 tests pass**, chạy dev để test thật, debug chuỗi lỗi xếp lớp trên n8n live cho đến khi cả 4 intent chat trả lời thật. Kết thúc bằng audit riêng cơ chế chấm điểm radar.

## 1. Bảng 20 lỗi — đã sửa hết

| # | Lỗi | Fix chính | File |
|---|---|---|---|
| 1 | JWT secret hardcode + secrets trong JSON | Fail-fast khi thiếu `JWT_SECRET`; xoá secret khỏi JSON | `main.ts`, `n8n-workflows/` |
| 2 | `attendances.date` lệch -1 ngày (local vs UTC) | Helper `vnDateUtc/vnMonth/vnMonthRange` + script sửa dữ liệu | `common/vn-date.ts`, `scripts/fix-attendance-date.mjs` |
| 3–6 | Phân quyền: nhân viên sửa/xoá được dữ liệu người khác | Guard theo role + filter `employeeId` từ JWT | `employees/`, `payroll/`, `attendance/` |
| 7 | Đáp án quiz lấy từ client | Chấm từ bản quiz server stash (`aiChatMessage.metadata.quiz`) | `training.service.ts` |
| 8 | Thiếu test PIT + vn-date | `vn-date.spec.ts` + `payroll-pit.spec.ts` | `apps/api/src/` |
| 9 | Thiếu migration `OfficeGeofence` + enum UserRole drift | Migration SQL mới gộp 5 giá trị role về 2 | `migrations/20261009...` |
| 10 | WF03 `Save User Message` là nhánh chết; WF04 nhánh FALSE của IF nuốt tin | Rewire connections trong JSON | `03/04-*.json` |
| 11 | Text "50% phép năm" sai policy trong knowledge docs | Đổi theo cài đặt động | `knowledge-docs.cjs` |
| 12 | Webhook không xác thực | `headerAuth` cho WF02/03 (WF04 giữ mở cho Zalo OA + đã có PII mask) | `02/03/04-*.json` |
| 13 | `maxOutputTokens` 8192 lệch chuẩn | Đồng bộ 1024 | `03-*.json` |
| 14–17 | Logout không xoá session; guard client; cache payroll | Fix service + hook | `auth/`, `web/` |
| 18 | Bảng công đếm weekend thành "Vắng" | Bỏ qua T7/CN khi không có bản ghi | `monthly-timesheet-strip.tsx` |
| 19 | Format UI: tiền `₫raw`, ngày ISO raw, CSV joinDate ISO, status GRADED raw, rate 0.08 hiển thị "0.08 (%)" | `vnd()`, `fmtVNDate()` trong `lib/utils.ts` + sửa 5 view | `dashboard/`, `employees/`, `training-analytics/`, `settings/salary-section` |
| 20 | Dead code + P2025 trả 500 | Xoá `getTree/getOrgChart/softDelete`; `PrismaExceptionFilter` P2025→404 | `departments/`, `employees/`, `main.ts` |

## 2. Lỗi đáng nhớ nhất — radar 3 tiêu chí giống hệt nhau

**Hiện tượng:** biểu đồ radar "4 tiêu chí năng lực" có 3 trục bằng nhau tuyệt đối.

**Nguyên nhân:** `submitQuiz` lưu `aiScore` là `essay_avg` nhân bản ×4 — LLM có trả `criteria{}` per-essay nhưng code bỏ qua khi ghi DB.

**Fix (2 lớp):**
1. `aiScore = { ...criteriaScore, essay_avg }` — lưu 4 giá trị thật của WF03, chỉ fallback `essay_avg` khi LLM bỏ trả criteria.
2. `gradeSession` (legacy) trung bình chỉ 4 tiêu chí, **loại `essay_avg`** khỏi `Object.entries` — tránh lệch tổng điểm.

**Audit kỹ sau fix:** DB xác nhận session mới có criteria phân hóa (`clarity 8.5, empathy 8.5, professional 7.5…`), radar khác nhau thật.

## 3. Chuỗi debug n8n live — 4 lỗi xếp lớp

Triệu chứng bề mặt: chat HR Policy Q&A báo *"Agent AI (n8n) không phản hồi. Kiểm tra workflow WF01 đang active."* — nhưng thông điệp này **gây hiểu lầm**: WF01 vẫn chạy, lỗi nằm sâu phía sau.

| Tầng | Lỗi | Cách phát hiện | Fix |
|---|---|---|---|
| 1 | Credential `NestJS API Key` (httpHeaderAuth) không tồn tại trên instance | `GET /api/v1/credentials` — JSON tham chiếu placeholder `__N8N_HEADER_AUTH_ID__` | Tạo credential qua API với `x-api-key = N8N_API_KEY`, thay ID vào JSON, PUT workflow |
| 2 | WF02 `Save User Message`: `genericCredentialType` nhưng **credentials null** | Execution API: `NodeOperationError: Credentials not found`, `error.node.parameters.authentication = "genericCredentialType"`, `credentials: {}` | Gán credential cho mọi node HTTP thiếu — quét cả 4 WF |
| 3 | WF04 node Gemini trỏ `"gemini-api-key"` không tồn tại | Execution 556: `Credential with ID "gemini-api-key" does not exist for type googlePalmApi` | Remap về credential Gemini thật (`GET /api/v1/credentials` theo type) |
| 4 | **Bug NestJS**: `employee-context/EMP005` trả 500 | WF02 trả fallback "Lỗi kỹ thuật" dù mọi node xanh → gọi trực tiếp context API | `leave.service.ts` spread `{gte, lte}` **ngang cấp** trong `where` thay vì bọc `startDate:` → Prisma throw. Sửa thành `startDate: vnDayRange(...)` |

**Bài học debug:** n8n API trả `408` lúc lúc đông → mọi script gọi n8n cần retry 3–5 lần; `includeData=true` prune output của AI node nên phải grep raw payload; execution API là nguồn chân lý — status webhook 200 không có nghĩa luồng thành công.

## 4. Kết quả kiểm thử

- **Unit:** 5 suites, **39/39 pass** (gồm 3 test hồi quy MCQ + 8 test vn-date + 4 test PIT).
- **Build:** `pnpm build` xanh (api + web), `tsc --noEmit` cả 2 app sạch.
- **E2E chat qua WF01 Router (live Gemini):**

| Intent | Kết quả |
|---|---|
| HR *"còn mấy ngày nghỉ phép?"* | ✅ **18 ngày** — số thật từ DB qua `employee-context` |
| TRAINING | ✅ khởi động role-play đúng kịch bản |
| CSKH | ✅ trả lời xin lỗi khách đúng vai |
| OTHER | ✅ menu định tuyến, 40ms |

- **E2E Training submit:** `POST /training/submit` 201, MCQ chấm server-side 2/5 đúng theo đáp án stash, criteria per-essay phân hóa, `totalScore = quiz×0.5 + essay_avg×10×0.5`.
- **Bug #2 lặp lại ở analytics:** `training/analytics?month=10` dùng `new Date(y,m,1)` local → filter rỗng dù có dữ liệu. Fix bằng `vnMonthRange` — đây là lần thứ 2 cùng lớp lỗi, xác nhận helper phải dùng **tất cả mọi nơi** lọc theo tháng.

## 5. File quan trọng tạo mới / sửa

- `apps/api/src/common/vn-date.ts` + `vn-date.spec.ts` — nguồn duy nhất cho ngày VN
- `apps/api/src/common/prisma-exception.filter.ts` — P2025 → 404
- `scripts/fix-attendance-date.mjs` — sửa dữ liệu attendance lệch ngày (chạy `--apply` khi DB thật)
- `scripts/e2e-training-test.cjs` — nộp bài test bất cứ lúc nào
- `scripts/audit-n8n-live.cjs`, `diag-execs.cjs`, `diag-node-out2.cjs`, `fix-gemini-cred.cjs`, `push-test-wf.cjs` — bộ công cụ audit n8n live (retry 408 sẵn)
- `packages/shared-types` — thêm build `tsc` → `dist/` (fix crash ESM khi `pnpm dev` trên Node 24 native TS)
- Xoá: `apps/docs/`, `packages/ui/` (dead workspace)

## 6. Việc còn treo

- [ ] Migration `20261009000001_add_office_geofence_align_userrole` chưa chạy trên DB thật (cần `pnpm --filter @repo/database migrate dev` khi chắc chắn backup)
- [ ] `scripts/fix-attendance-date.mjs --apply` sau khi migrate
- [ ] Việc còn lại xem [[09 - Task Checklist]]

> Liên kết: [[24 - Audit Cơ Chế Chấm Điểm AI]] · [[06 - n8n Workflows & AI Agents]] · [[01 - Kiến Trúc Hệ Thống & Multi-Agent]] · [[09 - Task Checklist]]
