---
tags: [khoa-luan, bao-cao, uml, plantuml, diagram, google-docs, verified]
created: 2026-11-05
---

# 📐 Vẽ Lại 22 Sơ Đồ UML & Chèn Vào Báo Cáo (05-11-2026)

> [!IMPORTANT]
> Toàn bộ 22 biểu đồ của báo cáo (Hình 3.1–3.10, 4.1–4.12) được vẽ lại theo **ký hiệu UML chuẩn kiểu Visual Paradigm** thay cho Mermaid, rồi chèn thành ảnh vào báo cáo Google Docs thay cho các khối mã Mermaid. Thay thế phần biểu đồ của [[31 - Báo Cáo Khóa Luận - Chương 4-5 & Biểu Đồ Mermaid (02-11-2026)]]. **Repo chưa commit.**

> [!WARNING]
> Sau khi đối chiếu với code, 16 sơ đồ đã được vẽ lại lần nữa. Bảng chỉnh sửa và kết quả kiểm thử xem [[38 - Kiểm Thử Toàn Bộ Endpoint, Đối Chiếu Sơ Đồ & Leo Thang Realtime (05-11-2026)]].

## 1. Vì sao đổi

Mermaid `flowchart` không có ký hiệu UML (actor, elip use case, lifeline, node 3D...), bố cục lộn xộn, không đạt chuẩn để đưa vào báo cáo. Chuyển sang **PlantUML** (render cục bộ, không gửi nội dung ra ngoài) với một bộ style chung màu vàng nhạt/viền nâu giống Visual Paradigm.

## 2. Loại UML cho từng hình

| Loại UML | Hình trong báo cáo |
|---|---|
| Use case (script Python, không qua PlantUML) | 3.1 |
| Component, chia package theo tầng | 3.2, 3.3, 3.10 |
| Class/ERD có bội số quan hệ | 3.4 |
| Activity (start/end, rẽ nhánh, fork, swimlane) | 3.5, 3.6, 3.7, 3.8, 4.2, 4.6, 4.8 |
| Sequence (lifeline, activation, alt/opt) | 3.9, 4.3, 4.5, 4.9, 4.10, 4.11, 4.12 |
| State machine | 4.4, 4.7 |
| Deployment (node 3D) | 4.1 |

> [!NOTE]
> Số hình chương 4 trong báo cáo **khác tên file** trong repo: Hình 4.2 = `H4-11-employee-create`, 4.3 = `H4-02-attendance`, 4.4 = `H4-03-leave-state`, 4.5 = `H4-04-leave-approve`, 4.6 = `H4-05-payroll-engine`, 4.7 = `H4-06-payroll-state`, 4.8 = `H4-12-settings-audit`, 4.9 = `H4-07-hr-chat`, 4.10 = `H4-08-rag`, 4.11 = `H4-09-quiz`, 4.12 = `H4-10-cskh-escalation`.

## 3. Thay đổi nội dung so với Mermaid cũ

- **DeepSeek:** mã Mermaid trong báo cáo mới hơn repo (đã chuyển agent sang DeepSeek, xem [[33 - Chuyển AI Agent Sang DeepSeek & Rà Soát Logic UI (03-11-2026)]]). Đã đồng bộ 9 hình theo báo cáo: 3.2, 3.3, 3.6, 3.8, 4.1, 4.8, 4.9, 4.11, 4.12; các `.mmd` tương ứng trong repo cũng chép lại cho khớp.
- **Hình 3.1:** Admin → Chấm công GPS đổi từ nét đứt sang nét liền (association UML luôn nét liền).
- **Hình 3.3:** bỏ mũi tên vòng ngược "phản hồi"; ô cuối ghi "Respond to Webhook (trả kết quả về AgentsService)".
- **Hình 3.6:** model, memory, 3 tool chuyển thành ghi chú cạnh HR Agent (activity diagram không có kết nối nét đứt kiểu n8n).
- **Hình 4.2:** thêm swimlane `EmployeesService` (đã đối chiếu `apps/api/src/employees/employees.service.ts`).

## 4. Tệp trong repo

| Đường dẫn | Nội dung |
|---|---|
| `docs/diagrams/uml/*.puml` | Mã PlantUML 21 hình |
| `docs/diagrams/uml/_style.iuml` | Style chung kiểu Visual Paradigm |
| `docs/diagrams/uml/gen_use_case.py` | Sinh Hình 3.1 (SVG); PNG xuất bằng Chrome headless 2x |
| `docs/diagrams/uml/render.sh` | Render PNG (dpi 180) + SVG ra `docs/diagrams/` |
| `tools/plantuml.jar` | PlantUML 1.2026.9, đã thêm vào `.gitignore` (30 MB) |

Render lại (cần Java 17):

```bash
bash docs/diagrams/uml/render.sh                 # tất cả
bash docs/diagrams/uml/render.sh H4-05-payroll-engine.puml
```

> [!WARNING]
> Các file `.mmd` cũ vẫn còn trong `docs/diagrams/`. Nếu render lại bằng Mermaid sẽ **ghi đè** ảnh UML mới.

## 5. Chèn vào báo cáo Google Docs

- Google Docs chỉ chèn ảnh từ URL công khai, repo `khoa-luan` private → tạo repo public riêng **NguyenDang182005/khoa-luan-figures** chỉ chứa 22 PNG (`hinh-3-01.png` … `hinh-4-12.png`). Ảnh đã chèn thì Docs giữ bản sao, repo này **xóa được**.
- Mỗi khối mã Mermaid (Courier New) thay bằng một ảnh căn giữa ngay trên chú thích; rộng tối đa 425pt (khổ chữ), cao tối đa 560pt.
- Sửa chữ trong báo cáo:
  - Câu dẫn Hình 3.6: "đường nét đứt là các kết nối…" → "ghi chú bên phải liệt kê mô hình, bộ nhớ và công cụ gắn với AI Agent."
  - Mở đầu Chương 4: "đặc tả bằng Mermaid [34]" → "vẽ theo ký hiệu UML bằng PlantUML [34]".
  - Kết luận: "22 biểu đồ Mermaid" → "22 biểu đồ UML".
  - Tài liệu tham khảo [34] → PlantUML, https://plantuml.com/

## 6. Kiểm tra

- Đọc lại báo cáo: đủ 22 ảnh, mỗi chú thích "Hình x.y." có ảnh ngay phía trên, không còn đoạn Courier New, không còn chữ "Mermaid".
- Đã mở xem 15/22 PNG để soát bố cục (sửa chồng nhãn ở 3.2, nhánh chồng ở 4.8, bố cục 3.3, 4.1).
- **Chưa** xem bố cục trang thực tế trong Docs: cần lướt lại xem ảnh lớn có đẩy chú thích sang trang sau không.
