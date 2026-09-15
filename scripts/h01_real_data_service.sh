#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${NAVIA_H01_STATE_DIR:-$ROOT_DIR/.navia/h01-real-data-service}"
DATA_SERVICE_REPO="${NAVIA_DATA_SERVICE_REPO:-$(cd "$ROOT_DIR/.." && pwd)/data_service}"
DATA_SERVICE_BACKEND="$DATA_SERVICE_REPO/backend"
DATA_SERVICE_HOST="${NAVIA_DATA_SERVICE_HOST:-127.0.0.1}"
DATA_SERVICE_PORT="${NAVIA_DATA_SERVICE_PORT:-8003}"
DATA_SERVICE_ROOT="${NAVIA_DATA_SERVICE_WORKSPACE_ROOT:-$STATE_DIR/workspaces}"
RUNTIME_HOST="${NAVIA_RUNTIME_HOST:-127.0.0.1}"
RUNTIME_PORT="${NAVIA_RUNTIME_PORT:-17861}"
ACTION="${1:-status}"

data_service_pid_file="$STATE_DIR/data-service.pid"
runtime_pid_file="$STATE_DIR/runtime.pid"

is_running() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(<"$pid_file")" 2>/dev/null
}

stop_pid() {
  local pid_file="$1"
  local label="$2"
  if ! is_running "$pid_file"; then
    rm -f "$pid_file"
    return
  fi
  local pid
  pid="$(<"$pid_file")"
  echo "Stopping $label (pid $pid)"
  kill "$pid" 2>/dev/null || true
  for _ in {1..50}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.1
  done
  if kill -0 "$pid" 2>/dev/null; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$pid_file"
}

assert_port_free() {
  local port="$1"
  local label="$2"
  if command -v lsof >/dev/null 2>&1 && lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "$label cannot start: port $port is already in use by a process not owned by this launcher." >&2
    echo "Stop that process explicitly, then rerun: $0 start" >&2
    exit 1
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  for _ in {1..100}; do
    if curl --fail --silent --show-error --max-time 1 "$url" >/dev/null 2>&1; then
      return
    fi
    sleep 0.1
  done
  echo "$label did not become ready. Inspect $STATE_DIR/${label}.log" >&2
  return 1
}

status() {
  local failed=0
  if is_running "$data_service_pid_file"; then
    echo "data_service: running (pid $(<"$data_service_pid_file"), http://$DATA_SERVICE_HOST:$DATA_SERVICE_PORT)"
  else
    echo "data_service: stopped"
    failed=1
  fi
  if is_running "$runtime_pid_file"; then
    echo "Navia Runtime: running (pid $(<"$runtime_pid_file"), http://$RUNTIME_HOST:$RUNTIME_PORT)"
  else
    echo "Navia Runtime: stopped"
    failed=1
  fi
  if [[ "$failed" -eq 0 ]]; then
    curl --fail --silent --show-error "http://$RUNTIME_HOST:$RUNTIME_PORT/v1/knowledge/status"
    printf '\n'
  fi
  return "$failed"
}

start() {
  if [[ ! -f "$DATA_SERVICE_BACKEND/app/main.py" ]]; then
    echo "data_service backend not found at $DATA_SERVICE_BACKEND" >&2
    echo "Set NAVIA_DATA_SERVICE_REPO to the local data_service repository." >&2
    exit 1
  fi
  command -v uvicorn >/dev/null 2>&1 || { echo "uvicorn is required." >&2; exit 1; }
  command -v curl >/dev/null 2>&1 || { echo "curl is required." >&2; exit 1; }
  mkdir -p "$STATE_DIR" "$DATA_SERVICE_ROOT"
  if is_running "$data_service_pid_file" || is_running "$runtime_pid_file"; then
    echo "H01 real-data services are already running. Use '$0 restart' to replace them."
    status
    return
  fi
  rm -f "$data_service_pid_file" "$runtime_pid_file"
  assert_port_free "$DATA_SERVICE_PORT" "data_service"
  assert_port_free "$RUNTIME_PORT" "Navia Runtime"

  echo "Starting data_service at http://$DATA_SERVICE_HOST:$DATA_SERVICE_PORT"
  nohup env \
    PYTHONPATH="$DATA_SERVICE_BACKEND${PYTHONPATH:+:$PYTHONPATH}" \
    DATA_SERVICE_REQUIRE_API_KEY=0 \
    DATA_SERVICE_WORKSPACE_ROOT="$DATA_SERVICE_ROOT" \
    DATA_SERVICE_ALLOWED_WORKSPACE_ROOTS="$DATA_SERVICE_ROOT" \
    uvicorn app.main:app --host "$DATA_SERVICE_HOST" --port "$DATA_SERVICE_PORT" --app-dir "$DATA_SERVICE_BACKEND" \
    >"$STATE_DIR/data_service.log" 2>&1 </dev/null &
  echo $! >"$data_service_pid_file"
  if ! wait_for_url "http://$DATA_SERVICE_HOST:$DATA_SERVICE_PORT/api/workspaces?limit=1" "data_service"; then
    stop_pid "$data_service_pid_file" "data_service"
    exit 1
  fi

  echo "Starting Navia Runtime with the real data_service adapter at http://$RUNTIME_HOST:$RUNTIME_PORT"
  nohup env \
    PYTHONPATH="$ROOT_DIR/services/local-runtime${PYTHONPATH:+:$PYTHONPATH}" \
    NAVIA_KNOWLEDGE_ADAPTER=data_service \
    NAVIA_DATA_SERVICE_URL="http://$DATA_SERVICE_HOST:$DATA_SERVICE_PORT" \
    uvicorn navia_runtime.app:app --host "$RUNTIME_HOST" --port "$RUNTIME_PORT" --app-dir "$ROOT_DIR/services/local-runtime" \
    >"$STATE_DIR/runtime.log" 2>&1 </dev/null &
  echo $! >"$runtime_pid_file"
  if ! wait_for_url "http://$RUNTIME_HOST:$RUNTIME_PORT/v1/knowledge/status" "runtime"; then
    stop_pid "$runtime_pid_file" "Navia Runtime"
    stop_pid "$data_service_pid_file" "data_service"
    exit 1
  fi

  status
  echo "Logs: $STATE_DIR/data_service.log and $STATE_DIR/runtime.log"
}

stop() {
  stop_pid "$runtime_pid_file" "Navia Runtime"
  stop_pid "$data_service_pid_file" "data_service"
}

foreground() {
  start
  trap 'stop' EXIT INT TERM
  echo "Supervising H01 real-data services. Press Ctrl+C to stop both processes."
  while is_running "$data_service_pid_file" && is_running "$runtime_pid_file"; do
    sleep 1
  done
  echo "A supervised H01 service exited unexpectedly." >&2
  return 1
}

case "$ACTION" in
  start) start ;;
  stop) stop ;;
  restart) stop; start ;;
  foreground) foreground ;;
  status) status ;;
  *) echo "Usage: $0 {start|stop|restart|foreground|status}" >&2; exit 2 ;;
esac
