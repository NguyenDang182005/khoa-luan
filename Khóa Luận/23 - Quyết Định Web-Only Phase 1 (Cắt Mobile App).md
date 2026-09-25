---
tags: [khoa-luan, quyet-dinh, scope, web-only]
created: 2026-09-25
---

# ⚖️ Quyết Định Web-Only Phase 1 — Cắt Mobile App Khỏi Scope

> **Biên bản quyết định 25/09/2026** — kết quả buổi stress-test ("grilling") phạm vi sản phẩm, thực hiện khi còn **7 tuần** trước bảo vệ.

## 1. Quyết định

**Cắt Mobile App (React Native + Expo) khỏi scope Phase 1.** Sản phẩm bàn giao: Web Portal (Admin + Employee Self-Service) + 4 AI workflow n8n + kênh CSKH Zalo OA (demo qua Slack DM). Mobile chuyển thành **hướng phát triển** (Phase 2). ADR chính thức: `docs/adr/0003-web-only-client-phase-1.md`.

## 2. Cơ sở quyết định (4 tiêu chí)

| # | Tiêu chí | Dữ kiện |
|---|----------|---------|
| 1 | **Ràng buộc đề tài** | Tên đề tài không nhắc "di động/đa nền tảng" → mobile không bị bắt buộc bởi bất kỳ văn bản nào |
| 2 | **Giá trị độc lập (persona)** | Không có nhóm người dùng nào *chỉ* mobile phục vụ được — toàn bộ tính năng kế hoạch (chấm công GPS, chat AI, đào tạo, hồ sơ, lương, phép) đã có trên Web ESS. "Phương án sử dụng thứ 2" không phải lập luận đủ mạnh trước hội đồng |
| 3 | **Năng lực thực thi** | Chưa có kinh nghiệm React Native; ước tính thực tế 2.5–3.5 tuần cho tối thiểu 3 màn hình (setup môi trường + Firebase trên RN + expo-location + debug máy thật) |
| 4 | **Quỹ thời gian** | Còn 7 tuần; Báo cáo luận văn 35%, Sprint 5 (chương 1–5, slides, video) + T15 (demo env) chưa bắt đầu — mobile "ăn" 3 tuần = rủi ro trực tiếp lên điểm báo cáo |

**Kết luận:** giữ mobile lúc này là **chi phí học framework mới trá hình thành tính năng**, không phải giá trị biện vệ. Cắt nó là quyết định kỷ luật phạm vi có chủ đích — hội đồng tôn trọng lập luận này hơn một app dở dang.

## 3. Điều gì KHÔNG mất

- 📍 **Killer #1 — GPS Geofencing Check-in**: ĐÃ chạy thật trên **Web ESS** — `employee-portal` dùng `navigator.geolocation.getCurrentPosition` + `haversineMeters` (`lib/api/attendance.api.ts`), vùng văn phòng đọc từ `OfficeGeofence` (Trang Cài Đặt). Cắt mobile không mất tính năng này.
- 📊 **Killer #3 — Radar Hybrid Assessment**: đã hiển thị trên Web (My Training, chuẩn thang điểm 23/09).
- 💬 AI Chat (HR Q&A / Training), hồ sơ 5 nhóm, lương, phép: đã có trên Web.

## 4. Làm rõ: GraphRAG → Chunk RAG

Kế hoạch T7–8 ghi "GraphRAG", nhưng thứ thực sự chạy từ 14/09 là **chunk RAG**: bảng `policy_chunks` (10 tài liệu) + embedding Gemini `gemini-embedding-001` 768 dims + pgvector HNSW (fallback cosine in-app) + tool `SearchPolicyKnowledge` trên WF02. **GraphRAG đa nhịp chưa từng triển khai** → chuyển thành mục "hướng phát triển" cùng mobile (báo cáo cần viết đúng thuật ngữ, tránh mâu thuẫn đã bị flag ở doc 15).

## 5. Việc đồng bộ đã thực hiện (25/09)

- [x] Xóa `apps/mobile/` khỏi monorepo + bỏ script `dev:mobile` (root `package.json`)
- [x] `README.md` — sơ đồ kiến trúc, cây monorepo, tech stack, ghi chú scope
- [x] `CONTEXT.md` — Scenario: scenarioType từ client Web
- [x] Doc 00 (tổng quan + scope), 01 (sơ đồ luồng: client = Web Portal/Zalo), 04 (banner cắt scope), 07 (trạng thái T11–12 + checklist), 09 (bảng tiến độ + mục P0 + bảng Killer Features), 11 (banner + Killer #1 ghi nhận Web ESS), 12 (quickstart bỏ dev:mobile)
- [x] `n8n-workflows/README.md` + `run-all.ps1` — channel ví dụ "web", mobile ghi chú reserved
- [x] ADR-0003: Web-only client Phase 1

**Không đụng vào** (nhãn vận chuyển/data layer đang chạy): JSON workflow n8n, `schema.prisma` (channel `mobile` = reserved), dữ liệu seed demo.

## 6. Phân bổ 7 tuần còn lại

1. **Ưu tiên 1 — Báo cáo + demo**: chương 1–5 luận văn, slides, video demo 5 phút, setup demo env (T15)
2. Kiểm thử tích hợp T13–14: gói trong ≤ 1 tuần
3. **Hướng phát triển (ghi trong báo cáo, không triển khai)**: Mobile app React Native (thiết kế 4 tab tại [[04 - Mobile App (React Native)]]), GraphRAG đa nhịp, Zalo OA thật, phân tích build-vs-buy so với nền tảng HR có sẵn (đề xuất bổ sung ADR-0004 / mục chương 1 — hiện chưa có tài liệu nào so sánh với OrangeHRM/BaseVN)

---

*Liên kết: [[00 - Tổng Quan Dự Án]] | [[07 - Kế Hoạch Thực Hiện 15 Tuần]] | [[09 - Task Checklist]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]] | [[04 - Mobile App (React Native)]]*
