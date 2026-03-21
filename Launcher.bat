@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
set "LAUNCHER_SCRIPT=%~dp0scripts\launcher.ps1"

rem Try Windows PowerShell first; fall back to PowerShell Core (pwsh) if needed.
echo Launching FloodGate...
powershell -ExecutionPolicy Bypass -NoProfile -File "!LAUNCHER_SCRIPT!" 2>nul
if errorlevel 1 (
    echo Trying PowerShell Core...
    pwsh -ExecutionPolicy Bypass -NoProfile -File "!LAUNCHER_SCRIPT!"
    if errorlevel 1 (
        echo Error: Failed to launch FloodGate. Ensure PowerShell is available.
        pause
    )
)
