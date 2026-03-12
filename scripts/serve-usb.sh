#!/usr/bin/env bash
# Secure Deployment Runner - USB / Portable Mode Launcher (macOS / Linux)
# Usage: bash scripts/serve-usb.sh [port]

set -e

PORT="${1:-3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$SCRIPT_DIR/../dist"

echo "============================================================"
echo "  Secure Deployment Runner - USB / Portable Mode"
echo "============================================================"
echo ""
echo "  Serving from: $DIST"
echo "  Access at:    http://localhost:$PORT"
echo ""
echo "  Press Ctrl+C to stop the server."
echo "============================================================"
echo ""

# Check dist exists
if [ ! -f "$DIST/index.html" ]; then
    echo "[ERROR] dist/index.html not found."
    echo "        Run 'npm run build' first, then copy the dist/ folder here."
    exit 1
fi

cd "$DIST"

# Try Python 3
if command -v python3 &>/dev/null; then
    echo "[OK] Using Python3 to serve..."
    # Open browser
    (sleep 1 && (open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true)) &
    python3 -m http.server "$PORT"
    exit 0
fi

# Try Python 2
if command -v python &>/dev/null; then
    echo "[OK] Using Python to serve..."
    (sleep 1 && (open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null || true)) &
    python -m SimpleHTTPServer "$PORT"
    exit 0
fi

# Try npx serve
if command -v npx &>/dev/null; then
    echo "[OK] Using npx serve..."
    npx serve . -p "$PORT" --single
    exit 0
fi

echo "[ERROR] No suitable HTTP server found."
echo "        Install Python 3: https://www.python.org/downloads/"
echo "        Or install Node.js: https://nodejs.org/"
exit 1
