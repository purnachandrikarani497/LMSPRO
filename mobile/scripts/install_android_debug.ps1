# Bypass flaky USB installs. Does NOT call adb kill-server or adb reconnect (those drop USB).
# Usage: .\scripts\install_android_debug.ps1
#        .\scripts\install_android_debug.ps1 -GoogleClientId "..." -SkipBuild
# USB install fails: .\scripts\install_android_debug.ps1 -WifiAdb -SkipBuild

param(
    [string] $GoogleClientId = "",
    [switch] $SkipBuild,
    [switch] $WifiAdb
)

$ErrorActionPreference = "Continue"

$mobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $mobileRoot

. (Join-Path $PSScriptRoot "adb_helpers.ps1")

function Get-AdbPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    throw "adb.exe not found. Install Android SDK Platform-Tools or set ANDROID_HOME."
}

$adb = Get-AdbPath
Write-Host "Using ADB: $adb" -ForegroundColor Gray

# Do NOT kill adb server here - it disconnects the phone for several seconds.

$devLines = & $adb devices
Write-Host ($devLines -join "`n")

$firstSerial = $null
foreach ($line in $devLines) {
    if ($line -match "^(\S+)\s+device\s*$") {
        $firstSerial = $Matches[1]
        break
    }
}
$hasUnauthorized = $false
foreach ($line in $devLines) {
    if ($line -match "^\S+\s+unauthorized\s*$") { $hasUnauthorized = $true }
}

if (-not $firstSerial) {
    Write-Host ""
    Write-Host "No device in 'device' state. Run .\scripts\check_android_usb.ps1" -ForegroundColor Red
    Write-Host ""
    if ($hasUnauthorized) {
        Write-Host "Tip: phone shows 'unauthorized' -> unlock screen and tap Allow on the RSA prompt." -ForegroundColor Cyan
    }
    exit 1
}

Write-Host "Using device: $firstSerial" -ForegroundColor Cyan

$defineArgs = @()
if ($GoogleClientId -ne "") {
    $defineArgs += "--dart-define=GOOGLE_CLIENT_ID=$GoogleClientId"
}

if (-not $SkipBuild) {
    Write-Host "`nflutter build apk --debug $($defineArgs -join ' ')" -ForegroundColor Cyan
    & flutter build apk --debug @defineArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host "`n-SkipBuild: using existing APK." -ForegroundColor Yellow
}

$apk = Join-Path $mobileRoot "build\app\outputs\flutter-apk\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) {
    Write-Host "APK not found: $apk" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 2
if (-not (Wait-AdbDevice -Adb $adb -Serial $firstSerial)) {
    Write-Host "Device not ready. Unlock phone and retry." -ForegroundColor Red
    exit 1
}

if ($WifiAdb) {
    $wifiEp = Switch-ToWifiAdb -Adb $adb -UsbSerial $firstSerial
    if (-not $wifiEp) {
        Write-Host "Wi-Fi ADB setup failed; continuing on USB." -ForegroundColor Yellow
    } else {
        $firstSerial = $wifiEp
    }
}

Set-AdbReverseToHost -Adb $adb -Serial $firstSerial -Port 5000 | Out-Null

$env:ADB_INSTALL_TIMEOUT = "600000"

$remoteApk = "/data/local/tmp/lmspro-debug.apk"
$installed = $false

Write-Host "`n[1/3] adb install -r --no-streaming ..." -ForegroundColor Cyan
& $adb -s $firstSerial install -r --no-streaming $apk
if ($LASTEXITCODE -eq 0) { $installed = $true }

if (-not $installed) {
    Start-Sleep -Seconds 2
    if (Wait-AdbDevice -Adb $adb -Serial $firstSerial -MaxAttempts 20) {
        Write-Host "[2/3] adb install -r ..." -ForegroundColor Yellow
        & $adb -s $firstSerial install -r $apk
        if ($LASTEXITCODE -eq 0) { $installed = $true }
    }
}

if (-not $installed) {
    Start-Sleep -Seconds 2
    if (Wait-AdbDevice -Adb $adb -Serial $firstSerial -MaxAttempts 20) {
        Write-Host "[3/3] adb push + pm install ..." -ForegroundColor Yellow
        & $adb -s $firstSerial push $apk $remoteApk
        if ($LASTEXITCODE -eq 0) {
            & $adb -s $firstSerial shell pm install -r -t $remoteApk
            if ($LASTEXITCODE -eq 0) { $installed = $true }
            & $adb -s $firstSerial shell rm -f $remoteApk 2>$null
        }
    }
}

if (-not $installed) {
    Write-Host "All install methods failed. Try -WifiAdb (same Wi-Fi as PC), Wireless debugging, or copy APK to phone:" -ForegroundColor Red
    Write-Host "  $apk" -ForegroundColor White
    exit 1
}

Write-Host "`nInstalled. Open the LearnHub app, then: flutter attach $($defineArgs -join ' ')" -ForegroundColor Green
