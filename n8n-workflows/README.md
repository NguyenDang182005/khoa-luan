# n8n Workflows — HR Multi-Agent System v2

## Tong quan

Thu muc nay chua 4 workflow JSON cho n8n, da duoc cap nhat theo quyet dinh thiet ke v2.

## Cai dat

### 1. Khoi dong n8n

```bash
docker-compose up -d n8n
```

Truy cap: http://localhost:5678 | User: `admin` | Password: `n8n-secret-2024`

### 2. Import Workflows

1. Dang nhap n8n
2. Click **+ New workflow** → **Import from JSON**
3. Paste noi dung tung file JSON hoac dung **Import from file**
4. Import theo thu tu: `01` → `02` → `03` → `04`

### 3. Environment Variables

Vao **Settings → Environment Variables** hoac set trong docker-compose:

| Variable | Mo ta |
|---|---|
| `GEMINI_API_KEY` | Google AI Studio API key (lay tai https://aistudio.google.com) |
| `HR_API_KEY` | API key de goi NestJS `/n8n/*` endpoints |
| `ZALO_OA_ACCESS_TOKEN` | Zalo OA access token (lay tai Zalo Developer) |

---

## Mo ta Workflow

### 01 — Router Agent

**Webhook:** `POST /webhook/chat`

**Request body:**
```json
{
  "message": "Toi con bao nhieu ngay phep?",
  "channel": "web | mobile | zalo",
  "employeeId": "clx...",
  "sessionId": null,
  "scenarioType": "customer_complaint"
}
```

**Flow:** Webhook → PII Masking (regex, 0 LLM) → Rule-based Intent Detection → Switch Router
*(WF04 CSKH có node PII Masking riêng từ 17/09 — xem `04-zalo-cskh.json`)*

**Notes:**
- Model: `gemini-3.1-flash-lite` (cho các sub-agents)
- `scenarioType` duoc truyen thang tu Mobile App (Q3), khong can AI detect
- Switch node v3.2 voi `rules.values[]` va `combinator: "and"` theo docs chinh thuc

---

### 02 — HR Q&A Agent

**Input:** Tu Router (intent = `HR_QA`)

**Flow:**
1. Song song: Get Employee Context + Get/Create Session (session kem `messages[]`)
2. Save User Message vao DB (Q10)
3. Build Multi-turn History: system prompt + toan bo lich su (Q1) + tin hien tai
4. Gemini 3.1 Flash Lite tao cau tra loi
5. Save Assistant Message
6. Respond ve webhook

**Notes:**
- Session endpoint tra ve `messages[]` inline (Q7), khong can them HTTP call
- Full history (Q1): toan bo, khong gioi han so luong turn
- `specifyBody: "json"` + `jsonBody` thay vi `bodyParameters` de gui JSON dong

---

### 03 — Training Role-play Agent

**Input:** Tu Router (intent = `TRAINING`)

**6 Scenarios (Q9):**
| scenarioType | Vai dien | Do kho |
|---|---|---|
| `customer_complaint` | KH phan nan dich vu | Cao |
| `colleague_conflict` | Mau thuan dong nghiep | Trung binh |
| `manager_feedback` | Feedback hieu suat | Trung binh |
| `new_employee_onboarding` | Huong dan NV moi | Thap |
| `performance_review` | Danh gia quy | Cao |
| `general_communication` | Dam phan doi tac | Trung binh |

**Flow:**
1. Load Scenario (Q3: dung `scenarioType` tu request body)
2. Song song: Role-play LLM + Scoring LLM (Gemini 3.1 Flash Lite)
3. Merge & Parse Result → Respond

**Scoring JSON format:**
```json
{
  "scores": { "professional": 8, "empathy": 7, "problem_solving": 6, "clarity": 9 },
  "total": 7.5,
  "feedback": "Nhan xet ngan gon..."
}
```

---

### 04 — Zalo OA CSKH Agent (Human-in-the-loop)

**Webhook:** `POST /webhook/zalo-webhook`

**Flow:**
1. Parse Zalo Message
2. Get/Create CSKH Session (kem `messages[]`)
3. Save User Message (Q10)
4. Build CSKH History (Q1: full multi-turn)
5. Gemini 3.1 Flash Lite → Parse Answer
6. **Song song (Q8):**
   - Save Assistant Message
   - Send Zalo Reply
   - Should Escalate? (IF node) → Escalate to Admin

**Escalation keywords (Q2):** neu AI tra loi chua cac cum tu:
`"vuot tham quyen"`, `"chuyen bo phan"`, `"nhan vien ho tro"`, `"khieu nai chinh thuc"`, `"yeu cau gap truong phong"`, v.v.

**Escalation endpoint:** `POST /api/v1/n8n/escalate` → NestJS tao Notification → WebSocket emit den Admin Portal

---

## Thay doi so voi v1

| # | Quyet dinh | Thay doi |
|---|---|---|
| Q1 | Full history | Build multi-turn `contents[]` tu `session.messages[]` |
| Q2 | Keyword escalation | IF node + Escalate to Admin node trong WF04 |
| Q3 | scenarioType tu Mobile | Bo keyword detection, doc `body.scenarioType` truc tiep |
| Q4 | Error handling | `specifyBody: "json"` dung theo docs, Switch v3.2 |
| Q6 | gemini-3.1-flash-lite | Tat ca 4 workflow (500 req/day quota, 15 RPM, on dinh) |
| Q7 | Session kem messages[] | NestJS `createOrGetSession` tra `include: { messages }` |
| Q8 | Parallel reply + escalate | Fan-out tu Parse CSKH Answer |
| Q9 | 6 scenarios | Them `new_employee_onboarding` va `performance_review` |
| Q10 | Save User Message | Node rieng truoc khi goi LLM |

---

> ⚠️ **Bao mat**: Doi `HR_API_KEY` va `N8N_BASIC_AUTH_PASSWORD` truoc khi deploy production.
> 💡 **Local dev**: n8n dung `host.docker.internal:3001` de goi NestJS tren host.
