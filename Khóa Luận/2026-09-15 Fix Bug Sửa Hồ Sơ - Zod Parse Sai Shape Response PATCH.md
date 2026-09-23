# Fix Bug Sửa Hồ Sơ — Zod Parse Sai Shape Response PATCH

**Ngày:** 2026-09-15  
**Trạng thái:** ✅ Hoàn thành + Đã test E2E qua trình duyệt thật (lục)

---

## Triệu chứng

Ở trang **Hồ Sơ Nhân Sự** (employees-view): mở drawer nhân viên → **"Sửa hồ sơ"** → chỉnh SĐT/địa chỉ/ngày sinh/CCCD → **"Lưu Thay Đổi"** → hiện đỏ **"Cập nhật hồ sơ thất bại."**, dialog không đóng.

**Nghịch lý:** kiểm tra API bằng script HTTP thì `PATCH /employees/:id` trả **200 và dữ liệu được lưu thành công** vào DB. Lỗi nằm hoàn toàn ở tầng client.

---

## Quy trình chẩn đoán (diagnosing-bugs loop)

### 1. Feedback loop HTTP — `scripts/diag-edit-profile.ps1`
Gửi đúng payload UI gửi (`phone`, `address`, `dateOfBirth` string `YYYY-MM-DD`, `nationalId`) → **lục** ngay từ đầu: API hoạt động hoàn hảo. → Bug nằm ở client, loop HTTP không đủ đỏ.

### 2. Feedback loop DOM — `scripts/diag-browser/diag-edit-profile-ui.js`
Puppeteer-core + **Edge có sẵn trên Windows** (không cần tải Chromium ~150MB). Kịch bản: login admin → bấm sidebar `Ho So Nhan Su` → gõ tìm "EMP003" → mở drawer → **Sửa hồ sơ** → sửa SĐT (React controlled input qua native setter + event `input`) → **Lưu Thay Đổi** → assert: dialog đóng? lỗi đỏ trên dialog? PATCH 200? console error?

**Kết quả chạy đầu (đỏ đúng triệu chứng user mô tả):**
```
PATCH /api/v1/employees/... -> 200 {...}
Dialog still open: true | Red errors: ["Cập nhật hồ sơ thất bại."]
RED: dialog khong dong
```

### 3. Gốc rễ

`apps/web/lib/api/employees.api.ts`:

```ts
update: async (id, input) => {
  const { data } = await apiClient.patch(`/employees/${id}`, input)
  return EmployeeDetailSchema.parse(data)   // 💥 nổ tại đây
}
```

- `PATCH /employees/:id` → backend trả object employee **PHẲNG** (`departmentId`, `positionId`, không có object lồng).
- `EmployeeDetailSchema` **bắt buộc** `department: {id, name}` + `position: {id, title}` (thiết kế cho `GET /employees/:id` trả chi tiết đầy đủ).
- Zod ném `ZodError` (thiếu `department`/`position`) → `handleSaveEdit` rơi vào `catch` → báo "thất bại" **dù server đã lưu 200**.
- **`updateStatus()` (switcher trạng thái trong drawer) dính cùng lỗi** — cùng parse sai schema, cùng trả object phẳng.

Các giả thuyết bị loại: axios interceptor (chỉ chặn 401 — không đụng 200), sai format ngày (`dateOfBirth` optional trong schema, `getById` cùng format ISO vẫn parse OK), auth redirect (không xảy ra).

---

## Fix

**Frontend-only, không đổi API contract** — PATCH xong luôn refetch `getById()` (response chi tiết khớp schema, drawer hiển thị đầy đủ 5 nhóm thông tin):

```ts
update: async (id: string, input: UpdateEmployeeInput) => {
  await apiClient.patch(`/employees/${id}`, input)
  return employeesApi.getById(id)
},
updateStatus: async (id: string, status: string) => {
  await apiClient.patch(`/employees/${id}/status`, { status })
  return employeesApi.getById(id)
},
```

> 💡 **Bài học:** không dùng schema "detail" để parse response của endpoint trả "flat". Quy tắc: GET-by-id = chi tiết lồng; PATCH = flat → luôn refetch sau ghi.

---

## Files đã thay đổi

| File | Thay đổi |
|---|---|
| `apps/web/lib/api/employees.api.ts` | `update()` + `updateStatus()`: bỏ `EmployeeDetailSchema.parse()` trên response phẳng → refetch `getById()` |
| `scripts/diag-edit-profile.ps1` | [Mới] Loop HTTP kiểm hồi quy |
| `scripts/diag-browser/diag-edit-profile-ui.js` | [Mới] Loop DOM (puppeteer-core + Edge) kiểm hồi quy mức UI |

---

## Kiểm thử

- **Loop DOM sau fix → LỤC:** PATCH 200, dialog đóng, không lỗi, dữ liệu persist (đổi SĐT → đọc lại khớp).
- **Typecheck:** `pnpm --filter web check-types` ✅
- **Dọn dẹp:** khôi phục phone EMP003 về `0903333333`, xóa ảnh chụp, không để instrumentation trong code app.
- **Lưu ý:** web chưa có unit-test runner → 2 script diag trên chính là kiểm hồi quy phù hợp nhất (chạy khi server 3000+3001 đang chạy: `node scripts/diag-browser/diag-edit-profile-ui.js`).

---

## Ghi chú hạ tầng (DSH sandbox)

- `nest start --watch` chết khi hot-reload (spawnSync `taskkill` bị chặn EPERM) → phải chạy API ở chế độ full-access hoặc ngoài DSH.
- `next build` bắt buộc spawn jest-worker → cũng cần full-access; chạy được qua `node node_modules/next/dist/bin/next build --experimental-build-mode compile` + `generate`.
- `next start` **đừng** pipe qua `Select-Object -First N` — pipeline ngắt sau N dòng sẽ kill luôn server.
