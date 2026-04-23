# Run while the phone is connected via USB debugging (no Wi-Fi / firewall needed for API).
# Then in the app: API server = 127.0.0.1:5000
# Usage (from mobile/):  .\scripts\adb_reverse_api.ps1
# Optional:              .\scripts\adb_reverse_api.ps1 -Serial DEVICE_SERIAL

param([string] $Serial = "")

$ErrorActionPreference = "Continue"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $scriptDir "adb_helpers.ps1")

function Get-AdbPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    throw "adb.exe not found."
}

$adb = Get-AdbPath
$useSerial = $Serial
if ($useSerial -eq "") {
    foreach ($line in & $adb devices) {
        if ($line -match "^(\S+)\s+device\s*$") {
            $useSerial = $Matches[1]
            break
        }
    }
}
if ($useSerial -eq "") {
    Write-Host "No device in 'device' state." -ForegroundColor Red
    exit 1
}

Write-Host "Device: $useSerial" -ForegroundColor Cyan
Set-AdbReverseToHost -Adb $adb -Serial $useSerial -Port 5000
