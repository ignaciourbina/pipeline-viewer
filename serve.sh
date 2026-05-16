#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PORT="${1:-8765}"
cd "$HERE/dist"
echo "serving $HERE/dist on http://localhost:$PORT (index.html = dynamic, viewer.html = static)"
exec python3 -m http.server "$PORT"
