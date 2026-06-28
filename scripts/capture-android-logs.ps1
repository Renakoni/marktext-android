param(
  [string]$Serial = "127.0.0.1:7555",
  [string]$Package = "io.github.renakoni.marktextandroid",
  [string]$Adb = "",
  [switch]$NoConnect,
  [switch]$ClearLogcat,
  [switch]$Follow
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$captureDir = Join-Path $repoRoot (Join-Path "logs" "android-$timestamp")
New-Item -ItemType Directory -Force -Path $captureDir | Out-Null

function Resolve-Adb {
  param([string]$RequestedAdb)

  if ($RequestedAdb) {
    return $RequestedAdb
  }

  $candidates = @(
    "E:\Android\Sdk\platform-tools\adb.exe",
    "E:\platform-tools\adb.exe",
    "adb"
  )

  foreach ($candidate in $candidates) {
    if (($candidate -eq "adb") -or (Test-Path -LiteralPath $candidate)) {
      return $candidate
    }
  }

  return "adb"
}

function Write-CommandOutput {
  param(
    [string]$Path,
    [scriptblock]$Command
  )

  try {
    & $Command 2>&1 | Out-File -LiteralPath $Path -Encoding utf8
  } catch {
    "Command failed: $_" | Out-File -LiteralPath $Path -Encoding utf8
  }
}

$adbPath = Resolve-Adb -RequestedAdb $Adb
$sessionFile = Join-Path $captureDir "session.txt"
$gitHead = ""
try {
  $gitHead = git -C $repoRoot rev-parse --short HEAD 2>$null
} catch {
  $gitHead = ""
}

@(
  "timestamp=$timestamp",
  "adb=$adbPath",
  "serial=$Serial",
  "package=$Package",
  "gitHead=$gitHead"
) | Out-File -LiteralPath $sessionFile -Encoding utf8

if (-not $NoConnect) {
  Write-CommandOutput -Path (Join-Path $captureDir "adb-connect.txt") -Command {
    & $adbPath connect $Serial
  }
}

if ($ClearLogcat) {
  Write-CommandOutput -Path (Join-Path $captureDir "adb-logcat-clear.txt") -Command {
    & $adbPath -s $Serial logcat -c
  }
}

if ($Follow) {
  & $adbPath -s $Serial logcat -v time -s MarkTextAndroid:* |
    Tee-Object -FilePath (Join-Path $captureDir "logcat-marktext-live.log")
  exit $LASTEXITCODE
}

Write-CommandOutput -Path (Join-Path $captureDir "adb-devices.txt") -Command {
  & $adbPath devices -l
}

Write-CommandOutput -Path (Join-Path $captureDir "logcat-marktext.log") -Command {
  & $adbPath -s $Serial logcat -d -v time -s MarkTextAndroid:*
}

Write-CommandOutput -Path (Join-Path $captureDir "logcat-errors.log") -Command {
  & $adbPath -s $Serial logcat -d -v time "*:E"
}

$privateListFile = Join-Path $captureDir "app-private-log-files.txt"
Write-CommandOutput -Path $privateListFile -Command {
  & $adbPath -s $Serial shell run-as $Package ls files/logs
}

$privateNames = @()
try {
  $privateNames = Get-Content -LiteralPath $privateListFile |
    Where-Object { $_ -match "\.log$" } |
    ForEach-Object { $_.Trim() } |
    Where-Object { $_ }
} catch {
  $privateNames = @()
}

foreach ($name in $privateNames) {
  $target = Join-Path $captureDir ("private-$name")
  Write-CommandOutput -Path $target -Command {
    & $adbPath -s $Serial shell run-as $Package cat "files/logs/$name"
  }
}

Write-Output "Android logs captured in $captureDir"
