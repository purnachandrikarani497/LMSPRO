# Builds app-arm64-v8a-release.apk with GOOGLE_CLIENT_ID from backend/.env (same ID the API uses).
# Never embeds GOOGLE_CLIENT_SECRET in the app - that stays server-side only.
# Usage (from mobile/):  .\scripts\build_release_apk_from_backend_env.ps1

$ErrorActionPreference = "Stop"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$repoRoot = Split-Path -Parent $mobileRoot
$envFile = Join-Path $repoRoot "backend\.env"

if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Host "Missing: $envFile" -ForegroundColor Red
    exit 1
}

$googleId = $null
foreach ($line in Get-Content -LiteralPath $envFile) {
    $t = $line.Trim()
    if ($t -eq "" -or $t.StartsWith("#")) { continue }
    if ($t -match '^\s*GOOGLE_CLIENT_ID\s*=\s*(.+)\s*$') {
        $googleId = $Matches[1].Trim().Trim('"').Trim("'")
        break
    }
}

if (-not $googleId) {
    Write-Host "GOOGLE_CLIENT_ID not found in backend\.env" -ForegroundColor Red
    exit 1
}

Set-Location $mobileRoot
Write-Host "Using GOOGLE_CLIENT_ID from backend\.env (Web client ID)." -ForegroundColor Cyan
Write-Host "GOOGLE_CLIENT_SECRET is not included in the APK (backend only)." -ForegroundColor DarkGray

# Gradle + native Google Sign-In read default_web_client_id from this env when embedding the APK.
$env:GOOGLE_CLIENT_ID = $googleId

& flutter pub get
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$sym = "build/app/outputs/symbols"
& flutter build apk --release --split-per-abi --target-platform android-arm64 `
    --suppress-analytics --obfuscate --split-debug-info=$sym `
    --dart-define=GOOGLE_CLIENT_ID=$googleId

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$apk = Join-Path $mobileRoot "build\app\outputs\flutter-apk\app-arm64-v8a-release.apk"
Write-Host ""
Write-Host "APK: $apk" -ForegroundColor Green
