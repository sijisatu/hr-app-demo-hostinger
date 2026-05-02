param(
  [string]$BaseUrl = "http://127.0.0.1:4100",
  [string]$FrontendUrl = "http://127.0.0.1:3100",
  [int]$Iterations = 3,
  [int]$TimeoutSec = 30,
  [string]$SessionKey = "global-admin",
  [string]$Username = "",
  [string]$Password = "",
  [string]$ForwardedProto = "",
  [switch]$Pause
)

$ErrorActionPreference = "Stop"

function Get-ResponseHeaderValue {
  param(
    $Response,
    [string]$Name
  )

  if (-not $Response -or -not $Response.Headers) {
    return $null
  }

  try {
    return $Response.Headers[$Name]
  } catch {
    return $null
  }
}

function Join-SetCookieHeader {
  param(
    $SetCookieHeader
  )

  if (-not $SetCookieHeader) {
    return ""
  }

  $headerValue = if ($SetCookieHeader -is [System.Array]) {
    $SetCookieHeader -join ","
  } else {
    [string]$SetCookieHeader
  }

  return (@(
    $headerValue `
      -split ",(?=[^;]+?=)" `
      | ForEach-Object { ($_ -split ";")[0].Trim() } `
      | Where-Object { $_ }
  ) -join "; ")
}

function Get-CookieValue {
  param(
    [string]$CookieHeader,
    [string]$Name
  )

  if (-not $CookieHeader) {
    return $null
  }

  foreach ($entry in ($CookieHeader -split ";")) {
    $trimmed = $entry.Trim()
    if ($trimmed.StartsWith("$Name=")) {
      return $trimmed.Substring($Name.Length + 1)
    }
  }

  return $null
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
    throw "Either -SessionKey or -Username/-Password must be provided."
  }

  $headers = @{}
  if ($ForwardedProto) {
    $headers["X-Forwarded-Proto"] = $ForwardedProto
  }

  $requestParams = @{
    Uri             = $loginUrl
    Method          = "POST"
    WebSession      = $session
    TimeoutSec      = $Timeout
    UseBasicParsing = $true
    ContentType     = "application/json"
    Body            = $payload
  }
  if ($headers.Count -gt 0) {
    $requestParams.Headers = $headers
  }

  $response = Invoke-WebRequest @requestParams
  if ([int]$response.StatusCode -lt 200 -or [int]$response.StatusCode -ge 300) {
    throw "Login failed with status $([int]$response.StatusCode)."
  }

  $cookieHeader = Join-SetCookieHeader -SetCookieHeader (Get-ResponseHeaderValue -Response $response -Name "Set-Cookie")
  if (-not $cookieHeader) {
    throw "Login succeeded but auth cookies were not returned."
  }

  $sessionToken = Get-CookieValue -CookieHeader $cookieHeader -Name "pp_session"
  if (-not $sessionToken) {
    throw "Login succeeded but pp_session cookie was not returned."
  }

  [PSCustomObject]@{
    WebSession   = $session
    CookieHeader = $cookieHeader
    SessionToken = $sessionToken
  }
}

function Invoke-ApiJson {
  param(
    [string]$Method,
    [string]$Url,
    [object]$Payload,
    [int]$Timeout,
    $SessionContext
  )

  $headers = @{ "X-Session-Benchmark" = "true" }
  if ($ForwardedProto) {
    $headers["X-Forwarded-Proto"] = $ForwardedProto
  }
  if ($SessionContext.CookieHeader) {
    $headers["Cookie"] = $SessionContext.CookieHeader
  }
  if ($SessionContext.SessionToken) {
    $headers["X-Session-Token"] = $SessionContext.SessionToken
  }

  $params = @{
    Uri             = $Url
    Method          = $Method
    TimeoutSec      = $Timeout
    UseBasicParsing = $true
    Headers         = $headers
  }
  if ($SessionContext.WebSession) {
    $params.WebSession = $SessionContext.WebSession
  }

  if ($null -ne $Payload) {
    $params.ContentType = "application/json"
    $params.Body = ($Payload | ConvertTo-Json -Depth 8)
  }

  $response = Invoke-WebRequest @params
  $body = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }

  [PSCustomObject]@{
    StatusCode = [int]$response.StatusCode
    Body       = $body
  }
}

function Invoke-ApiDelete {
  param(
    [string]$Url,
    [int]$Timeout,
    $SessionContext
  )

  $headers = @{ "X-Session-Benchmark" = "true" }
  if ($ForwardedProto) {
    $headers["X-Forwarded-Proto"] = $ForwardedProto
  }
  if ($SessionContext.CookieHeader) {
    $headers["Cookie"] = $SessionContext.CookieHeader
  }
  if ($SessionContext.SessionToken) {
    $headers["X-Session-Token"] = $SessionContext.SessionToken
  }

  $params = @{
    Uri             = $Url
    Method          = "DELETE"
    TimeoutSec      = $Timeout
    UseBasicParsing = $true
    Headers         = $headers
  }
  if ($SessionContext.WebSession) {
    $params.WebSession = $SessionContext.WebSession
  }

  $response = Invoke-WebRequest @params
  $body = if ($response.Content) { $response.Content | ConvertFrom-Json } else { $null }

  [PSCustomObject]@{
    StatusCode = [int]$response.StatusCode
    Body       = $body
  }
}

function Measure-WriteOperation {
  param(
    [string]$Name,
    [scriptblock]$Action,
    [int]$Repeat
  )

  $durations = @()
  $statuses = @()
  $errors = 0

  for ($i = 1; $i -le $Repeat; $i++) {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
      $result = & $Action $i
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      $statuses += [int]$result
    } catch {
      $stopwatch.Stop()
      $durations += [math]::Round($stopwatch.Elapsed.TotalMilliseconds, 2)
      $statuses += 0
      $errors += 1
      Write-Warning "$Name iteration $i failed: $($_.Exception.Message)"
    }
  }

  $sorted = @($durations | Sort-Object)
  $avg = [math]::Round((($durations | Measure-Object -Average).Average), 2)
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
    Operation   = $Name
    AvgMs       = $avg
    MedianMs    = $median
    P95Ms       = $p95
    MinMs       = $min
    MaxMs       = $max
    Errors      = $errors
    Statuses    = (($statuses | Group-Object | Sort-Object Name | ForEach-Object { "$($_.Name)x$($_.Count)" }) -join ", ")
    SampleCount = $durations.Count
  }
}

Write-Host ""
Write-Host "Write benchmark backend URL : $BaseUrl"
Write-Host "Frontend auth URL           : $FrontendUrl"
Write-Host "Iterations                  : $Iterations"
Write-Host "Timeout                     : $TimeoutSec sec"
Write-Host "Session key                 : $SessionKey"
Write-Host ""

$session = New-AuthenticatedSession -AppUrl $FrontendUrl -DemoSessionKey $SessionKey -LoginUsername $Username -LoginPassword $Password -Timeout $TimeoutSec

$departmentsResponse = Invoke-ApiJson -Method GET -Url "$BaseUrl/api/departments" -Payload $null -Timeout $TimeoutSec -Session $session
$employeesResponse = Invoke-ApiJson -Method GET -Url "$BaseUrl/api/employees?page=1&pageSize=20" -Payload $null -Timeout $TimeoutSec -Session $session
$employees = if ($employeesResponse.Body.data.items) { @($employeesResponse.Body.data.items) } else { @($employeesResponse.Body.data) }
$referenceEmployee = $employees | Select-Object -First 1
$referenceManager = $employees | Where-Object { $_.role -eq "manager" -and $_.status -eq "active" } | Select-Object -First 1
$referenceDepartment = @($departmentsResponse.Body.data | Select-Object -ExpandProperty name -ErrorAction SilentlyContinue)[0]
if (-not $referenceDepartment) {
  $referenceDepartment = "General Operations"
}
if (-not $referenceEmployee) {
  throw "No employee data found for reimbursement/employee write benchmarks."
}
if ($referenceManager) {
  $referenceDepartment = $referenceManager.department
}

$timestampSeed = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()

$results = @()

$results += Measure-WriteOperation -Name "department-create-update-delete" -Repeat $Iterations -Action {
  param($iteration)
  $seed = "$timestampSeed-dept-$iteration"
  $createPayload = @{
    name   = "Benchmark Department $seed"
    active = $true
  }
  $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/departments" -Payload $createPayload -Timeout $TimeoutSec -Session $session
  $id = $create.Body.data.id
  $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/departments/$id" -Payload @{ name = "Benchmark Department Updated $seed"; active = $false } -Timeout $TimeoutSec -Session $session
  $delete = Invoke-ApiDelete -Url "$BaseUrl/api/departments/$id" -Timeout $TimeoutSec -Session $session
  [int]$delete.StatusCode
}

$results += Measure-WriteOperation -Name "compensation-profile-create-update-delete" -Repeat $Iterations -Action {
  param($iteration)
  $seed = "$timestampSeed-comp-$iteration"
  $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/compensation-profiles" -Payload @{
    position   = "Benchmark Position $seed"
    baseSalary = 12345678
    active     = $true
    notes      = "Benchmark compensation profile"
  } -Timeout $TimeoutSec -Session $session
  $id = $create.Body.data.id
  $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/compensation-profiles/$id" -Payload @{
    notes      = "Benchmark compensation profile updated"
    baseSalary = 13345678
    active     = $false
  } -Timeout $TimeoutSec -Session $session
  $delete = Invoke-ApiDelete -Url "$BaseUrl/api/compensation-profiles/$id" -Timeout $TimeoutSec -Session $session
  [int]$delete.StatusCode
}

$results += Measure-WriteOperation -Name "tax-profile-create-update-delete" -Repeat $Iterations -Action {
  param($iteration)
  $seed = "$timestampSeed-tax-$iteration"
  $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/tax-profiles" -Payload @{
    name        = "Benchmark Tax $seed"
    rate        = 5.5
    active      = $true
    description = "Benchmark tax profile"
  } -Timeout $TimeoutSec -Session $session
  $id = $create.Body.data.id
  $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/tax-profiles/$id" -Payload @{
    rate        = 6.25
    active      = $false
    description = "Benchmark tax profile updated"
  } -Timeout $TimeoutSec -Session $session
  $delete = Invoke-ApiDelete -Url "$BaseUrl/api/tax-profiles/$id" -Timeout $TimeoutSec -Session $session
  [int]$delete.StatusCode
}

$results += Measure-WriteOperation -Name "payroll-component-create-update-delete" -Repeat $Iterations -Action {
  param($iteration)
  $seed = "$timestampSeed-paycomp-$iteration"
  $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/payroll/components" -Payload @{
    code            = "BMK$iteration$([int](Get-Random -Minimum 100 -Maximum 999))"
    name            = "Benchmark Payroll Component $seed"
    type            = "earning"
    calculationType = "fixed"
    amount          = 100000
    taxable         = $true
    active          = $true
    appliesToAll    = $false
    employeeIds     = @($referenceEmployee.id)
    description     = "Benchmark payroll component"
  } -Timeout $TimeoutSec -Session $session
  $id = $create.Body.data.id
  $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/payroll/components/$id" -Payload @{
    amount      = 150000
    active      = $false
    description = "Benchmark payroll component updated"
  } -Timeout $TimeoutSec -Session $session
  $delete = Invoke-ApiDelete -Url "$BaseUrl/api/payroll/components/$id" -Timeout $TimeoutSec -Session $session
  [int]$delete.StatusCode
}

$results += Measure-WriteOperation -Name "reimbursement-claim-type-create-update-delete" -Repeat $Iterations -Action {
  param($iteration)
  $seed = "$timestampSeed-claim-$iteration"
  $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/reimbursement/claims" -Payload @{
    employeeId       = $referenceEmployee.id
    employeeName     = $referenceEmployee.name
    department       = $referenceEmployee.department
    designation      = $referenceEmployee.position
    category         = "medical"
    claimType        = "Benchmark Medical"
    subType          = "Benchmark $seed"
    currency         = "IDR"
    annualLimit      = 500000
    remainingBalance = 500000
    active           = $true
    notes            = "Benchmark reimbursement claim type"
  } -Timeout $TimeoutSec -Session $session
  $id = $create.Body.data.id
  $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/reimbursement/claims/$id" -Payload @{
    remainingBalance = 450000
    active           = $false
    notes            = "Benchmark reimbursement claim type updated"
  } -Timeout $TimeoutSec -Session $session
  $delete = Invoke-ApiDelete -Url "$BaseUrl/api/reimbursement/claims/$id" -Timeout $TimeoutSec -Session $session
  [int]$delete.StatusCode
}

if ($referenceManager) {
  $results += Measure-WriteOperation -Name "employee-create-update-delete" -Repeat $Iterations -Action {
    param($iteration)
    $seed = "$timestampSeed-emp-$iteration"
    $nik = "BMK-$seed"
    $create = Invoke-ApiJson -Method POST -Url "$BaseUrl/api/employees" -Payload @{
      nik                   = $nik
      name                  = "Benchmark Employee $seed"
      email                 = "benchmark.$seed@example.com"
      birthPlace            = "Jakarta"
      birthDate             = "1995-01-01"
      gender                = "male"
      maritalStatus         = "single"
      address               = "Benchmark Address"
      idCardNumber          = "3171$([string](Get-Random -Minimum 100000000000 -Maximum 999999999999))"
      education             = "S1 Informatika"
      workExperience        = "Benchmark Experience"
      educationHistory      = @()
      workExperiences       = @()
      department            = $referenceDepartment
      position              = "Benchmark Staff"
      role                  = "employee"
      status                = "active"
      phone                 = "081234567890"
      workLocation          = "Jakarta HQ"
      workType              = "onsite"
      managerName           = $referenceManager.name
      employmentType        = "contract"
      contractStatus        = "contract"
      contractStart         = "2026-01-01"
      contractEnd           = "2026-12-31"
      baseSalary            = 7000000
      allowance             = 500000
      financialComponentIds = @()
      taxProfile            = "Benchmark Tax"
      bankName              = "BCA"
      bankAccountMasked     = "***1234"
      appLoginEnabled       = $false
    } -Timeout $TimeoutSec -Session $session
    $id = $create.Body.data.id
    $update = Invoke-ApiJson -Method PATCH -Url "$BaseUrl/api/employees/$id" -Payload @{
      phone   = "089999999999"
      address = "Benchmark Address Updated"
      status  = "inactive"
    } -Timeout $TimeoutSec -Session $session
    $delete = Invoke-ApiDelete -Url "$BaseUrl/api/employees/$id" -Timeout $TimeoutSec -Session $session
    [int]$delete.StatusCode
  }
} else {
  Write-Warning "Skipping employee-create-update-delete because no active manager record was found in current dataset."
}

Write-Host ""
Write-Host "Ranking by average latency"
Write-Host "--------------------------"
$results |
  Sort-Object AvgMs -Descending |
  Format-Table Operation, AvgMs, MedianMs, P95Ms, MinMs, MaxMs, Errors, Statuses -AutoSize

if ($Pause) {
  Write-Host ""
  Read-Host "Write benchmark selesai. Tekan Enter untuk tutup"
}
