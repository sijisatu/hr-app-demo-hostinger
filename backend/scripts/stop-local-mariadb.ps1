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

$dataPath = [System.IO.Path]::GetFullPath($DataDir)
$pidPath = Join-Path $dataPath "mariadbd.pid"
$mysqlAdmin = Get-MariaDbBinary -BinaryName "mysqladmin.exe"

cmd /c "`"$mysqlAdmin`" --protocol=tcp --skip-ssl -h $DbHost -P $Port -u root --password=$RootPassword shutdown >nul 2>nul"

if (Test-Path $pidPath) {
  Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
}

Write-Output "MariaDB stop requested for $DbHost`:$Port"
