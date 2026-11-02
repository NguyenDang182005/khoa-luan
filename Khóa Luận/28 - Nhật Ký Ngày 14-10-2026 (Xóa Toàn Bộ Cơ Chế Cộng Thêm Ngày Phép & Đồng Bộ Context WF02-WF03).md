---
tags: [khoa-luan, leave-policy, carry-over, seniority-bonus, n8n, wf02, wf03, rag, e2e-test]
created: 2026-10-14
---

# 🧹 Nhật Ký Ngày 14-10-2026 (Đợt 3): Xóa Toàn Bộ Cơ Chế Cộng Thêm Ngày Phép & Đồng Bộ Context WF02–WF03

> **Mục tiêu:** Xóa HOÀN TOÀN hai cơ chế cộng thêm ngày phép:
> 1. **Cộng phép thâm niên** (+1 ngày mỗi 5 năm cống hiến) → đã xóa ở đợt 2.
> 2. **Chuyển phép dư năm trước sang năm sau** (carry-over `maxCarryOverDays`) → **xóa nốt ở đợt này**.
>
> Đồng thời cập nhật **context/prompt** của WF02 & WF03 để AI không còn nhắc đến bất kỳ cơ chế nào ngoài quy tắc chuẩn 12 ngày/năm + pro-rate năm đầu.

---

## 1. Nguyên Nhân Phát Hiện

Sau khi xóa cơ chế thâm niên ở đợt 2, giao diện `Bàn Làm Việc Cá Nhân` của `EMP006` (Nguyễn Thị HR Admin) vẫn hiển thị **`PHÉP NĂM CÒN LẠI: 16 / 17 ngày`** thay vì `11 / 12 ngày`.

**Nguyên nhân gốc:** Trong bảng `leave_policies` của PostgreSQL, trường `maxCarryOverDays` vẫn bằng `5`, khiến hàm `computeBalance()` cộng thêm 5 ngày phép dư từ năm trước vào tổng phép năm hiện tại (`12 + 5 = 17 ngày`, đã nghỉ 1 ngày → `16 / 17 ngày`).

---

## 2. Các Hạng Mục Đã Cập Nhật

### 2.1. Database & Backend

| Tầng | File / Bảng | Thay đổi chi tiết |
|---|---|---|
| **PostgreSQL** | `leave_policies` (bảng `id = 'default'`) | `UPDATE leave_policies SET "seniorityBonusEveryYears" = 0, "seniorityBonusDays" = 0, "maxCarryOverDays" = 0, "note" = NULL` |
| **Default khi tạo mới** | `apps/api/src/settings/single-row.utils.ts` | Thêm `maxCarryOverDays: 0` vào `ensureDefaultLeavePolicy()` |
| **Hàm tính phép** | `apps/api/src/leave/leave-entitlement.ts` | Cố định `carryOver = 0` trong `computeBalance()`, cập nhật docstring: *"Không áp dụng bất kỳ cơ chế cộng thêm ngày phép nào khác (seniorityBonus = 0, carryOver = 0)"*. Đổi `maxCarryOverDays` thành optional trong `LeavePolicyConfig`. |
| **Docstring** | `apps/api/src/leave/leave.service.ts` | Cập nhật JSDoc của `getBalance()`: *"quota chuẩn (pro-rate năm đầu theo tháng vào làm), không cộng thêm phép thâm niên hay chuyển thừa."* |
| **Unit Tests** | `apps/api/src/leave/leave-entitlement.spec.ts` | **16/16 tests pass** — bao gồm test case "kể cả khi năm trước còn dư phép vẫn không cộng dồn sang năm sau (total = 12)" |

### 2.2. Context AI — WF02 (`02 - HR Q&A Agent`)

| Node | Thay đổi |
|---|---|
| **HR Agent** (`systemMessage` + `options.systemMessage`) | Thay đoạn cũ *"phep du nam truoc duoc chuyen sang nam sau theo han muc cai dat cua cong ty"* bằng: **"KHONG ap dung bat ky co che cong them ngay phep nao khac (KHONG cong them ngay phep theo tham nien cong hien, KHONG chuyen phep du nam truoc sang nam sau)"** |

### 2.3. Context AI — WF03 (`03 - Training Role-play Agent`)

| Node | Thay đổi |
|---|---|
| **Load Scenario** (`companyPolicy`) | Thay đoạn cũ *"phep du nam truoc chuyen sang nam sau theo han muc cai dat"* bằng: **"KHONG ap dung bat ky co che cong them ngay phep nao: KHONG cong phep tham nien, KHONG chuyen phep du nam truoc sang nam sau"** |
| **Load Scenario** (`new_employee_onboarding.role`) | Thay *"khong cong phep tham nien 5 nam"* bằng: **"khong cong phep tham nien va khong chuyen phep du"** |
| **Quiz Generator Agent** (`systemMessage`) | Thay *"khong cong them 1 ngay phep moi 5 nam tham nien"* bằng: **"khong cong phep tham nien va khong chuyen phep du sang nam sau"** |
| **Quiz Grader Agent** (`systemMessage`) | Tương tự Quiz Generator Agent |
| **Training Agent** (`systemMessage` + `options.systemMessage` — cả fallback) | Thay *"KHONG cong them 1 ngay phep moi 5 nam tham nien"* bằng: **"KHONG cong phep tham nien va KHONG chuyen phep du sang nam sau"** |

### 2.4. Script Generator & RAG Knowledge

| File | Thay đổi |
|---|---|
| `scripts/generate-wf03.cjs` | Đồng bộ toàn bộ nội dung tương ứng với `03-training-agent.json` (Load Scenario, Quiz Gen Agent, Quiz Grade Agent, Training Agent) |
| `packages/database/scripts/knowledge-docs.cjs` | Tài liệu *"Chế độ nghỉ phép và ngày nghỉ"* — thay dòng *"Nhân viên được chuyển phép năm chưa dùng sang năm sau theo chính sách công ty..."* bằng: **"Phép năm chưa sử dụng hết trong năm sẽ hết hiệu lực vào cuối ngày 31/12 (không chuyển sang năm sau)"** |
| **Seed RAG** | Chạy lại `node packages/database/scripts/seed-knowledge.cjs` → ✅ 10/10 chunks (pgvector: ON) |

### 2.5. Deploy Workflow lên n8n Live

- `PUT + POST /activate` cho **WF02** (`JubiKeUfr46oqGAr`) → ✅ Pushed & activated.
- `PUT + POST /activate` cho **WF03** (`aaCU1Zr00f506dcJ`) → ✅ Pushed & activated.

---

## 3. Kết Quả Kiểm Thử

### 3.1. Unit Tests (`leave-entitlement.spec.ts`)

```
PASS src/leave/leave-entitlement.spec.ts
  yearsOfServiceAtYearEnd  (3 tests)
  computeBaseQuota         (5 tests)
  computeBalance           (4 tests)
  countWorkdays            (4 tests)
Tests: 16 passed, 16 total — Time: 0.627s
```

### 3.2. Verify EMP006 Leave Balance (`debug-leave.cjs`)

```json
{
  "year": 2026,
  "quota": 12,
  "seniorityBonus": 0,
  "proratedMonths": null,
  "carryOver": 0,
  "total": 12,
  "used": 1,
  "remaining": 11
}
```
→ ✅ **EMP006 hiển thị đúng `11 / 12 ngày`** (không còn `16 / 17 ngày`).

### 3.3. Live API Context (`GET /api/v1/n8n/employee-context/EMP006`)

```json
{"annual":{"total":12,"used":1,"remaining":11,"quota":12}}
```
→ ✅ Không còn trường `carryOver` hay `seniorityBonus`.

### 3.4. E2E Test WF02 — Hỏi Chính Sách Phép & Số Dư Phép EMP006

**Câu hỏi:** *"Chính sách nghỉ phép năm của công ty có cộng thêm phép thâm niên hay chuyển phép dư sang năm sau không? Tôi (EMP006) còn bao nhiêu ngày phép?"*

**Phản hồi WF02 (Gemini 3.1 Flash Lite):**
> - Công ty **không** áp dụng cơ chế cộng thêm ngày phép theo thâm niên.
> - Công ty **không** cho phép chuyển ngày phép dư của năm cũ sang năm sau. Phép năm chưa sử dụng hết sẽ hết hiệu lực vào cuối ngày 31/12 hàng năm.
> - Tổng số ngày phép năm: **12 ngày**, đã nghỉ: **1 ngày**, còn lại: **11 ngày**.

→ ✅ Trả lời chính xác cả quy định lẫn số liệu thực tế.

---

## 4. Kiến Trúc Dữ Liệu HR Agent (Ghi Chú Kỹ Thuật)

HR Agent (WF02) kết hợp **cả hai nguồn dữ liệu**:

| Nguồn | Loại dữ liệu | Cơ chế |
|---|---|---|
| **systemMessage** (Context/Prompt) | Quy tắc nền, hướng dẫn hành vi, quy định cốt lõi | Embed cứng trong node `HR Agent` → LLM đọc trực tiếp |
| **GetEmployeeContext** (API) | Thông tin cá nhân, hợp đồng, số dư phép thực tế | Gọi `GET /api/v1/n8n/employee-context/{employee_id}` về NestJS → tính realtime từ DB |
| **SearchPolicyKnowledge** (API → RAG) | Tài liệu chính sách chi tiết (10 docs, vector search) | Gọi `GET /api/v1/n8n/knowledge-search?query=...` → truy vấn pgvector trên bảng `policy_chunks` |
| **GetPayrollContext** (API) | Phiếu lương chi tiết theo tháng/năm | Gọi `GET /api/v1/n8n/payroll-context/{employee_id}?month=X&year=Y` |

→ Khi sửa chính sách phép phải cập nhật **đồng bộ cả 4 nguồn**: (1) Backend logic + DB, (2) systemMessage prompt, (3) RAG knowledge docs, (4) AI Context API response.

---

> Liên kết: [[00 - Tổng Quan Dự Án]] · [[06 - n8n Workflows & AI Agents]] · [[09 - Task Checklist]] · [[27 - Nhật Ký Ngày 14-10-2026 (Tối Ưu UI-UX, Bỏ Phép Thâm Niên & Chuẩn Hóa Context WF01-WF04)]]
