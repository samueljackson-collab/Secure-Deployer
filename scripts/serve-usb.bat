@echo off
setlocal EnableDelayedExpansion

set PORT=3000
set DIST=%~dp0dist

echo ============================================================
echo   Secure Deployment Runner - USB / Portable Mode
echo ============================================================
echo.
echo   Serving from: %DIST%
echo   Access at:    http://localhost:%PORT%
echo.
echo   Press Ctrl+C to stop the server.
echo ============================================================
echo.

:: Check if dist/ exists
if not exist "%DIST%\index.html" (
    echo [ERROR] dist\index.html not found.
    echo         Run 'npm run build' first, then copy the dist\ folder here.
    pause
    exit /b 1
)

:: Try Python 3
python --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Using Python to serve...
    start "" "http://localhost:%PORT%"
    python -m http.server %PORT% --directory "%DIST%"
    goto :done
)

:: Try Python3 explicitly
python3 --version >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Using Python3 to serve...
    start "" "http://localhost:%PORT%"
    python3 -m http.server %PORT% --directory "%DIST%"
    goto :done
)

:: Fallback: PowerShell built-in HTTP listener (no dependencies required)
echo [INFO] Python not found. Using built-in PowerShell HTTP server...
echo.
start "" "http://localhost:%PORT%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$port = %PORT%; $dir = '%DIST%';" ^
    "$http = [System.Net.HttpListener]::new();" ^
    "$http.Prefixes.Add(\"http://localhost:$port/\");" ^
    "$http.Start();" ^
    "Write-Host \"[OK] Server running at http://localhost:$port\";" ^
    "Write-Host \"Press Ctrl+C to stop.\";" ^
    "while ($http.IsListening) {" ^
    "  $ctx = $http.GetContext();" ^
    "  $p = $ctx.Request.Url.LocalPath.TrimStart('/');" ^
    "  if (!$p) { $p = 'index.html' };" ^
    "  $f = Join-Path $dir $p;" ^
    "  if (!(Test-Path $f -PathType Leaf)) { $f = Join-Path $dir 'index.html' };" ^
    "  $bytes = [IO.File]::ReadAllBytes($f);" ^
    "  $ext = [IO.Path]::GetExtension($f);" ^
    "  $mime = switch ($ext) {" ^
    "    '.html' {'text/html; charset=utf-8'}" ^
    "    '.js'   {'application/javascript'}" ^
    "    '.css'  {'text/css'}" ^
    "    '.svg'  {'image/svg+xml'}" ^
    "    '.png'  {'image/png'}" ^
    "    '.ico'  {'image/x-icon'}" ^
    "    '.json' {'application/json'}" ^
    "    '.woff2'{'font/woff2'}" ^
    "    default {'application/octet-stream'}" ^
    "  };" ^
    "  $ctx.Response.ContentType = $mime;" ^
    "  $ctx.Response.ContentLength64 = $bytes.Length;" ^
    "  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length);" ^
    "  $ctx.Response.Close();" ^
    "}"

:done
endlocal
