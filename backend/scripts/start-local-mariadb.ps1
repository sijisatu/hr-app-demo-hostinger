param(
  [string]$DataDir = (Join-Path (Get-Location) ".mariadb-data"),
  [string]$DbHost = "127.0.0.1",
  [int]$Port = 3307,
  [string]$RootPassword = "root"
)

$ErrorActionPreference = "Stop"
$PSNativeCommandUseErrorActionPreference = $false

function Get-MariaDbBinary {
  param([string]$BinaryName)

  $candidates = @(
    "C:\Program Files\MariaDB 12.2\bin",
    "C:\Program Files\MariaDB 11.8\bin",
    "C:\Program Files\MariaDB 11.7\bin",
    "C:\Program Files\MariaDB 11.6\bin",
    "C:\Program Files\MySQL\MySQL Server 8.0\bin"
  )

  foreach ($candidate in $candidates) {
    $fullPath = Join-Path $candidate $BinaryName
    if (Test-Path $fullPath) {
      return $fullPath
    }
  }

  throw "$BinaryName not found. Install MariaDB/MySQL client tools or update the script candidates."
}

function Test-DatabaseReady {
  param(
    [string]$MysqlAdminPath,
    [string]$DbHost,
    [int]$DbPort,
    [string]$DbPassword
  )

  cmd /c "`"$MysqlAdminPath`" --protocol=tcp --skip-ssl -h $DbHost -P $DbPort -u root --password=$DbPassword ping >nul 2>nul"
  return $LASTEXITCODE -eq 0
}

$dataPath = [System.IO.Path]::GetFullPath($DataDir)
$configPath = Join-Path $dataPath "my.ini"
$pidPath = Join-Path $dataPath "mariadbd.pid"
$logPath = Join-Path $dataPath "mariadbd.console.log"
$errPath = Join-Path $dataPath "mariadbd.console.err.log"

if (-not (Test-Path $configPath)) {
  throw "MariaDB data directory is not initialized: $configPath"
}

$mysqlAdmin = Get-MariaDbBinary -BinaryName "mysqladmin.exe"
$mariadbd = Get-MariaDbBinary -BinaryName "mariadbd.exe"

if (Test-DatabaseReady -MysqlAdminPath $mysqlAdmin -DbHost $DbHost -DbPort $Port -DbPassword $RootPassword) {
  Write-Output "MariaDB already running on $DbHost`:$Port"
  exit 0
}

$process = Start-Process -FilePath $mariadbd `
  -ArgumentList @("""--defaults-file=$configPath""", "--standalone", "--console") `
  -WorkingDirectory (Split-Path $dataPath -Parent) `
  -WindowStyle Hidden `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError $errPath `
  -PassThru

$process.Id | Set-Content -Path $pidPath -Encoding ascii

$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 2
  if ($process.HasExited) {
    break
  }
  if (Test-DatabaseReady -MysqlAdminPath $mysqlAdmin -DbHost $DbHost -DbPort $Port -DbPassword $RootPassword) {
    $ready = $true
    break
  }
}

if (-not $ready) {
  if (-not $process.HasExited) {
    $process.Kill()
    $process.WaitForExit()
  }
  throw "MariaDB did not become ready on $DbHost`:$Port"
}

Write-Output "MariaDB started on $DbHost`:$Port (PID $($process.Id))"
