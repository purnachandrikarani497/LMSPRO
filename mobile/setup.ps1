# LearnHub LMS - one-shot Flutter mobile setup (Windows)
# Run from PowerShell:  cd path\to\LMSPRO\mobile   .\setup.ps1
# Or right-click setup.ps1 -> Run with PowerShell (may need: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned)

$ErrorActionPreference = "Stop"
$MobileRoot = $PSScriptRoot
Set-Location $MobileRoot

# Reload PATH from Windows (Machine + User). Required if you just added Flutter in
# System Properties: existing terminals (including Cursor) still have the old PATH until restarted.
$env:Path = @(
    [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    [System.Environment]::GetEnvironmentVariable("Path", "User")
) -join ";"

# Optional: FLUTTER_ROOT points at the SDK root (folder that contains bin\flutter.bat)
if ($env:FLUTTER_ROOT) {
    $fb = Join-Path $env:FLUTTER_ROOT "bin"
    if (Test-Path (Join-Path $fb "flutter.bat")) {
        $env:Path = "$fb;$env:Path"
    }
}

# Common Windows zip layout: C:\flutter_windows_*-stable\flutter\bin
if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    $zipRoot = Get-ChildItem -Path "C:\" -Directory -Filter "flutter_windows_*-stable" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($zipRoot) {
        $flutterBin = Join-Path $zipRoot.FullName "flutter\bin"
        if (Test-Path (Join-Path $flutterBin "flutter.bat")) {
            $env:Path = "$flutterBin;$env:Path"
            Write-Host "Found Flutter at: $flutterBin" -ForegroundColor DarkGray
        }
    }
}

Write-Host ""
Write-Host "=== LearnHub LMS - Flutter mobile setup ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Flutter was not found in PATH." -ForegroundColor Red
    Write-Host "Add the folder that contains flutter.bat to PATH (e.g. ...\flutter\bin), click OK in Environment Variables, then run this script again." -ForegroundColor Yellow
    Write-Host "Or close this terminal and open a new one. Or set FLUTTER_ROOT to your SDK folder (the one that contains the bin folder)." -ForegroundColor Yellow
    exit 1
}

Write-Host "Using Flutter:" -ForegroundColor Gray
# Avoid piping flutter output through PowerShell (breaks UTF-8 bullets in some consoles).
try { [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false) } catch { }
& flutter --version
Write-Host ""

Write-Host "Running flutter doctor (fix any [X]: Android Studio, licenses, etc.)..." -ForegroundColor Yellow
flutter doctor
Write-Host ""

if (-not (Test-Path (Join-Path $MobileRoot "android"))) {
    Write-Host "Creating Android and iOS platform folders (flutter create)..." -ForegroundColor Yellow
    flutter create . --project-name lmspro_mobile --org com.learnhub.lmspro --platforms=android,ios
    if ($LASTEXITCODE -ne 0) {
        Write-Host "flutter create failed. See messages above." -ForegroundColor Red
        exit $LASTEXITCODE
    }
} else {
    Write-Host "android/ already exists - skipping flutter create." -ForegroundColor Green
}

Write-Host ""
Write-Host "Installing packages (flutter pub get)..." -ForegroundColor Yellow
flutter pub get
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=== Setup finished ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Start your API:  cd ..\backend   npm start   (port 5000)" -ForegroundColor White
Write-Host "  2. Run the app:     cd mobile        flutter run" -ForegroundColor White
$phoneHint = '  3. Physical phone:  flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:5000/api'
Write-Host $phoneHint -ForegroundColor White
Write-Host ""
