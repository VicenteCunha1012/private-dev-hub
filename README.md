# Dev Hub

Personal local developer portal. All your tools in one browser tab — sidebar, iframes, no state loss when switching between them. Runs entirely on localhost via a single Docker Compose file.

---

## What it is

A self-hosted dashboard that keeps every dev tool you use (Kafka UI, mock data generator, JSON differ, terminal sessions, ArgoCD, Portainer, etc.) in a persistent iframe. Switching between tools is instant and stateless — the iframe stays mounted in the DOM, only its visibility changes.

---

## Stack

| Layer | Technology |
|---|---|
| Frontends | React + Vite (TypeScript) |
| Backends | Ktor 3 (Kotlin 21) |
| Databases | PostgreSQL 16 |
| Infrastructure | Docker Compose |
| TUIs in browser | ttyd |
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
| ttyd Manager | — | 10600 | 10604–10620 (dynamic) |

All ports are bound to `127.0.0.1` only — not exposed on your network.

---

## Running

```bash
docker compose up --build -d
```

Open `http://localhost:10300`.

First run seeds the hub with default folders (Infra, Dev, Observabilidade, Tools) and placeholder entries. Own tools (Kafbat+, AI Sessions, JSON Tools, Mock Generator) are auto-registered — no manual setup needed. Edit or delete any entry in Settings.

---

## First-time setup

Most tools work out of the box. The ones that need config:

| Tool | What to configure | Where |
|---|---|---|
| Kafbat+ | Kafka broker URLs (e.g. `my-broker:9092`) | Open Kafbat+ → config is at `http://localhost:10401/config` or set via its API |
| Mock Data Generator | Groq API key (free at [console.groq.com](https://console.groq.com)) | Open Mock Generator → Settings (config card in the UI), paste your API key |
| AI Session Manager | Path to `.claude` directory | Pre-configured to `/home/user/.claude` (mounted from host via docker-compose) |

---

## Project Structure

```
dev-hub/
├── docker-compose.yml
├── hub/
│   ├── frontend/               React + Vite — port 10300
│   └── backend/                Ktor — port 10303 + PostgreSQL 10403
├── kafbat-plus/
│   ├── frontend/               React + Vite — port 10301
│   └── backend/                Ktor — port 10401 + PostgreSQL 10501
├── ai-session-manager/
│   ├── frontend/               React + Vite — port 10302
│   └── backend/                Ktor — port 10402 (no DB, reads ~/.claude)
├── json-tools/
│   ├── frontend/               React + Vite — port 10306
│   └── backend/                Ktor — port 10406 (stateless, no DB)
├── mock-data-generator/
│   ├── frontend/               React + Vite — port 10308
│   └── backend/                Ktor — port 10408 + PostgreSQL 10508
├── ttyd-manager/               Ktor — port 10600, manages TUIs on 10604–10620
└── backend-template/           Ktor starter to copy for new modules
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

Local Kafka UI built from scratch.

**What you can do:**
- Browse all topics with search, see partition count and message count per topic
- Click a topic to view its latest messages with full JSON formatting (syntax-highlighted, auto-collapsed for large payloads)
- Filter messages by value substring, exact key, specific partition, configurable limit (50/100/200/500)
- Produce messages: write JSON in the editor, drag & drop a `.json` file, or use "Generate payload" to pull mock data from the Mock Data Generator
- Create and delete topics
- View partition details (leader, replicas, ISR, offsets) and topic-level Kafka configs
- See cluster overview: brokers, controller status, total topics and partitions

**Config:** set your Kafka broker URLs via `POST http://localhost:10401/config` with `{"brokers": "broker1:9092,broker2:9092"}`.

---

### AI Session Manager

Visual dashboard for Claude Code session usage and spending.

**What you can do:**
- See all your Claude Code sessions across projects, sorted by last activity
- Search sessions by title or project name
- View total spending breakdown: by model (Sonnet, Opus, Haiku, Fable) and by project, with proportional cost bars
- Click a session to see: token summary (input/output/cache), token distribution bar, session duration, estimated cost
- Browse the conversation turn-by-turn with role, model, token counts, and message preview
- See which MCP tools were used in each session

**How it works:** the backend reads `~/.claude/projects/` (mounted read-only from the host). No database — all data comes from Claude Code's own JSONL session files.

---

### JSON Tools

Self-hosted JSON utility. No DB, stateless.

**What you can do:**
- **Format** — paste or drop JSON, pick indent (2/3/4 spaces), get prettified output with copy button
- **Compact** — paste formatted JSON, get single-line minified output. Shows size reduction percentage
- **Diff** — paste two JSONs side by side, get a structural comparison at every path level (added/removed/changed with both values shown)
- Drag & drop `.json` files into any pane
- Paste and copy buttons for quick clipboard workflows

---

### Mock Data Generator

Generate realistic mock data from real JSON samples using AI-inferred specs.

**How it works (the key principle):**
1. You paste real JSON samples (and optionally an OpenAPI schema or Java DTOs)
2. The AI (Groq, free tier) analyzes the samples **once** and produces a structured generation spec
3. A local deterministic generator (Python + Faker) uses that spec to produce as many records as you want — no API cost per record, reproducible, with referential coherence

**What you can do:**
- **Infer a spec** — paste 1+ JSON samples, optionally upload a schema, click "Infer Spec". The AI captures per-field: source type (enum/regex/range/faker/constant/reference), distribution weights, patterns, ranges, null rates, conditionals, correlations, and referential integrity
- **Review and edit the spec** — every field attribute is editable in an expandable table. Your overrides layer on top of the AI inference without replacing it
- **Generate data** — pick entity, count (1–1000), profile (valid/invalid/edge), optional seed. Preview the results inline
- **Three profiles:**
  - `valid` — respects all constraints
  - `invalid` — randomly violates one constraint per record (null required field, wrong type, overflow max length)
  - `edge` — boundary values (empty strings, max-length strings, range min/max, zero, -1)
- **Export Python scripts:**
  - `generate.py` — standalone, runs offline with Faker, CLI: `python generate.py --count 100 --profile valid --seed 42`
  - `call_api.py` — generates + sends to REST endpoints, uses `auth_util.get_token()` for JWT auth
- **Version history** — every spec edit creates a new version. Full history with rollback to any previous version
- **Two-pass generation** — pass 1 generates entities and collects ID pools; pass 2 resolves cross-entity references (foreign keys, parent-child). Handles correlations like `updatedAt > createdAt`

**Kafbat+ integration:** in Kafbat+'s produce modal, the "Generate payload" button lets you pick a spec from the Mock Generator, choose entity/count/profile, and inject the generated JSON directly into the message editor. Optional — if the Mock Generator is down, the button is hidden and Kafbat+ works normally.

**Config (required):** go to Mock Generator in the hub, set your **Groq API key** in the config card. Get a free key at [console.groq.com](https://console.groq.com). You can also change the model (default: `llama-3.3-70b-versatile`) and Faker locale (default: `en_US`).

**Two modes:**
- **Kafka mode** — no schema needed, AI infers everything from samples. Output is JSON payloads for Kafka topics
- **API mode** — uses an OpenAPI schema or Java DTOs to constrain the structure. Generates `call_api.py` with endpoint routing

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

- Sensitive config (API keys, tokens, passwords) lives in each module's config card — nothing hardcoded. Keys are masked in API responses
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
- [x] Mock Data Generator — AI-inferred specs, deterministic generation, Kafbat+ integration
- [x] ttyd Manager — dynamic TUI spawning
- [ ] RTK Helper — `filters.toml` editor with versioned backups
- [ ] GitLab MR Dashboard — personal MR overview
- [ ] Hub-level aggregated backup (all modules in one zip)
- [ ] nginx strip-headers proxy for X-Frame-Options
