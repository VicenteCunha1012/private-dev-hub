#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
TTYD_JAR="$DIR/ttyd-manager/build/libs/ttyd-manager-all.jar"
TTYD_PID_FILE="$DIR/.ttyd-manager.pid"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[dev-hub]${NC} $1"; }
warn() { echo -e "${YELLOW}[dev-hub]${NC} $1"; }
info() { echo -e "${CYAN}[dev-hub]${NC} $1"; }

# ── Ensure Java is installed ──────────────────────────────────────────────────
if ! command -v java &>/dev/null; then
    warn "Java not found — installing JDK 21..."
    sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-21-jre-headless
    log "Java installed"
else
    log "Java: $(java -version 2>&1 | head -1)"
fi

# ── Ensure Docker is running ─────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo "Docker is not installed. Install it first: https://docs.docker.com/engine/install/"
    exit 1
fi
if ! docker info &>/dev/null; then
    echo "Docker daemon is not running. Start it first."
    exit 1
fi
log "Docker: OK"

# ── Ensure ttyd is installed ──────────────────────────────────────────────────
if ! command -v ttyd &>/dev/null; then
    warn "ttyd not found — installing..."
    ARCH=$(uname -m)
    case "$ARCH" in
        x86_64)  TTYD_BIN="ttyd.x86_64" ;;
        aarch64) TTYD_BIN="ttyd.aarch64" ;;
        *)       echo "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
    sudo curl -fsSL -o /usr/local/bin/ttyd \
        "https://github.com/tsl0922/ttyd/releases/download/1.7.7/$TTYD_BIN"
    sudo chmod +x /usr/local/bin/ttyd
    log "ttyd installed"
else
    log "ttyd: $(ttyd --version 2>&1 | head -1)"
fi

# ── Build ttyd-manager jar if missing ─────────────────────────────────────────
if [ ! -f "$TTYD_JAR" ]; then
    info "Building ttyd-manager (first time only)..."
    (cd "$DIR/ttyd-manager" && ./gradlew shadowJar --no-daemon -x test -q)
    log "ttyd-manager built"
else
    log "ttyd-manager jar: cached"
fi

# ── Stop anything already running ─────────────────────────────────────────────
if [ -f "$TTYD_PID_FILE" ]; then
    OLD_PID=$(cat "$TTYD_PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
        warn "Stopping previous ttyd-manager (PID $OLD_PID)..."
        kill "$OLD_PID" 2>/dev/null || true
        sleep 1
    fi
    rm -f "$TTYD_PID_FILE"
fi

# ── Global git pre-push hook ────────────────────────────────────────────────
HOOKS_DIR="$HOME/.git-hooks"
HOOK_FILE="$HOOKS_DIR/pre-push"
CURRENT_HOOKS_PATH=$(git config --global core.hooksPath 2>/dev/null || echo "")

if [ -n "$CURRENT_HOOKS_PATH" ] && [ "$CURRENT_HOOKS_PATH" != "$HOOKS_DIR" ]; then
    warn "core.hooksPath already set to '$CURRENT_HOOKS_PATH' — skipping hook install"
else
    mkdir -p "$HOOKS_DIR"
    cat > "$HOOK_FILE" << 'HOOK_EOF'
#!/usr/bin/env bash
# Dev Hub: notify hub of git push (non-blocking, never fails the push)
(curl -sS -m 2 -X POST http://localhost:10303/events/git-push \
  -H 'Content-Type: application/json' \
  -d '{"type":"git-push"}' >/dev/null 2>&1 &)
exit 0
HOOK_EOF
    chmod +x "$HOOK_FILE"
    git config --global core.hooksPath "$HOOKS_DIR"
    log "Git pre-push hook installed ($HOOKS_DIR)"
fi

# ── Docker Compose ────────────────────────────────────────────────────────────
log "Starting Docker Compose services..."
docker compose up --build -d

# ── ttyd-manager (native on host) ────────────────────────────────────────────
log "Starting ttyd-manager on host (port 10600)..."
java -jar "$TTYD_JAR" &
TTYD_PID=$!
echo "$TTYD_PID" > "$TTYD_PID_FILE"

log "ttyd-manager running (PID $TTYD_PID)"
echo ""
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
info "  Hub:                http://localhost:10300"
info "  Kafbat+:            http://localhost:10301"
info "  AI Sessions:        http://localhost:10302"
info "  JSON Tools:         http://localhost:10306"
info "  Mock Generator:     http://localhost:10308"
info "  Command Vault:      http://localhost:10309"
info "  Port Radar:         http://localhost:10310"
info "  Health Dashboard:   http://localhost:10311"
info "  ttyd Manager:       http://localhost:10600"
info "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
log "All services started. Open http://localhost:10300"
