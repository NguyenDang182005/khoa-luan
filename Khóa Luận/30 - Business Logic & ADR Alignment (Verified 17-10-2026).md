---
tags: [khoa-luan, business-logic, adr, verified, leave, payroll, auth, training, chat]
created: 2026-10-17
updated: 2026-10-17
---

# 📋 Business Logic & ADR Alignment (Verified từ Source Code)

> [!IMPORTANT]
> Ghi chú này xác minh **logic nghiệp vụ thực tế** trong source code, so khớp với các quyết định kiến trúc (ADR). Mọi con số, công thức đều đọc trực tiếp từ file `.ts` và `schema.prisma`. Ngày xác minh: **17/10/2026**.

---

## 1. 🏖️ Nghỉ Phép (Leave Entitlement)

**Source:** `apps/api/src/leave/leave-entitlement.ts` (109 dòng)

### Công Thức

| Tham số | Giá trị | Nguồn |
|---|---|---|
| `annualQuotaDays` | **12 ngày** | `schema.prisma` L514: `@default(12)` |
| `seniorityBonusDays` | **0** (hardcode) | `leave-entitlement.ts` L73: `const seniorityBonus = 0` |
| `seniorityBonusEveryYears` | **0** | `single-row.utils.ts` L14 |
| `maxCarryOverDays` | **0** | `single-row.utils.ts` L16 |
| `carryOver` | **0** (hardcode) | `leave-entitlement.ts` L94: `const carryOver = 0` |
| `prorateByJoinMonth` | `true` | Truyền từ DB `LeavePolicy` |

### Pro-rate Năm Đầu
```
quota = round2(annualQuotaDays × proratedMonths / 12)
proratedMonths = max(1, 12 - joinMonth)   // tháng vào làm tính trọn 1 tháng
```
**Ví dụ:** Vào tháng 7 → `proratedMonths = 6` → `quota = 12 × 6 / 12 = 6.0 ngày`

### Ngày Làm Việc (countWorkdays)
- Đếm ngày trong khoảng `[from, to]`, **loại bỏ Thứ 7 + Chủ nhật** (day === 0 || day === 6)
- Hàm `round2()`: làm tròn 2 số thập phân tránh sai số float

> [!NOTE]
> **Seniority bonus đã bị xóa có chủ đích** (xem note 28). Dù `LeavePolicyConfig` interface vẫn giữ các field `seniorityBonusEveryYears`, `seniorityBonusDays` — code LUÔN override = 0. Test `leave-entitlement.spec.ts` có 17 case confirm: "10 năm thâm niên vẫn = 0 bonus".

---

## 2. 💰 Bảng Lương (Payroll Rule Engine)

**Source:** `apps/api/src/payroll/payroll.service.ts` (388 dòng)

### 2.1 Thuế TNCN (PIT) — 7 Bậc Luỹ Tiến

| Bậc | Đến (VNĐ) | Thuế suất |
|-----|-----------|----------|
| 1 | 5.000.000 | 5% |
| 2 | 10.000.000 | 10% |
| 3 | 18.000.000 | 15% |
| 4 | 32.000.000 | 20% |
| 5 | 52.000.000 | 25% |
| 6 | 80.000.000 | 30% |
| 7 | ∞ | 35% |

**Giảm trừ gia cảnh (pitFreeAmount):** 11.000.000 VNĐ/tháng (mặc định SalaryConfig)

### 2.2 Bảo Hiểm Xã Hội — Cap 36 Triệu

| Loại | Tỷ lệ NLĐ đóng | Mặc định |
|------|-----------------|----------|
| BHXH | `bhxhRate` | 8% |
| BHYT | `bhytRate` | 1.5% |
| BHTN | `bhtnRate` | 1% |

**Trần đóng:** `siBase = min(baseSalary, 36.000.000)` — cap từ 2024

### 2.3 Tăng Ca (OT) — 3 Mức Theo Loại Ngày

| `dayType` | Hệ số | Mặc định SalaryConfig |
|-----------|-------|-----------------------|
| `NORMAL` | 1.5x | `overtimeRate: 1.5` |
| `WEEKEND` | 2.0x | `otWeekendRate: 2.0` |
| `HOLIDAY` | 3.0x | `otHolidayRate: 3.0` |

**Công thức OT:**
```
hourlyRate = baseSalary / (workingDays × standardWorkHours)
overtimePay = hourlyRate × (otNormal×1.5 + otWeekend×2.0 + otHoliday×3.0)
```

### 2.4 Ngày Công Thực Tế

- `workingDays` = số ngày Mon-Fri trong tháng
- **Ngày phép CÓ LƯƠNG** (`ANNUAL`, `SICK` đã APPROVED) **vẫn tính là ngày làm việc** → không bị trừ lương
- `HALF_DAY` = 0.5 ngày
- `ON_LEAVE` trong attendance → đã tính riêng qua `countPaidLeaveDays`
- `ABSENT` bị loại khỏi attendance query

### 2.5 Net Salary
```
grossIncome = actualBaseSalary + allowances + overtimePay + bonus
taxableIncome = grossIncome - totalInsurance - pitFreeAmount
pit = calculatePIT(taxableIncome)    // 7-bracket progressive
deductions = totalInsurance + pit
netSalary = round(grossIncome - deductions)
```

### 2.6 Workflow Lương
```
DRAFT → generate()/generateBulk()
DRAFT → APPROVED → approve()/approveBulk()
APPROVED → PAID → markAsPaid()/markPaidBulk(paidAt = now)
```
- Bảng lương đã `APPROVED` **không thể tái tạo** (throw `BadRequestException`)
- `generateBulk`: lấy tất cả nhân viên `ACTIVE` hoặc `ON_LEAVE`
- `approveBulk`/`markPaidBulk`: hỗ trợ cả `month/year` lẫn `ids[]`

---

## 3. 💬 Phiên Chat AI (Session Lifecycle)

**Source:** `apps/api/src/ai-context/ai-context.service.ts` (592 dòng)

### 3.1 Day-Based Rollover (Q7)

```
vnDate(d) → d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
```
- Phiên được **tái sử dụng** nếu: `isActive=true` AND `vnDate(updatedAt) === vnDate(now)` (cùng ngày VN)
- **Qua 12h đêm VN** → đóng phiên cũ (`isActive=false`) → tạo phiên mới
- Session lookup: match `(employee + type + channel)` trước, fallback `externalId`

### 3.2 Session Ownership (Q18)

- Khi client gửi `sessionId` → verify `employeeId` phải khớp → chống dùng chéo session
- Chỉ dùng lại nếu: active + đúng chủ + cùng ngày VN

### 3.3 Rehydrate Portal (Q16)

- `getRehydratableWebSession`: chỉ trả session nếu `isActive=true` AND cùng ngày VN
- Khác ngày → `null` → portal không kéo chat cũ hôm trước vào UI

### 3.4 Escalation CSKH (Q2)

- n8n WF04 phát hiện `[CAN_ESCALATE:]` → POST `/n8n/escalate`
- Session bị tắt bot: `isActive = false`
- Notification push cho **TẤT CẢ** Admin users (tạo 1 notification/admin)
- WebSocket `ai:activity` emit to admin room
- Admin có thể **bật lại bot** thủ công qua `reactivateSession`

### 3.5 Midnight Cron Reset

```typescript
@Cron('0 0 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
// Reset ALL CSKH sessions isActive=false → isActive=true
// Gửi greeting vào Slack channel (nếu có SLACK_CHANNEL_ID)
```

---

## 4. 📝 Training Quiz Anti-Cheat

**Source:** `agents.service.ts` + `training.service.ts`

### 4.1 Quiz Answer Stashing (Server-side)

1. WF03 `generate_quiz` trả kèm `questions[]` (5 MCQ + 2 essay) có `correctAnswer`
2. **NestJS stash đáp án** vào `AiChatMessage.metadata.quiz` (message assistant gần nhất)
3. Client nhận `questions[]` nhưng **correctAnswer bị gỡ trước khi gửi frontend? Không** — correctAnswer có trong payload. Tuy nhiên khi `submitQuiz`, server **KHÔNG tin client**

### 4.2 Server-Side Grading

```
loadServerQuizAnswers(employee, scenario):
  → Đọc AiChatMessage(role='assistant', metadata.scenarioType=scenario, session.type=TRAINING)
  → Parse metadata.quiz → Map<questionId, correctAnswer>

mcqIsCorrect(ans):
  → So sánh answer.trim().toUpperCase() === expected.trim().toUpperCase()
  → Nếu không có trong DB → fallback rawResults từ WF03
```

> [!WARNING]
> **#7 Anti-cheat:** Comment code nói rõ: *"KHÔNG tin correctAnswer do client gửi (nếu tin, người học tự gửi đáp án đúng và luôn 100%). Đáp án đúng lấy từ bản WF03 đã stash server-side."*

### 4.3 Scoring Formula

```
quizScore = (correctCount / totalMcq) × 100
totalScore = quizScore × 0.5 + essayAvg × 10 × 0.5

4 tiêu chí essay (WF03 chấm 0-10):
  - chuyen_nghiep → professional
  - dong_cam → empathy
  - giai_quyet → problemSolving
  - ro_rang → clarity
```

### 4.4 Fallback Offline

Khi WF03 không khả dụng (timeout 60s):
- MCQ: so sánh `answer` vs `correctAnswer` client gửi
- Essay: score mặc định **6/10**
- Overall feedback: `'Hệ thống chấm điểm tự động.'`

### 4.5 Training Scenarios (6 loại)

`CUSTOMER_COMPLAINT | COLLEAGUE_CONFLICT | MANAGER_FEEDBACK | NEW_EMPLOYEE_ONBOARDING | PERFORMANCE_REVIEW | GENERAL_COMMUNICATION`

---

## 5. 🔐 Auth & Security Chain

**Source:** `auth.service.ts` (338 dòng) + `password-policy.ts` + `notifications.gateway.ts`

### 5.1 Login Flow

```
1. Tìm user by email → không có/bị disabled → fail
2. Kiểm tra lockedUntil → còn khóa → throw (hiện số phút còn lại)
3. Kiểm tra passwordHash → null → "chỉ đăng nhập bằng Google/Facebook"
4. bcrypt.compare(password, hash)
   ├─ SAI → failedLoginAttempts++ 
   │       nếu attempts >= maxFailedAttempts → lock (lockoutMinutes phút)
   │       reset bộ đếm = 0 khi lock (đếm lại từ 0 sau mở khóa)
   └─ ĐÚNG → reset failedLoginAttempts=0, lockedUntil=null, ghi lastLoginAt
5. Tạo JWT session: refresh token (30 ngày) + access token (TTL theo SecurityPolicy.accessTokenTtlHours)
6. Ghi LoginHistory (userId, email, success, reason, ip, userAgent)
```

### 5.2 Firebase OAuth Login

- Verify `idToken` → decode Firebase token
- **Whitelist check:** user phải tồn tại trong DB + isActive
- Chặn OAuth khi `lockedUntil` > now
- Link Firebase UID / Google ID / Facebook ID lần đầu
- Cập nhật `avatarUrl`, `displayName` nếu chưa có

### 5.3 Đổi Mật Khẩu

```
1. Verify currentPassword (bcrypt.compare)
2. Validate newPassword theo SecurityPolicy rules:
   - passwordMinLength
   - requireUppercase, requireLowercase, requireDigit, requireSpecial
3. Hash new password (bcrypt, salt=10)
4. Set passwordChangedAt = now
5. THU HỒI MỌI PHIÊN KHÁC (deleteMany RefreshToken WHERE userId AND id ≠ currentSessionId)
```

### 5.4 Logout

- **Fix bug cũ:** `refreshToken = undefined` → Prisma bỏ qua filter → **xóa nhầm TOÀN BỘ** refresh token
- Giờ: throw `BadRequestException` nếu thiếu refreshToken

### 5.5 WebSocket Security (#14)

- JWT verified tại **handshake** — token lấy từ `auth.token` hoặc `Authorization` header
- Token không hợp lệ → `client.disconnect(true)` ngay
- `join-admin`: chỉ `role === 'ADMIN'` mới join được room `admin`
- AI activity emit chỉ broadcast tới room `admin`

### 5.6 Password Policy Interface

```typescript
interface PasswordPolicyRules {
  passwordMinLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigit: boolean;
  requireSpecial: boolean;
}
```

---

## 6. 📍 Chấm Công (Attendance)

**Source:** `attendance.service.ts` (207 dòng)

### 6.1 Check-in

- Resolve `userId → employeeId` (user phải liên kết hồ sơ nhân viên)
- `vnDateUtc()` → ngày UTC đúng ngày VN hôm nay
- Đã check-in → throw `ConflictException`
- Muộn: sau **08:30** → status = `LATE`, ngược lại `PRESENT`
- Race condition (#17): `P2002` unique constraint → coi như đã check-in

### 6.2 Check-out

```
workHours = round2((now - checkIn) / 3.600.000)
overtime = max(0, round2(workHours - 8))
```
- Chưa check-in → throw
- Đã check-out → throw `ConflictException`

### 6.3 Phân Quyền Xem

- **ADMIN:** xem tất cả
- **Nhân viên:** chỉ xem chấm công **của chính mình** (`assertCanView`)

---

## 7. 🧠 RAG Knowledge Search

**Source:** `knowledge.service.ts` (154 dòng)

- **Embedding model:** `gemini-embedding-001` (768 chiều)
- **Table:** `policy_chunks` (nội quy công ty + Bộ luật Lao động 2019)
- **Mode 1 (pgvector):** SQL `1 - (embedding <=> $1::vector)` → cosine similarity
- **Mode 2 (fallback):** Load toàn bộ chunk → cosine trong Node.js
- **Top-K:** mặc định 4, max 10
- **Cache:** `pgvectorMode` được cache sau lần check đầu (query `pg_extension`)

---

## 8. ✅ ADR Alignment — Xác Minh So Khớp Code

### ADR-0001: PostgreSQL Chat Memory ✅

| Quyết định | Code thực tế | Khớp? |
|---|---|---|
| Dùng Postgres Chat Memory node | WF02/WF04 dùng `Postgres Chat Memory` bảng `n8n_chat_histories` | ✅ |
| Bỏ memoryBufferWindow | Không còn buffer memory trong WF JSON | ✅ |
| NestJS vẫn expose endpoint lưu message | `POST /n8n/chat/message` qua `AiContextService.saveMessage()` | ✅ |
| Session key là sessionId | `createOrGetSession` tạo UUID, truyền cho n8n | ✅ |
| History tồn tại qua docker restart | Dữ liệu trong PostgreSQL, volume mounted | ✅ |

### ADR-0002: NestJS RAG Middleware ✅

| Quyết định | Code thực tế | Khớp? |
|---|---|---|
| NestJS endpoint cho vector search | `GET\|POST /n8n/knowledge-search` → `KnowledgeService.search()` | ✅ |
| pgvector extension | `knowledge.service.ts` kiểm tra `pg_extension WHERE extname='vector'` | ✅ |
| Gemini Embedding API | `gemini-embedding-001`, 768 dims | ✅ |
| Fallback cosine in-app | `cosine()` method khi pgvector chưa enable | ✅ |
| HR Agent gọi qua tool | n8n WF02 tool `SearchPolicyKnowledge` | ✅ |
| Tài liệu: nội quy + BLLĐ 2019 | `policy_chunks` table, seed script | ✅ |

### ADR-0003: Web-Only Phase 1 ✅

| Quyết định | Code thực tế | Khớp? |
|---|---|---|
| Xóa `apps/mobile` | Không tồn tại `apps/mobile` directory | ✅ |
| Channel `mobile` giữ nguyên reserved | Schema Prisma giữ `channel: String` (chấp nhận mọi giá trị) | ✅ |
| GPS geofencing trên Web ESS | `navigator.geolocation` + Haversine trong `employee-portal-view.tsx` | ✅ |
| `@repo/shared-types` dùng chung | Package tồn tại trong monorepo | ✅ |
| Firebase Auth sẵn sàng multi-client | `FirebaseAdminService` verify token, không ràng buộc platform | ✅ |

---

## 9. ⚙️ Cấu Hình Mặc Định (Single-Row Pattern)

**Source:** `single-row.utils.ts` — Pattern dùng chung: 3 bảng cấu hình, mỗi bảng 1 bản ghi `id='default'`, auto-create race-safe (P2002 retry).

| Bảng | Defaults quan trọng |
|---|---|
| `LeavePolicy` | `annualQuotaDays: @default(12)`, `seniorityBonusEveryYears: 0`, `seniorityBonusDays: 0`, `maxCarryOverDays: 0` |
| `SecurityPolicy` | `maxFailedAttempts: @default(5)`, `lockoutMinutes: @default(15)`, `passwordMinLength: @default(8)`, `accessTokenTtlHours: @default(24)` |
| `AiAgentConfig` | `enabled: @default(true)`, `timeoutMs: @default(90000)` |

---

*Liên kết:* [[05 - Database Schema (Prisma)]] | [[06 - n8n Workflows & AI Agents]] | [[02 - Backend NestJS (API)]] | [[28 - Nhật Ký Ngày 14-10-2026 (Xóa Toàn Bộ Cơ Chế Cộng Thêm Ngày Phép & Đồng Bộ Context WF02-WF03)]] | [[01 - Kiến Trúc Hệ Thống & Multi-Agent]]