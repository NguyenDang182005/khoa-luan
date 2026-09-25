# ADR-0003: Web-only client cho Phase 1 — Mobile App là hướng phát triển

**Ngày:** 2026-09-25  
**Trạng thái:** Accepted

## Bối cảnh

Kế hoạch ban đầu gồm mobile app React Native (Expo) cho Employee Self-Service: chấm công GPS geofencing, chat AI, hybrid assessment, hồ sơ lương/phép (8 màn hình). Thực trạng tuần ~13/15 của khóa luận:

- `apps/mobile` chỉ là skeleton: 3 UI primitives, chưa có `app/` (expo-router entry), chưa boot được, 0/8 màn hình, chưa cài `expo-location`
- Web Portal đã hoàn thành 10 views bao gồm **toàn bộ** chức năng kế hoạch cho mobile — kể cả GPS geofence check-in (`navigator.geolocation` + Haversine, `OfficeGeofence` cấu hình tại Trang Cài Đặt)
- Tên đề tài đăng ký không ràng buộc nền tảng di động
- Không xác định được persona nào **chỉ** mobile phục vụ được ("phương án sử dụng thứ 2" không đủ mạnh trước hội đồng)
- Còn 7 tuần; báo cáo luận văn 35%, Sprint 5 (chương 1–5, slides, video demo) và T15 (demo env) chưa bắt đầu

## Quyết định

**Phase 1 = web-only client.** Xóa `apps/mobile` khỏi monorepo, bỏ script `dev:mobile`. Mobile app là Phase 2 (hướng phát triển): kiến trúc API-first + `@repo/shared-types` dùng chung + Firebase Auth đảm bảo tính sẵn sàng cho client di động khi cần.

Nhãn `channel: "mobile"` trong payload webhook n8n và schema Prisma **giữ nguyên** như giá trị reserved (không đụng vào hệ thống đang chạy).

## Hệ quả

- ✅ ~3 tuần được giải phóng cho báo cáo, slides, video demo, demo env — yếu tố quyết định điểm số
- ✅ Repo sạch: không còn skeleton bỏ dở gây câu hỏi khi hội đồng review mã nguồn
- ✅ Killer #1 GPS geofencing vẫn live trên Web ESS (`employee-portal`)
- ⚠️ Mất cơ hội demo "app thật trên điện thoại" — chấp nhận vì hình thức demo là video/slides
- ⚠️ Thiết kế Phase 2 giữ tại `Khóa Luận/04` (4 tab) và `Khóa Luận/11` mục 3; biên bản quyết định: `Khóa Luận/23`
