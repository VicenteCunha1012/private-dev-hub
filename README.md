# Dev Hub

Personal local developer portal. All your tools in one browser tab — sidebar, iframes, no state loss when switching between them. Runs entirely on localhost via a single Docker Compose file.

---

## What it is

A self-hosted dashboard that keeps every dev tool you use (Kafka UI, GitLab MRs, terminal sessions, ArgoCD, Portainer, etc.) in a persistent iframe. Switching between tools is instant and stateless — the iframe stays mounted in the DOM, only its visibility changes.

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
| AI Session Manager | 10302 | 10402 | 10502 |
| RTK Helper | 10305 | 10405 | 10505 |
| JSON Tools | 10306 | 10406 | — |
| GitLab MR Dashboard | 10307 | 10407 | — |
| ttyd Manager | — | — | 10604–10620 (dynamic) |

All ports are bound to `127.0.0.1` only — not exposed on your network.

---

## Running

```bash
docker compose up --build -d
```

Open `http://localhost:10300`.

First run seeds the hub with default folders (Infra, Dev, Observabilidade) and placeholder entries. Edit or delete them in Settings.

---

## Project Structure

```
dev-hub/
├── docker-compose.yml
├── hub/
│   ├── frontend/       React + Vite — port 10300
│   └── backend/        Ktor — port 10303 + PostgreSQL 10403
├── kafbat-plus/        (Fase 2)
├── ai-session-manager/ (Fase 2)
├── rtk-helper/         (Fase 2)
├── json-tools/         (Fase 2)
├── gitlab-mr/          (Fase 2)
├── ttyd-manager/       (Fase 2)
└── backend-template/   Ktor starter to copy for new modules
```

---

## Modules

### Hub (built — Fase 1)

The shell. Everything else lives inside it.

**Frontend:**
- Sidebar with collapsible folders and entries
- All iframes mounted simultaneously — switching is `display:none` / `display:block`, state is never lost
- Home screen with search and icon grid
- Settings page with full CRUD for entries, folders, keybinds, and backup

**Backend + DB:**
- Persists entries, folders, icons, hub config, and keybinds
- Auto-fetches favicons from entry URLs (async, cached in DB)
- Export/import config as JSON (`GET /config/export`, `POST /config/import`)

**Entry types:**
- `redirect` — any URL opened in an iframe (external tools, ArgoCD, Portainer, etc.)
- `tui` — terminal session via ttyd, opened in an iframe
- `tool` — future first-party module with its own frontend

---

### Kafbat+ (Fase 2)

Local Kafka UI built from scratch.

- Browse topics, search by name
- View last N messages per topic with full JSON formatting
- Filter by substring, exact key, or timestamp range
- Produce messages via editor or JSON file upload (drag & drop)
- Proto file upload for gRPC/protobuf decode (planned post-MVP)
- Multiple broker support, auto-discovery

---

### AI Session Manager (Fase 2)

"Portainer for AI" — visual manager for Claude Code and OpenCode sessions.

- Scans configured directories for session files
- Lists conversations with title, date, estimated cost, and token count
- Toggle between Claude Code and OpenCode views
- Shows active context and MCP tools per session
- Spending totals by tool and globally

---

### RTK Helper (Fase 2)

Manager for RTK (`filters.toml`) token filter config.

- View and edit `filters.toml` with TOML syntax highlighting
- Search rules by substring or regex
- Apply changes with automatic backup (previous version saved to DB)
- Version history with diff view and one-click rollback
- `rtk gain` stats panel

---

### JSON Tools (Fase 2)

Self-hosted JSON toolbox. Stateless, no DB.

- **Format** — pretty-print with configurable indent
- **Compact** — minify to single line
- **Diff** — side-by-side comparison with coloured highlighting

---

### GitLab MR Dashboard (Fase 2)

Personal MR overview for self-hosted GitLab. Stateless, no DB.

- MRs assigned to you
- MRs waiting for your review
- Open thread counts per MR
- Direct links to open in GitLab
- Configured via Personal Access Token in Settings

---

### ttyd Manager (Fase 2)

Manages terminal sessions exposed as iframes via `ttyd`.

- Single service in Compose — no one container per TUI
- Spawns `ttyd` processes dynamically per configured TUI
- Each TUI gets a port in the `10604–10620` range
- Add/remove TUIs at runtime via Settings card

Default TUIs (seeds): k9s, lazydocker, bash

---

## Keyboard Shortcuts

Shortcuts work when the hub has focus (sidebar or home screen). When an iframe is active, click the sidebar first to re-acquire focus, then use keys.

| Default key | Action |
|---|---|
| `Escape` | Go home + focus sidebar |
| `/` | Focus search bar |
| `↑` / `↓` | Cycle through entries |
| `,` | Open settings |
| `1` – `9` | Open entry by slot (configurable) |

All shortcuts are configurable in **Settings → Keyboard Shortcuts**. Click a field and press the key you want. Supports modifiers: `ctrl+k`, `alt+1`, etc.

**Quick slots 1–9:** by default, `1` opens the 1st entry in the list, `2` the 2nd, etc. You can remap any slot to any specific entry in Settings.

**Custom shortcuts:** assign any key (or combo) to any specific entry. These take priority over slot defaults.

---

## Settings & Config

Every module exposes `GET /config` and `POST /config`. The hub collects them all.

### Export / Import

**Config JSON** — all settings (URLs, tokens, keybinds, pg tool paths) in a single file.

```
Settings → Backup & Restore → Export config
Settings → Backup & Restore → Import config
```

**DB backup** — `pg_dump` of each module's database, bundled as a zip.

```
GET  /db/export/all   → zip with one dump per module
POST /db/import/all   → restore from zip
```

### Recovery after full wipe

```bash
docker compose up -d
# Open http://localhost:10300/config
# Import config → select config-backup.json
# Import DBs    → select db-backup.zip
```

---

## Adding a New Module

1. Copy `backend-template/` to `<module-name>/backend/`
2. Run `npm create vite@latest frontend -- --template react-ts` in `<module-name>/`
3. Assign the next free `xx` suffix (frontend `103xx`, backend `104xx`, DB `105xx`)
4. Implement mandatory endpoints: `GET/POST /config`, `GET /health`, `GET/POST /config/export`, `GET/POST /config/import`, `GET/POST /db/export` (if DB)
5. Add services to `docker-compose.yml`
6. Register the entry in the hub (type: `tool`)

All backends must allow CORS from `http://localhost:10300`.

---

## Development

**Frontend (hot reload):**
```bash
cd hub/frontend
npm install
npm run dev    # http://localhost:5173
```
Point `src/api/hubApi.ts` BASE to `http://localhost:10303` (already the default).

**Backend (local run):**
```bash
cd hub/backend
./gradlew run
```
Requires a local PostgreSQL on port 10403 (or change `application.yaml` to point elsewhere).

**Build backend fat jar:**
```bash
./gradlew shadowJar
# output: build/libs/hub-backend-*-all.jar
```

---

## Conventions

- Sensitive config (tokens, passwords) lives in the Settings card — nothing hardcoded
- Backends retry DB connections on startup (or use `depends_on: condition: service_healthy`)
- Icons: backend auto-fetches `/favicon.ico` from entry URLs asynchronously, caches bytes in DB
- SSL is bypassed for favicon fetches (local tools often have self-signed certs)
- `X-Frame-Options` / CSP headers from external services may block iframes — add an nginx strip-headers proxy if needed

---

## Roadmap

- [x] Hub — sidebar, iframes, state preservation
- [x] Dynamic redirects and TUI entries
- [x] Keybinds (configurable, stored in DB, exported)
- [x] Favicon auto-fetch and caching
- [x] Export / import config JSON
- [ ] Kafbat+ (Fase 2)
- [ ] AI Session Manager (Fase 2)
- [ ] RTK Helper (Fase 2)
- [ ] JSON Tools (Fase 2)
- [ ] GitLab MR Dashboard (Fase 2)
- [ ] ttyd Manager (Fase 2)
- [ ] DB export/import (pg_dump per module)
- [ ] nginx strip-headers proxy for X-Frame-Options
