# [diag-loop] Department filter: GET /employees?departmentId=xxx
# RED   = filtered result identical to unfiltered (backend swallows the param)
# GREEN = smaller result + every row belongs to the filtered department
param(
  [string]$BaseUrl = "http://127.0.0.1:3001/api/v1",
  [string]$Email = "hr-admin@company.com",
  [string]$Password = "Admin@123"
)
$ErrorActionPreference = "Stop"
$tok = (Invoke-RestMethod -Uri "$BaseUrl/auth/login" -Method POST -ContentType "application/json" -Body (@{email=$Email;password=$Password} | ConvertTo-Json)).accessToken
$H = @{ Authorization = "Bearer $tok" }

$all = (Invoke-RestMethod -Uri "$BaseUrl/employees?limit=1" -Headers $H)
$totalAll = $all.meta.total
Write-Host "Total employees: $totalAll"

$page = (Invoke-RestMethod -Uri "$BaseUrl/employees?limit=50" -Headers $H).data
$dept = $page | Group-Object { $_.department.name } | Sort-Object Count -Descending | Select-Object -First 1
$deptId = ($page | Where-Object { $_.department.name -eq $dept.Name } | Select-Object -First 1).department.id
Write-Host "Testing department: $($dept.Name) (id=$deptId)"

$filtered = Invoke-RestMethod -Uri "$BaseUrl/employees?limit=100&departmentId=$deptId" -Headers $H
$totalFiltered = $filtered.meta.total
$wrongDept = ($filtered.data | Where-Object { $_.department.id -ne $deptId }).Count
Write-Host "Filtered result: total=$totalFiltered wrongDeptRows=$wrongDept"

if ($totalFiltered -eq $totalAll) {
  Write-Host "RED: backend swallowed departmentId - result identical to unfiltered ($totalFiltered of $totalAll)"
  exit 1
}
if ($wrongDept -gt 0) {
  Write-Host "RED: $wrongDept rows do not belong to the filtered department"
  exit 1
}
Write-Host "GREEN: filter works: $totalAll before -> $totalFiltered after"
exit 0
