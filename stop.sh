#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
TTYD_PID_FILE="$DIR/.ttyd-manager.pid"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[dev-hub]${NC} $1"; }

# ── Stop ttyd-manager ─────────────────────────────────────────────────────────
if [ -f "$TTYD_PID_FILE" ]; then
    PID=$(cat "$TTYD_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        log "Stopping ttyd-manager (PID $PID)..."
        kill "$PID" 2>/dev/null || true
        # Also kill any ttyd child processes it spawned
        pkill -P "$PID" 2>/dev/null || true
    fi
    rm -f "$TTYD_PID_FILE"
else
    # Try to find and kill it anyway
    pkill -f "ttyd-manager-all.jar" 2>/dev/null || true
fi

# Kill any orphan ttyd processes on our port range
for port in $(seq 10604 10620); do
    pid=$(lsof -ti ":$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null || true
    fi
done

# ── Docker Compose ────────────────────────────────────────────────────────────
log "Stopping Docker Compose services..."
docker compose down

log "All services stopped."
