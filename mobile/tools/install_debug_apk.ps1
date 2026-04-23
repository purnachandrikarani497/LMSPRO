# Install the latest debug APK with full "Failure [...]" output (Flutter often truncates).
# Usage: .\tools\install_debug_apk.ps1   OR   .\tools\install_debug_apk.ps1 -Serial ZA222KY4RR

param([string] $Serial = "")

$ErrorActionPreference = "Stop"
$adb = Join-Path $env:LOCALAPPDATA "Android\Sdk\platform-tools\adb.exe"
if (-not (Test-Path $adb)) {
    Write-Host "adb not found: $adb" -ForegroundColor Red
    exit 1
}

$mobileRoot = Split-Path $PSScriptRoot -Parent
$apk = Join-Path $mobileRoot "build\app\outputs\flutter-apk\app-debug.apk"
if (-not (Test-Path $apk)) {
    Write-Host "APK not found. Run: flutter build apk --debug" -ForegroundColor Red
    Write-Host "Looked for: $apk"
    exit 1
}

& $adb start-server
$devices = & $adb devices
Write-Host $devices

if (-not $Serial) {
    $lines = & $adb devices | Select-String "^\S+\s+device$"
    if ($lines.Count -eq 1) {
        $Serial = ($lines[0].Line -split "\s+")[0]
        Write-Host "Using device: $Serial" -ForegroundColor Cyan
    } else {
        Write-Host "Multiple or no devices. Pass -Serial ZA222KY4RR" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "`nUninstalling old package (ignore errors if none)..." -ForegroundColor Gray
& $adb -s $Serial uninstall "com.learnhub.lmspro.lmspro_mobile" 2>$null

$remote = "/data/local/tmp/lmspro_debug.apk"
Write-Host "Pushing APK..." -ForegroundColor Gray
& $adb -s $Serial push $apk $remote
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`npm install output (look for Failure [...]):" -ForegroundColor Cyan
& $adb -s $Serial shell pm install -r $remote
$code = $LASTEXITCODE

Write-Host "`nCleaning temp on device..." -ForegroundColor Gray
& $adb -s $Serial shell rm -f $remote 2>$null

if ($code -ne 0) {
    Write-Host "`nCommon fixes:" -ForegroundColor Yellow
    Write-Host "  - Free storage on the phone"
    Write-Host "  - Developer options: enable Install via USB / disable USB verification (OEM)"
    Write-Host "  - Revoke USB debugging authorizations, replug USB, accept prompt"
    Write-Host "  - Uninstall any old LearnHub / same package from Play if sideload conflicts"
}
exit $code
