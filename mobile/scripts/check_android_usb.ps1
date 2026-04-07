# USB debugging check (use this first). Run from mobile/:  .\scripts\check_android_usb.ps1
# If USB never stays connected, use Wi-Fi ADB: .\scripts\wireless_adb_setup.ps1 (two different ports on the phone; see script header).

$ErrorActionPreference = "Continue"

function Get-AdbPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return $null
}

$adb = Get-AdbPath
if (-not $adb) {
    Write-Host "adb.exe not found. Install Android SDK Platform-Tools (Android Studio -> SDK Manager)." -ForegroundColor Red
    exit 1
}

Write-Host "ADB: $adb`n" -ForegroundColor Gray
$output = & $adb devices -l
Write-Host $output

$lines = $output -split "`r?`n"
$state = "none"
foreach ($line in $lines) {
    if ($line -match "^\S+\s+device(\s|$)") { $state = "ok" }
    if ($line -match "^\S+\s+unauthorized(\s|$)") { $state = "unauthorized" }
    if ($line -match "^\S+\s+offline(\s|$)") { $state = "offline" }
}

Write-Host ""
if ($state -eq "ok") {
    Write-Host "OK: ADB sees your device. You can run Flutter builds / .\scripts\flutter_run_android_safe.ps1" -ForegroundColor Green
    exit 0
}

Write-Host "========== Fix USB debugging (try in order) ==========" -ForegroundColor Yellow
Write-Host " 1. Unlock the phone. Screen on while plugging in."
Write-Host " 2. Cable: use one that supports DATA (not charge-only). Try another cable."
Write-Host " 3. Developer options: USB debugging ON."
Write-Host " 4. Developer options: Revoke USB debugging authorizations, unplug, replug, accept RSA prompt."
Write-Host " 5. Notification: USB mode = File transfer / MTP (not Charge only)."
Write-Host " 6. PC: use a motherboard USB port if possible; avoid bad hubs. Try USB 2.0 port."
Write-Host " 7. Windows: Device Manager -> Universal Serial Bus controllers -> each USB Root Hub ->"
Write-Host "    Power Management -> UNCHECK 'Allow the computer to turn off this device'."
Write-Host " 8. Install Google USB Driver (SDK Manager) or your phone OEM driver if device is unknown."
Write-Host ""
Write-Host "If USB keeps dropping: use Wi-Fi ADB (phone and PC on same Wi-Fi):" -ForegroundColor Cyan
Write-Host "  .\scripts\wireless_adb_setup.ps1   (read the header: pairing port and session port are different)" -ForegroundColor White
Write-Host ""

if ($state -eq "unauthorized") {
    Write-Host "Phone shows unauthorized -> unlock and tap Allow on the RSA fingerprint dialog." -ForegroundColor Red
}
if ($state -eq "offline") {
    Write-Host "Phone shows offline -> unplug, revoke authorizations (step 4), replug." -ForegroundColor Red
}
if ($state -eq "none") {
    Write-Host "No device listed -> Windows is not talking ADB to the phone (cable, driver, or port)." -ForegroundColor Red
}
exit 1
