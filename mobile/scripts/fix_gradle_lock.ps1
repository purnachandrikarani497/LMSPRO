# Unblocks: "Cannot lock execution history cache ... already been locked"
# Run from mobile/:  .\scripts\fix_gradle_lock.ps1
# Best: close Android Studio first so no second Gradle holds the cache.

$ErrorActionPreference = "Continue"
$mobileRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $mobileRoot "android"
if (-not (Test-Path -LiteralPath $androidDir)) {
    Write-Host "Expected folder not found: $androidDir" -ForegroundColor Red
    exit 1
}

Push-Location $androidDir
try {
    Write-Host "Stopping Gradle daemons..." -ForegroundColor Cyan
    & .\gradlew.bat --stop 2>&1 | Write-Host
} finally {
    Pop-Location
}

$hist = Join-Path $androidDir ".gradle\8.14\executionHistory"
if (Test-Path -LiteralPath $hist) {
    Write-Host "Removing stale execution history cache: $hist" -ForegroundColor Yellow
    Remove-Item -LiteralPath $hist -Recurse -Force -ErrorAction SilentlyContinue
}

$logicLock = Join-Path $androidDir ".gradle\noVersion\buildLogic.lock"
if (Test-Path -LiteralPath $logicLock) {
    Remove-Item -LiteralPath $logicLock -Force -ErrorAction SilentlyContinue
}

Write-Host ""
Write-Host "Done. Retry your build (only one of: Android Studio OR terminal, not both at once):" -ForegroundColor Green
Write-Host "  .\scripts\flutter_run_android_safe.ps1 -AllAbis" -ForegroundColor White
