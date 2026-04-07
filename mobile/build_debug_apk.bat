@echo off
REM Faster debug APK for sideload testing (larger than release).
cd /d "%~dp0"
call flutter pub get
if errorlevel 1 exit /b 1
call flutter build apk --debug --split-per-abi --target-platform android-arm64 --suppress-analytics
if errorlevel 1 exit /b 1
echo.
echo APK: %CD%\build\app\outputs\flutter-apk\app-arm64-v8a-debug.apk
pause
