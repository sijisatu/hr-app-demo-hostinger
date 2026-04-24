param(
  [string]$DatabaseUrl = $env:DATABASE_URL,
  [string]$OutputDir = (Join-Path (Get-Location) "backups")
)

$ErrorActionPreference = "Stop"

function Get-MySqlBin {
  $candidates = @(
    "C:\Program Files\MariaDB 12.2\bin",
    "C:\Program Files\MariaDB 11.8\bin",
    "C:\Program Files\MariaDB 11.7\bin",
    "C:\Program Files\MariaDB 11.6\bin",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin"
  )

  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "mysqldump.exe")) {
      return $candidate
    }
  }

  throw "mysqldump.exe not found. Install MariaDB/MySQL client tools or update the script candidates."
}

function Get-EnvValue {
  param(
    [string]$FilePath,
    [string]$Key
  )

  if (-not (Test-Path $FilePath)) {
    return $null
  }

  $line = Get-Content $FilePath | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (-not $line) {
    return $null
  }

  return ($line -replace "^$Key=", "").Trim().Trim('"')
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  $DatabaseUrl = Get-EnvValue -FilePath (Join-Path (Get-Location) ".env") -Key "DATABASE_URL"
}

if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
  throw "DATABASE_URL is required."
}

$uri = [System.Uri]$DatabaseUrl
$userInfo = $uri.UserInfo.Split(":", 2)
$username = $userInfo[0]
$password = if ($userInfo.Length -gt 1) { $userInfo[1] } else { "" }
$database = $uri.AbsolutePath.TrimStart("/")
$hostName = $uri.Host
$port = if ($uri.Port -gt 0) { $uri.Port } else { 3306 }

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $OutputDir "$database-$timestamp.sql"
$mySqlDump = Join-Path (Get-MySqlBin) "mysqldump.exe"

$env:MYSQL_PWD = $password
& $mySqlDump --host=$hostName --port=$port --user=$username --single-transaction --routines --triggers --result-file=$outputFile $database
Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue

Write-Output $outputFile
