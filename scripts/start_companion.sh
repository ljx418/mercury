#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/services/local-runtime"
VENV_PYTHON="$APP_DIR/.venv/bin/python"
CONFIG_PATH="${NAVIA_COMPANION_CONFIG:-$HOME/.navia/companion.json}"
EXTENSION_ID="${1:-}"

if [[ -x "$VENV_PYTHON" ]]; then
  PYTHON="$VENV_PYTHON"
else
  PYTHON="$(command -v python3)"
fi

export PYTHONPATH="$APP_DIR${PYTHONPATH:+:$PYTHONPATH}"

if [[ -n "$EXTENSION_ID" ]]; then
  "$PYTHON" -m navia_runtime.companion \
    --config "$CONFIG_PATH" \
    --install-extension-id "$EXTENSION_ID"
elif [[ ! -f "$CONFIG_PATH" ]]; then
  echo "Navia Companion has not been paired with the Chrome extension." >&2
  echo "Run the Windows 'Navia Runtime' shortcut to complete the one-time setup." >&2
  exit 2
fi

PORT="$("$PYTHON" - "$CONFIG_PATH" <<'PY'
import sys
from pathlib import Path

from navia_runtime.companion import read_config

print(read_config(Path(sys.argv[1]))["port"])
PY
)"

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to clean port $PORT, but it was not found." >&2
  exit 1
fi

PIDS="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
if [[ -n "$PIDS" ]]; then
  echo "Stopping the existing Runtime on 127.0.0.1:$PORT: $PIDS"
  kill $PIDS 2>/dev/null || true
  for _ in {1..30}; do
    sleep 0.1
    REMAINING="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
    [[ -z "$REMAINING" ]] && break
  done
  REMAINING="$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)"
  if [[ -n "$REMAINING" ]]; then
    echo "Force stopping process(es) still listening on $PORT: $REMAINING"
    kill -9 $REMAINING 2>/dev/null || true
  fi
fi

cd "$ROOT_DIR"
echo "Starting the paired Navia Companion at http://127.0.0.1:$PORT"
exec "$PYTHON" -m navia_runtime.companion --config "$CONFIG_PATH"
