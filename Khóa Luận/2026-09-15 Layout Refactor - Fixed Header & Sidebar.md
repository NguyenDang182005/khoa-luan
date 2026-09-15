# Layout Refactor — Fixed Header & Sidebar

**Ngày:** 2026-09-15  
**Trạng thái:** ✅ Hoàn thành

---

## Vấn đề

Header và sidebar bị cuộn theo cùng content khi chuyển tab. Content chính hiển thị trắng (blank) khi dùng `h-screen` vì `html`/`body` chưa có `h-full`.

---

## Giải pháp: Tách component + App Layout chuẩn

Không dùng `position: fixed` hay `sticky`. Dùng Flexbox + `h-full` đúng chuẩn Next.js App Router.

### Cấu trúc layout mới

```
html.h-full
  body.h-full
    div.flex.flex-col.h-full      ← AppShell
      <AppHeader> (shrink-0)      ← Cố định trên cùng
      div.flex.flex-1.min-h-0    ← Body row
        <AppSidebar> (shrink-0)  ← Cố định bên trái
        main.overflow-y-auto     ← Chỉ vùng này cuọn
```

---

## Files đã thay đổi / tạo mới

### [Mới] `apps/web/components/shell/app-header.tsx`

Component Header độc lập, nhận props:
- `user: AuthUser` — hiển thị tên, role badge, avatar
- `onLogout: () => void`
- `onOpenSearch: () => void` — mở Search modal (chỉ ADMIN)

### [Mới] `apps/web/components/shell/app-sidebar.tsx`

Component Sidebar độc lập, nhận props:
- `navItems: NavItem[]` — danh sách tab được filter theo role
- `activeTab: string`
- `onTabChange: (id) => void`
- `onLogout: () => void`
- `userInitials: string`

### [Sửa] `apps/web/app/layout.tsx`

```tsx
<html lang="vi" className={cn("font-sans h-full", geist.variable)}>
  <body className={`${geistSans.variable} ${geistMono.variable} h-full`}>
    {children}
  </body>
</html>
```

Thêm `h-full` vào `html` và `body` — bắt buộc để `h-full` trên child hoạt động.

### [Refactor] `apps/web/app/page.tsx`

```tsx
// AppShell return:
<div className="flex flex-col h-full bg-background text-foreground">
  <AppHeader user={user} onLogout={logout} onOpenSearch={() => setSearchOpen(true)} />
  <div className="flex flex-1 min-h-0">
    <AppSidebar navItems={navItems} activeTab={activeTab} onTabChange={...} ... />
    <main className="flex-1 min-w-0 overflow-y-auto bg-background">
      {/* tab content */}
    </main>
  </div>
  {searchOpen && <SearchModal ... />}
</div>
```

Cũng tách `SearchModal` thành inline component riêng trong file.

---

## Tác động

- Header cố định, không di chuyển khi chuyển tab
- Sidebar cố định, không di chuyển khi cuọn content
- Chỉ `<main>` cuọn nội dung
- `page.tsx` gọn hơn, dễ maintain

---

## Liên kết

- [[2026-09-15 2-Role Refactor & OAuth Account Management]]
