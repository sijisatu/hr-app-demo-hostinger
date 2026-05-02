param(
  [string]$BaseUrl = "http://127.0.0.1:4100",
  [string]$FrontendUrl = "http://127.0.0.1:3100",
  [int]$Iterations = 5,
  [int]$TimeoutSec = 30,
  [string]$SessionKey = "",
  [string]$Username = "",
  [string]$Password = "",
  [ValidateSet("all", "admin", "hr", "manager", "employee")]
  [string]$Profile = "all",
  [string]$ForwardedProto = "",
  [switch]$Pause
)

$ErrorActionPreference = "Stop"

$publicTargets = @(
  @{ Name = "health"; Path = "/api/health" },
  @{ Name = "health-live"; Path = "/api/health/live" },
  @{ Name = "health-ready"; Path = "/api/health/ready" }
)

$roleTargets = @(
  @{ Name = "auth-session-current"; Path = "/api/auth/session/current"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "dashboard-summary"; Path = "/api/dashboard/summary"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "employees-50"; Path = "/api/employees?page=1&pageSize=50"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-history-20"; Path = "/api/attendance/history?page=1&pageSize=20"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-history-50"; Path = "/api/attendance/history?page=1&pageSize=50"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-history-200"; Path = "/api/attendance/history?page=1&pageSize=200"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-today"; Path = "/api/attendance/today"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-overview"; Path = "/api/attendance/overview"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "attendance-overtime"; Path = "/api/attendance/overtime"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "leave-history-20"; Path = "/api/leave/history?page=1&pageSize=20"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "leave-history-50"; Path = "/api/leave/history?page=1&pageSize=50"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "leave-history-200"; Path = "/api/leave/history?page=1&pageSize=200"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "reimbursement-claims"; Path = "/api/reimbursement/claims"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "reimbursement-requests-50"; Path = "/api/reimbursement/requests?page=1&pageSize=50"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "payroll-overview"; Path = "/api/payroll/overview"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "payroll-components"; Path = "/api/payroll/components"; Roles = @("admin", "hr", "manager") },
  @{ Name = "payroll-runs"; Path = "/api/payroll/runs"; Roles = @("admin", "hr", "manager") },
  @{ Name = "payroll-payslips-50"; Path = "/api/payroll/payslips?page=1&pageSize=50"; Roles = @("admin", "hr", "manager", "employee") },
  @{ Name = "compensation-profiles"; Path = "/api/compensation-profiles"; Roles = @("admin", "hr", "manager") },
  @{ Name = "departments"; Path = "/api/departments"; Roles = @("admin", "hr", "manager") },
  @{ Name = "tax-profiles"; Path = "/api/tax-profiles"; Roles = @("admin", "hr", "manager") },
  @{ Name = "ops-metrics"; Path = "/api/ops/metrics"; Roles = @("admin", "hr") },
  @{ Name = "activity-logs-50"; Path = "/api/ops/audit-logs?page=1&pageSize=50"; Roles = @("admin", "hr") }
)

$demoSessionKeys = @{
  admin    = "global-admin"
  hr       = "elena-hr"
  manager  = "sarah-manager"
  employee = "james-employee"
}

function New-BenchmarkResult {
  param(
    [string]$Role,
    [string]$Endpoint,
    [string]$Url,
    [double[]]$Durations,
    [int[]]$Statuses,
    [int]$ErrorCount
  )

  $sorted = @($Durations | Sort-Object)
  $avg = [math]::Round((($Durations | Measure-Object -Average).Average), 2)
  $min = [math]::Round($sorted[0], 2)
  $max = [math]::Round($sorted[-1], 2)
  $medianIndex = [math]::Floor($sorted.Count / 2)
  $median = if ($sorted.Count % 2 -eq 0) {
    [math]::Round((($sorted[$medianIndex - 1] + $sorted[$medianIndex]) / 2), 2)
  } else {
    [math]::Round($sorted[$medianIndex], 2)
  }

  $p95Index = [math]::Ceiling($sorted.Count * 0.95) - 1
  if ($p95Index -lt 0) { $p95Index = 0 }
  if ($p95Index -ge $sorted.Count) { $p95Index = $sorted.Count - 1 }
  $p95 = [math]::Round($sorted[$p95Index], 2)

  [PSCustomObject]@{
    Role        = $Role
    Endpoint    = $Endpoint
    AvgMs       = $avg
    MedianMs    = $median
    P95Ms       = $p95
    MinMs       = $min
    MaxMs       = $max
    Errors      = $ErrorCount
    Statuses    = (($Statuses | Group-Object | Sort-Object Name | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ", ")
    SampleCount = $Durations.Count
    Url         = $Url
  }
}

function Invoke-BenchmarkRequest {
  param(
    [string]$Url,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $requestParams = @{
    Uri             = $Url
    Method          = "GET"
    TimeoutSec      = $Timeout
    UseBasicParsing = $true
  }
  $headers = @{}
  if ($ForwardedProto) {
    $headers["X-Forwarded-Proto"] = $ForwardedProto
  }
  if ($Session) {
    $requestParams.WebSession = $Session
    $headers["X-Session-Benchmark"] = "true"
  }
  if ($headers.Count -gt 0) {
    $requestParams.Headers = $headers
  }
  Invoke-WebRequest @requestParams
}

function Measure-Endpoint {
  param(
    [string]$Role,
    [string]$Name,
    [string]$Url,
    [int]$Repeat,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $durations = @()
  $statuses = @()
  $errorCount = 0

  for ($i = 1; $i -le $Repeat; $i++) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $response = Invoke-BenchmarkRequest -Url $Url -Timeout $Timeout -Session $Session
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      $statuses += [int]$response.StatusCode
    } catch {
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statuses += [int]$_.Exception.Response.StatusCode
      } else {
        $statuses += 0
      }
      $errorCount += 1
    }
  }

  New-BenchmarkResult -Role $Role -Endpoint $Name -Url $Url -Durations $durations -Statuses $statuses -ErrorCount $errorCount
}

function Measure-PostEndpoint {
  param(
    [string]$Role,
    [string]$Name,
    [string]$Url,
    [object]$Payload,
    [int]$Repeat,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $durations = @()
  $statuses = @()
  $errorCount = 0
  $jsonPayload = $Payload | ConvertTo-Json -Depth 8

  for ($i = 1; $i -le $Repeat; $i++) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $requestParams = @{
        Uri             = $Url
        Method          = "POST"
        TimeoutSec      = $Timeout
        UseBasicParsing = $true
        ContentType     = "application/json"
        Body            = $jsonPayload
      }
      $headers = @{}
      if ($ForwardedProto) {
        $headers["X-Forwarded-Proto"] = $ForwardedProto
      }
      if ($Session) {
        $requestParams.WebSession = $Session
        $headers["X-Session-Benchmark"] = "true"
      }
      if ($headers.Count -gt 0) {
        $requestParams.Headers = $headers
      }

      $response = Invoke-WebRequest @requestParams
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      $statuses += [int]$response.StatusCode
    } catch {
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
        $statuses += [int]$_.Exception.Response.StatusCode
      } else {
        $statuses += 0
      }
      $errorCount += 1
    }
  }

  New-BenchmarkResult -Role $Role -Endpoint $Name -Url $Url -Durations $durations -Statuses $statuses -ErrorCount $errorCount
}

function Invoke-JsonGet {
  param(
    [string]$Url,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $response = Invoke-BenchmarkRequest -Url $Url -Timeout $Timeout -Session $Session
  if (-not $response.Content) {
    return $null
  }
  return $response.Content | ConvertFrom-Json
}

function New-AuthenticatedSession {
  param(
    [string]$AppUrl,
    [string]$DemoSessionKey,
    [string]$LoginUsername,
    [string]$LoginPassword,
    [int]$Timeout
  )

  $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
  $loginUrl = "$AppUrl/api/auth/login"

  if ($DemoSessionKey) {
    $payload = @{ sessionKey = $DemoSessionKey } | ConvertTo-Json
  } elseif ($LoginUsername -and $LoginPassword) {
    $payload = @{
      username = $LoginUsername
      password = $LoginPassword
    } | ConvertTo-Json
  } else {
    return $null
  }

  $response = Invoke-WebRequest -Uri $loginUrl -Method POST -WebSession $session -TimeoutSec $Timeout -UseBasicParsing -ContentType "application/json" -Body $payload
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) {
    throw "Login failed with status $([int]$response.StatusCode)."
  }

  return $session
}

function Resolve-SessionActor {
  param(
    [string]$ApiBase,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $json = Invoke-JsonGet -Url "$ApiBase/api/auth/session/current" -Timeout $Timeout -Session $Session
  return $json.data
}

function Get-DynamicTargets {
  param(
    [string]$Role,
    [string]$ApiBase,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session,
    $Actor
  )

  $targets = @()

  if (-not $Actor -or -not $Actor.id) {
    return $targets
  }

  try {
    $documentsResponse = Invoke-JsonGet -Url "$ApiBase/api/employees/$($Actor.id)/documents" -Timeout $Timeout -Session $Session
    $targets += @{ Name = "employee-documents-self"; Path = "/api/employees/$($Actor.id)/documents" }
    $documents = @($documentsResponse.data)
    if ($documents.Count -gt 0 -and $documents[0].id) {
      $targets += @{ Name = "employee-document-asset"; Path = "/api/assets/employees/$($Actor.id)/documents/$($documents[0].id)" }
    }
  } catch {
  }

  try {
    $attendanceResponse = Invoke-JsonGet -Url "$ApiBase/api/attendance/history?page=1&pageSize=20" -Timeout $Timeout -Session $Session
    $attendanceItems = if ($attendanceResponse.data.items) { @($attendanceResponse.data.items) } else { @($attendanceResponse.data) }
    $attendanceWithPhoto = $attendanceItems | Where-Object { $_.photoUrl } | Select-Object -First 1
    if ($attendanceWithPhoto -and $attendanceWithPhoto.id) {
      $targets += @{ Name = "attendance-selfie-asset"; Path = "/api/assets/attendance/$($attendanceWithPhoto.id)/selfie" }
    }
  } catch {
  }

  try {
    $leaveResponse = Invoke-JsonGet -Url "$ApiBase/api/leave/history?page=1&pageSize=20" -Timeout $Timeout -Session $Session
    $leaveItems = if ($leaveResponse.data.items) { @($leaveResponse.data.items) } else { @($leaveResponse.data) }
    $leaveWithDoc = $leaveItems | Where-Object { $_.supportingDocumentUrl } | Select-Object -First 1
    if ($leaveWithDoc -and $leaveWithDoc.id) {
      $targets += @{ Name = "leave-supporting-document-asset"; Path = "/api/assets/leave/$($leaveWithDoc.id)/supporting-document" }
    }
  } catch {
  }

  try {
    $reimbursementResponse = Invoke-JsonGet -Url "$ApiBase/api/reimbursement/requests?page=1&pageSize=20" -Timeout $Timeout -Session $Session
    $reimbursementItems = if ($reimbursementResponse.data.items) { @($reimbursementResponse.data.items) } else { @($reimbursementResponse.data) }
    $reimbursementWithReceipt = $reimbursementItems | Where-Object { $_.receiptFileUrl } | Select-Object -First 1
    if ($reimbursementWithReceipt -and $reimbursementWithReceipt.id) {
      $targets += @{ Name = "reimbursement-receipt-asset"; Path = "/api/assets/reimbursements/$($reimbursementWithReceipt.id)/receipt" }
    }
  } catch {
  }

  return $targets
}

function Get-DynamicPostTargets {
  param(
    [string]$Role,
    [string]$ApiBase,
    [int]$Timeout,
    [Microsoft.PowerShell.Commands.WebRequestSession]$Session
  )

  $targets = @()

  if (@("admin", "hr", "manager") -contains $Role) {
    $targets += [PSCustomObject]@{
      Name    = "reports-export-start"
      Path    = "/api/reports/export"
      Payload = @{
        reportName    = "Benchmark Report"
        fileExtension = "txt"
        content       = "Benchmark export smoke test"
      }
    }
  }

  try {
    $payslipResponse = Invoke-JsonGet -Url "$ApiBase/api/payroll/payslips?page=1&pageSize=1" -Timeout $Timeout -Session $Session
    $payslipItems = if ($payslipResponse.data.items) { @($payslipResponse.data.items) } else { @($payslipResponse.data) }
    $firstPayslip = $payslipItems | Select-Object -First 1
    if ($firstPayslip -and $firstPayslip.id) {
      $targets += [PSCustomObject]@{
        Name    = "payroll-payslip-export-start"
        Path    = "/api/payroll/payslips/export"
        Payload = @{
          payslipId = $firstPayslip.id
        }
      }
    }
  } catch {
  }

  return $targets
}

function Get-RoleTargets {
  param(
    [string]$Role
  )

  return $roleTargets | Where-Object { $_.Roles -contains $Role }
}

function New-RoleRunConfig {
  param(
    [string]$RoleName,
    [string]$DemoKey,
    [string]$AppUrl,
    [string]$ApiBase,
    [int]$Timeout
  )

  $session = New-AuthenticatedSession -AppUrl $AppUrl -DemoSessionKey $DemoKey -LoginUsername "" -LoginPassword "" -Timeout $Timeout
  $actor = Resolve-SessionActor -ApiBase $ApiBase -Timeout $Timeout -Session $session

  [PSCustomObject]@{
    Role    = $RoleName
    Session = $session
    Actor   = $actor
  }
}

Write-Host ""
Write-Host "Benchmark backend URL : $BaseUrl"
Write-Host "Frontend auth URL     : $FrontendUrl"
Write-Host "Iterations            : $Iterations"
Write-Host "Timeout               : $TimeoutSec sec"
Write-Host "Profile               : $Profile"

$results = @()
$skipped = @()

foreach ($target in $publicTargets) {
  $url = "$BaseUrl$($target.Path)"
  Write-Host ("Testing public/{0} ..." -f $target.Name)
  $results += Measure-Endpoint -Role "public" -Name $target.Name -Url $url -Repeat $Iterations -Timeout $TimeoutSec -Session $null
}

$roleRuns = @()
if ($SessionKey) {
  $authSession = New-AuthenticatedSession -AppUrl $FrontendUrl -DemoSessionKey $SessionKey -LoginUsername "" -LoginPassword "" -Timeout $TimeoutSec
  $actor = Resolve-SessionActor -ApiBase $BaseUrl -Timeout $TimeoutSec -Session $authSession
  $roleRuns += [PSCustomObject]@{
    Role    = $actor.role
    Session = $authSession
    Actor   = $actor
  }
  Write-Host "Auth mode             : demo-sessionKey ($SessionKey -> $($actor.role))"
} elseif ($Username -and $Password) {
  $authSession = New-AuthenticatedSession -AppUrl $FrontendUrl -DemoSessionKey "" -LoginUsername $Username -LoginPassword $Password -Timeout $TimeoutSec
  $actor = Resolve-SessionActor -ApiBase $BaseUrl -Timeout $TimeoutSec -Session $authSession
  $roleRuns += [PSCustomObject]@{
    Role    = $actor.role
    Session = $authSession
    Actor   = $actor
  }
  Write-Host "Auth mode             : username-password ($Username -> $($actor.role))"
} else {
  $rolesToRun = switch ($Profile) {
    "admin"    { @("admin") }
    "hr"       { @("hr") }
    "manager"  { @("manager") }
    "employee" { @("employee") }
    default    { @("admin", "hr", "manager", "employee") }
  }

  Write-Host ("Auth mode             : demo-roles ({0})" -f (($rolesToRun -join ", ")))
  foreach ($roleName in $rolesToRun) {
    $roleRuns += New-RoleRunConfig -RoleName $roleName -DemoKey $demoSessionKeys[$roleName] -AppUrl $FrontendUrl -ApiBase $BaseUrl -Timeout $TimeoutSec
  }
}

Write-Host ""

foreach ($roleRun in $roleRuns) {
  Write-Host ("Role session ready    : {0} ({1})" -f $roleRun.Role, $roleRun.Actor.name)
  $targets = @()
  $targets += Get-RoleTargets -Role $roleRun.Role
  $targets += Get-DynamicTargets -Role $roleRun.Role -ApiBase $BaseUrl -Timeout $TimeoutSec -Session $roleRun.Session -Actor $roleRun.Actor

  foreach ($target in $targets) {
    $url = "$BaseUrl$($target.Path)"
    Write-Host ("Testing {0}/{1} ..." -f $roleRun.Role, $target.Name)
    try {
      $results += Measure-Endpoint -Role $roleRun.Role -Name $target.Name -Url $url -Repeat $Iterations -Timeout $TimeoutSec -Session $roleRun.Session
    } catch {
      $skipped += [PSCustomObject]@{
        Role     = $roleRun.Role
        Endpoint = $target.Name
        Url      = $url
        Reason   = $_.Exception.Message
      }
    }
  }

  $postTargets = Get-DynamicPostTargets -Role $roleRun.Role -ApiBase $BaseUrl -Timeout $TimeoutSec -Session $roleRun.Session
  foreach ($target in $postTargets) {
    $url = "$BaseUrl$($target.Path)"
    Write-Host ("Testing {0}/{1} ..." -f $roleRun.Role, $target.Name)
    try {
      $results += Measure-PostEndpoint -Role $roleRun.Role -Name $target.Name -Url $url -Payload $target.Payload -Repeat $Iterations -Timeout $TimeoutSec -Session $roleRun.Session
    } catch {
      $skipped += [PSCustomObject]@{
        Role     = $roleRun.Role
        Endpoint = $target.Name
        Url      = $url
        Reason   = $_.Exception.Message
      }
    }
  }
}

Write-Host ""
Write-Host "Ranking by average latency"
Write-Host "--------------------------"
$results |
  Sort-Object AvgMs -Descending |
  Format-Table Role, Endpoint, AvgMs, MedianMs, P95Ms, MinMs, MaxMs, Errors, Statuses -AutoSize

Write-Host ""
Write-Host "Slowest per role"
Write-Host "---------------"
$results |
  Group-Object Role |
  ForEach-Object {
    $_.Group | Sort-Object AvgMs -Descending | Select-Object -First 5
  } |
  Format-Table Role, Endpoint, AvgMs, MedianMs, P95Ms, Statuses -AutoSize

Write-Host ""
Write-Host "Detailed URLs"
Write-Host "-------------"
$results |
  Sort-Object Role, Endpoint |
  Format-Table Role, Endpoint, Url -AutoSize

if ($skipped.Count -gt 0) {
  Write-Host ""
  Write-Host "Skipped endpoints"
  Write-Host "-----------------"
  $skipped | Format-Table Role, Endpoint, Reason -AutoSize
}

if ($Pause) {
  Write-Host ""
  Read-Host "Benchmark selesai. Tekan Enter untuk tutup"
}
