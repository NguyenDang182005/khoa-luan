# debug-n8n — script dò/sửa nội bộ n8n (one-shot)

Đây là các script **chẩn đoán/phẫu thuật** được dùng trong phiên sửa lỗi chat n8n (15/09).
Chúng đọc/ghi thẳng SQLite của n8n trong container (`docker exec hr_n8n node -`), vì thế
**chỉ chạy khi hiểu rõ** — sai một bước có thể làm hỏng workflow đang active.

- `read-n8n-*.cjs` — đọc workflows/executions/schema/webhooks/credentials từ DB n8n.
- `patch-wf01-*.cjs` — các bước vá đã áp dụng cho WF01 (giữ lại để tham khảo lịch sử fix).
- `build-wf01-import.cjs` — sinh JSON import chuẩn cho `n8n import:workflow`.

## Bài học rút ra (đừng lặp lại)

1. n8n 2.x **thực thi workflow từ `workflow_history` version được `activeVersionId` trỏ tới**,
   không phải (chỉ) cột `workflow_entity.nodes` — vá phải áp vào CẢ HAI nơi.
2. Execute Workflow node cần resource-locator đầy đủ:
   `"workflowId": { "__rl": true, "value": "<id>", "mode": "id" }` — thiếu `__rl` →
   `Parameter "Workflow" is required`.
3. Đường an toàn nhất để thay workflow: `n8n import:workflow` (CLI tự chuẩn hoá),
   rồi `n8n unpublish/publish:workflow` + cập nhật `webhook_entity` + restart container.
