@echo off
REM Simple release APK (arm64 only) - no PowerShell, no adb steps.
REM For Google Sign-In: use scripts\build_release_apk_from_backend_env.ps1 (reads GOOGLE_CLIENT_ID from backend\.env).
REM From Explorer: double-click this file (run from the mobile\ folder).
REM Output: build\app\outputs\flutter-apk\app-arm64-v8a-release.apk
cd /d "%~dp0"
echo.
echo === flutter pub get ===
call flutter pub get
if errorlevel 1 exit /b 1
echo.
echo === flutter build apk (release, split per ABI, arm64) ===
echo This uses ~1-3 GB under mobile\build while compiling - normal. Run flutter clean to free it.
call flutter build apk --release --split-per-abi --target-platform android-arm64 --suppress-analytics --obfuscate --split-debug-info=build/app/outputs/symbols
if errorlevel 1 exit /b 1
echo.
echo DONE. Copy this file to your phone and install:
echo   %CD%\build\app\outputs\flutter-apk\app-arm64-v8a-release.apk
echo.
pause
