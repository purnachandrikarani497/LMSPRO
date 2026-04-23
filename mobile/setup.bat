@echo off
cd /d "%~dp0"
echo Running setup.ps1 ...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
pause
