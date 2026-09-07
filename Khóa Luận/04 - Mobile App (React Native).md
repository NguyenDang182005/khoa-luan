---
tags: [khoa-luan, mobile, react-native, expo, employee-app]
created: 2026-09-04
---

# 📱 Mobile App (React Native + Expo)

## Thông Tin

| Mục | Giá trị |
|-----|----------|
| **Framework** | React Native 0.79.5 + Expo 57 |
| **Path** | `apps/mobile/` |
| **Routing** | Expo Router |
| **Styling** | NativeWind (Tailwind cho RN) |
| **State** | Zustand + TanStack Query |
| **Target** | iOS & Android |

## Mục đích

Ứng dụng **gọn nhẹ trên diện thoại** dành cho **Nhân viên**:

- ⏰ **Chấm công** (Check-in / Check-out)
- 🗨️ **Nhắn tin với Trợ lý AI nội bộ** (HR Q&A + Training)
- 📄 **Xem thông tin lương, ngày phép, hợp đồng**
- 🎮 **Thực hành Role-play đào tạo** (Training Agent)
- 📬 **Xin nghỉ phép**

## Tech Stack

| Package | Mục đích |
|---------|----------|
| `expo-router` | File-based navigation |
| `nativewind` v4 | Tailwind CSS cho React Native |
| `react-native-reanimated` | Smooth animations |
| `@tanstack/react-query` | API data fetching |
| `zustand` | Global state |
| `@react-native-async-storage` | Persistent local storage |
| `axios` | HTTP client |
| `@expo/vector-icons` | Icon library |
| `@repo/shared-types` | Type safety với Backend |

## Luồng AI Chat (Mobile → n8n → Gemini)

```
Nhân viên nhắn tin
    ↓
Mobile gọi POST /webhook/chat
    ↓
n8n Router Agent (PII Masking → Intent Detection)
    ↓
Route đến HR/Training Agent
    ↓
Gemini xử lý
    ↓
Trả kết quả về Mobile
```

---

*Liên kết:* [[00 - Tổng Quan Dự Án]] | [[01 - Kiến Trúc Hệ Thống & Multi-Agent]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]]
