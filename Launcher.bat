@echo off
cd /d "%~dp0"
set "LAUNCHER_SCRIPT=%~dp0scripts\launcher.ps1"

rem Try Windows PowerShell first; fall back to PowerShell Core (pwsh) if needed.
powershell -ExecutionPolicy Bypass -NoProfile -File "%LAUNCHER_SCRIPT%" 2>nul || pwsh -ExecutionPolicy Bypass -NoProfile -File "%LAUNCHER_SCRIPT%"
