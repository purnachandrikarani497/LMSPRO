# Wi-Fi ADB (when USB is unreliable). Also accepts old names: -PairPort and -ConnectPort.
#
#  ========== TWO DIFFERENT PORTS (do not mix them) ==========
#
#  PAIRING PORT  = port shown ONLY on "Pair device with pairing code"  -> used in: adb pair IP:PAIRING_PORT CODE
#  SESSION PORT  = port shown on MAIN "Wireless debugging" as "IP address & port" -> used in: adb connect IP:SESSION_PORT
#
#  They are NOT the same number. Same Wi-Fi IP for the phone is common; the two ports are almost always different.
#
#  Example:
#    Pairing screen:     192.168.1.12 : 42203   + code 936832
#    Main screen:        192.168.1.12 : 37155   <- this session port goes to -SessionPort
#
#  .\scripts\wireless_adb_setup.ps1 -PairHost 192.168.1.12 -PairingPort 42203 -PairCode 936832 -SessionPort 37155
#
#  .\scripts\flutter_run_android_safe.ps1 -SkipBuild -Serial "192.168.1.12:37155"

param(
    [string] $PairHost = "",
    [Alias("PairPort")]
    [int] $PairingPort = 0,
    [string] $PairCode = "",
    [string] $ConnectHost = "",
    [Alias("ConnectPort")]
    [int] $SessionPort = 0
)

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
    throw "adb.exe not found. Install Android SDK Platform-Tools."
}

function Get-SuggestedPcLanIp {
    try {
        $addrs = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object {
            $ip = $_.IPAddress
            if ($ip -match '^(127\.|169\.254\.)') { return $false }
            if ($ip -match '^192\.168\.56\.') { return $false }
            if ($ip -match '^(192\.168\.|10\.)') { return $true }
            return $false
        }
        return ($addrs | Select-Object -First 1).IPAddress
    } catch {
        return $null
    }
}

function Write-PortReminder {
    Write-Host ""
    Write-Host "Reminder: PAIRING port (pair screen) and SESSION port (main Wireless debugging screen) are different." -ForegroundColor DarkCyan
    Write-Host "          -PairingPort = pair screen only.  -SessionPort = main screen 'IP address & port' only." -ForegroundColor DarkCyan
    Write-Host ""
}

$adb = Get-AdbPath
Write-Host "ADB: $adb" -ForegroundColor Gray

if ($SessionPort -gt 0) {
    Write-PortReminder
    if ($ConnectHost -eq "" -and $PairHost -ne "") {
        $ConnectHost = $PairHost
        Write-Host "Using phone IP $ConnectHost for adb connect (from -PairHost)." -ForegroundColor DarkGray
    }
    if ($ConnectHost -eq "") {
        Write-Host "Need -ConnectHost or -PairHost, and -SessionPort (main Wireless debugging line)." -ForegroundColor Red
        exit 1
    }
    if ($PairHost -ne "" -and $ConnectHost -ne "" -and $PairHost -ne $ConnectHost) {
        Write-Host "Note: -PairHost ($PairHost) and -ConnectHost ($ConnectHost) differ. Usually both should be the phone Wi-Fi IP." -ForegroundColor Yellow
    }

    $endpoint = "${ConnectHost}:${SessionPort}"
    if ($PairHost -ne "" -and $PairingPort -gt 0 -and $PairCode -ne "") {
        $pairEndpoint = "${PairHost}:${PairingPort}"
        Write-Host "Step 1 - adb pair (pairing screen only): $pairEndpoint" -ForegroundColor Cyan
        & $adb pair $pairEndpoint $PairCode
        if ($LASTEXITCODE -ne 0) {
            Write-Host "adb pair failed. Use IP + PAIRING port + code from the pairing dialog." -ForegroundColor Red
            exit 1
        }
        Start-Sleep -Seconds 2
    }

    Write-Host "Step 2 - adb connect (main Wireless debugging line): $endpoint" -ForegroundColor Cyan
    $connOut = & $adb connect $endpoint 2>&1 | Out-String
    Write-Host $connOut.TrimEnd()
    $connFail = $connOut -match 'cannot connect|failed|refused|10061'
    if ($connFail) {
        Write-Host ""
        Write-Host "Connect failed. Check -SessionPort: it must be the port on the MAIN Wireless debugging screen," -ForegroundColor Red
        Write-Host "NOT the pairing port. Do not use your PC's IP as the phone IP." -ForegroundColor Red
        exit 1
    }

    Start-Sleep -Seconds 1
    $devOut = & $adb devices -l 2>&1 | Out-String
    Write-Host $devOut.TrimEnd()
    if ($devOut -notmatch [regex]::Escape($endpoint) -or $devOut -match "$([regex]::Escape($endpoint))\s+offline") {
        Write-Host ""
        Write-Host "Device not listed. Copy IP:sessionPort exactly from the phone main Wireless debugging screen." -ForegroundColor Red
        exit 1
    }

    Write-Host ""
    Write-Host "Next:" -ForegroundColor Green
    Write-Host "  .\scripts\flutter_run_android_safe.ps1 -SkipBuild -Serial `"$endpoint`"" -ForegroundColor White
    $lan = Get-SuggestedPcLanIp
    if ($lan) {
        Write-Host "App API base (PC on Wi-Fi): http://${lan}:5000/api/" -ForegroundColor Cyan
    }
    exit 0
}

Write-Host ""
Write-Host "Wireless ADB" -ForegroundColor Cyan
Write-Host "------------" -ForegroundColor Cyan
Write-Host "PAIRING PORT  = only from 'Pair device with pairing code'"
Write-Host "SESSION PORT  = only from main screen 'IP address & port'  (different number; used with adb connect)"
Write-Host ""
Write-Host "Example:" -ForegroundColor Yellow
Write-Host '  .\scripts\wireless_adb_setup.ps1 -PairHost 192.168.1.12 -PairingPort 42203 -PairCode 936832 -SessionPort 37155' -ForegroundColor White
Write-Host "Legacy names still work: -PairPort and -ConnectPort mean the same as -PairingPort and -SessionPort." -ForegroundColor DarkGray
Write-Host ""
exit 1
