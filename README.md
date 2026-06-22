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
| Kafbat+ | Kafka cluster(s) — broker URLs | Hub Settings → Module Configuration → Add/edit clusters |
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
- All iframes pre-loaded on page load — switching is instant with zero state loss
- **Tiling window manager**: drag an entry onto an open iframe to split the view. Drop on left/right half for side-by-side, drop on a corner for 2×2 grid. Close panes with X. Drag to center of a pane to replace it. Clicking sidebar entries replaces the focused pane
- **Spotlight search** (press `Shift`): global quick-switcher that searches all entries, Kafka topics, JSON tools (format/compact/diff), Command Vault snippets. Deep-links into sub-views via `postMessage`
- Home screen with search and icon grid (cards are draggable too)
- Settings page: CRUD for entries/folders, module config (Kafbat+ clusters), keybinds, multi-palette themes (5 presets + custom colors), backup & restore
- Add entries from home screen or sidebar (+) — supports redirect URLs and TUI terminals
- TUI sessions auto-recreate on page load if ttyd-manager is running (survives stop/start)
- Backup scheduler: auto-backup hub DB on configurable interval with retention policy

**Entry types:**
- `redirect` — any URL opened in an iframe (ArgoCD, Portainer, etc.)
- `tui` — terminal session via ttyd
- `tool` — first-party module (auto-registered)

---

### Kafbat+

Local Kafka UI built from scratch. Supports **multiple clusters**.

**What you can do:**
- **Multi-cluster**: switch between Kafka clusters from a dropdown in the sidebar. Add/edit/remove clusters in Hub Settings → Module Configuration
- Browse all topics with search, see partition count and message count per topic
- View latest messages with syntax-highlighted JSON (auto-collapsed for large payloads)
- Filter messages by value substring, exact key, partition, configurable limit (50/100/200/500)
- Produce messages: JSON editor, drag & drop `.json` file onto the message area, or "Generate payload" from Mock Generator
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
- **Cost Tracker tab**: daily/weekly/monthly spending bar chart, daily average, monthly projection, detail table by date
- **AI Config tab**: read-only unified view of Claude Code + OpenCode configuration — commands, skills, MCPs, rules, agents, plugins. Shows sync status (green = shared between tools, grey = single tool only). Click any item to view its full content

**How it works:** reads `~/.claude/projects/` for Claude Code (JSONL files, mounted read-only) and `~/.local/share/opencode/opencode.db` for OpenCode (SQLite). AI Config reads `~/.claude/` (commands, skills, CLAUDE.md), `~/.claude.json` (MCP servers), and `~/.config/opencode/` (opencode.json, AGENTS.md, plugins). No database of its own.

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

**How to use it:**

1. **Get a Groq API key** (free) at [console.groq.com](https://console.groq.com). Open Mock Generator → you'll see a config card at the top → paste your API key → Save
2. **Click "+ New Spec"** in the sidebar
3. **Paste JSON samples** — real examples of the data you want to generate. At least 1 sample, ideally 3–5 for better pattern detection. You can also drag & drop `.json` files
4. **(Optional)** Paste an OpenAPI schema or Java DTO classes in the "Schema" field — the AI uses them to understand types and constraints better
5. **Choose mode**: `kafka` (generates standalone JSON records) or `api` (generates records + REST call scripts)
6. **Click "Infer Spec"** — the AI analyzes your samples once and produces a structured generation spec. Takes a few seconds
7. **Review the spec** — an expandable field table shows every field with its inferred type, source (faker, enum, range, regex, constant, reference), null rate, constraints, etc. You can edit any attribute
8. **Generate data** — go to the Generate tab, pick a count (1–1000) and a profile:
   - `valid` — respects all constraints
   - `invalid` — randomly violates one constraint per record (null a required field, wrong type, overflow max length)
   - `edge` — boundary values (0, -1, empty string, max-length, range min/max)
9. **Export scripts** — download a standalone `generate.py` (runs offline with Faker, no API) or `call_api.py` (sends generated data to REST endpoints with JWT auth)

**Key features:**
- AI infers once, generates locally forever — 10,000 records costs zero API calls
- Version history with rollback — every edit creates a new version
- Two-pass generation for referential coherence (foreign keys always point to real IDs)
- Kafbat+ integration: "Generate payload" button in the Kafbat+ produce modal generates data from a spec directly into a Kafka topic
- Supports nested objects and arrays, enum distributions with weights, regex templates, conditional fields, correlations between fields

---

### Command Vault

Personal command/snippet manager with variable substitution and execution.

**What you can do:**
- Save commands with title, the command itself, description, and tags
- Search by text (title/command/description), filter by tags
- **Expand panel**: click "Expand" on any snippet to open the action panel with live preview, Copy, and Run buttons
- **Variable substitution**: commands can have `{namespace}`, `{pod}`, etc. Fill in values with autocomplete from history (stored in localStorage). Live preview shows the resolved command with highlighted substitutions
- **File picker variables**: use `{file:varname}` for path variables — opens a full file browser modal (Browse button) to navigate and select files/directories from the host filesystem
- **Run button**: execute the command on the host and see stdout/stderr output inline. Configurable working directory with file picker
- **Variable history**: previous values per variable are remembered across sessions (last 10)
- Tag badges, tag filter dropdown, distinct tags list

**Examples:**
```
kubectl get pods -n {namespace} | grep {filter}
docker exec -it {container} bash
cat {file:config}
scp {file:source} user@host:{destination}
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

Manages terminal sessions and command execution. Runs natively on the host (not in Docker) so TUIs and executed commands can use your local binaries and configs (`~/.kube/config`, etc.).

- Spawns `ttyd` processes dynamically, one per TUI
- Each TUI gets a port in the `10604–10620` range
- Add/remove TUIs at runtime via hub Settings
- **Command execution**: `POST /exec` runs shell commands on the host with configurable working directory and timeout (used by Command Vault's Run button)
- **File browsing**: `GET /files?path=` lists directory contents (used by Command Vault's file picker)
- API: `GET /tuis`, `POST /tuis`, `DELETE /tuis/{id}`, `POST /exec`, `GET /files`

---

## Keyboard Shortcuts

| Default key | Action |
|---|---|
| `Shift` | Open Spotlight search (global quick-switcher) |
| `Escape` | Go home + focus sidebar |
| `/` | Focus search bar |
| `↑` / `↓` | Cycle through entries |
| `,` | Open settings |
| `1` – `9` | Open entry by slot (configurable) |

All configurable in **Settings → Keyboard Shortcuts**. Supports modifiers (`ctrl+k`, `alt+1`). Quick slots 1–9 remappable to any entry. Custom shortcuts take priority.

> **Note**: If you use Vimium or similar keyboard extensions, exclude `localhost:10300` from them — they intercept keys before the page can handle them.

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
- [x] ttyd Manager — dynamic TUI spawning on host, TUI session auto-recovery on restart
- [x] Tiling window manager — drag entries to split into side-by-side or 2×2 grid
- [x] Spotlight global search — Shift to search entries, Kafka topics, JSON tools, commands with deep-linking
- [x] AI Config viewer — unified read-only view of Claude Code + OpenCode configuration
- [ ] Todo List — full CRUD todo app with lists, subtasks, priorities, tags
- [ ] RTK Helper — `filters.toml` editor with versioned backups
- [ ] GitLab MR Dashboard — personal MR overview
- [ ] Hub-level aggregated backup (all modules in one zip)
