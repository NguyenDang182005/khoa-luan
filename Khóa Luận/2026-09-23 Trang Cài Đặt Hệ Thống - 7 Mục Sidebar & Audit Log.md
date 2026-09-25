---
tags: [khoa-luan, cai-dat, admin, rbac, audit-log, leave-policy, security-policy, ai-agent, settings]
created: 2026-09-23
updated: 2026-09-23
---

# 🛠️ Trang Cài Đặt Hệ Thống (Admin) — 7 Mục Sidebar & Audit Log

> Ngày: 23-09-2026 · Phạm vi: `apps/api` (NestJS) + `apps/web` (Next.js) + `packages/database` (Prisma)
> Phân quyền: **chỉ ADMIN_GROUP** (trừ GET geofence — nhân viên check-in cần)

## 1. Bối Cảnh & Quyết Định Thiết KẾ

Trang Cài Đặt gốc chỉ có 3 mục (Lương & Thuế, Vùng Chấm Công, Tích Hợp). Bổ sung 4 mục mới theo thiết kế đã duyệt (20 câu hỏi grill-me):

| Quyết định | Lựa chọn |
|---|---|
| "Phép Năm" | Cấu hình **chính sách** (quota/thâm niên/carry-over), không phải quản lý đơn |
| Mục tiêu Bảo Mật | Password policy + khóa tài khoản + quản lý phiên + lịch sử đăng nhập + đổi mật khẩu |
| Lưu cấu hình | **Per-section Save** + dirty indicator; mọi thay đổi ghi **audit log** (áp dụng cả 5 section cấu hình) |
| Kỹ thuật | Bảng **single-row** (`id: 'default'`) + `SettingsAuditLog` append-only |
| Phiên đăng nhập (Q17=A) | JWT thêm claim `sid` (id RefreshToken) — **kiểm tra mỗi request**; thu hồi → chết ngay |
| AI Agent (Q20=B) | **Không sửa n8n**. Gate bật/tắt phía NestJS; webhookUrl/apiKey/timeoutMs cấu hình được; tham số model chỉ-đọc |

## 2. Database (Prisma)

**Bảng mới (single-row `id: 'default'`):**
- `LeavePolicy` — annualQuotaDays 12 · seniorityBonusEveryYears 5 · seniorityBonusDays 1 · prorateByJoinMonth true · maxCarryOverDays 0 · note?
- `SecurityPolicy` — passwordMinLength 8 · require{Uppercase,Lowercase,Digit,Special} true · passwordMaxAgeDays 0 · maxFailedAttempts 5 · lockoutMinutes 15 · accessTokenTtlHours 720
- `AiAgentConfig` — enabled true · webhookUrl? · apiKey? (write-only) · timeoutMs 90000
- `LoginHistory` — userId? (SetNull) · email · success · reason? · ip? · userAgent?
- `SettingsAuditLog` — adminUserId? (SetNull) · adminEmail · section · field · oldValue? · newValue?

**Cột mới:** `users.failedLoginAttempts / lockedUntil / passwordChangedAt`; `refresh_tokens.ip / userAgent`.
**Migration:** `20260923140145_add_settings_and_audit_models` (additive, không đụng data — DB có drift sẵn, dùng `db execute` + `migrate resolve`).

## 3. Backend (NestJS)

```
apps/api/src/settings/
├── settings.service.ts        # CRUD 5 cấu hình + sessions + login-history + audit-log + test-connection
├── settings-audit.service.ts  # logChanges(): diff before/after → createMany (bỏ qua id/createdAt/updatedAt)
├── single-row.utils.ts        # ensureDefault{LeavePolicy,SecurityPolicy,AiAgentConfig}
└── dto/                       # Update{LeavePolicy,SecurityPolicy,AiAgentConfig}Dto (class-validator)
```

**Endpoints (ADMIN_GROUP):** GET/PATCH `settings/leave-policy` · `settings/security-policy` · `settings/ai-config` · PATCH `settings/geofence` · POST `settings/ai/test-connection` → `{healthz, roundTrip}` · GET `settings/sessions` (select KHÔNG có cột token) · DELETE `settings/sessions/:id` · POST `settings/sessions/revoke-others` · GET `settings/login-history` · GET `settings/audit-log?page&limit&section`
**Công khai (mọi user):** GET `settings/geofence`, GET `salary-config/current`, POST `auth/change-password`.

**Bảo mật:**
- Login: đếm sai → khóa theo `SecurityPolicy` (thông báo "tạm khóa"), reset bộ đếm khi thành công; Firebase login cũng bị chặn khi đang khóa.
- JWT payload thêm `sid`; `JwtStrategy` kiểm tra session tồn tại + chưa hết hạn + user active mỗi request (không nhận diện được → 401 "Phiên đăng nhập đã bị thu hồi hoặc hết hạn"). Token cũ không `sid` vẫn dùng được (backward-compatible).
- Đổi mật khẩu: verify bcrypt → policy 400 liệt kê yêu cầu → cập nhật `passwordChangedAt` → xóa các refresh token khác.
- `portalChat` đọc `AiAgentConfig`: tắt → thông báo thân thiện (latencyMs 0, không gọi n8n); webhookUrl/apiKey fallback env `N8N_WEBHOOK_URL`/`N8N_API_KEY`; timeout từ DB. *(Fix kèm: sessionType lạ chuẩn hóa về HR_QA — trước đây 500 Prisma enum.)*

## 4. Frontend (Next.js)

```
components/views/settings-view.tsx          # Shell: sidebar trái 7 mục + panel phải + dialog dirty-switch
components/views/settings/
├── salary-section.tsx                      # Lương & Thuế (theo năm, 9 field)
├── geofence-section.tsx                    # Vùng chấm công (tên, lat, lng, bán kính)
├── integrations-section.tsx                # Ping DB / n8n / Slack / Gemini
├── leave-policy-section.tsx                # Quota, thâm niên, carry-over, pro-rate switch
├── security-section.tsx                    # 4 card: policy · đổi mật khẩu · phiên (thu hồi) · lịch sử đăng nhập
├── ai-agent-section.tsx                    # Gate switch · webhook · apiKey write-only ("trống = giữ nguyên") · timeout · Kiểm tra kết nối · panel tham số model chỉ-đọc
└── audit-log-section.tsx                   # Bảng old→new, lọc section, phân trang
components/ui/switch.tsx                    # Switch hand-rolled (role="switch", emerald)
```

- Mỗi section tự quản state + `onDirtyChange` → sidebar hiện **chấm vàng** · chuyển mục khi dirty → **dialog xác nhận** "Rời bỏ thay đổi".
- apiKey chỉ-GHI: GET trả `apiKeySet: boolean`, không bao giờ trả key.

## 5. Kết Quả Kiểm Thử 🧪

| Bộ test | Lệnh | Kết quả |
|---|---|---|
| Unit (leave-entitlement) | `pnpm --filter api test` | **18/18 pass** |
| E2E Bảo mật (sid, revoke, lockout, đổi mật khẩu) | `node scripts/test-security.mjs` | **14/14 pass** (+ nhánh lockout 12/12) |
| E2E Toàn trang Cài Đặt | `node scripts/test-settings.mjs` | **29/29 pass** |
| TypeScript API / Web | `pnpm check-types` (api + web) | **0 lỗi** |

E2E Cài Đặt phủ: phân quyền (7 endpoint 403 với EMPLOYEE, geofence 200), round-trip phép-năm→balance (pro-rate đúng 14/12), audit đủ 4 section + lọc, gate AI agent (tắt → latencyMs 0), test-connection healthz n8n thật (14ms / round-trip 942ms).

## 6. Danh Mục Tệp Thay Đổi 📂

| Tệp | Vai trò |
|---|---|
| `packages/database/prisma/schema.prisma` + migration | 5 bảng mới + cột users/refresh_tokens |
| `apps/api/src/settings/*` | Module settings hoàn chỉnh (service, audit, dto, controller) |
| `apps/api/src/auth/{auth.service,auth.controller,jwt.strategy}.ts` | sid, lockout, policy, change-password |
| `apps/api/src/agents/agents.service.ts` + `portal.controller.ts` | Đọc AiAgentConfig; POST chat → 200 |
| `apps/api/src/salary-config/*` | Upsert ghi audit (admin từ JWT) |
| `apps/api/src/leave/leave-entitlement.ts` (+spec) | Quota/thâm niên/pro-rate/carry-over |
| `apps/web/components/views/settings-view.tsx` + `settings/*` (8 file) | Shell sidebar + 7 section |
| `apps/web/lib/{schemas/settings.schema.ts, api/settings.api.ts, api/auth.api.ts}` | Zod schema + API client |
| `scripts/test-settings.mjs`, `scripts/test-security.mjs` | E2E |

---

*Ghi chú liên kết:* [[03 - Web Portal (Next.js)]] | [[02 - Backend NestJS (API)]] | [[05 - Database Schema (Prisma)]] | [[19 - Nhật Ký Ngày 23-09-2026]] | [[12 - Báo Cáo Triển Khai & Kiểm Thử Web Portal (Next.js + shadcn ui)]]
