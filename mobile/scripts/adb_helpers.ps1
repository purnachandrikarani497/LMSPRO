# Dot-source helpers: . "$PSScriptRoot\adb_helpers.ps1"
# Do not call adb kill-server / adb reconnect during install retries - they reset USB and drop the phone.
# Before a long Gradle compile, Stop-AdbServerForGradle is OK: it stops ADB chatter so USB stays stable.

function Stop-AdbServerForGradle {
    param([Parameter(Mandatory)] [string] $Adb)
    $null = & $Adb kill-server 2>&1
}

function Start-AdbServerQuiet {
    param([Parameter(Mandatory)] [string] $Adb)
    $null = & $Adb start-server 2>&1
}

function Wait-AdbDevice {
    param(
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $Serial,
        [int] $MaxAttempts = 45,
        [int] $DelaySec = 2
    )
    for ($i = 0; $i -lt $MaxAttempts; $i++) {
        $lines = & $Adb devices
        foreach ($line in $lines) {
            if ($line -match "^$([regex]::Escape($Serial))\s+device\s*$") {
                if ($i -gt 0) {
                    Write-Host "Device $Serial is back (waited $($i * $DelaySec)s)." -ForegroundColor Green
                }
                return $true
            }
        }
        if ($i -eq 0) {
            Write-Host "Waiting for $Serial to be in 'device' state..." -ForegroundColor DarkYellow
        } else {
            Write-Host "  still waiting... ($i/$MaxAttempts)" -ForegroundColor DarkGray
        }
        Start-Sleep -Seconds $DelaySec
    }
    return $false
}

# adb devices can list "device" while the next command fails (stale USB). Shell must succeed before reverse/install.
function Test-AdbTransport {
    param(
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $Serial,
        [int] $Retries = 8,
        [int] $DelaySec = 2,
        [switch] $Quiet
    )
    for ($i = 0; $i -lt $Retries; $i++) {
        $null = & $Adb -s $Serial shell echo adb_ok 2>&1
        if ($LASTEXITCODE -eq 0) { return $true }
        if (-not $Quiet -and $i -eq 0) {
            Write-Host "ADB transport check failed (USB may have slept during build); retrying..." -ForegroundColor DarkYellow
        }
        Start-Sleep -Seconds $DelaySec
    }
    return $false
}

function Test-IsWifiAdbSerial {
    param([Parameter(Mandatory)] [string] $Serial)
    return $Serial -match '^\d+\.\d+\.\d+\.\d+:\d+$'
}

function Get-AndroidWifiIp {
    param(
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $Serial
    )
    foreach ($iface in @('wlan0', 'wlan1')) {
        $raw = & $Adb -s $Serial shell ip -f inet addr show $iface 2>&1 | Out-String
        if ($raw -match 'inet\s+(\d+\.\d+\.\d+\.\d+)') {
            return $Matches[1]
        }
    }
    $all = & $Adb -s $Serial shell ip addr 2>&1 | Out-String
    $ms = [regex]::Matches($all, 'inet\s+(\d+\.\d+\.\d+\.\d+)/')
    foreach ($m in $ms) {
        $c = $m.Groups[1].Value
        if ($c -notmatch '^127\.' -and $c -notmatch '^169\.254\.') { return $c }
    }
    return $null
}

# USB must be connected for the tcpip handshake. After success, installs use TCP (often stable when USB bulk transfer fails).
function Switch-ToWifiAdb {
    param(
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $UsbSerial
    )
    if (Test-IsWifiAdbSerial -Serial $UsbSerial) {
        Write-Host "Already using Wi-Fi ADB ($UsbSerial)." -ForegroundColor Gray
        return $UsbSerial
    }
    Write-Host "`nSwitching ADB to Wi-Fi (phone and PC on the same network)..." -ForegroundColor Cyan
    $null = & $Adb -s $UsbSerial tcpip 5555 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "adb tcpip failed. Keep USB connected, USB debugging on, and authorize this PC." -ForegroundColor Red
        return $null
    }
    Start-Sleep -Seconds 2
    $ip = Get-AndroidWifiIp -Adb $Adb -Serial $UsbSerial
    if (-not $ip) {
        Write-Host "Could not read the phone Wi-Fi IP. Enable Wi-Fi and same LAN as this PC." -ForegroundColor Red
        & $Adb -s $UsbSerial usb 2>$null
        return $null
    }
    $endpoint = "${ip}:5555"
    Write-Host "Phone Wi-Fi IP: $ip -> adb connect $endpoint ..." -ForegroundColor Gray
    $null = & $Adb connect $endpoint 2>&1
    Start-Sleep -Seconds 2
    if (-not (Wait-AdbDevice -Adb $Adb -Serial $endpoint -MaxAttempts 30 -DelaySec 2)) {
        Write-Host "adb connect failed. From this PC, ping $ip ; check firewall and same subnet." -ForegroundColor Red
        & $Adb -s $UsbSerial usb 2>$null
        return $null
    }
    Write-Host "ADB over Wi-Fi ready ($endpoint). You may unplug USB before install if you prefer." -ForegroundColor Green
    return $endpoint
}

# Maps device localhost:Port to PC localhost:Port - use API base http://127.0.0.1:PORT/api/ in the app (no Wi-Fi / firewall issues).
function Set-AdbReverseToHost {
    param(
        [Parameter(Mandatory)] [string] $Adb,
        [Parameter(Mandatory)] [string] $Serial,
        [int] $Port = 5000
    )
    $remote = "tcp:$Port"
    $ok = $false
    $lastOut = ""
    for ($attempt = 1; $attempt -le 4 -and -not $ok; $attempt++) {
        if ($attempt -gt 1) {
            Start-Sleep -Seconds 2
            $null = Test-AdbTransport -Adb $Adb -Serial $Serial -Retries 5 -DelaySec 1 -Quiet
        }
        $null = & $Adb -s $Serial reverse --remove $remote 2>&1
        $lastOut = & $Adb -s $Serial reverse $remote $remote 2>&1 | Out-String
        $ok = ($LASTEXITCODE -eq 0) -and ($lastOut -notmatch "error|failed|not found")
    }
    if (-not $ok) {
        Write-Host "adb reverse failed (exit=$LASTEXITCODE): $lastOut" -ForegroundColor Yellow
        Write-Host "Try: adb -s $Serial reverse --remove $remote ; adb -s $Serial reverse $remote $remote" -ForegroundColor DarkYellow
        return $false
    }
    Write-Host ""
    Write-Host "adb reverse $remote $remote OK" -ForegroundColor Green
    # Listing is optional; on flaky USB the list call can fail even when reverse is set.
    try {
        $list = [string](cmd /c "`"$Adb`" -s $Serial reverse --list 2>nul")
        if ($list.Trim().Length -gt 0) {
            Write-Host ($list.TrimEnd()) -ForegroundColor DarkGray
        }
    } catch { }
    Write-Host "In the app use API: 127.0.0.1:$Port  (full base http://127.0.0.1:${Port}/api/)" -ForegroundColor Cyan
    Write-Host "Requires: USB debugging + backend npm start on this PC (port $Port)." -ForegroundColor Gray
    return $true
}
