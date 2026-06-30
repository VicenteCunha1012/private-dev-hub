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
| JSON Tools | 10306 | 10406 | — (backend only, UI merged into Dev Utils) |
| Mock Data Generator | 10308 | 10408 | 10508 |
| Command Vault | 10309 | 10409 | 10509 |
| Infra Monitor | 10310 | 10410 | — (backend only, UI merged into Dev Utils) |
| Todo | 10312 | 10412 | 10512 |
| Arcade | 10313 | 10413 | 10513 |
| Secrets Vault | 10314 | 10414 | 10514 |
| Git History | 10315 | 10415 | — |
| Dev Utils | 10316 | 10416 | — (includes JSON Tools + Infra Monitor UI) |
| AI Memory | 10317 | 10417 | 10517 (backend + MCP only, UI merged into AI Sessions) |
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
├── dev-hub-core/                   Shared Kotlin library (BaseDatabase, BaseConfigService, plugins)
├── hub/
│   ├── frontend/                   React + Vite — port 10300 (PWA installable)
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
├── infra-monitor/
│   ├── frontend/                   React + Vite — port 10310
│   └── backend/                    Ktor — port 10410 (reads host /proc/net + proxies health checks)
├── todo/
│   ├── frontend/                   React + Vite — port 10312
│   └── backend/                    Ktor — port 10412 + PostgreSQL 10512
├── arcade/
│   ├── frontend/                   React + Vite — port 10313
│   └── backend/                    Ktor — port 10413 + PostgreSQL 10513
├── secrets-vault/
│   ├── frontend/                   React + Vite — port 10314
│   └── backend/                    Ktor — port 10414 + PostgreSQL 10514
├── git-history/
│   ├── frontend/                   React + Vite — port 10315
│   └── backend/                    Ktor — port 10415 (stateless, shells out to git)
├── utils/
│   ├── frontend/                   React + Vite — port 10316
│   └── backend/                    Ktor — port 10416 (stateless)
├── ai-memory/
│   ├── frontend/                   React + Vite — port 10317
│   ├── backend/                    Ktor — port 10417 + PostgreSQL 10517
│   └── mcp-server/                 MCP server for Claude Code / OpenCode integration
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
- **Memory tab**: AI Memory UI — handoff notes (grouped by project/context, with history) and decision log (CRUD, searchable, filterable by tag/project). Calls the AI Memory backend at port 10417

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
- **Flows**: node-based visual automation editor (React Flow)
  - **Node types**: Start (execution entry), Constant (data source), Command (shell execution), Display (output viewer), Subflow (reuse other flows as nodes)
  - **Data edges** (dashed) connect outputs to inputs; **Flow edges** (solid yellow) define execution order
  - Commands with `{variable}` syntax auto-generate input ports on the node
  - **Real-time streaming**: command output streams line-by-line via SSE into Display nodes
  - **Subflow nodes**: use any saved flow as a reusable node — unconnected inputs auto-exposed
  - Start/stop execution, autosave, right-click context menus

**Examples:**
```
kubectl get pods -n {namespace} | grep {filter}
docker exec -it {container} bash
cat {file:config}
scp {file:source} user@host:{destination}
SELECT * FROM {table} WHERE id = {id} LIMIT {limit};
```

---

### Infra Monitor

Port scanner + service health dashboard combined. Stateless, no DB.

**Ports tab:**
- All open ports with PID, process name, protocol, and state (reads host `/proc` via `SYS_PTRACE` + `DAC_READ_SEARCH` capabilities)
- Dev Hub ports (10300–10620) grouped in a collapsible section labeled by module name
- **Conflict detection**: warning badge if a portal port is occupied by an unexpected process
- Click any LISTEN port to open `http://localhost:{port}` in a new tab
- Auto-refresh every 5s

**Services tab:**
- Traffic-light grid: green (up), red (down), yellow (degraded) per service
- Response time in ms for each service
- Summary bar: "X/Y services up"
- Auto-refresh: 5s / 10s / 30s / off
- Configurable service list (defaults to all portal backends)

**How it works:** backend reads `/host/proc/1/net/tcp` (root network namespace, not the container namespace) for ports. Pings `/health` on all configured services in parallel (5s timeout) for service status. Docker capabilities `SYS_PTRACE` + `DAC_READ_SEARCH` allow reading PID/process for all host processes.

---

### ttyd Manager

Manages terminal sessions and command execution. Runs natively on the host (not in Docker) so TUIs and executed commands can use your local binaries and configs (`~/.kube/config`, etc.).

- Spawns `ttyd` processes dynamically, one per TUI
- Each TUI gets a port in the `10604–10620` range
- Add/remove TUIs at runtime via hub Settings
- **Command execution**: `POST /exec` runs shell commands on the host with configurable working directory and timeout (used by Command Vault's Run button)
- **Streaming execution**: `GET /exec/stream` SSE endpoint for real-time stdout streaming (used by Flow editor)
- **File browsing**: `GET /files?path=` lists directory contents (used by Command Vault's file picker)
- **Deduplication**: creating a TUI with the same name as an existing one kills the old session first (prevents port exhaustion)
- API: `GET /tuis`, `POST /tuis`, `DELETE /tuis/{id}`, `POST /exec`, `GET /exec/stream`, `GET /files`

---

### Secrets Vault

Zero-knowledge encrypted credential manager. Master password never leaves the browser.

**What you can do:**
- Store credentials with label, category, tags (plaintext for search) + encrypted blob (value, username, URL, notes)
- **Client-side encryption**: Web Crypto API (PBKDF2 → AES-256-GCM). Backend stores only ciphertext
- **Auto-lock**: vault locks when iframe loses focus or tab switches. Manual lock button too
- **Master password setup**: first visit creates vault with password. No recovery — forget = wipe only
- **Change password**: re-encrypts all secrets with new key
- Search by label/category/tags while locked (metadata is plaintext)
- Reveal/copy individual fields after unlock

---

### Git History Explorer

Visual explorer for local Git repository history. Three modes: commit browsing, file timeline, and line tracing.

**What you can do:**
- **Browse commits**: select repo + branch, paginated commit list, click any commit to see full diff with side-by-side hunks
- **Browse files**: navigate the file tree at any branch/commit, view file contents, see file-level commit history with diffs
- **Line tracing**: select lines in a file viewer, instant blame (who last touched each line), then "full line history" traces the evolution of those lines through history using iterative `git blame -L` (chains through parent commits following the original line number — more accurate than `git log -L` on restructured files)
- **Config card**: add/remove repository directories to explore
- Diff rendering with green/red highlighting, line numbers, hunk headers

**How it works:** backend shells out to `git` (ProcessBuilder with list args — no shell interpolation). Repos mounted read-only in Docker. Sanitizes all refs and paths.

---

### Dev Utils

Unified dev toolbox with a sidebar navigation. No database. Merges JSON Tools and Infra Monitor UI.

**Sidebar sections:**

*Dev Utils:*
- **Regex workbench** — test regex against text, live match highlighting, capture groups, pattern explanation
- **Cron / systemd-timer translator** — parse cron or `OnCalendar=` expressions, human-readable description, next N executions
- **UUID / ULID generator** — generate in bulk (UUID v4, uppercase, no dashes, ULID), copy individual or all
- **Hash & checksum** — MD5/SHA-1/SHA-256/SHA-384/SHA-512, compare two hashes
- **URL / query parser** — decompose URL into components + query params table, encode/decode
- **JWT decoder** — decode header + payload, show expiry status, extract Keycloak roles

*JSON Tools:*
- **Format** — prettify JSON with configurable indent, copy button
- **Compact** — minify to single line, shows size reduction %
- **Diff** — structural side-by-side comparison at every JSON path, inline LCS-based line highlighting, synced scrolling, `Ctrl+Enter` to compare

*Infra Monitor:*
- **Port Radar** — all open ports with PID, process, state; Dev Hub ports collapsible section; conflict detection; auto-refresh
- **Health Dashboard** — traffic-light service health grid; configurable service list; auto-refresh

---

### AI Memory

Persistent memory for AI tools — handoff notes between sessions and a searchable decision log. Exposed as MCP server for Claude Code and OpenCode.

**What you can do:**
- **Handoff Notes**: write session state at the end of a session (what was being done, what's left). Read at session start. Grouped by project + context. History preserved.
- **Decision Log**: log technical decisions with title, description, reasoning, alternatives, tags, project. Searchable and filterable. Field for future MR/ticket linking (placeholder, resolver not yet built).
- **MCP server**: `write_handoff`, `read_handoff`, `log_decision`, `search_decisions` — callable by Claude Code and OpenCode
- Both AI tools and humans can write via MCP or UI respectively
- See `ai-memory/MCP_SETUP.md` for integration instructions

---

### Arcade

Coin-operated retro game arcade with 15 browser games.

**What you can do:**
- Earn coins via git push hooks, spend them to play
- 15 games: 2048, Minesweeper, Memory, Tetris, Snake, Breakout, Pong, and more
- High scores and play history tracked per game
- Random game selection from 3 offered per coin

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
- **Full backup**: `Settings → Backup & Restore → Export/Import everything` — exports ALL module data (hub, commands, flows, secrets, arcade, todo, kafbat, mock generator, ai-memory) into one JSON file. Import restores everything across all modules.
- **Backup Scheduler**: `Settings → Backup Scheduler` — auto-backup on interval with retention, manual trigger, backup list

### Recovery after full wipe

```bash
./start.sh
# Open http://localhost:10300 → Settings
# Import everything → devhub-full-backup-YYYY-MM-DD.json
```

---

## Adding a New Module

1. `cp -r backend-template/ <module>/backend/`
2. `cd <module> && npm create vite@latest frontend -- --template react-ts`
3. Assign next free `xx` suffix (frontend `103xx`, backend `104xx`, DB `105xx`)
4. Add `includeBuild("../../dev-hub-core")` to `settings.gradle.kts`, use `implementation("pt.cunha:dev-hub-core")` in `build.gradle.kts`
5. Extend `BaseDatabase` for schema, `BaseConfigService` for config CRUD, call `installStandardPlugins()` + `healthRoutes()` + `configDbRoutes()` in Application.kt
6. Add to `docker-compose.yml`
7. Add seed entry in `hub/backend/.../Database.kt`

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
- [x] Infra Monitor — live port scanner with collapsible Dev Hub section + traffic-light health checks (merged from Port Radar + Health Dashboard)
- [x] ttyd Manager — dynamic TUI spawning on host, TUI session auto-recovery on restart
- [x] Tiling window manager — drag entries to split into side-by-side or 2×2 grid
- [x] Spotlight global search — Shift to search entries, Kafka topics, JSON tools, commands, flows with deep-linking
- [x] AI Config viewer — unified read-only view of Claude Code + OpenCode configuration
- [x] Todo List — full CRUD todo app with lists, subtasks, priorities, tags
- [x] Arcade — coin-operated retro game arcade (15 games, git-push coin earning)
- [x] Secrets Vault — zero-knowledge encrypted credential manager (Web Crypto, AES-256-GCM)
- [x] Command Vault Flows — node-based visual automation with React Flow, SSE streaming, subflow nodes
- [x] PWA support — installable as standalone app (Firefox via extension)
- [x] Custom context menus — right-click on entries, snippets, flows for quick actions
- [x] Full backup/restore — export/import all module data in one JSON file
- [x] dev-hub-core — shared Kotlin library (BaseDatabase, BaseConfigService, standard plugins/routes)
- [x] Entry emojis — per-entry emoji icons in sidebar and home screen
- [x] JSON diff synced scrolling — left/right panes scroll together, changed values on same line
- [x] Git History Explorer — visual repo history browser with commit/file/line-trace modes
- [x] Dev Utils — regex, cron, UUID, hash, URL parser, JWT decoder in one tabbed page
- [x] AI Memory — handoff notes + decision log with MCP server for Claude Code / OpenCode
- [ ] RTK Helper — `filters.toml` editor with versioned backups
- [ ] GitLab MR Dashboard — personal MR overview
