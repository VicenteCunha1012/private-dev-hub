# Dev Hub

Personal local developer portal. All your tools in one browser tab — sidebar, iframes, no state loss when switching between them. Runs entirely on localhost via a single Docker Compose file.

---

## What it is

A self-hosted dashboard that keeps every dev tool you use (Kafka UI, JSON differ, terminal sessions, ArgoCD, Portainer, etc.) in a persistent iframe. Switching between tools is instant and stateless — the iframe stays mounted in the DOM, only its visibility changes.

---

## Stack

| Layer | Technology |
|---|---|
| Frontends | React + Vite (TypeScript) |
| Backends | Ktor 3 (Kotlin 21) |
| Databases | PostgreSQL 16 |
| Infrastructure | Docker Compose |
| TUIs in browser | ttyd |

---

## Port Convention

Each module gets a consistent `xx` suffix across its services.

| Module | Frontend | Backend | DB |
|---|---|---|---|
| Hub | 10300 | 10303 | 10403 |
| Kafbat+ | 10301 | 10401 | 10501 |
| AI Session Manager | 10302 | 10402 | — |
| JSON Tools | 10306 | 10406 | — |
| ttyd Manager | — | 10600 | 10604–10620 (dynamic) |

All ports are bound to `127.0.0.1` only — not exposed on your network.

---

## Running

```bash
docker compose up --build -d
```

Open `http://localhost:10300`.

First run seeds the hub with default folders (Infra, Dev, Observabilidade, Tools) and placeholder entries. Own tools (Kafbat+, AI Sessions, JSON Tools) are auto-registered — no manual setup needed. Edit or delete any entry in Settings.

---

## Project Structure

```
dev-hub/
├── docker-compose.yml
├── hub/
│   ├── frontend/            React + Vite — port 10300
│   └── backend/             Ktor — port 10303 + PostgreSQL 10403
├── kafbat-plus/
│   ├── frontend/            React + Vite — port 10301
│   └── backend/             Ktor — port 10401 + PostgreSQL 10501
├── ai-session-manager/
│   ├── frontend/            React + Vite — port 10302
│   └── backend/             Ktor — port 10402 (no DB, reads ~/.claude)
├── json-tools/
│   ├── frontend/            React + Vite — port 10306
│   └── backend/             Ktor — port 10406 (stateless, no DB)
├── ttyd-manager/            Ktor — port 10600, manages TUIs on 10604–10620
└── backend-template/        Ktor starter to copy for new modules
```

---

## Modules

### Hub

The shell. Everything else lives inside it.

**Frontend:**
- Sidebar with collapsible folders, drag-and-drop entries between folders
- All iframes mounted simultaneously — switching is `display:none` / `display:block`, state is never lost
- Home screen with search and icon grid
- Settings page: full CRUD for entries/folders, keybinds, multi-palette themes (presets + custom colors), backup & restore
- TUI entry creation spawns a ttyd session automatically via ttyd-manager

**Backend + DB:**
- Persists entries, folders, icons, hub config, keybinds, and palette
- Auto-fetches favicons from entry URLs (async, cached in DB with override support)
- Config export/import as JSON (`GET /config/export`, `POST /config/import`)
- DB export/import as SQL (`GET /db/export`, `POST /db/import`)

**Entry types:**
- `redirect` — any URL opened in an iframe (external tools, ArgoCD, Portainer, etc.)
- `tui` — terminal session via ttyd, opened in an iframe
- `tool` — first-party module with its own frontend (auto-registered on seed)

---

### Kafbat+

Local Kafka UI built from scratch. Full-featured topic browser and message producer.

**Frontend (10301):**
- Topic sidebar with search, partition count, and message count per topic
- Cluster overview home screen showing brokers, topic count, total partitions, controller status
- Message viewer with filtering: substring search in values, exact key filter, partition filter, configurable limit (50/100/200/500)
- Collapsible JSON viewer with syntax highlighting — auto-collapses large payloads (>500 chars) with expand/collapse toggle and size indicator
- Partition details tab: leader, replicas, ISR, offsets per partition
- Topic config tab: all Kafka topic-level configs
- Produce modal: JSON editor with Format JSON button, drag & drop `.json` file upload, custom headers (key:value per line), result feedback (partition + offset)
- Create topic modal: name, partitions, replication factor
- Delete topic with confirmation

**Backend (10401) + DB (10501):**
- Apache Kafka client for admin operations (topic CRUD, cluster metadata, offset queries)
- Consumer with seek-to-end for latest messages, seek-by-timestamp for time-range queries
- Producer with key, value, headers, and partition targeting
- Config stored in PostgreSQL (broker URLs, default message limit)
- Endpoints: `GET /cluster`, `GET /brokers`, `GET /topics`, `GET /topics/{topic}`, `GET /topics/{topic}/messages`, `POST /topics/{topic}/produce`, `POST /topics`, `DELETE /topics/{topic}`
- Full config/db export/import support

---

### AI Session Manager

Visual dashboard for Claude Code session usage and spending.

**Frontend (10302):**
- Session list sidebar with search, showing title, project, message count, cost, and last activity timestamp
- Spending overview home screen: total sessions, total cost, input/output tokens, cache read/creation tokens
- Spending breakdown by model (Sonnet, Opus, Haiku, Fable) and by project with proportional bars
- Session detail view:
  - Token summary cards (input, output, cache read, cache creation)
  - Token distribution bar chart
  - Summary stats: total tokens, estimated cost, session duration
  - Turns timeline showing role, model, tokens per turn, and message preview
  - MCP tools tab listing all MCP tools used in the session

**Backend (10402):**
- Scans `~/.claude/projects/` directory (mounted read-only from host)
- Parses JSONL session files: extracts titles (`ai-title`), messages (`assistant`/`user`), usage metadata (input/output/cache tokens, model)
- Cost estimation based on per-model pricing (input/output/cache-read/cache-creation rates)
- Endpoints: `GET /sessions`, `GET /sessions/{id}`, `GET /spending`, `GET /projects`
- No database — reads session files directly from the filesystem

---

### JSON Tools

Self-hosted JSON toolbox. Stateless, no DB.

**Frontend (10306):**
- Three-tab interface with pill-style tab switcher
- **Format** — paste or drop JSON, pick indent (2/3/4 spaces), get prettified output. Copy output and paste input buttons
- **Compact** — paste formatted JSON, get single-line minified output. Shows size reduction percentage (e.g. "1240 → 380 chars (69% smaller)")
- **Diff** — two side-by-side editor panes. Structural comparison showing every difference at JSON path level:
  - `ADDED` (green) — key/element exists only in right
  - `REMOVED` (red) — key/element exists only in left
  - `CHANGED` (amber) — value differs, shows both left and right values
  - Swap button to flip left/right
- All panes support drag & drop of `.json` files

**Backend (10406):**
- `POST /format` — parse + re-serialize with configurable indent
- `POST /compact` — parse + serialize without whitespace
- `POST /diff` — recursive structural diff of two JSON trees, returns path-level differences with type (added/removed/changed) and values
- Handles invalid JSON gracefully with error messages

---

### ttyd Manager

Manages terminal sessions exposed as iframes via `ttyd`.

- Single service in Compose — spawns `ttyd` processes dynamically, one per TUI
- Each TUI gets a port in the `10604–10620` range
- Add/remove TUIs at runtime via the hub Settings page
- API: `GET /tuis`, `POST /tuis`, `DELETE /tuis/{id}`
- Mounts Docker socket and `/home` for container access

---

## Keyboard Shortcuts

Shortcuts work when the hub has focus (sidebar or home screen). When an iframe is active, click the sidebar first to re-acquire focus.

| Default key | Action |
|---|---|
| `Escape` | Go home + focus sidebar |
| `/` | Focus search bar |
| `↑` / `↓` | Cycle through entries |
| `,` | Open settings |
| `1` – `9` | Open entry by slot (configurable) |

All shortcuts are configurable in **Settings → Keyboard Shortcuts**. Supports modifiers: `ctrl+k`, `alt+1`, etc.

**Quick slots 1–9:** by default, `1` opens the 1st entry, `2` the 2nd, etc. Remappable to any entry.

**Custom shortcuts:** assign any key combo to any entry. Takes priority over slot defaults.

---

## Themes

Settings → Appearance offers preset themes (Midnight, Ocean, Forest, Ember, Monochrome) and a Custom option with color pickers for primary accent, secondary accent, and background. Theme is stored in the hub DB and included in config exports.

---

## Settings & Config

Every module exposes `GET /config` and `POST /config`. The hub reads them and renders config cards.

### Backup & Restore

**Config JSON** — all settings (entries, folders, keybinds, palette, pg tool paths) in a single file:

```
Settings → Backup & Restore → Export config / Import config
```

**Database SQL** — full hub data dump (entries, folders, icons, config):

```
Settings → Backup & Restore → Export database / Import database
```

Each module backend also exposes its own `/db/export` and `/db/import` endpoints (where applicable).

### Recovery after full wipe

```bash
docker compose up -d
# Open http://localhost:10300 → Settings
# Import config → select config-backup.json
# Import database → select hub-db-YYYY-MM-DD.sql
```

---

## Adding a New Module

1. Copy `backend-template/` to `<module-name>/backend/`
2. Run `npm create vite@latest frontend -- --template react-ts` in `<module-name>/`
3. Assign the next free `xx` suffix (frontend `103xx`, backend `104xx`, DB `105xx`)
4. Implement mandatory endpoints: `GET/POST /config`, `GET /health`, `GET/POST /config/export`, `GET/POST /config/import`, `GET/POST /db/export` (if DB)
5. Add services to `docker-compose.yml`
6. Register the entry in the hub seed (`Database.kt`) or add manually via Settings

All backends must allow CORS from `http://localhost:10300`.

---

## Development

**Frontend (hot reload):**
```bash
cd hub/frontend  # or any module's frontend/
npm install
npm run dev    # http://localhost:5173
```

**Backend (local run):**
```bash
cd hub/backend  # or any module's backend/
./gradlew run
```
Requires dependencies running (PostgreSQL, Kafka, etc.) or adjust `application.yaml`.

**Build backend fat jar:**
```bash
./gradlew shadowJar
# output: build/libs/*-all.jar
```

---

## Conventions

- Sensitive config (tokens, passwords) lives in the Settings card — nothing hardcoded
- Backends retry DB connections on startup (or use `depends_on: condition: service_healthy`)
- Icons: backend auto-fetches `/favicon.ico` from entry URLs asynchronously, caches bytes in DB
- Override icons per entry via upload or URL in Settings
- `X-Frame-Options` / CSP headers from external services may block iframes — add an nginx strip-headers proxy if needed

---

## Roadmap

- [x] Hub — sidebar, iframes, state preservation, drag-and-drop
- [x] Dynamic redirects and TUI entries via ttyd-manager
- [x] Keybinds (configurable, stored in DB, exported)
- [x] Multi-palette themes (presets + custom colors)
- [x] Favicon auto-fetch and caching with manual override
- [x] Export / import config JSON
- [x] Export / import database SQL
- [x] Kafbat+ — Kafka topic browser, message viewer, producer
- [x] AI Session Manager — Claude Code session scanner, spending tracker
- [x] JSON Tools — format, compact, structural diff
- [x] ttyd Manager — dynamic TUI spawning
- [ ] RTK Helper — `filters.toml` editor with versioned backups
- [ ] GitLab MR Dashboard — personal MR overview
- [ ] Hub-level aggregated backup (all modules in one zip)
- [ ] nginx strip-headers proxy for X-Frame-Options
