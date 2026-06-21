# Dev Hub

Personal local developer portal. All your tools in one browser tab — sidebar, iframes, no state loss when switching between them. Runs entirely on localhost via a single Docker Compose file.

---

## What it is

A self-hosted dashboard that keeps every dev tool you use (Kafka UI, mock data generator, JSON differ, command snippets, health checks, terminal sessions, ArgoCD, Portainer, etc.) in a persistent iframe. Switching between tools is instant and stateless — the iframe stays mounted in the DOM, only its visibility changes.

---

## Stack

| Layer | Technology |
|---|---|
| Frontends | React + Vite (TypeScript) |
| Backends | Ktor 3 (Kotlin 21) |
| Databases | PostgreSQL 16 |
| Infrastructure | Docker Compose |
| TUIs in browser | ttyd (runs on host) |
| AI inference | Groq (free, llama-3.3-70b) |

---

## Port Convention

Each module gets a consistent `xx` suffix across its services.

| Module | Frontend | Backend | DB |
|---|---|---|---|
| Hub | 10300 | 10303 | 10403 |
| Kafbat+ | 10301 | 10401 | 10501 |
| AI Session Manager | 10302 | 10402 | — |
| JSON Tools | 10306 | 10406 | — |
| Mock Data Generator | 10308 | 10408 | 10508 |
| Command Vault | 10309 | 10409 | 10509 |
| Port Radar | 10310 | 10410 | — |
| Health Dashboard | 10311 | 10411 | — |
| ttyd Manager | — | 10600 | — |
| ttyd TUI sessions | — | — | 10604–10620 (dynamic) |

All ports are bound to `127.0.0.1` only — not exposed on your network.

---

## Running

```bash
./start.sh        # builds everything, starts Docker Compose + ttyd-manager
./stop.sh          # stops everything cleanly
```

Open `http://localhost:10300`.

`start.sh` does: Docker Compose up (all containerized services) + ttyd-manager on the host (so TUIs can use your local binaries and configs like `~/.kube/config`). It installs `ttyd` and Java automatically if missing.

First run seeds the hub with default folders (Infra, Dev, Observabilidade, Tools) and placeholder entries. All own tools are auto-registered — no manual setup needed. Edit or delete any entry in Settings.

---

## First-time setup

Most tools work out of the box. The ones that need config:

| Tool | What to configure | Where |
|---|---|---|
| Kafbat+ | Kafka broker URLs (e.g. `host.docker.internal:29092`) | Hub Settings → Module Configuration, or `POST http://localhost:10401/config` |
| Mock Data Generator | Groq API key (free at [console.groq.com](https://console.groq.com)) | Open Mock Generator → config card, paste your API key |
| AI Session Manager | Path to `.claude` directory | Pre-configured via docker-compose volume mount |
| Backup Scheduler | Backup directory, interval, retention | Hub Settings → Backup Scheduler section |

---

## Project Structure

```
dev-hub/
├── docker-compose.yml
├── start.sh / stop.sh
├── hub/
│   ├── frontend/                   React + Vite — port 10300
│   └── backend/                    Ktor — port 10303 + PostgreSQL 10403
├── kafbat-plus/
│   ├── frontend/                   React + Vite — port 10301
│   └── backend/                    Ktor — port 10401 + PostgreSQL 10501
├── ai-session-manager/
│   ├── frontend/                   React + Vite — port 10302
│   └── backend/                    Ktor — port 10402 (reads ~/.claude + opencode.db)
├── json-tools/
│   ├── frontend/                   React + Vite — port 10306
│   └── backend/                    Ktor — port 10406 (stateless)
├── mock-data-generator/
│   ├── frontend/                   React + Vite — port 10308
│   └── backend/                    Ktor — port 10408 + PostgreSQL 10508
├── command-vault/
│   ├── frontend/                   React + Vite — port 10309
│   └── backend/                    Ktor — port 10409 + PostgreSQL 10509
├── port-radar/
│   ├── frontend/                   React + Vite — port 10310
│   └── backend/                    Ktor — port 10410 (reads host /proc/net)
├── health-dashboard/
│   ├── frontend/                   React + Vite — port 10311
│   └── backend/                    Ktor — port 10411 (proxies health checks)
├── ttyd-manager/                   Ktor — port 10600 (runs on host, not Docker)
└── backend-template/               Ktor starter to copy for new modules
```

---

## Modules

### Hub

The shell. Everything else lives inside it.

**What you can do:**
- Sidebar with collapsible folders, drag-and-drop entries between folders
- All iframes mounted simultaneously — switching never loses state
- Home screen with search and icon grid
- Settings page: CRUD for entries/folders, module config (Kafbat+ brokers), keybinds, multi-palette themes (5 presets + custom colors), backup & restore
- TUI entry creation spawns a ttyd session automatically
- Backup scheduler: auto-backup hub DB on configurable interval with retention policy

**Entry types:**
- `redirect` — any URL opened in an iframe (ArgoCD, Portainer, etc.)
- `tui` — terminal session via ttyd
- `tool` — first-party module (auto-registered)

---

### Kafbat+

Local Kafka UI built from scratch.

**What you can do:**
- Browse all topics with search, see partition count and message count per topic
- View latest messages with syntax-highlighted JSON (auto-collapsed for large payloads)
- Filter messages by value substring, exact key, partition, configurable limit (50/100/200/500)
- Produce messages: JSON editor, drag & drop `.json` file, or "Generate payload" from Mock Generator
- Create and delete topics
- View partition details (leader, replicas, ISR, offsets) and topic-level Kafka configs
- Cluster overview: brokers, controller, total topics/partitions

---

### AI Session Manager

Visual dashboard for Claude Code and OpenCode session usage and spending.

**What you can do:**
- See all sessions across projects, search by title or project
- **Tool filter**: switch between Claude Code, OpenCode, or All — each with its own spending view
- **Model filter**: filter sessions by model (Sonnet, Opus, Haiku, etc.)
- Spending breakdown by model and by project with proportional bars
- Click a session: token summary, distribution bar, duration, cost, turn-by-turn view, MCP tools
- **Cost Tracker tab**: daily/weekly spending bar chart, daily average, monthly projection, detail table by date

**How it works:** reads `~/.claude/projects/` for Claude Code (JSONL files, mounted read-only) and `~/.local/share/opencode/opencode.db` for OpenCode (SQLite). No database of its own.

---

### JSON Tools

Self-hosted JSON utility. Stateless, no DB.

**What you can do:**
- **Format** — prettify JSON with configurable indent, copy button
- **Compact** — minify to single line, shows size reduction %
- **Diff** — structural side-by-side comparison at every JSON path (added/removed/changed), inline line-by-line highlighting (LCS-based), `Ctrl+Enter` to compare
- Drag & drop `.json` files, paste/copy buttons

---

### Mock Data Generator

Generate realistic mock data from real JSON samples using AI-inferred specs.

**How it works:**
1. Paste real JSON samples (+ optional OpenAPI schema or Java DTOs)
2. AI (Groq, free) analyzes samples **once** → structured generation spec
3. Local generator (Python + Faker) produces N records from the spec — zero API cost, reproducible

**What you can do:**
- Infer a spec from samples — captures source types, distributions, patterns, null rates, correlations, referential integrity
- Review and edit every field attribute in an expandable table
- Generate with 3 profiles: `valid`, `invalid` (violates constraints), `edge` (boundary values)
- Export `generate.py` (offline, Faker) and `call_api.py` (REST calls with `auth_util.get_token()`)
- Version history with rollback
- Two-pass generation for referential coherence (foreign keys resolve to real IDs)
- Kafbat+ integration: "Generate payload" button in produce modal

**Config:** set Groq API key in the config card (free at [console.groq.com](https://console.groq.com)).

---

### Command Vault

Personal command/snippet manager with variable substitution.

**What you can do:**
- Save commands with title, the command itself, description, and tags
- Search by text (title/command/description), filter by tags
- **Variable substitution**: commands can have `{namespace}`, `{pod}`, etc. When you click Copy, a form appears asking for each variable's value — with autocomplete from previous values (stored in localStorage). Live preview shows the resolved command with highlighted substitutions before copying
- One-click copy for commands without variables
- Tag badges, tag filter dropdown, distinct tags list

**Examples:**
```
kubectl get pods -n {namespace} | grep {filter}
docker exec -it {container} bash
SELECT * FROM {table} WHERE id = {id} LIMIT {limit};
```

---

### Port Radar

Shows which ports are in use on localhost right now. Stateless, no DB.

**What you can do:**
- See all open ports with PID, process name, protocol, and state
- Portal ports (10300–10620) highlighted and labeled with module name
- **Conflict detection**: warning badge if a portal port is occupied by an unexpected process
- Click any LISTEN port to open `http://localhost:{port}` in a new tab
- Toggle between "All ports" and "Portal only"
- Auto-refresh every 5s

**How it works:** backend reads `/proc/net/tcp` from the host (mounted as `/host/proc` volume).

---

### Health Dashboard

"Is everything up?" at a glance. Stateless, no DB.

**What you can do:**
- Traffic-light grid: green (up), red (down), yellow (degraded) per service
- Response time in ms for each service
- Summary bar: "X/Y services up"
- Auto-refresh: 5s / 10s / 30s / off
- Configurable service list (defaults to all portal backends)

**How it works:** backend pings `/health` on all configured services in parallel (5s timeout), returns aggregated status. Uses Docker service names for containers, `host.docker.internal` for ttyd-manager.

---

### ttyd Manager

Manages terminal sessions exposed as iframes via `ttyd`. Runs natively on the host (not in Docker) so TUIs can use your local binaries and configs (`~/.kube/config`, etc.).

- Spawns `ttyd` processes dynamically, one per TUI
- Each TUI gets a port in the `10604–10620` range
- Add/remove TUIs at runtime via hub Settings
- API: `GET /tuis`, `POST /tuis`, `DELETE /tuis/{id}`

---

## Keyboard Shortcuts

| Default key | Action |
|---|---|
| `Escape` | Go home + focus sidebar |
| `/` | Focus search bar |
| `↑` / `↓` | Cycle through entries |
| `,` | Open settings |
| `1` – `9` | Open entry by slot (configurable) |

All configurable in **Settings → Keyboard Shortcuts**. Supports modifiers (`ctrl+k`, `alt+1`). Quick slots 1–9 remappable to any entry. Custom shortcuts take priority.

---

## Themes

Settings → Appearance: 5 presets (Midnight, Ocean, Forest, Ember, Mono) + Custom with color pickers. Stored in DB, included in config exports.

---

## Settings & Config

Every module exposes `GET /config` and `POST /config`.

### Backup & Restore

- **Config JSON**: `Settings → Backup & Restore → Export/Import config`
- **Database SQL**: `Settings → Backup & Restore → Export/Import database`
- **Backup Scheduler**: `Settings → Backup Scheduler` — auto-backup on interval with retention, manual trigger, backup list

### Recovery after full wipe

```bash
./start.sh
# Open http://localhost:10300 → Settings
# Import config → config-backup.json
# Import database → hub-db-YYYY-MM-DD.sql
```

---

## Adding a New Module

1. `cp -r backend-template/ <module>/backend/`
2. `cd <module> && npm create vite@latest frontend -- --template react-ts`
3. Assign next free `xx` suffix (frontend `103xx`, backend `104xx`, DB `105xx`)
4. Implement: `GET /health`, `GET/POST /config`, `GET/POST /config/export`, `GET/POST /config/import`, `GET/POST /db/export` (if DB)
5. Add to `docker-compose.yml`
6. Add seed entry in `hub/backend/.../Database.kt`

---

## Development

```bash
# Frontend hot reload
cd <module>/frontend && npm install && npm run dev

# Backend local run
cd <module>/backend && ./gradlew run

# Build fat jar
cd <module>/backend && ./gradlew shadowJar
```

---

## Roadmap

- [x] Hub — sidebar, iframes, state preservation, drag-and-drop
- [x] Keybinds, themes, favicon auto-fetch
- [x] Export / import config + database
- [x] Backup Scheduler — auto-backup with retention
- [x] Kafbat+ — Kafka topic browser, message viewer, producer
- [x] AI Session Manager — session scanner, spending tracker, cost projection
- [x] JSON Tools — format, compact, structural diff
- [x] Mock Data Generator — AI-inferred specs, Faker generation, Kafbat+ integration
- [x] Command Vault — snippet manager with `{variable}` substitution
- [x] Port Radar — live port scanner with conflict detection
- [x] Health Dashboard — traffic-light health checks
- [x] ttyd Manager — dynamic TUI spawning on host
- [ ] RTK Helper — `filters.toml` editor with versioned backups
- [ ] GitLab MR Dashboard — personal MR overview
- [ ] Hub-level aggregated backup (all modules in one zip)
