#!/usr/bin/env pwsh
# run-all.ps1 — Chạy toàn bộ hệ thống từ đầu
# Usage: .\run-all.ps1

Write-Host "🚀 HR Multi-Agent System — Startup Script" -ForegroundColor Cyan
Write-Host ("=" * 50)

# =====================
# STEP 1: Khởi động Docker services
# =====================
Write-Host "`n📦 Step 1: Khởi động Docker (PostgreSQL + n8n)..." -ForegroundColor Yellow
docker-compose up -d postgres n8n
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Lỗi khởi động Docker. Đảm bảo Docker Desktop đang chạy." -ForegroundColor Red
    exit 1
}

Write-Host "⏳ Chờ PostgreSQL sẵn sàng (15s)..."
Start-Sleep -Seconds 15

# =====================
# STEP 2: Prisma Migrate + Seed
# =====================
Write-Host "`n🗄️  Step 2: Migrate database + Seed data..." -ForegroundColor Yellow
$env:DATABASE_URL = "postgresql://postgres:postgres123@127.0.0.1:5432/hr_system_db"

npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migrate thất bại" -ForegroundColor Red
    exit 1
}

npx tsx packages/database/prisma/seed.ts
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seed thất bại" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Database ready!" -ForegroundColor Green

# =====================
# STEP 3: Khởi động NestJS API
# =====================
Write-Host "`n🖥️  Step 3: Khởi động NestJS API (background)..." -ForegroundColor Yellow
Start-Process -NoNewWindow -FilePath "pnpm" -ArgumentList "dev --filter=api" -PassThru | Out-Null
Write-Host "⏳ Chờ NestJS khởi động (10s)..."
Start-Sleep -Seconds 10
Write-Host "✅ NestJS đang chạy tại http://localhost:3001" -ForegroundColor Green

# =====================
# STEP 4: Setup n8n (credentials + import + publish workflows)
# =====================
Write-Host "`n🤖 Step 4: Cấu hình n8n (credentials + publish workflows)..." -ForegroundColor Yellow
Write-Host "⏳ Chờ n8n sẵn sàng (10s)..."
Start-Sleep -Seconds 10

node scripts/setup-n8n.mjs
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Setup n8n thất bại — kiểm tra logs ở trên" -ForegroundColor Red
    exit 1
}

# =====================
# DONE
# =====================
Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
Write-Host "🎉 Hệ thống đã sẵn sàng!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 URLs:"
Write-Host "  • NestJS API:  http://localhost:3001/api"
Write-Host "  • n8n UI:      http://localhost:5678  (admin / n8n-secret-2024)"
Write-Host "  • pgAdmin:     http://localhost:5050  (admin@hr-system.com / admin123)"
Write-Host ""
Write-Host "🧪 Test HR Agent:"
Write-Host "  curl -X POST http://localhost:5678/webhook/chat ``"
Write-Host "    -H 'Content-Type: application/json' ``"
Write-Host "    -d '{""message"":""Luong thang 8 cua toi la bao nhieu?"",""channel"":""web"",""employeeId"":""EMP003""}'"
Write-Host ""
Write-Host "🧪 Test Training Agent:"
Write-Host "  curl -X POST http://localhost:5678/webhook/chat ``"
Write-Host "    -H 'Content-Type: application/json' ``"
Write-Host "    -d '{""message"":""Bat dau kich ban"",""channel"":""web"",""employeeId"":""EMP004"",""scenarioType"":""customer_complaint""}'"
