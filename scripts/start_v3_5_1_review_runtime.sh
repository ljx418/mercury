#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/services/local-runtime"
PRIVATE_ROOT="$HOME/.navia/private/v3-5.1-production-candidate-20261010T210000Z-workspace"
CONFIG_PATH="${NAVIA_COMPANION_CONFIG:-$HOME/.navia/companion.json}"

if [[ ! -f "$PRIVATE_ROOT/workspace.sqlite3" ]]; then
  echo "The fixed V3-5.1 review database is unavailable: $PRIVATE_ROOT/workspace.sqlite3" >&2
  exit 2
fi

export NAVIA_DB_PATH="$PRIVATE_ROOT/workspace.sqlite3"
export NAVIA_MEDIA_TASK_ROOT="$PRIVATE_ROOT"
export NAVIA_COMPANION_CONFIG="$CONFIG_PATH"
exec "$ROOT_DIR/scripts/start_companion.sh"
