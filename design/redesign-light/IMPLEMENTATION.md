# Light redesign — quy tắc áp dụng vào code

Tham chiếu thị giác: `design/redesign-light/prototype.html` (3 màn đã duyệt). Token nằm ở `apps/web/app/globals.css`.

## Ràng buộc cứng
- Chỉ đổi **giao diện** (className, cấu trúc JSX phục vụ layout, chữ hiển thị). Không đổi logic, state, gọi API, schema Zod, RBAC, WebSocket, props public của component, tên field.
- Không thêm thư viện. Dùng lucide-react, Recharts, @base-ui/react, sonner sẵn có.
- Không hardcode màu: cấm `emerald-*`, `red-*`, `rose-*`, `amber-*`, `purple-*`, `indigo-*`, `green-*`, `blue-*`, `sky-*`, `cyan-*`, `teal-*`, `gray-*`, `slate-*`, hex `#…`, `oklch(…)` trong component. Dùng token bên dưới.
- Không gradient, không `backdrop-blur`, không `shadow-md/lg/xl/2xl`, không `scale-*` hover, không emoji làm icon.
- Không dark mode: bỏ các prefix `dark:` mới; giữ nguyên nếu đã có cũng được.

## Token màu (Tailwind class)
| Mục đích | Class |
|---|---|
| Nền trang / card / vùng chìm | `bg-background` / `bg-card` / `bg-sunken` (#F9FAFB) / `bg-muted` |
| Chữ chính / phụ / mờ | `text-foreground` / `text-secondary-foreground` / `text-muted-foreground` / `text-subtle-foreground` (chỉ placeholder, chữ không mang thông tin) |
| Viền | `border-border`, viền phân cách dòng `border-border-subtle`, viền input `border-input` |
| Primary (duy nhất) | `bg-primary` `hover:bg-primary-hover` `text-primary` `bg-primary-tint` `text-accent-foreground` |
| Thành công | `text-success` `bg-success-tint` |
| Cảnh báo | `text-warning` `bg-warning-tint` |
| Lỗi / nguy hiểm | `text-danger` `bg-danger-tint` (`destructive` = alias) |
| Thông tin | `text-info` `bg-info-tint` |
| AI (chỉ cho thứ thuộc AI) | `text-ai` `bg-ai-tint` |
| Agent | WF01 `text-agent-wf01 bg-agent-wf01-tint` (violet) · WF02 `…wf02` (blue) · WF03 `…wf03` (amber) · WF04 `…wf04` (rose). Tên cũ `agent-teal/blue/amber/coral` vẫn chạy nhưng trỏ WF01/02/03/04 — **sửa map nào đang gán WF sai màu** (vd. WF04 đang dùng teal → đổi sang wf04). |
| Chart | `var(--chart-1..5)`, grid `var(--chart-grid)`, axis `var(--muted-foreground)` |

Map thay thế nhanh: `emerald-*` → `success`; `red-*`/`rose-*` → `danger`; `amber-*`/`yellow-*` → `warning`; `blue-*`/`sky-*` → `info` (nếu là trạng thái) hoặc `primary`; `purple-*`/`indigo-*`/`violet-*` → `ai` (nếu thuộc AI) hoặc `primary`. Dạng `bg-emerald-500/15 text-emerald-400` → `bg-success-tint text-success`. Chấm trạng thái `bg-emerald-500` → `bg-success`.

## Typography
`text-display` 30/36 · `text-h1` 24/32 · `text-h2` 20/28 · `text-h3` 16/24 · `text-body` 14/22 · `text-body-sm` 13/20 · `text-caption` 12/18 · `text-micro` 11/16.
- Không dùng `text-[9px]`, `text-[10px]`; tối thiểu `text-micro` (11px) và chỉ cho nhãn phụ/timestamp.
- Sentence case. Bỏ `uppercase tracking-wider` ở tiêu đề card, nhãn KPI, tiêu đề bảng. Nếu thật cần eyebrow: `text-micro font-medium uppercase tracking-[0.04em] text-muted-foreground`.
- Chuỗi tiếng Việt viết hoa mọi chữ đầu ("Bảng Lương & Thuế") → sentence case ("Bảng lương & thuế"). Không đổi chuỗi dùng làm key/logic.
- Số tiền, số liệu: thêm `tabular` (class tiện ích có sẵn), cột tiền căn phải. `font-mono` chỉ cho mã NV, ID, model id.

## Bố cục trang
- Mỗi view là nội dung trong `<main>` (shell đã lo sidebar/header, `max-w-[1440px]`, padding 16/24/32). View **không** tự thêm padding ngoài cùng lớn hơn; dùng wrapper `flex flex-col gap-6`.
- Page header: `<h1 className="text-h1 font-semibold">` + `<p className="mt-1 text-body text-muted-foreground">` bên trái, nút hành động bên phải (`flex flex-wrap items-end justify-between gap-4`). Đúng **một** nút primary mỗi màn; còn lại `variant="outline"`.
- Grid: `gap-4 lg:gap-6`. Card padding 20/24 (Card primitive đã có).
- Cột phụ cố định (AI Agents 280px, Settings 220px, CSKH 340px): nền `bg-card`, `border-r border-border` hoặc tách thành card riêng; dưới `lg` xếp chồng hoặc cuộn ngang, không vỡ layout ở 375px.
- Bảng: dùng primitive `Table` (header 44 nền sunken, row 56). Bọc `overflow-x-auto`, đặt `min-w-[…]` cho table để cuộn ngang trên mobile.

## Component
- `Button`: `default` (primary) · `outline` · `ghost` · `destructive` (danger outline) · `secondary`. Size `sm` 32, `default` 36, `lg` 40. Icon button phải có `aria-label`.
- `Badge` variants: `success` `warning` `destructive` `info` `ai` `secondary` `outline` `default`(primary tint) + agent `teal|blue|amber|coral`. Trạng thái luôn kèm icon hoặc dot + chữ.
- `Tabs`: đã là underline; chỉ cần dùng `TabsList`/`TabsTrigger`, bỏ class nền tối tự thêm.
- `Card`/`CardHeader`/`CardTitle`/`CardDescription`: bỏ class tự thêm kiểu `text-xs uppercase` trên `CardTitle`.
- Dialog: primitive đã chuẩn; truyền `className="max-w-[560px]"` cho modal chi tiết.
- Icon trong ô tint: `flex size-9 items-center justify-center rounded-md bg-primary-tint text-primary` (hoặc tint trạng thái).
- Empty state: icon 40 trong ô `bg-muted text-muted-foreground`, tiêu đề `text-body font-semibold`, mô tả `text-body-sm text-muted-foreground`, CTA outline nếu có.
- Loading: dùng class `skeleton` (đã có shimmer) thay cho `animate-pulse bg-muted`.
- Banner cảnh báo: `rounded-lg border border-warning/20 bg-warning-tint text-warning` + icon; lỗi tương tự với `danger`.
- Live dot: `size-2 rounded-full bg-success` (+ `animate-pulse` nếu đang realtime) kèm chữ.
- Recharts: `CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false}`; `XAxis/YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} axisLine={false} tickLine={false}`; Tooltip `contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, boxShadow: "var(--shadow-sm)", fontSize: 12 }}`; màu series `var(--chart-n)`.

## Kiểm tra trước khi xong
- `grep -nE "(emerald|red|rose|amber|purple|indigo|green|blue|sky|cyan|teal|gray|slate|yellow|violet)-[0-9]|#[0-9a-fA-F]{6}|oklch\(|uppercase|text-\[(9|10)px\]|backdrop-blur|gradient" <file>` → không còn (trừ eyebrow hợp lệ).
- `pnpm --filter web check-types` không lỗi mới trong file mình sửa.
