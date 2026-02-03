@echo off
REM ============================================================================
REM  LaunchFromUSB.bat
REM  Secure Deployment Runner - USB Portable Launcher
REM ============================================================================
REM
REM  PURPOSE:
REM    Launches the Secure Deployment Runner portable application from a USB
REM    drive. This script auto-detects the application directory and starts
REM    the Electron portable executable.
REM
REM  USAGE:
REM    1. Build the portable app: npm run build:portable
REM    2. Copy the Secure-Deployment-Runner-Portable-*.exe to the USB drive
REM    3. Place this script next to the portable .exe on the USB root
REM    4. Double-click LaunchFromUSB.bat to start
REM
REM  SAFETY:
REM    - No admin privileges required for the launcher itself
REM    - No internet access required
REM    - No system modifications made by this launcher
REM    - Application runs sandboxed in Electron with strict CSP
REM    - All data stays on the USB drive unless explicitly configured otherwise
REM
REM ============================================================================

setlocal EnableDelayedExpansion

REM Detect the USB/script directory
set "USB_DIR=%~dp0"
if "%USB_DIR:~-1%"=="\" set "USB_DIR=%USB_DIR:~0,-1%"

echo ============================================================
echo   Secure Deployment Runner - USB Launcher
echo   Hospital Network Deployment Tool
echo ============================================================
echo.
echo   Drive: %USB_DIR%
echo   Date:  %DATE% %TIME%
echo.

REM Look for the portable executable
set "APP_EXE="
for %%F in ("%USB_DIR%\Secure-Deployment-Runner-Portable-*.exe") do (
    set "APP_EXE=%%F"
)

if not defined APP_EXE (
    REM Try the release subdirectory
    for %%F in ("%USB_DIR%\release\Secure-Deployment-Runner-Portable-*.exe") do (
        set "APP_EXE=%%F"
    )
)

if not defined APP_EXE (
    echo [ERROR] Could not find Secure-Deployment-Runner-Portable-*.exe
    echo.
    echo Please ensure the portable executable is in:
    echo   %USB_DIR%\
    echo   or %USB_DIR%\release\
    echo.
    echo Build it with: npm run build:portable
    echo.
    pause
    exit /b 1
)

echo   Found: %APP_EXE%
echo.

REM Set environment variables for the app
set "ELECTRON_NO_ATTACH_CONSOLE=1"
set "ELECTRON_DISABLE_GPU=0"

REM Ensure the scripts directory is available next to the exe
set "SCRIPTS_DIR=%USB_DIR%\scripts"
if not exist "%SCRIPTS_DIR%" (
    echo [WARNING] Scripts directory not found: %SCRIPTS_DIR%
    echo           Metadata collection scripts may not be available.
    echo.
)

echo Starting Secure Deployment Runner...
echo.
echo ============================================================
echo   IMPORTANT: This application is for authorized hospital
echo   IT personnel only. All actions are logged.
echo ============================================================
echo.

REM Launch the application
start "" "%APP_EXE%"

REM Exit the launcher
exit /b 0
