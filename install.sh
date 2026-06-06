#!/usr/bin/env sh
# install.sh — Secure Deployment Runner setup script (POSIX sh)
# Works on macOS, Linux, and WSL.
# Usage: sh install.sh [--skip-env]

set -e

# ---------------------------------------------------------------------------
# Colour helpers (fall back gracefully if terminal doesn't support them)
# ---------------------------------------------------------------------------
RED=''
GREEN=''
YELLOW=''
BOLD=''
RESET=''

if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  RESET='\033[0m'
fi

info()    { printf "%s[INFO]%s  %s\n"  "$GREEN"  "$RESET" "$*"; }
warn()    { printf "%s[WARN]%s  %s\n"  "$YELLOW" "$RESET" "$*"; }
error()   { printf "%s[ERROR]%s %s\n"  "$RED"    "$RESET" "$*" >&2; }
header()  { printf "\n%s==> %s%s\n"   "$BOLD"   "$*" "$RESET"; }
divider() { printf "%s\n" "------------------------------------------------------------"; }

# ---------------------------------------------------------------------------
# Step 1 — Node.js version check (requires 20+)
# ---------------------------------------------------------------------------
check_node() {
  header "Checking Node.js version"

  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is not installed or not on PATH."
    error "Install Node.js 20 LTS from https://nodejs.org/en/download/"
    error "or use a version manager: nvm, fnm, or volta."
    exit 1
  fi

  NODE_VERSION="$(node --version)"
  # Strip leading 'v' and extract major version number
  NODE_MAJOR="$(echo "$NODE_VERSION" | sed 's/^v//' | cut -d'.' -f1)"

  if [ "$NODE_MAJOR" -lt 20 ]; then
    error "Node.js $NODE_VERSION is installed, but version 20 or higher is required."
    error "Upgrade via: https://nodejs.org/en/download/ or use nvm/fnm/volta."
    exit 1
  fi

  info "Node.js $NODE_VERSION detected (>= 20 required) -- OK"
}

# ---------------------------------------------------------------------------
# Step 2 — npm version check (requires 10+)
# ---------------------------------------------------------------------------
check_npm() {
  header "Checking npm version"

  if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed. It should ship with Node.js."
    error "Try: node --version, then reinstall Node.js from nodejs.org."
    exit 1
  fi

  NPM_VERSION="$(npm --version)"
  NPM_MAJOR="$(echo "$NPM_VERSION" | cut -d'.' -f1)"

  if [ "$NPM_MAJOR" -lt 10 ]; then
    warn "npm $NPM_VERSION detected. npm 10+ is recommended."
    warn "Upgrade with: npm install -g npm@latest"
    warn "Continuing anyway..."
  else
    info "npm $NPM_VERSION detected (>= 10 recommended) -- OK"
  fi
}

# ---------------------------------------------------------------------------
# Step 3 — Environment setup
# ---------------------------------------------------------------------------
setup_env() {
  header "Setting up environment"

  if [ -f ".env" ]; then
    info ".env already exists -- skipping copy."
  else
    if [ -f ".env.example" ]; then
      cp .env.example .env
      info ".env created from .env.example."
    else
      warn ".env.example not found. Creating a blank .env file."
      touch .env
    fi
    info "Edit .env if you want to pre-bake a GEMINI_API_KEY into the build."
    info "(The app works without it -- AI features prompt for the key at runtime.)"
  fi
}

# ---------------------------------------------------------------------------
# Step 4 — Install dependencies
# ---------------------------------------------------------------------------
install_deps() {
  header "Installing dependencies (npm ci)"

  if [ ! -f "package.json" ]; then
    error "package.json not found. Are you in the project root?"
    error "Run: cd secure-deployer && sh install.sh"
    exit 1
  fi

  if [ -f "package-lock.json" ]; then
    info "package-lock.json found -- using 'npm ci' for reproducible install."
    npm ci
  else
    warn "package-lock.json not found -- falling back to 'npm install'."
    warn "Consider committing package-lock.json for reproducible builds."
    npm install
  fi

  info "Dependencies installed successfully."
}

# ---------------------------------------------------------------------------
# Step 5 — Warn about broken vitest.config.ts before running tests
# ---------------------------------------------------------------------------
warn_broken_tests() {
  header "Test harness status"

  divider
  warn "IMPORTANT: The test harness is not yet functional."
  warn ""
  warn "vitest.config.ts exists but is missing required fields:"
  warn "  - environment: 'jsdom'   (needed to run React component tests)"
  warn "  - globals: true          (needed for describe/it/expect without imports)"
  warn "  - setupFiles             (needed for @testing-library/react cleanup)"
  warn ""
  warn "In addition, test dependencies (vitest, jsdom, @testing-library/react)"
  warn "are not in package.json, and no 'test' script exists yet."
  warn ""
  warn "Running 'npm test' will fail until these issues are resolved."
  warn "See docs/GUIDE.md -- Testing section for the full fix."
  divider
}

# ---------------------------------------------------------------------------
# Step 6 — Verify the build passes
# ---------------------------------------------------------------------------
verify_build() {
  header "Verifying lint and build"

  info "Running lint (eslint --max-warnings 0)..."
  if npm run lint; then
    info "Lint passed -- 0 errors, 0 warnings."
  else
    error "Lint failed. Fix the reported issues before running the app in production."
    error "For development, you can continue with 'npm run dev' despite lint errors."
  fi

  info "Running production build..."
  if npm run build; then
    info "Build succeeded. Output is in dist/."
  else
    error "Build failed. Check the TypeScript errors reported above."
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Print usage / next steps
# ---------------------------------------------------------------------------
print_usage() {
  divider
  printf "\n"
  printf "%sSecure Deployment Runner — Setup Complete%s\n" "$BOLD" "$RESET"
  printf "\n"
  printf "Available commands:\n"
  printf "\n"
  printf "  %snpm run dev%s\n" "$GREEN" "$RESET"
  printf "      Start the development server with hot reload.\n"
  printf "      Opens at http://localhost:3000\n"
  printf "\n"
  printf "  %snpm run build%s\n" "$GREEN" "$RESET"
  printf "      Compile TypeScript + React into an optimized production bundle.\n"
  printf "      Output goes to dist/ (PWA service worker included).\n"
  printf "\n"
  printf "  %snpm run lint%s\n" "$GREEN" "$RESET"
  printf "      Run ESLint across all .ts and .tsx files.\n"
  printf "      Must pass with 0 warnings before any production push.\n"
  printf "\n"
  printf "  %snpm run preview%s\n" "$GREEN" "$RESET"
  printf "      Serve the production build locally at http://localhost:4173\n"
  printf "      for smoke-testing before deployment.\n"
  printf "\n"
  printf "  %snpm test%s\n" "$YELLOW" "$RESET"
  printf "      (Currently broken -- see docs/GUIDE.md for the fix required\n"
  printf "       before tests can run.)\n"
  printf "\n"
  printf "Documentation:\n"
  printf "  docs/GUIDE.md                -- Full usage guide\n"
  printf "  docs/PRODUCTION_CHECKLIST.md -- Pre-release checklist\n"
  printf "  docs/PROCESS.md              -- End-to-end SOP\n"
  printf "  README.md                    -- Architecture and runbook\n"
  printf "\n"
  divider
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  SKIP_ENV=0
  SKIP_BUILD=0

  for arg in "$@"; do
    case "$arg" in
      --skip-env)   SKIP_ENV=1 ;;
      --skip-build) SKIP_BUILD=1 ;;
    esac
  done

  header "Secure Deployment Runner — Installation"
  info "Running from: $(pwd)"
  divider

  check_node
  check_npm

  if [ "$SKIP_ENV" = "0" ]; then
    setup_env
  fi

  install_deps
  warn_broken_tests

  if [ "$SKIP_BUILD" = "0" ]; then
    verify_build
  fi

  print_usage
}

main "$@"
