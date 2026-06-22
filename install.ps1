#Requires -Version 5.1
<#
.SYNOPSIS
    Secure Deployment Runner — PowerShell installation script.

.DESCRIPTION
    Sets up the Secure Deployment Runner development environment on Windows.
    Checks Node.js 20+, creates the .env file, installs npm dependencies via
    npm ci, warns about the broken vitest.config.ts, and optionally runs lint
    and a production build to verify the environment.

.PARAMETER SkipEnv
    Skip .env file creation.

.PARAMETER SkipBuild
    Skip the lint and build verification step.

.EXAMPLE
    .\install.ps1

.EXAMPLE
    .\install.ps1 -SkipBuild

.EXAMPLE
    .\install.ps1 -SkipEnv -SkipBuild
#>

[CmdletBinding()]
param(
    [switch]$SkipEnv,
    [switch]$SkipBuild
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Colour / output helpers
# ---------------------------------------------------------------------------
function Write-Info   { param([string]$Message) Write-Host "[INFO]  $Message" -ForegroundColor Green }
function Write-Warn   { param([string]$Message) Write-Host "[WARN]  $Message" -ForegroundColor Yellow }
function Write-Err    { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red }
function Write-Header { param([string]$Message) Write-Host "`n==> $Message" -ForegroundColor Cyan }
function Write-Divider { Write-Host ("=" * 60) }

# ---------------------------------------------------------------------------
# Step 1 — Node.js version check (requires 20+)
# ---------------------------------------------------------------------------
function Test-Node {
    Write-Header "Checking Node.js version"

    $nodeCmd = Get-Command 'node' -ErrorAction SilentlyContinue
    if (-not $nodeCmd) {
        Write-Err "Node.js is not installed or not on PATH."
        Write-Err "Install Node.js 20 LTS from: https://nodejs.org/en/download/"
        Write-Err "After installing, restart PowerShell and re-run this script."
        exit 1
    }

    $nodeVersion = & node --version 2>&1
    # Version string is like "v20.18.0" — strip the leading 'v'
    $versionString = $nodeVersion -replace '^v', ''
    $parts = $versionString.Split('.')
    $majorVersion = [int]$parts[0]

    if ($majorVersion -lt 20) {
        Write-Err "Node.js $nodeVersion is installed, but version 20 or higher is required."
        Write-Err "Upgrade from: https://nodejs.org/en/download/"
        Write-Err "Or use a version manager: nvm-windows, fnm, or volta."
        exit 1
    }

    Write-Info "Node.js $nodeVersion detected (>= 20 required) -- OK"
}

# ---------------------------------------------------------------------------
# Step 2 — npm version check (recommends 10+)
# ---------------------------------------------------------------------------
function Test-Npm {
    Write-Header "Checking npm version"

    $npmCmd = Get-Command 'npm' -ErrorAction SilentlyContinue
    if (-not $npmCmd) {
        Write-Err "npm is not installed. It should be bundled with Node.js."
        Write-Err "Reinstall Node.js from https://nodejs.org/"
        exit 1
    }

    $npmVersion = & npm --version 2>&1
    $npmMajor = [int]($npmVersion.Split('.')[0])

    if ($npmMajor -lt 10) {
        Write-Warn "npm $npmVersion detected. npm 10+ is recommended."
        Write-Warn "Upgrade with: npm install -g npm@latest"
        Write-Warn "Continuing anyway..."
    } else {
        Write-Info "npm $npmVersion detected (>= 10 recommended) -- OK"
    }
}

# ---------------------------------------------------------------------------
# Step 3 — Environment setup
# ---------------------------------------------------------------------------
function Initialize-Env {
    Write-Header "Setting up environment"

    if (Test-Path ".env") {
        Write-Info ".env already exists -- skipping copy."
    } elseif (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Info ".env created from .env.example."
        Write-Info "Edit .env if you want to pre-bake a GEMINI_API_KEY into the build."
        Write-Info "(The app works without it -- AI features prompt for the key at runtime.)"
    } else {
        Write-Warn ".env.example not found. Creating a blank .env file."
        New-Item -ItemType File -Path ".env" -Force | Out-Null
        Write-Info "Blank .env created."
    }
}

# ---------------------------------------------------------------------------
# Step 4 — Install npm dependencies
# ---------------------------------------------------------------------------
function Install-Dependencies {
    Write-Header "Installing dependencies"

    if (-not (Test-Path "package.json")) {
        Write-Err "package.json not found."
        Write-Err "Make sure you are running this script from the project root."
        Write-Err "Expected: cd secure-deployer; .\install.ps1"
        exit 1
    }

    if (Test-Path "package-lock.json") {
        Write-Info "package-lock.json found -- using 'npm ci' for reproducible install."
        & npm ci
    } else {
        Write-Warn "package-lock.json not found -- falling back to 'npm install'."
        Write-Warn "Consider committing package-lock.json for reproducible builds."
        & npm install
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Err "Dependency installation failed (exit code $LASTEXITCODE). See errors above."
        exit 1
    }

    Write-Info "Dependencies installed successfully."
}

# ---------------------------------------------------------------------------
# Step 5 — Warn about broken vitest.config.ts
# ---------------------------------------------------------------------------
function Show-TestWarning {
    Write-Header "Test harness status"

    Write-Divider
    Write-Warn "IMPORTANT: The test harness is not yet functional."
    Write-Host ""
    Write-Warn "vitest.config.ts exists but is missing required fields:"
    Write-Warn "  - environment: 'jsdom'   (needed to run React component tests)"
    Write-Warn "  - globals: true          (needed for describe/it/expect without imports)"
    Write-Warn "  - setupFiles             (needed for @testing-library/react cleanup)"
    Write-Host ""
    Write-Warn "In addition, test dependencies (vitest, jsdom, @testing-library/react)"
    Write-Warn "are not in package.json, and no 'test' script exists yet."
    Write-Host ""
    Write-Warn "Running 'npm test' will fail until these issues are resolved."
    Write-Warn "See docs\GUIDE.md -- Testing section for the full fix."
    Write-Divider
}

# ---------------------------------------------------------------------------
# Step 6 — Verify lint and build
# ---------------------------------------------------------------------------
function Invoke-Verification {
    Write-Header "Verifying lint and build"

    Write-Info "Running lint (eslint --max-warnings 0)..."
    & npm run lint

    if ($LASTEXITCODE -ne 0) {
        Write-Warn "Lint reported issues. Fix them before any production push."
        Write-Warn "Continuing with build check..."
    } else {
        Write-Info "Lint passed -- 0 errors, 0 warnings."
    }

    Write-Host ""
    Write-Info "Running production build..."
    & npm run build

    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed (exit code $LASTEXITCODE). Check TypeScript errors above."
        exit 1
    }

    Write-Info "Build succeeded. Output is in dist\."
}

# ---------------------------------------------------------------------------
# Print next steps / usage
# ---------------------------------------------------------------------------
function Write-Usage {
    Write-Divider
    Write-Host ""
    Write-Host "Secure Deployment Runner -- Setup Complete" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Available commands:" -ForegroundColor White
    Write-Host ""
    Write-Host "  npm run dev" -ForegroundColor Green
    Write-Host "      Start the development server with hot reload."
    Write-Host "      Opens at http://localhost:3000"
    Write-Host ""
    Write-Host "  npm run build" -ForegroundColor Green
    Write-Host "      Compile TypeScript + React into an optimized production bundle."
    Write-Host "      Output goes to dist\  (PWA service worker included)."
    Write-Host ""
    Write-Host "  npm run lint" -ForegroundColor Green
    Write-Host "      Run ESLint across all .ts and .tsx files."
    Write-Host "      Must pass with 0 warnings before any production push."
    Write-Host ""
    Write-Host "  npm run preview" -ForegroundColor Green
    Write-Host "      Serve the production build at http://localhost:4173"
    Write-Host "      for smoke-testing before deployment."
    Write-Host ""
    Write-Host "  npm test" -ForegroundColor Yellow
    Write-Host "      (Currently broken -- see docs\GUIDE.md for the fix required"
    Write-Host "       before tests can run.)"
    Write-Host ""
    Write-Host "Documentation:" -ForegroundColor White
    Write-Host "  docs\GUIDE.md                -- Full usage guide"
    Write-Host "  docs\PRODUCTION_CHECKLIST.md -- Pre-release checklist"
    Write-Host "  docs\PROCESS.md              -- End-to-end SOP"
    Write-Host "  README.md                    -- Architecture and runbook"
    Write-Host ""
    Write-Divider
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
function Main {
    Write-Header "Secure Deployment Runner -- Installation"
    Write-Info "Running from: $(Get-Location)"
    Write-Divider

    Test-Node
    Test-Npm

    if (-not $SkipEnv) {
        Initialize-Env
    }

    Install-Dependencies
    Show-TestWarning

    if (-not $SkipBuild) {
        Invoke-Verification
    }

    Write-Usage
}

Main
