---
tags: [khoa-luan, pii, masking, audit, gemini, privacy, fixed, runtime-verified]
created: 2026-09-17
updated: 2026-09-17
status: fixed-verified
---

# 🔍 Audit PII Masking — Kế Hoạch vs Hiện Trạng (17-09-2026)

> **Phạm vi:** toàn chu trình (masking pipeline → DB → endpoint `pii-audit` → tab PII trên portal).
> **Phương pháp:** đối chiếu tĩnh (docs `Khóa Luận/` vs code, có trích dẫn file:dòng) + **runtime test** bắn PII giả (SĐT `0900000001`, CCCD `001200000001`, email `test@example.com`) qua cả 2 luồng WF01 (portal chat) & WF04 (webhook Zalo/Slack), soi DB + đầu ra.
> **Kết luận ngắn:** ❌ **CHƯA đúng theo kế hoạch** — masking chỉ đúng cho luồng nội bộ; luồng khách hàng (CSKH) và quiz submit đưa PII raw thẳng vào Gemini; tab Audit gán nhãn sai; không có test tự động.

---

## 1. Kết quả tổng hợp theo từng cam kết của kế hoạch

| Cam kết kế hoạch | Nguồn | Hiện trạng | Verdict |
|---|---|---|---|
| "Mọi tin nhắn… phải qua Regex+Rule Masking trước khi gửi Gemini", bảo vệ cả **khách hàng** | `11 - Định Hướng` (94-100) | Luồng nội bộ HR_QA/Training qua WF01: ✅ Gemini chỉ thấy `maskedMessage`. Luồng CSKH production (Slack/Zalo → WF04 **bỏ qua WF01**): ❌ raw tới Gemini. Quiz submit (`training.service.ts:127-140` → WF03): ❌ raw | ⚠️ **Đúng một phần** |
| Vị trí masking: WF01 Code node, LLM chỉ thấy `maskedMessage` | `01 - Kiến Trúc` (63-67) | Node "PII Masking" `01-router-agent.json:23` che đúng 3 loại (ID 9/12 số → `[MASKED_ID]`, SĐT → `[MASKED_PHONE]`, email → `[MASKED_EMAIL]`); WF02 prompt dùng `maskedMessage` (`02:104`), WF03 role-play dùng `maskedMessage` | ✅ Khớp (cho luồng qua WF01) |
| WF04 lưu original + masked; masked ưu tiên khi có | `07 - Kế Hoạch` (33), `15 - Refactor` (30,100) | `04-zalo-cskh.json:34` `masked = body.maskedMessage \|\| raw` — chỉ sửa được **thứ tự ưu tiên** (commit `300716c`), nhưng upstream `slack.service.ts:65-87` **không gửi `maskedMessage`** và WF04 **không có node mask** → trên luồng thật `masked === raw` | ❌ **Vẫn là Critical** (đúng như doc 15 tự bóc) |
| Audit Trail hiển thị **đối chiếu song song** original ↔ masked | `11:99`, `03:71`, `12:72` | Tab PII Audit chỉ render 1 cột "Nội dung đã lưu" (chính là bản GỐC trong DB); `metadata.maskedMessage` có trong schema nhưng **không render**; badge "Đã lưu sau masking" gán **cứng cho 100% item** (`cskh-escalation-view.tsx:636`), caption "đã qua PII Masking của WF01" (`:616`) sai với luồng CSKH | ❌ Chưa đạt |
| "PII Masking & Audit Trail 🟢 Xong 100%" | `09:133`, `14:155`, `12:103` | Không có bất kỳ test tự động nào verify masking (`test-all-wf.cjs:30-56` còn **truyền sẵn `maskedMessage` sạch** → bypass node mask). Doc `15` là bản duy nhất trung thực khi ghi "Critical — chưa fix" | ❌ Claim sai |

---

## 2. Bằng chứng runtime (17/09, PII giả)

| Luồng | Gemini nhận | DB content | DB metadata |
|---|---|---|---|
| **WF01** portal chat (HR_QA) | ✅ bản masked (bot trả lời bình thường, không lặp PII) | bản original (theo kế hoạch "lưu original") | chỉ `{"intent":"HR_QA"}` — **không lưu bản masked** → audit không thể đối chiếu song song cho luồng này |
| **WF04** webhook Zalo/Slack | ❌ **raw** (masked = raw) | bản original | `maskedMessage` **giống hệt bản gốc**, không có `[MASKED_*]` |
| `GET /agents/pii-audit` | — | trả content **gốc** (có đủ PII giả) | `metadata_has_masked=false` |

**Root cause (WF04):** `Parse Zalo Message` (`04:34`) chỉ *đọc* `body.maskedMessage` do upstream truyền — không node nào *tạo* nó; `SlackService` (`slack.service.ts:65-73`) forward payload không có field này → masking là **no-op** trên luồng khách hàng.

## 3. PII "thật" trong DB — CHỈ GHI NHẤN, chưa xử lý

Quét toàn bộ `AiChatMessage.content`: tìm thấy **1 email** (18 ký tự, `sup…`) và **1 SĐT** (`091…`, 10 số) lưu nguyên văn. Số lượng nhỏ (DB demo) nhưng đúng nghĩa là PII chưa mask nằm trong DB. *Theo quyết định của bạn: chưa đụng dữ liệu, chờ duyệt hướng xử lý.*

## 4. Khoảng trống khác

- **Không có retention/TTL** cho `ai_chat_messages.content` (chứa original) và `n8n_chat_histories` — chỉ là backlog (`15:103`).
- Regex chưa phủ SĐT 11 số legacy (016x/012x), máy bàn 02x; có thể over-mask số 9/12 chữ số vô tình.
- Docs lệch nhau: `09`/`14` claim 100% Xong vs `15` ghi Critical chưa fix; `n8n-workflows/README.md:53` stale; comment `schema.prisma:471` ghi key `masked_content` nhưng code dùng `maskedMessage`.

---

## 5. Trả lời câu hỏi "đang làm đúng kế hoạch chưa?"

> **Đúng một phần.** Luồng nhân viên nội bộ (HR_QA, Training role-play qua WF01) mask đúng thiết kế. Nhưng (1) luồng **khách hàng CSKH** — nhóm mà doc 11 cam kết bảo vệ — đang đưa PII raw thẳng vào Gemini; (2) quiz submit raw; (3) tab Audit chưa có đối chiếu song song + badge gán cứng gây hiểu nhầm "đã mask" cho dữ liệu raw; (4) không có test tự động; (5) docs tự mâu thuẫn về trạng thái. Doc `15` đã tự phát hiện (2) từ 15/09 nhưng đến nay mới sửa được nửa vấn đề (thứ tự ưu tiên field, chưa có node mask).

---

## 6. Câu hỏi mở chờ quyết định (chưa fix gì trước khi duyệt)

> ✅ **Đã được chủ repo quyết định hết (17/09 tối) và triển khai xong — xem mục 7.**

1. **WF04 mask gốc rễ:** thêm node "PII Masking" (dùng lại đúng regex WF01) vào WF04 ngay sau Parse Zalo Message, trước Save User Message & CSKH Agent?
2. **Quiz essay:** mask câu trả lời tự luận trước khi Gemini chấm, hay chấp nhận rủi ro (dữ liệu nội bộ) và ghi rõ vào tài liệu?
3. **Tab PII Audit:** (a) render đối chiếu song song original ↔ `metadata.maskedMessage` + badge có điều kiện (chỉ "Đã lưu sau masking" khi 2 bản khác nhau), (b) chỉ sửa badge, hay (c) để nguyên?
4. **Regex:** giữ nguyên + ghi rõ giới hạn trong tài liệu, hay mở rộng SĐT 11 số/máy bàn?
5. **Retention:** thêm TTL/xóa dữ liệu gốc sau N ngày, hay để backlog?
6. **Đồng bộ docs:** hạ claim "100% Xong" ở `09`/`14`, sửa `README` n8n, sửa key comment schema?

---

## 7. ✅ ĐÃ XỬ LÝ (17/09 tối) — theo quyết định của chủ repo

| Quyết định | Đã làm | Kết quả |
|---|---|---|
| Q8: Thêm node mask vào WF04 | Node "PII Masking" (regex WF01: `[MASKED_ID]`/`[MASKED_PHONE]`/`[MASKED_EMAIL]`) chèn giữa Parse Zalo Message → Get/Create CSKH Session; `Save User Message` lưu `content`=original + `metadata.maskedMessage`=bản mask; `CSKH Agent` prompt dùng bản mask. Deploy live qua `scripts/fix-wf04-pii-mask.mjs` (delete+create, giữ id `ioUQHgxiI7Db2rfF`), chạy lại `fix-router.mjs` (WF01 id mới `PbZ7WHffDLI5vj69`) | ✅ |
| Q9: Quiz essay | Chấp nhận rủi ro (dữ liệu nội bộ) — đã ghi vào doc `15` mục backlog | ✅ docs |
| Q10: Audit tab | Render **3 cột song song**: Vai trò \| Bản gốc (lưu DB) \| Bản mask AI nhìn thấy (token `[MASKED_*]` tô sáng); badge "Đã lưu sau masking" chỉ hiện khi bản mask khác original, ngược lại badge vàng "Gốc chưa mask (bản ghi cũ)"; sửa caption sai | ✅ |
| Q11: Regex | Giữ nguyên 3 loại; giới hạn (SĐT 11 số legacy/máy bàn không phủ, có thể over-mask số 9/12 chữ số) ghi rõ tại đây | ✅ docs |
| Q12: Retention | Backlog (doc `15` mục 5 có sẵn TTL `n8n_chat_histories`) | ✅ docs |
| Q13: Đồng bộ docs | `09` checklist, `14` nhật ký (ghi chú sửa claim), `15` (Critical #5 → đã fix), `n8n-workflows/README.md` (flow 0-LLM), `schema.prisma` comment key `maskedMessage` | ✅ |

### Kiểm chứng sau fix — `node scripts/diag-pii-runtime.cjs` → 0 RED

```
WF04 metadata.maskedMessage =
  "…SĐT [MASKED_PHONE] hoặc email [MASKED_EMAIL], CCCD [MASKED_ID]."
[PASS] maskedMessage KHÁC content (hết no-op)
[PASS] đủ 3 token [MASKED_PHONE]/[MASKED_ID]/[MASKED_EMAIL]
[PASS] bản mask không còn PII giả nguyên văn
[PASS] phản hồi bot không lặp PII giả
```

- ESLint + `tsc --noEmit`: 0 lỗi
- PII thật trong DB (1 email + 1 SĐT): **vẫn giữ nguyên theo quyết định** — đã ghi nhận ở mục 3, chờ chỉ đạo riêng nếu muốn xử lý
- Files: `n8n-workflows/04-zalo-cskh.json`, `apps/web/components/views/cskh-escalation-view.tsx`, `scripts/fix-wf04-pii-mask.mjs` (NEW), `scripts/diag-pii-runtime.cjs` (NEW), 5 files docs

---

*Liên kết: [[17 - Nhật Ký Ngày 17-09-2026]] | [[11 - Định Hướng Phát Triển Sản Phẩm (Web & Mobile)]] | [[15 - Refactor Real API Toàn Portal & Review Best Practice]] | [[2026-09-17 Redesign UI Bàn Tiếp Quản CSKH & Fix Bug Toggle Bot]]*
