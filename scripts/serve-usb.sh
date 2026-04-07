#!/usr/bin/env bash
# ============================================================
#  Secure Deployment Runner — USB Portable Launcher (Linux/macOS)
#  Serves the built dist/ folder on port 3000.
#  No installation required (uses Python 3).
#
#  Usage: bash scripts/serve-usb.sh
#  Requires: dist/ folder in the repo root
# ============================================================

set -euo pipefail

PORT=3000
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/../dist"

if [ ! -d "$DIST_DIR" ]; then
    echo "[ERROR] dist/ folder not found at: $DIST_DIR"
    echo "        Run 'npm run build' first to generate dist/."
    exit 1
fi

DIST_ABS="$(cd "$DIST_DIR" && pwd)"

echo "============================================================"
echo "  Secure Deployment Runner - USB Portable Launcher"
echo "============================================================"
echo "  Serving: $DIST_ABS"
echo "  Port   : $PORT"
echo "  URL    : http://localhost:$PORT"
echo "============================================================"
echo ""

# Open browser in background (best-effort; not all environments support this)
if command -v xdg-open &>/dev/null; then
    (sleep 1 && xdg-open "http://localhost:$PORT") &
elif command -v open &>/dev/null; then
    (sleep 1 && open "http://localhost:$PORT") &
fi

echo "[INFO] Press Ctrl+C to stop the server."
echo ""

python3 -m http.server "$PORT" --directory "$DIST_ABS"
