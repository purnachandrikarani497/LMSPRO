# Deletes Flutter build output and local Android Gradle cache under mobile/android/.gradle
# Frees several GB. Safe: next build will recreate everything.
# Usage (from mobile/):  .\scripts\clean_mobile.ps1

$ErrorActionPreference = "Continue"
$mobileRoot = Split-Path -Parent $PSScriptRoot
Set-Location $mobileRoot

Write-Host "flutter clean..." -ForegroundColor Cyan
& flutter clean
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$g = Join-Path $mobileRoot "android\.gradle"
if (Test-Path -LiteralPath $g) {
    Write-Host "Removing android\.gradle (project Gradle cache)..." -ForegroundColor Yellow
    Remove-Item -LiteralPath $g -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Done. Disk space freed; run flutter pub get before building again." -ForegroundColor Green
