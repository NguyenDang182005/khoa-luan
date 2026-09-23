# [diag-loop] Feedback loop: "Sua ho so" bug (PATCH /employees/:id)
# RED   = PATCH fails (HTTP != 200) or data not persisted
# GREEN = PATCH 200 + re-read matches
param(
  [string]$BaseUrl = "http://127.0.0.1:3001/api/v1",
  [string]$Email = "hr-admin@company.com",
  [string]$Password = "Admin@123",
  [string]$EmpCode = "EMP003",
  [string]$Phone = "",
  [string]$Address = "",
  [string]$DateOfBirth = "",
  [string]$NationalId = ""
)
$ErrorActionPreference = "Stop"

$tok = (Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{email=$Email;password=$Password} | ConvertTo-Json)).accessToken
$H = @{ Authorization = "Bearer $tok" }

$list = (Invoke-RestMethod -Uri "$BaseUrl/employees?limit=100" -Headers $H).data
$emp = ($list | Where-Object { $_.employeeCode -eq $EmpCode } | Select-Object -First 1)
if (-not $emp) { Write-Host "RED: employee $EmpCode not found"; exit 1 }
$before = Invoke-RestMethod -Uri "$BaseUrl/employees/$($emp.id)" -Headers $H

# Defaults: reuse current values (same as UI handleSaveEdit does)
if (-not $Phone)       { $Phone = [string]$emp.phone }
if (-not $Address)     { $Address = [string]$emp.address }
if (-not $DateOfBirth) { $DateOfBirth = if ($before.dateOfBirth) { ([string]$before.dateOfBirth).Substring(0,10) } else { "1995-05-10" } }
if (-not $NationalId)  { $NationalId = [string]$emp.nationalId }

$payloadObj = @{
  phone       = $Phone
  address     = $Address
  dateOfBirth = $DateOfBirth
  nationalId  = $NationalId
}
$payload = $payloadObj | ConvertTo-Json

Write-Host "==> PATCH /employees/$($emp.id)"
Write-Host "body: $payload"
try {
  $r = Invoke-WebRequest -Uri "$BaseUrl/employees/$($emp.id)" -Method PATCH -Headers $H -ContentType "application/json" -Body $payload -UseBasicParsing
  Write-Host "HTTP $($r.StatusCode): $($r.Content.Substring(0, [Math]::Min(400, $r.Content.Length)))"
} catch {
  $code = 0
  try { $code = $_.Exception.Response.StatusCode.value__ } catch {}
  $bodyText = ""
  try {
    $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
    $bodyText = $reader.ReadToEnd()
  } catch { $bodyText = $_.Exception.Message }
  Write-Host "RED: HTTP $code body=$bodyText"
  exit 1
}

$after = Invoke-RestMethod -Uri "$BaseUrl/employees/$($emp.id)" -Headers $H
$phoneOk  = ($after.phone -eq $Phone)
$nationOk = ($after.nationalId -eq $NationalId)
$dobOk    = ($after.dateOfBirth -ne $null)
Write-Host "re-read: phoneMatch=$phoneOk nationalIdMatch=$nationOk dobPresent=$dobOk"
if ($phoneOk -and $nationOk) { Write-Host "GREEN"; exit 0 } else { Write-Host "RED: data mismatch after PATCH"; exit 1 }
