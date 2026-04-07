@echo off
REM ============================================================
REM  Secure Deployment Runner — USB Portable Launcher (Windows)
REM  Serves the built dist/ folder on port 3000 using Python or
REM  PowerShell's built-in HTTP listener. Opens the browser.
REM  No installation required.
REM
REM  Usage: Double-click serve-usb.bat from the USB root.
REM  Requires: dist\ folder in the parent directory of scripts\
REM ============================================================

setlocal EnableDelayedExpansion

set PORT=3000
set "SCRIPT_DIR=%~dp0"
set "DIST_DIR=%SCRIPT_DIR%..\dist"

REM Resolve the dist path
pushd "%DIST_DIR%" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] dist\ folder not found at: %DIST_DIR%
    echo         Run "npm run build" first to generate dist\.
    pause
    exit /b 1
)
set "DIST_ABS=%CD%"
popd

echo ============================================================
echo   Secure Deployment Runner - USB Portable Launcher
echo ============================================================
echo   Serving: %DIST_ABS%
echo   Port   : %PORT%
echo ============================================================
echo.

REM Try Python 3 first
python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Using Python 3 HTTP server...
    start "" "http://localhost:%PORT%"
    python3 -m http.server %PORT% --directory "%DIST_ABS%"
    goto :end
)

REM Try Python (may be python on some systems)
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [INFO] Using Python HTTP server...
    start "" "http://localhost:%PORT%"
    python -m http.server %PORT% --directory "%DIST_ABS%"
    goto :end
)

REM Fall back to PowerShell HTTP listener
echo [INFO] Python not found. Using PowerShell HTTP listener...
start "" "http://localhost:%PORT%"
powershell.exe -ExecutionPolicy Bypass -File "%SCRIPT_DIR%serve-portable.ps1" -Port %PORT% -DistPath "%DIST_ABS%"

:end
endlocal
