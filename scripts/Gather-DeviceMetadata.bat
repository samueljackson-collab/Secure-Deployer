@echo off
REM ============================================================================
REM  Gather-DeviceMetadata.bat
REM  Hospital Imaging Task Sequence - Device Metadata Collection Orchestrator
REM ============================================================================
REM
REM  PURPOSE:
REM    Runs during SCCM/MDT task sequence to collect device hardware and
REM    software metadata. Calls the companion PowerShell script, then copies
REM    the resulting JSON to both a local staging path and a network share.
REM
REM  USAGE:
REM    This script is designed to run from a USB drive during the imaging
REM    wizard. Place both Gather-DeviceMetadata.bat and
REM    Gather-DeviceMetadata.ps1 in the same directory on the USB drive,
REM    then execute this .bat file from the task sequence.
REM
REM      X:\Scripts\Gather-DeviceMetadata.bat
REM
REM    It can also be called from a task sequence step:
REM      cmd.exe /c "X:\Scripts\Gather-DeviceMetadata.bat"
REM
REM  REQUIREMENTS:
REM    - Windows PE or full Windows environment with PowerShell available
REM    - Network connectivity to SHARE_PATH (if network copy is desired)
REM    - No internet or external services required
REM    - No external dependencies beyond built-in Windows components
REM
REM  OUTPUT:
REM    - Local JSON:   %TEMP%\DeviceMetadata\<COMPUTERNAME>.json
REM    - Network JSON: \\DEPLOYSERVER\ImageMetadata$\<COMPUTERNAME>.json
REM    - Log file:     %TEMP%\DeviceMetadata\Gather-DeviceMetadata.log
REM
REM  SAFETY:
REM    This script is read-only with respect to the target system. It only
REM    gathers information and writes output files. It does not modify any
REM    system settings, registry keys, or services. Safe for hospital
REM    networks - no internet access, no external data transmission.
REM
REM ============================================================================

setlocal EnableDelayedExpansion

REM ============================================================================
REM  CONFIGURATION - Edit these variables for your environment
REM ============================================================================

REM UNC share path where metadata JSON files are stored for the Image Monitor
set "SHARE_PATH=\\DEPLOYSERVER\ImageMetadata$"

REM Local directory for staging metadata output and logs
set "LOCAL_OUTPUT_DIR=%TEMP%\DeviceMetadata"

REM Log file path
set "LOG_PATH=%LOCAL_OUTPUT_DIR%\Gather-DeviceMetadata.log"

REM Timeout in seconds to wait for PowerShell script completion
set "PS_TIMEOUT=120"

REM ============================================================================
REM  DERIVED PATHS - Do not edit below unless customizing behavior
REM ============================================================================

REM Detect the drive/directory this .bat file is running from (USB root)
set "SCRIPT_DIR=%~dp0"

REM Remove trailing backslash if present for clean path joining
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Full path to the companion PowerShell script
set "PS_SCRIPT=%SCRIPT_DIR%\Gather-DeviceMetadata.ps1"

REM Computer name for output file naming
if defined COMPUTERNAME (
    set "DEVICE_NAME=%COMPUTERNAME%"
) else (
    set "DEVICE_NAME=UNKNOWN_%RANDOM%"
)

REM Output file paths
set "LOCAL_JSON=%LOCAL_OUTPUT_DIR%\%DEVICE_NAME%.json"
set "NETWORK_JSON=%SHARE_PATH%\%DEVICE_NAME%.json"

REM ============================================================================
REM  FUNCTIONS
REM ============================================================================

goto :Main

:LogMessage
REM Writes a timestamped message to both the console and the log file.
REM Usage: call :LogMessage "LEVEL" "Message text"
set "LOG_LEVEL=%~1"
set "LOG_MSG=%~2"
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set "LOG_DATE=%%b/%%c/%%d"
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set "LOG_TIME=%%a:%%b"
set "LOG_LINE=[%LOG_DATE% %LOG_TIME%] [%LOG_LEVEL%] %LOG_MSG%"
echo %LOG_LINE%
echo %LOG_LINE%>>"%LOG_PATH%" 2>nul
goto :eof

:EnsureDirectory
REM Creates a directory if it does not exist.
REM Usage: call :EnsureDirectory "C:\Path\To\Dir"
if not exist "%~1" (
    mkdir "%~1" 2>nul
    if errorlevel 1 (
        call :LogMessage "ERROR" "Failed to create directory: %~1"
        exit /b 1
    )
)
exit /b 0

REM ============================================================================
REM  MAIN EXECUTION
REM ============================================================================

:Main

REM --- Step 1: Create local output directory ---
call :EnsureDirectory "%LOCAL_OUTPUT_DIR%"
if errorlevel 1 (
    echo [FATAL] Cannot create local output directory. Exiting.
    exit /b 1
)

REM Initialize log file
echo.>>"%LOG_PATH%"
call :LogMessage "INFO" "========================================================"
call :LogMessage "INFO" "Gather-DeviceMetadata.bat - Starting metadata collection"
call :LogMessage "INFO" "========================================================"
call :LogMessage "INFO" "Script directory : %SCRIPT_DIR%"
call :LogMessage "INFO" "Device name      : %DEVICE_NAME%"
call :LogMessage "INFO" "Local output     : %LOCAL_JSON%"
call :LogMessage "INFO" "Network share    : %SHARE_PATH%"
call :LogMessage "INFO" "PowerShell script: %PS_SCRIPT%"

REM --- Step 2: Validate that the PowerShell script exists ---
if not exist "%PS_SCRIPT%" (
    call :LogMessage "ERROR" "PowerShell script not found: %PS_SCRIPT%"
    call :LogMessage "ERROR" "Ensure Gather-DeviceMetadata.ps1 is in the same directory as this .bat file."
    exit /b 2
)
call :LogMessage "INFO" "PowerShell script found. Proceeding."

REM --- Step 3: Validate that PowerShell is available ---
where powershell.exe >nul 2>nul
if errorlevel 1 (
    call :LogMessage "ERROR" "PowerShell.exe not found in PATH. Cannot proceed."
    call :LogMessage "ERROR" "Ensure this is running in a Windows PE environment with PowerShell support."
    exit /b 3
)
call :LogMessage "INFO" "PowerShell.exe is available."

REM --- Step 4: Execute the PowerShell metadata collection script ---
call :LogMessage "INFO" "Launching PowerShell metadata collection..."
call :LogMessage "INFO" "Command: powershell.exe -ExecutionPolicy Bypass -NoProfile -File \"%PS_SCRIPT%\" -OutputPath \"%LOCAL_JSON%\""

powershell.exe -ExecutionPolicy Bypass -NoProfile -NonInteractive -File "%PS_SCRIPT%" -OutputPath "%LOCAL_JSON%"
set "PS_EXIT=%ERRORLEVEL%"

call :LogMessage "INFO" "PowerShell script exited with code: %PS_EXIT%"

REM --- Step 5: Check PowerShell exit code ---
if %PS_EXIT% NEQ 0 (
    call :LogMessage "ERROR" "PowerShell script returned non-zero exit code: %PS_EXIT%"
    call :LogMessage "ERROR" "Metadata collection may be incomplete. Check the PowerShell log for details."

    REM Even on partial failure, continue to copy whatever was generated
    if not exist "%LOCAL_JSON%" (
        call :LogMessage "ERROR" "No output JSON file was generated. Cannot proceed with copy."
        exit /b 4
    ) else (
        call :LogMessage "WARNING" "Output JSON exists despite error. Will attempt to copy partial results."
    )
) else (
    call :LogMessage "INFO" "PowerShell script completed successfully."
)

REM --- Step 6: Verify local JSON output exists ---
if not exist "%LOCAL_JSON%" (
    call :LogMessage "ERROR" "Expected output file not found: %LOCAL_JSON%"
    call :LogMessage "ERROR" "The PowerShell script did not produce a metadata JSON file."
    exit /b 5
)

REM Get file size for logging
for %%A in ("%LOCAL_JSON%") do set "JSON_SIZE=%%~zA"
call :LogMessage "INFO" "Local JSON file created: %LOCAL_JSON% (%JSON_SIZE% bytes)"

REM --- Step 7: Copy results to network share ---
call :LogMessage "INFO" "Attempting to copy metadata to network share: %SHARE_PATH%"

REM Test if network share is reachable
if not exist "%SHARE_PATH%" (
    call :LogMessage "WARNING" "Network share not accessible: %SHARE_PATH%"
    call :LogMessage "WARNING" "This may be expected in WinPE before network drivers load."
    call :LogMessage "WARNING" "Attempting to create share path..."
    mkdir "%SHARE_PATH%" 2>nul
)

if exist "%SHARE_PATH%" (
    copy /y "%LOCAL_JSON%" "%NETWORK_JSON%" >nul 2>nul
    if errorlevel 1 (
        call :LogMessage "WARNING" "Failed to copy JSON to network share."
        call :LogMessage "WARNING" "Local copy is still available at: %LOCAL_JSON%"
        call :LogMessage "WARNING" "You may need to manually copy the file after network is available."
    ) else (
        call :LogMessage "INFO" "Successfully copied metadata to: %NETWORK_JSON%"
    )
) else (
    call :LogMessage "WARNING" "Network share is not reachable. Skipping network copy."
    call :LogMessage "WARNING" "Local copy preserved at: %LOCAL_JSON%"
)

REM --- Step 8: Also copy the progress file to the network share if it exists ---
set "PROGRESS_FILE=%TEMP%\imaging_progress.json"
if exist "%PROGRESS_FILE%" (
    if exist "%SHARE_PATH%" (
        copy /y "%PROGRESS_FILE%" "%SHARE_PATH%\%DEVICE_NAME%_progress.json" >nul 2>nul
        if not errorlevel 1 (
            call :LogMessage "INFO" "Progress file copied to network share."
        )
    )
) else (
    call :LogMessage "WARNING" "Progress file not found at: %PROGRESS_FILE%"
)

REM --- Step 9: Copy log file to network share ---
if exist "%SHARE_PATH%" (
    copy /y "%LOG_PATH%" "%SHARE_PATH%\%DEVICE_NAME%.log" >nul 2>nul
    if not errorlevel 1 (
        call :LogMessage "INFO" "Log file copied to network share."
    )
)

REM --- Step 10: Final summary ---
call :LogMessage "INFO" "========================================================"
call :LogMessage "INFO" "Metadata collection complete for: %DEVICE_NAME%"
call :LogMessage "INFO" "Local JSON : %LOCAL_JSON%"
if exist "%NETWORK_JSON%" (
    call :LogMessage "INFO" "Network JSON: %NETWORK_JSON%"
) else (
    call :LogMessage "WARNING" "Network JSON: NOT COPIED (share unavailable)"
)
call :LogMessage "INFO" "Log file   : %LOG_PATH%"
call :LogMessage "INFO" "========================================================"

REM Return the PowerShell exit code so the task sequence knows the result
endlocal & exit /b %PS_EXIT%
