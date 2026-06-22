@echo off
:: install.bat — Secure Deployment Runner setup script for Windows
:: Requires Windows 10 or later, Node.js 20+, and npm on PATH.
:: Usage: install.bat [--skip-env] [--skip-build]

setlocal EnableDelayedExpansion

:: ---------------------------------------------------------------------------
:: Colour helper (Windows 10+ ANSI support via VirtualTerminalLevel registry)
:: We skip colour codes for broad compatibility; use labels instead.
:: ---------------------------------------------------------------------------

echo.
echo ============================================================
echo  Secure Deployment Runner -- Windows Installation
echo ============================================================
echo.

:: ---------------------------------------------------------------------------
:: Parse arguments
:: ---------------------------------------------------------------------------
set SKIP_ENV=0
set SKIP_BUILD=0

:parse_args
if "%~1"=="" goto :done_args
if /i "%~1"=="--skip-env"   set SKIP_ENV=1
if /i "%~1"=="--skip-build" set SKIP_BUILD=1
shift
goto :parse_args
:done_args

:: ---------------------------------------------------------------------------
:: Step 1 -- Check Node.js is installed
:: ---------------------------------------------------------------------------
echo [INFO] Checking Node.js version...

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed or not on PATH.
    echo [ERROR] Install Node.js 20 LTS from: https://nodejs.org/en/download/
    echo [ERROR] After installing, restart this terminal and re-run install.bat.
    exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node --version') do set NODE_MAJOR=%%V
:: Strip leading 'v' from the major version token
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% LSS 20 (
    for /f %%V in ('node --version') do set NODE_VER=%%V
    echo [ERROR] Node.js !NODE_VER! is installed, but version 20 or higher is required.
    echo [ERROR] Upgrade from: https://nodejs.org/en/download/
    exit /b 1
)

for /f %%V in ('node --version') do echo [INFO] Node.js %%V detected (^>= 20 required) -- OK

:: ---------------------------------------------------------------------------
:: Step 2 -- Check npm is available
:: ---------------------------------------------------------------------------
echo.
echo [INFO] Checking npm version...

npm --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found. It should be bundled with Node.js.
    echo [ERROR] Reinstall Node.js from https://nodejs.org/
    exit /b 1
)

for /f %%V in ('npm --version') do echo [INFO] npm %%V detected -- OK

:: ---------------------------------------------------------------------------
:: Step 3 -- Environment setup
:: ---------------------------------------------------------------------------
if %SKIP_ENV%==1 goto :skip_env

echo.
echo [INFO] Setting up environment...

if exist ".env" (
    echo [INFO] .env already exists -- skipping copy.
) else (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo [INFO] .env created from .env.example.
    ) else (
        echo [WARN] .env.example not found. Creating a blank .env file.
        type nul > ".env"
    )
    echo [INFO] Edit .env if you want to pre-bake a GEMINI_API_KEY into the build.
    echo [INFO] (The app works without it -- AI features prompt for the key at runtime.)
)

:skip_env

:: ---------------------------------------------------------------------------
:: Step 4 -- Install dependencies
:: ---------------------------------------------------------------------------
echo.
echo [INFO] Installing dependencies...

if not exist "package.json" (
    echo [ERROR] package.json not found.
    echo [ERROR] Make sure you are running this script from the project root.
    echo [ERROR] Expected: cd secure-deployer ^&^& install.bat
    exit /b 1
)

if exist "package-lock.json" (
    echo [INFO] package-lock.json found -- using "npm ci" for reproducible install.
    call npm ci
) else (
    echo [WARN] package-lock.json not found -- falling back to "npm install".
    call npm install
)

if errorlevel 1 (
    echo [ERROR] Dependency installation failed. See errors above.
    exit /b 1
)

echo [INFO] Dependencies installed successfully.

:: ---------------------------------------------------------------------------
:: Step 5 -- Warn about test coverage status
:: ---------------------------------------------------------------------------
echo.
echo ============================================================
echo [INFO] Test Infrastructure Status:
echo.
echo        vitest.config.ts is properly configured.
echo        Test dependencies are installed in package.json.
echo        "npm test" and "npm run test:coverage" scripts exist.
echo        src\tests\setup.ts imports @testing-library/jest-dom.
echo.
echo        However, NO TESTS have been written yet.
echo        "npm test" will pass (no failures) but coverage will be 0%%.
echo.
echo        See docs\GUIDE.md -- Testing section for test-writing guidance.
echo ============================================================
echo.

:: ---------------------------------------------------------------------------
:: Step 6 -- Verify lint and build (optional)
:: ---------------------------------------------------------------------------
if %SKIP_BUILD%==1 goto :skip_build

echo [INFO] Running lint (eslint --max-warnings 0)...
call npm run lint
if errorlevel 1 (
    echo [WARN] Lint reported issues. Fix them before any production push.
    echo [WARN] Continuing with build check...
)

echo.
echo [INFO] Running production build...
call npm run build
if errorlevel 1 (
    echo [ERROR] Build failed. Check TypeScript errors above.
    exit /b 1
)
echo [INFO] Build succeeded. Output is in dist\.

:skip_build

:: ---------------------------------------------------------------------------
:: Print usage / next steps
:: ---------------------------------------------------------------------------
echo.
echo ============================================================
echo  Secure Deployment Runner -- Setup Complete
echo ============================================================
echo.
echo  Available commands:
echo.
echo    npm run dev
echo        Start the development server with hot reload.
echo        Opens at http://localhost:3000
echo.
echo    npm run build
echo        Compile into an optimized production bundle.
echo        Output goes to dist\  (PWA service worker included).
echo.
echo    npm run lint
echo        Run ESLint across all .ts and .tsx files.
echo        Must pass with 0 warnings before any production push.
echo.
echo    npm run preview
echo        Serve the production build at http://localhost:4173
echo        for smoke-testing before deployment.
echo.
echo    npm test
echo        (Currently broken -- see docs\GUIDE.md for the fix.)
echo.
echo  Documentation:
echo    docs\GUIDE.md                -- Full usage guide
echo    docs\PRODUCTION_CHECKLIST.md -- Pre-release checklist
echo    docs\PROCESS.md              -- End-to-end SOP
echo    README.md                    -- Architecture and runbook
echo.
echo ============================================================

endlocal
exit /b 0
