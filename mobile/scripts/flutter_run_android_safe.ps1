# Like "flutter run" on Android, but installs without adb reconnect/kill-server (those drop USB).
# Runs "adb reverse tcp:5000 tcp:5000" so the app can use API http://127.0.0.1:5000/api/ (USB tunnel; no LAN/firewall).
# Usage (from mobile/):
#   .\scripts\flutter_run_android_safe.ps1
# Optional Google Sign-In (same Web client ID as backend):
#   .\scripts\flutter_run_android_safe.ps1 -GoogleClientId "YOUR_ID.apps.googleusercontent.com"
# If omitted, GOOGLE_CLIENT_ID is read from backend/.env when present (Dart + Gradle).
# Gradle: script runs "adb kill-server" before flutter build so the phone gets zero ADB USB traffic during compile (fixes many disconnects).
# Optional: -KeepAdbDuringBuild if you must keep adb talking during compile (emulator edge cases).
# You can also: -Release -BuildOnly, then plug USB and run -SkipBuild -SkipAttach.
# Smaller APK (~50MB or less typical): -Release + arm64-only default. Emulators / 32-bit phone: add -AllAbis.
# Gradle can run 10-25+ minutes - do not press Ctrl+C.
# Install uses Wi-Fi ADB after a short USB handshake (reliable). -UsbOnlyInstall forces flaky USB bulk (not recommended).
# Alternatives if deploy still fails: open the mobile/ folder in Android Studio and Run (green play), or copy
# build\app\outputs\flutter-apk\app-arm64-v8a-debug.apk to the phone and install from Files (allow unknown sources).
# Opt out (USB-only install): .\scripts\flutter_run_android_safe.ps1 -UsbOnlyInstall
# (Legacy -WifiAdb is no longer required; Wi-Fi for APK is default when appropriate.)
# Build once then install/attach only:
#   .\scripts\flutter_run_android_safe.ps1 -SkipBuild
# Wireless-only: .\scripts\wireless_adb_setup.ps1 (pairing port and session port differ; see that script), then -Serial "IP:SESSION_PORT"
# Multiple devices (USB + Wi-Fi ADB, two phones, etc.): auto-picks USB/emulator first; override with:
#   .\scripts\flutter_run_android_safe.ps1 -Serial ZA222KY4RR
#   .\scripts\flutter_run_android_safe.ps1 -Serial 192.168.1.12:5555
#
# PowerShell: use .\script.ps1   (do not type "run .\script.ps1")

param(
    [string] $GoogleClientId = "",
    [string] $Serial = "",
    [switch] $SkipBuild,
    [switch] $Release,
    [switch] $AllAbis,
    [switch] $BuildOnly,
    [switch] $WifiAdb,
    [switch] $UsbOnlyInstall,
    [switch] $SkipAttach
)

$ErrorActionPreference = "Continue"

$mobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $mobileRoot

if ($GoogleClientId -eq "") {
    $envBackend = Join-Path (Split-Path -Parent $mobileRoot) "backend\.env"
    if (Test-Path -LiteralPath $envBackend) {
        foreach ($line in Get-Content -LiteralPath $envBackend) {
            $t = $line.Trim()
            if ($t -eq "" -or $t.StartsWith("#")) { continue }
            if ($t -match '^\s*GOOGLE_CLIENT_ID\s*=\s*(.+)\s*$') {
                $GoogleClientId = $Matches[1].Trim().Trim('"').Trim("'")
                break
            }
        }
    }
}

. (Join-Path $PSScriptRoot "adb_helpers.ps1")

# Prefer USB / emulator over "192.168.x.x:5555" so adb reverse + installs match the physical device by default.
function Select-DefaultAdbSerial {
    param([Parameter(Mandatory)] [string[]] $Serials)
    $local = @()
    foreach ($s in $Serials) {
        if (-not (Test-IsWifiAdbSerial -Serial $s)) {
            $local += $s
        }
    }
    if ($local.Count -ge 1) { return $local[0] }
    return $Serials[0]
}

$pkg = "com.learnhub.lmspro.lmspro_mobile"
$activity = "$pkg/.MainActivity"

function Normalize-AbiToken {
    param([string] $s)
    if (-not $s) { return $null }
    $t = ($s | Out-String).Trim() -replace "[\r\n]+", ""
    $t = $t -replace '^\[|\]$', ""
    $t = $t.Trim()
    if ($t -match "error|not found" -or $t -eq "") { return $null }
    if ($t -match ',') { $t = ($t -split ',')[0].Trim() }
    return $t
}

# Some OEMs omit ro.product.cpu.abi over adb; try several props + uname.
function Get-DevicePrimaryAbi {
    param([Parameter(Mandatory)] [string] $Adb, [Parameter(Mandatory)] [string] $Serial)
    $props = @(
        'ro.product.cpu.abi',
        'ro.system.product.cpu.abi',
        'ro.vendor.product.cpu.abi',
        'ro.product.cpu.abi64'
    )
    foreach ($prop in $props) {
        $o = & $Adb -s $Serial shell getprop $prop 2>&1
        if ($LASTEXITCODE -ne 0) { continue }
        $t = Normalize-AbiToken $o
        if ($t) { return $t }
    }
    foreach ($prop in @('ro.product.cpu.abilist', 'ro.system.product.cpu.abilist', 'ro.vendor.product.cpu.abilist')) {
        $o = & $Adb -s $Serial shell getprop $prop 2>&1
        if ($LASTEXITCODE -ne 0) { continue }
        $t = Normalize-AbiToken $o
        if ($t) { return $t }
    }
    $un = Normalize-AbiToken (& $Adb -s $Serial shell uname -m 2>&1)
    if ($un) {
        switch -Regex ($un) {
            '^aarch64$' { return 'arm64-v8a' }
            '^armv8l$' { return 'arm64-v8a' }
            '^armv7l$' { return 'armeabi-v7a' }
            '^x86_64$' { return 'x86_64' }
            '^i686$' { return 'x86' }
        }
    }
    return $null
}

# Prefers split app-<abi>-<debug|release>.apk. If ABI unknown, prefer arm64 split over fat universal.
function Resolve-FlutterSplitApk {
    param(
        [Parameter(Mandatory)] [string] $MobileRoot,
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $Serial,
        [Parameter(Mandatory)] [ValidateSet('debug', 'release')] [string] $BuildKind
    )
    $dir = Join-Path $MobileRoot "build\app\outputs\flutter-apk"
    if (-not (Test-Path -LiteralPath $dir)) { return $null }
    $sfx = $BuildKind

    $abi = Get-DevicePrimaryAbi -Adb $Adb -Serial $Serial
    if ($abi) {
        $splitName = switch -Regex ($abi.Trim()) {
            '^arm64-v8a$' { "app-arm64-v8a-$sfx.apk" }
            '^armeabi-v7a$' { "app-armeabi-v7a-$sfx.apk" }
            '^x86_64$' { "app-x86_64-$sfx.apk" }
            '^x86$' { "app-x86-$sfx.apk" }
            default { $null }
        }
        if ($splitName) {
            $p = Join-Path $dir $splitName
            if (Test-Path -LiteralPath $p) { return $p }
        }
    }

    foreach ($name in @("app-arm64-v8a-$sfx.apk", "app-armeabi-v7a-$sfx.apk", "app-x86_64-$sfx.apk", "app-x86-$sfx.apk")) {
        $p = Join-Path $dir $name
        if (Test-Path -LiteralPath $p) { return $p }
    }

    $universal = Join-Path $dir "app-$sfx.apk"
    if (Test-Path -LiteralPath $universal) { return $universal }

    $any = @(Get-ChildItem -Path $dir -Filter "app-*-$sfx.apk" -File -ErrorAction SilentlyContinue)
    if ($any.Count -ge 1) {
        foreach ($pat in @('arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86')) {
            $hit = $any | Where-Object { $_.Name -eq "app-$pat-$sfx.apk" } | Select-Object -First 1
            if ($hit) { return $hit.FullName }
        }
        return ($any | Sort-Object Name)[0].FullName
    }
    return $null
}

function Get-AdbPath {
    $candidates = @(
        "$env:LOCALAPPDATA\Android\sdk\platform-tools\adb.exe",
        "$env:ANDROID_HOME\platform-tools\adb.exe",
        "$env:ANDROID_SDK_ROOT\platform-tools\adb.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    throw "adb.exe not found. Install Android SDK Platform-Tools."
}

$adb = Get-AdbPath
Write-Host "ADB: $adb" -ForegroundColor Gray

$defineArgs = @()
if ($GoogleClientId -ne "") {
    $defineArgs += "--dart-define=GOOGLE_CLIENT_ID=$GoogleClientId"
    $env:GOOGLE_CLIENT_ID = $GoogleClientId
}

$platArgs = @()
if (-not $AllAbis) {
    $platArgs += "--target-platform"
    $platArgs += "android-arm64"
}

if (-not $SkipBuild) {
    $mode = if ($Release) { "release" } else { "debug" }
    Write-Host ""
    Write-Host "=== Gradle build ($mode) ===" -ForegroundColor Green
    if (-not $KeepAdbDuringBuild) {
        Write-Host "Stopping ADB (adb kill-server) so your phone has no ADB traffic during Gradle - main fix for USB disconnects." -ForegroundColor Cyan
        Write-Host "Phone can stay plugged; charging/MTP may still show. Install phase restarts ADB automatically." -ForegroundColor DarkGray
        Stop-AdbServerForGradle -Adb $adb
        Start-Sleep -Milliseconds 500
    } else {
        Write-Host "-KeepAdbDuringBuild: ADB left running (USB may still drop on some PCs during long compiles)." -ForegroundColor Yellow
    }
    if (-not $AllAbis) {
        Write-Host "Target: android-arm64 only. For x86 emulator or 32-bit phone add -AllAbis" -ForegroundColor DarkGray
    }
    Write-Host "Gradle may take 10-25+ min. Wait for 'Built build\...'. Do not press Ctrl+C." -ForegroundColor Yellow
    $flutterGlobal = @("--suppress-analytics")
    if ($Release) {
        # Obfuscation + split debug symbols shrinks release APK; symbols stay under build/ (gitignored), not on device.
        $symDir = "build/app/outputs/symbols"
        & flutter @flutterGlobal build apk --release @defineArgs --split-per-abi @platArgs --obfuscate --split-debug-info=$symDir
    } else {
        & flutter @flutterGlobal build apk --debug @defineArgs --split-per-abi @platArgs
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} else {
    Write-Host ""
    Write-Host "-SkipBuild: using existing APK, no Gradle run." -ForegroundColor Yellow
}

if ($BuildOnly) {
    Write-Host ""
    Write-Host "BuildOnly: finished. Connect phone (USB), then install with:" -ForegroundColor Cyan
    Write-Host "  .\scripts\flutter_run_android_safe.ps1 $(if ($Release) { '-Release ' })-SkipBuild -SkipAttach" -ForegroundColor White
    exit 0
}

Write-Host ""
Write-Host "=== Install phase - connect phone (USB) if needed ===" -ForegroundColor Green
Start-AdbServerQuiet -Adb $adb
Start-Sleep -Milliseconds 400
$devLines = & $adb devices
Write-Host ($devLines -join "`n")

$serials = @()
foreach ($line in $devLines) {
    if ($line -match "^(\S+)\s+device\s*$") {
        $serials += $Matches[1]
    }
}
if ($serials.Count -eq 0) {
    Write-Host "`nNo device in 'device' state. Plug in USB, unlock phone, authorize debugging." -ForegroundColor Red
    Write-Host "  .\scripts\check_android_usb.ps1" -ForegroundColor Yellow
    Write-Host "  Or after build: .\scripts\flutter_run_android_safe.ps1 $(if ($Release) { '-Release ' })-SkipBuild -SkipAttach" -ForegroundColor DarkGray
    exit 1
}

$useSerial = $Serial
if ($useSerial -eq "") {
    if ($serials.Count -gt 1) {
        $useSerial = Select-DefaultAdbSerial -Serials $serials
        Write-Host ('Multiple devices: using {0} (USB/emulator preferred over Wi-Fi ADB).' -f $useSerial) -ForegroundColor Yellow
        Write-Host 'Override: -Serial <id from adb devices>' -ForegroundColor DarkGray
    } else {
        $useSerial = $serials[0]
    }
} elseif ($serials -notcontains $useSerial) {
    Write-Host "Serial $useSerial is not in 'device' state." -ForegroundColor Red
    exit 1
}

Write-Host "`nUsing device: $useSerial" -ForegroundColor Cyan

if ($UsbOnlyInstall) {
    Write-Host "WARNING: -UsbOnlyInstall pushes the full APK over USB only (often disconnects). Omit it to use Wi-Fi ADB for the large transfer (recommended)." -ForegroundColor Red
}

Start-Sleep -Seconds 2
if (-not (Wait-AdbDevice -Adb $adb -Serial $useSerial)) {
    Write-Host "Device never came back. Unlock phone, replug USB, then retry or use Wireless debugging." -ForegroundColor Red
    exit 1
}
if (-not (Test-AdbTransport -Adb $adb -Serial $useSerial)) {
    Write-Host "ADB lists the device but shell does not respond. Replug USB, unlock phone, run .\scripts\check_android_usb.ps1" -ForegroundColor Red
    exit 1
}

$abiHint = Get-DevicePrimaryAbi -Adb $adb -Serial $useSerial
$kind = if ($Release) { "release" } else { "debug" }
$apk = Resolve-FlutterSplitApk -MobileRoot $mobileRoot -Adb $adb -Serial $useSerial -BuildKind $kind
if (-not $apk -or -not (Test-Path -LiteralPath $apk)) {
    Write-Host "No matching $kind APK (ABI $(if ($abiHint) { $abiHint } else { 'unknown' }))." -ForegroundColor Red
    if (-not $AllAbis) {
        Write-Host "You built arm64-only (default). For 32-bit-only phones or x86 emulator, rebuild with -AllAbis." -ForegroundColor Yellow
    }
    Write-Host "Run: .\scripts\flutter_run_android_safe.ps1 $(if ($Release) { '-Release ' })$(if ($AllAbis) { '-AllAbis ' })-SkipBuild" -ForegroundColor Yellow
    exit 1
}
$apkItem = Get-Item -LiteralPath $apk
$apkMb = [math]::Round($apkItem.Length / 1MB, 1)
Write-Host ""
Write-Host ("Installing {0} ({1} MB) for ABI {2}" -f $apkItem.Name, $apkMb, $(if ($abiHint) { $abiHint } else { "unknown" })) -ForegroundColor Cyan

# Large APK over USB often fails (write failed / broken pipe) while small commands still work - not Gradle kicking the device.
# Default: switch ADB to TCP (Wi-Fi) for reverse + install; bulk transfer then avoids flaky USB. Emulators stay on USB.
$usbSerialBeforeWifi = $useSerial
$tryWifiForApk = (-not $UsbOnlyInstall) -and (-not (Test-IsWifiAdbSerial -Serial $useSerial)) -and ($useSerial -notmatch '^emulator-')
if ($tryWifiForApk) {
    Write-Host ""
    Write-Host "Switching ADB to Wi-Fi for this session (APK install over USB is unreliable on many PCs/cables)." -ForegroundColor Cyan
    Write-Host "Phone Wi-Fi ON, same network as this PC. To force USB-only install: -UsbOnlyInstall" -ForegroundColor DarkGray
    $wifiEp = Switch-ToWifiAdb -Adb $adb -UsbSerial $useSerial
    if ($wifiEp) {
        $useSerial = $wifiEp
    } else {
        Write-Host "Wi-Fi ADB not available; continuing on USB (install may fail on large APK)." -ForegroundColor Yellow
    }
} elseif ($WifiAdb -and -not (Test-IsWifiAdbSerial -Serial $usbSerialBeforeWifi)) {
    Write-Host ""
    Write-Host "-WifiAdb is deprecated (Wi-Fi for APK is already the default when USB is used). Use -UsbOnlyInstall to stay on USB." -ForegroundColor DarkGray
}

# App can use http://127.0.0.1:5000/api/ via adb reverse (works over USB or Wi-Fi ADB transport).
Set-AdbReverseToHost -Adb $adb -Serial $useSerial -Port 5000 | Out-Null

# Longer install timeout helps slow USB (milliseconds; honored by adb install on many builds).
$env:ADB_INSTALL_TIMEOUT = "600000"

$remoteApk = if ($Release) { "/data/local/tmp/lmspro-release.apk" } else { "/data/local/tmp/lmspro-debug.apk" }
$installed = $false

# Do NOT use adb reconnect here - it resets USB and drops the device on many PCs.

$installAttempts = 3
for ($try = 1; $try -le $installAttempts -and -not $installed; $try++) {
    if ($try -gt 1) {
        Write-Host "`nInstall retry $try/$installAttempts..." -ForegroundColor DarkYellow
        Start-Sleep -Seconds 3
        if (-not (Wait-AdbDevice -Adb $adb -Serial $useSerial -MaxAttempts 15)) {
            Write-Host "Device not ready; unlock phone and replug USB." -ForegroundColor Red
            break
        }
    }

    Write-Host "`n[1/3] adb install -r --no-streaming ..." -ForegroundColor Cyan
    & $adb -s $useSerial install -r --no-streaming $apk
    if ($LASTEXITCODE -eq 0) { $installed = $true; break }

    Start-Sleep -Seconds 2
    if (-not (Wait-AdbDevice -Adb $adb -Serial $useSerial -MaxAttempts 20)) {
        Write-Host "Lost device after step 1. Replug USB, or confirm phone Wi-Fi + same LAN as PC." -ForegroundColor Red
        continue
    }
    Write-Host "[2/3] adb install -r (streamed) ..." -ForegroundColor Yellow
    & $adb -s $useSerial install -r $apk
    if ($LASTEXITCODE -eq 0) { $installed = $true; break }

    Start-Sleep -Seconds 2
    if (-not (Wait-AdbDevice -Adb $adb -Serial $useSerial -MaxAttempts 20)) {
        Write-Host "Lost device before step 3." -ForegroundColor Red
        continue
    }
    Write-Host "[3/3] adb push + pm install ..." -ForegroundColor Yellow
    Write-Host "  pushing $apk -> $remoteApk" -ForegroundColor Gray
    & $adb -s $useSerial push $apk $remoteApk
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  pm install -r -t $remoteApk" -ForegroundColor Gray
        & $adb -s $useSerial shell pm install -r -t $remoteApk
        if ($LASTEXITCODE -eq 0) { $installed = $true; break }
        & $adb -s $useSerial shell rm -f $remoteApk 2>$null
    }
}

if (-not $installed) {
    Write-Host ""
    Write-Host "All automatic installs failed. The APK is fine." -ForegroundColor Red
    if ($UsbOnlyInstall -or (Test-IsWifiAdbSerial -Serial $useSerial)) {
        if ($UsbOnlyInstall) {
            Write-Host "You used -UsbOnlyInstall (USB bulk only). Retry without it so the script can use Wi-Fi for the APK, or fix USB (cable, USB 2.0 port, disable USB selective suspend)." -ForegroundColor Yellow
        } else {
            Write-Host "Check Wi-Fi (phone + PC same LAN), firewall, and run again. Or sideload the APK manually:" -ForegroundColor Yellow
        }
    } else {
        Write-Host "Wi-Fi ADB was skipped or failed; USB bulk transfer then failed. Enable phone Wi-Fi (same network as PC) and run again, or sideload:" -ForegroundColor Yellow
    }
    Write-Host "  $apk" -ForegroundColor White
    exit 1
}

if (-not (Wait-AdbDevice -Adb $adb -Serial $useSerial -MaxAttempts 15)) {
    Write-Host "Device lost before launch." -ForegroundColor Red
    exit 1
}

Write-Host "`nStarting app..." -ForegroundColor Cyan
& $adb -s $useSerial shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -n $activity
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$attachHint = "flutter attach -d " + $useSerial + " " + ($defineArgs -join " ")
Write-Host ""
if ($SkipAttach) {
    Write-Host "Installed and launched. (Skipped flutter attach.) To debug: $attachHint" -ForegroundColor Green
    if ($Release) {
        Write-Host "Note: release APK has no hot-reload VM; use a debug build + attach for dev, or -SkipBuild after changing code." -ForegroundColor DarkGray
    }
    exit 0
}
Write-Host $attachHint -ForegroundColor Green
if ($Release) {
    Write-Host "Release build: flutter attach may be limited (no hot reload). Prefer debug for active development." -ForegroundColor DarkYellow
}
& flutter attach -d $useSerial @defineArgs
