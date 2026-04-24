param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectDir,

  [int[]]$Ports = @(3000, 4000)
)

$ErrorActionPreference = "SilentlyContinue"

try {
  $resolvedProjectDir = (Resolve-Path -LiteralPath $ProjectDir).Path
} catch {
  $resolvedProjectDir = $ProjectDir
}

$selfPid = $PID

function Get-PortOwnerPids {
  param([int[]]$LocalPorts)

  $matches = netstat -ano | Select-String "LISTENING"
  $pids = foreach ($line in $matches) {
    $text = $line.ToString()
    foreach ($port in $LocalPorts) {
      if ($text -match (":{0}\s" -f $port)) {
        $columns = ($text -split "\s+") | Where-Object { $_ }
        if ($columns.Count -gt 0) {
          $columns[-1]
        }
        break
      }
    }
  }

  $pids |
    Where-Object { $_ -match '^\d+$' } |
    ForEach-Object { [int]$_ } |
    Sort-Object -Unique
}

function Get-ProjectProcessPids {
  param([string]$BasePath)

  Get-CimInstance Win32_Process |
    Where-Object {
      $_.ProcessId -ne $selfPid -and
      $_.CommandLine -and
      $_.CommandLine -like "*$BasePath*" -and
      $_.CommandLine -notlike "*hr-app-control.cmd*" -and
      $_.CommandLine -notlike "*hr-app-stop-processes.ps1*"
    } |
    Select-Object -ExpandProperty ProcessId -Unique
}

for ($attempt = 0; $attempt -lt 6; $attempt++) {
  $targets = @(
    Get-PortOwnerPids -LocalPorts $Ports
    Get-ProjectProcessPids -BasePath $resolvedProjectDir
  ) | Where-Object { $_ } | Sort-Object -Unique

  if (-not $targets) {
    break
  }

  foreach ($pidValue in $targets) {
    try {
      Start-Process -FilePath "taskkill.exe" -ArgumentList @("/PID", [string]$pidValue, "/T", "/F") -WindowStyle Hidden -Wait | Out-Null
    } catch {
    }
  }

  Start-Sleep -Milliseconds 700
}
