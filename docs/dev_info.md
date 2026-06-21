# Dev Hub — Developer Reference

Complete technical reference for the Personal Dev Portal. This document is designed to give an LLM (or a new developer) the full context needed to work on any part of the codebase.

---

## Architecture Overview

The project is a monorepo with multiple independent modules, each with its own frontend (React+Vite) and backend (Ktor/Kotlin). They are all orchestrated by a single `docker-compose.yml`, except the ttyd-manager which runs natively on the host.

The **Hub** is the shell — a React app with a persistent sidebar that loads every other tool in an iframe. Iframes are never destroyed; switching between tools toggles `display:none`/`display:block` so state (scroll, forms, sessions) is preserved.

Each module is fully self-contained: its own Dockerfile, its own Postgres DB (if needed), its own API. Modules communicate only via HTTP APIs, never by sharing databases or state.

---

## Technology Versions

| Component | Version |
|---|---|
| Kotlin | 2.3.21 |
| Ktor | 3.5.0 (via `io.ktor:ktor-version-catalog:3.5.0`) |
| JDK | 21 (build: gradle:8.12-jdk21, runtime: eclipse-temurin:21-jre-jammy) |
| Gradle | 9.4.1 (via wrapper) |
| PostgreSQL | 16-alpine |
| React | 19.2.6 |
| Vite | 8.x |
| TypeScript | 6.0.x |
| Node | 22-alpine (build), nginx:alpine (serve) |
| Kafka client | 3.9.0 (kafbat-plus only) |

---

## Port Map

| Module | Frontend | Backend | DB | Notes |
|---|---|---|---|---|
| Hub | 10300 | 10303 | 10403 | Shell with sidebar + iframes |
| Kafbat+ | 10301 | 10401 | 10501 | Kafka UI |
| AI Session Manager | 10302 | 10402 | — | Reads `~/.claude` from host |
| JSON Tools | 10306 | 10406 | — | Stateless |
| Mock Data Generator | 10308 | 10408 | 10508 | AI-inferred specs + Python generator |
| ttyd Manager | — | 10600 | — | Runs on host, not in Docker |
| ttyd TUI sessions | — | — | — | 10604–10620 dynamic |

All Docker ports bind to `127.0.0.1` only. Frontends are served via nginx on port 80 inside the container, mapped to `103xx` on the host.

---

## Project Structure

```
dev-hub/
├── docker-compose.yml              # All containerized services
├── start.sh                        # Starts everything (compose + ttyd-manager)
├── stop.sh                         # Stops everything
├── .gitignore
├── README.md                       # User-facing docs
├── docs/
│   └── dev_info.md                 # This file
├── initial_prompt.md               # Original design spec (Portuguese)
│
├── hub/
│   ├── frontend/                   # React + Vite
│   │   ├── src/
│   │   │   ├── App.tsx             # Main layout: sidebar + iframe area + home/config
│   │   │   ├── main.tsx            # Entry point
│   │   │   ├── types.ts            # Entry, Folder, KeybindsConfig, PaletteConfig, HubConfig, ExportedConfig
│   │   │   ├── palettes.ts         # Theme presets (midnight, ocean, forest, ember, mono) + custom builder
│   │   │   ├── api/hubApi.ts       # Hub backend API client + ttyd-manager API client
│   │   │   ├── hooks/useKeybinds.ts # Global keyboard shortcut handler
│   │   │   └── components/
│   │   │       ├── Sidebar.tsx     # Collapsible folders, entry list, drag-and-drop
│   │   │       ├── HomeScreen.tsx  # Search + icon grid
│   │   │       ├── IframeArea.tsx  # All iframes mounted simultaneously, show/hide via CSS
│   │   │       ├── ConfigPage.tsx  # Full settings: entries CRUD, themes, keybinds, backup/restore
│   │   │       ├── EntryIcon.tsx   # Renders favicons (from backend cache or fallback)
│   │   │       └── Modal.tsx       # Reusable modal wrapper
│   │   ├── Dockerfile              # node:22-alpine build → nginx:alpine serve
│   │   └── nginx.conf              # SPA fallback + gzip
│   │
│   └── backend/                    # Ktor
│       ├── src/main/kotlin/pt/cunha/hub/
│       │   ├── Application.kt     # Module setup: plugins, routing, service wiring
│       │   ├── Database.kt        # Schema creation + seed data (folders, entries, tools auto-registration)
│       │   ├── Main.kt            # Ktor main (EngineMain)
│       │   ├── models/Models.kt   # All data classes: Entry, Folder, HubConfig, KeybindsConfig, PaletteConfig, etc.
│       │   ├── routes/
│       │   │   ├── HealthRoute.kt  # GET /health
│       │   │   ├── FoldersRoute.kt # CRUD /folders
│       │   │   ├── EntriesRoute.kt # CRUD /entries + icon management
│       │   │   └── ConfigRoute.kt  # GET/POST /config, /config/export, /config/import, /db/export, /db/import
│       │   └── services/
│       │       ├── FolderService.kt    # Folder CRUD with position ordering
│       │       ├── EntryService.kt     # Entry CRUD with folder assignment
│       │       ├── ConfigService.kt    # Key-value config + DB export/import
│       │       └── FaviconService.kt   # Async favicon fetch, cache in DB, override support, SSL bypass
│       ├── src/main/resources/
│       │   ├── application.yaml    # Port 10303, postgres connection
│       │   └── logback.xml
│       ├── build.gradle.kts        # Ktor + kotlinx-serialization + postgresql + ktor-client
│       ├── settings.gradle.kts     # Ktor version catalog 3.5.0
│       ├── gradle/libs.versions.toml
│       └── Dockerfile              # gradle build → temurin:21-jre
│
├── kafbat-plus/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx             # Topic list + message viewer + modals
│   │   │   ├── api/kafkaApi.ts     # Full Kafka API client
│   │   │   └── components/
│   │   │       ├── TopicList.tsx       # Sidebar: search, topic count, partition/message stats
│   │   │       ├── ClusterOverview.tsx # Home: broker cards, stats
│   │   │       ├── MessageViewer.tsx   # Messages tab (with filters), partitions tab, config tab
│   │   │       ├── JsonViewer.tsx      # Syntax-highlighted JSON with collapse for large payloads
│   │   │       ├── ProduceModal.tsx    # JSON editor + file upload + drag&drop + Mock Generator integration
│   │   │       └── CreateTopicModal.tsx
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   └── backend/
│       ├── src/main/kotlin/pt/cunha/kafbat/
│       │   ├── Application.kt     # Module setup
│       │   ├── Database.kt        # Config table + seed (brokers, default_limit)
│       │   ├── ConfigService.kt   # Config CRUD + DB export/import
│       │   ├── KafkaService.kt    # Admin client, consumer, producer — all Kafka operations
│       │   └── Routes.kt          # All endpoints: /config, /brokers, /cluster, /topics, /generate
│       ├── build.gradle.kts       # + kafka-clients 3.9.0
│       └── Dockerfile
│
├── ai-session-manager/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx             # Session list + detail/spending view
│   │   │   ├── api/sessionsApi.ts
│   │   │   └── components/
│   │   │       ├── SessionList.tsx       # Sidebar: search, cost, message count
│   │   │       ├── SessionDetailView.tsx # Token cards, distribution bar, turns timeline, MCP tools
│   │   │       └── SpendingOverview.tsx  # Home: total stats, by-model, by-project bars
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   └── backend/
│       ├── src/main/kotlin/pt/cunha/aisessions/
│       │   ├── Application.kt     # Module setup + all routes inline
│       │   └── SessionScanner.kt  # Filesystem scanner for ~/.claude/projects/ JSONL files
│       ├── build.gradle.kts       # No DB dependencies
│       └── Dockerfile
│
├── json-tools/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx             # Three tabs: Format, Compact, Diff — all in one file
│   │   │   └── api/jsonApi.ts
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   └── backend/
│       ├── src/main/kotlin/pt/cunha/jsontools/
│       │   └── Application.kt     # All routes + diff algorithm inline, stateless
│       ├── build.gradle.kts       # No DB
│       └── Dockerfile
│
├── mock-data-generator/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx             # Spec list sidebar + editor/upload views
│   │   │   ├── api/mockgenApi.ts
│   │   │   └── components/
│   │   │       ├── UploadPanel.tsx  # Sample paste/drop + schema upload + infer button
│   │   │       └── SpecEditor.tsx   # Field table (expandable rows), generate tab, history tab
│   │   ├── Dockerfile
│   │   └── nginx.conf
│   │
│   └── backend/
│       ├── src/main/kotlin/pt/cunha/mockgen/
│       │   ├── Application.kt     # Module setup, wires GroqProvider
│       │   ├── Database.kt        # Schema: mockgen_config, specs, spec_versions
│       │   ├── ConfigService.kt   # Config CRUD + masked output + DB export/import
│       │   ├── ai/
│       │   │   ├── AiProvider.kt   # Interface: inferSpec(samples, schema, schemaType, mode) → GenerationSpec
│       │   │   └── GroqProvider.kt # Groq implementation (OpenAI-compatible API, JSON mode)
│       │   ├── models/Models.kt   # FieldSpec, EntitySpec, GenerationSpec, ApiEndpoint, InferRequest, etc.
│       │   ├── services/
│       │   │   ├── SpecService.kt       # Spec CRUD + versioning + rollback
│       │   │   ├── GeneratorService.kt  # Builds Python script, runs via ProcessBuilder, captures output
│       │   │   └── ScriptGenerator.kt   # Generates standalone generate.py and call_api.py
│       │   └── routes/Routes.kt   # /config, /specs, /infer, /generate, /specs/{id}/export
│       ├── build.gradle.kts       # + ktor-client-core, ktor-client-cio, ktor-client-content-negotiation
│       └── Dockerfile             # temurin:21-jre + python3 + faker
│
├── ttyd-manager/                  # Runs NATIVELY on host, not in Docker
│   ├── src/main/kotlin/pt/cunha/ttydmanager/
│   │   ├── Application.kt        # Ktor server on port 10600
│   │   └── TuiManager.kt         # Process spawning, port pool 10604-10620, cleanup
│   ├── build.gradle.kts
│   ├── Dockerfile                 # Exists but unused — kept for reference
│   └── settings.gradle.kts
│
└── backend-template/              # Ktor starter to copy for new modules
    ├── src/main/kotlin/           # Sample CitySchema, Routing, Postgres, etc.
    ├── build.gradle.kts
    └── settings.gradle.kts
```

---

## Database Schemas

### Hub DB (port 10403, db: hub, user: hub)

```sql
folders (id SERIAL PK, name VARCHAR(255), position INT)
entries (id SERIAL PK, label VARCHAR(255), url TEXT, type VARCHAR(50),
         folder_id INT FK→folders, position INT, workdir TEXT, command TEXT)
entry_icons (entry_id INT PK FK→entries, favicon_data BYTEA, favicon_content_type VARCHAR(100),
             override_data BYTEA, override_content_type VARCHAR(100), override_url TEXT, last_fetched TIMESTAMPTZ)
hub_config (key VARCHAR(255) PK, value TEXT)
```

Seed data: folders (Infra, Dev, Observabilidade, Tools), placeholder redirect entries, tool entries for Kafbat+/AI Sessions/JSON Tools/Mock Generator, pg tool paths.

### Kafbat+ DB (port 10501, db: kafbat, user: kafbat)

```sql
kafbat_config (key VARCHAR(255) PK, value TEXT)
```

Seed: `brokers=localhost:9092`, `default_limit=100`.

### Mock Generator DB (port 10508, db: mockgen, user: mockgen)

```sql
mockgen_config (key VARCHAR(255) PK, value TEXT)
specs (id SERIAL PK, name VARCHAR(255), mode VARCHAR(50), spec_json TEXT,
       version INT DEFAULT 1, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ)
spec_versions (id SERIAL PK, spec_id INT FK→specs, version INT,
               spec_json TEXT, created_at TIMESTAMPTZ)
```

Seed: `groq_api_key=` (empty), `groq_model=llama-3.3-70b-versatile`, `faker_locale=en_US`.

---

## API Reference

### Hub Backend (10303)

| Method | Path | Description |
|---|---|---|
| GET | /health | `{"status":"ok"}` |
| GET | /folders | List all folders with their entries |
| POST | /folders | Create folder `{name}` |
| PUT | /folders/{id} | Update folder `{name?, position?}` |
| DELETE | /folders/{id} | Delete folder |
| GET | /entries | List all entries |
| POST | /entries | Create entry `{label, url?, type, folderId?, position, workdir?, command?}` |
| PUT | /entries/{id} | Update entry (partial) |
| DELETE | /entries/{id} | Delete entry |
| GET | /entries/{id}/icon | Get icon bytes (override → favicon → 404) |
| POST | /entries/{id}/icon | Set icon (JSON `{url}` or multipart file upload) |
| DELETE | /entries/{id}/icon | Clear icon override |
| POST | /entries/{id}/icon/refresh | Re-fetch favicon from entry URL |
| GET | /config | Get hub config (pg paths, keybinds, palette) |
| POST | /config | Update config (partial) |
| GET | /config/export | Export config + folders + entries as JSON |
| POST | /config/import | Import config JSON |
| GET | /db/export | Export full DB as SQL INSERT statements |
| POST | /db/import | Import SQL (replaces all data) |

### Kafbat+ Backend (10401)

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /config | Get config (brokers, default_limit) |
| POST | /config | Update config |
| GET | /config/export | Export config |
| POST | /config/import | Import config |
| GET | /db/export | Export DB as SQL |
| POST | /db/import | Import SQL |
| GET | /cluster | Cluster overview (brokers, topic count, partitions, controller) |
| GET | /brokers | List brokers with host/port/controller status |
| GET | /topics | List topics `?search=&showInternal=` |
| POST | /topics | Create topic `{name, partitions, replicationFactor}` |
| GET | /topics/{topic} | Topic details (partitions, configs) |
| DELETE | /topics/{topic} | Delete topic |
| GET | /topics/{topic}/messages | Read messages `?limit=&search=&key=&from=&to=&partition=` |
| POST | /topics/{topic}/produce | Produce message `{key?, value, headers?, partition?}` |

### AI Session Manager Backend (10402)

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /config | `{claudeDir}` |
| GET | /config/export | Export config |
| POST | /config/import | No-op (config is in application.yaml) |
| GET | /sessions | List sessions `?tool=claude-code` |
| GET | /sessions/{id} | Session detail with turns and MCP tools |
| GET | /spending | Spending report `?tool=claude-code` |
| GET | /projects | List projects with session counts |

### JSON Tools Backend (10406)

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| POST | /format | `{json, indent?}` → `{result, valid, error?}` |
| POST | /compact | `{json}` → `{result, valid, error?}` |
| POST | /diff | `{left, right}` → `{equal, differences[], leftValid, rightValid, error?}` |

### Mock Data Generator Backend (10408)

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /config | Get config (masked API key) |
| POST | /config | Update config `{groq_api_key?, groq_model?, faker_locale?}` |
| GET | /config/export | Export config (unmasked) |
| POST | /config/import | Import config |
| GET | /db/export | Export DB as SQL |
| POST | /db/import | Import SQL |
| GET | /specs | List all specs |
| GET | /specs/{id} | Get spec by ID |
| PUT | /specs/{id} | Update spec (creates new version) |
| DELETE | /specs/{id} | Delete spec and all versions |
| GET | /specs/{id}/history | Version history |
| POST | /specs/{id}/rollback/{version} | Rollback to version |
| POST | /infer | Infer spec from samples `{name, mode, samples[], schema?, schemaType?}` |
| POST | /generate | Generate data `{specId, count, profile, seed?, entityName?}` |
| GET | /specs/{id}/export | Download Python script `?type=generate\|call_api` |

### ttyd Manager (10600, runs on host)

| Method | Path | Description |
|---|---|---|
| GET | /health | Health check |
| GET | /tuis | List active TUI sessions |
| POST | /tuis | Create TUI `{name, workdir, command}` → assigns port from 10604-10620 |
| DELETE | /tuis/{id} | Kill TUI process and reclaim port |

---

## Key Design Decisions

### Iframe State Preservation
All iframes for all entries are mounted in the DOM at all times (IframeArea.tsx). Navigation only toggles `display:none`/`display:block`. This means switching to ArgoCD after being in Kafbat+ for an hour doesn't lose your ArgoCD session.

### Hub is Pure Infra
The hub backend only manages entries, folders, icons, and config. It never contains business logic for other modules. Module auto-registration happens via DB seed in `Database.kt` — the seed inserts `tool` entries pointing to each module's frontend URL.

### ttyd Runs on Host
The ttyd-manager runs natively (not in Docker) so TUI tools can access the host's binaries, configs, and filesystems directly. `k9s` uses `~/.kube/config`, `lazydocker` talks to the host Docker socket, etc. The `start.sh` script handles this: it starts docker-compose for everything else, then launches the ttyd-manager jar as a background process.

### Mock Generator: LLM Infers Spec, Never Data
The AI (Groq) runs once to produce a structured `GenerationSpec` from samples. All actual data generation is done by a deterministic Python script (Faker) that reads the spec. This means generating 10,000 records costs zero API calls.

### Two-Pass Generation with Referential Coherence
Pass 1 generates all entities and collects IDs into pools keyed by `entityName.fieldName`. Pass 2 resolves `reference-to-other-field` sources by picking from existing pools. This ensures foreign keys always point to real IDs.

### AI Provider Abstraction
`AiProvider` interface has a single method: `inferSpec(samples, schema, schemaType, mode) → GenerationSpec`. `GroqProvider` implements it using the Groq API (OpenAI-compatible, JSON mode). Adding Anthropic/OpenAI means implementing the same interface — the rest of the system doesn't change.

### Config in DB, Not Files
All module config lives in a key-value table in its Postgres DB (or in application.yaml for modules without DB). This means config is backed up with `GET /db/export` and restored with `POST /db/import`. Sensitive values (API keys) are masked in `GET /config` responses but returned unmasked in `GET /config/export`.

### Favicon Resolution
When an entry with a URL is created, the hub backend asynchronously fetches `/favicon.ico` (or parses `<link rel="icon">` from the HTML). The result is cached as bytes + content-type in `entry_icons`. Users can override with their own icon (upload or URL). SSL certificate validation is bypassed for favicon fetches because local tools often use self-signed certs.

---

## Module Communication

```
Hub Frontend (10300)
  ├── iframes → Kafbat+ Frontend (10301)
  │                └── calls → Kafbat+ Backend (10401) → Kafka brokers
  │                └── calls → Mock Generator Backend (10408) [optional, for "Generate payload"]
  ├── iframes → AI Sessions Frontend (10302)
  │                └── calls → AI Sessions Backend (10402) → reads ~/.claude filesystem
  ├── iframes → JSON Tools Frontend (10306)
  │                └── calls → JSON Tools Backend (10406)
  ├── iframes → Mock Generator Frontend (10308)
  │                └── calls → Mock Generator Backend (10408) → Groq API (for inference)
  │                                                           → Python subprocess (for generation)
  ├── iframes → ttyd sessions (10604-10620) [served by host ttyd processes]
  └── calls → Hub Backend (10303) → Hub DB (10403)
                                  → ttyd Manager API (10600)
```

Dependencies between modules are unidirectional and optional:
- Kafbat+ → Mock Generator: "Generate payload" button in produce modal. If Mock Generator is down, button is hidden.
- Hub → ttyd Manager: creating TUI entries calls ttyd-manager API. If ttyd-manager is down, TUI creation fails but everything else works.

---

## Frontend Patterns

### Styling
All frontends use inline styles (no CSS-in-JS library, no CSS modules). CSS variables are defined in `index.css` for colors/theme. Each module has its own accent color:
- Hub: purple (`#a78bfa` / configurable via palettes)
- Kafbat+: indigo (`#6366f1`)
- AI Sessions: violet (`#8b5cf6`)
- JSON Tools: amber (`#f59e0b`)
- Mock Generator: emerald (`#10b981`)

### Common UI Components
Each module defines its own components (no shared component library). Common patterns:
- Sidebar on the left (280-320px), main content on the right
- Toast notifications for save/error feedback
- Modals with backdrop blur + click-outside-to-close
- Tables with expandable rows for detail views
- Monospace font for data display (JetBrains Mono / Fira Code)

### API Clients
Each frontend has an `api/` directory with a typed API client. Pattern:
```typescript
const BASE = 'http://localhost:PORT'
async function req<T>(path: string, opts?: RequestInit): Promise<T> { ... }
export const api = { method: () => req('/path'), ... }
```

---

## Backend Patterns

### Application Module
Every backend follows the same structure in `Application.kt`:
1. Initialize Database (if applicable)
2. Create services
3. Install Ktor plugins: ContentNegotiation (JSON), CORS (anyHost), DefaultHeaders, StatusPages
4. Define routing: health + module-specific routes

### Database Connection
Direct JDBC with `java.sql.Connection`. No ORM. Connection is created once at startup with retry logic (30 attempts, 2s interval). Schema is created with `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for migrations.

### CORS
All backends allow all origins (`anyHost()`) with all methods. This is fine because everything runs on localhost.

### Error Handling
StatusPages catches:
- `IllegalArgumentException` → 400
- `NoSuchElementException` → 404
- `Throwable` → 500 with log

### Serialization
`kotlinx.serialization` with `@Serializable` data classes. JSON configured with `ignoreUnknownKeys = true`.

---

## Build & Deploy

### Frontend Build
```dockerfile
FROM node:22-alpine AS build
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY dist/ /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
```

### Backend Build
```dockerfile
FROM gradle:8.12-jdk21 AS build
COPY . .
RUN gradle shadowJar --no-daemon -x test

FROM eclipse-temurin:21-jre-jammy
COPY build/libs/*-all.jar app.jar
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Mock Generator's Dockerfile also installs `python3` + `faker` in the runtime image.

### Local Development
```bash
# Frontend hot reload
cd <module>/frontend && npm install && npm run dev  # port 5173

# Backend
cd <module>/backend && ./gradlew run

# Build jar only
cd <module>/backend && ./gradlew shadowJar
```

---

## Adding a New Module

1. `cp -r backend-template/ <module>/backend/`
2. `cd <module> && npm create vite@latest frontend -- --template react-ts && cd frontend && npm install`
3. Clean template files from backend: remove `CitySchema.kt`, `DI.kt`, `Koin.kt`, etc. Create package dir under `src/main/kotlin/pt/cunha/<module>/`
4. Update `settings.gradle.kts`: set `rootProject.name`
5. Update `build.gradle.kts`: set group, remove unused deps (h2, koin, swagger)
6. Update `gradle/libs.versions.toml`: remove unused versions
7. Update `application.yaml`: set port and module class
8. Implement mandatory endpoints: `GET /health`, `GET/POST /config`, `GET/POST /config/export`, `GET/POST /config/import`, `GET/POST /db/export` (if DB)
9. Add to `docker-compose.yml` (frontend + backend + db if needed)
10. Add seed entry in `hub/backend/.../Database.kt` → `seedIfEmpty()` with type `tool`
11. Clean frontend: remove `App.css`, `assets/`, update `main.tsx`, `index.css`, `App.tsx`
12. Create `Dockerfile` and `nginx.conf` for frontend

Port convention: assign next free `xx` suffix → frontend `103xx`, backend `104xx`, DB `105xx`.

---

## Claude Code Session Format (for AI Session Manager)

Sessions are stored in `~/.claude/projects/<project-dir-name>/`:
- `<session-id>.jsonl` — one JSON object per line
- `<session-id>/` — directory with session artifacts

JSONL message types:
- `permission-mode` — `{type, permissionMode, sessionId}`
- `ai-title` — `{type, aiTitle, sessionId}` — conversation title
- `user` — `{type, message: {role, content}, timestamp?, parentUuid, ...}`
- `assistant` — `{type, message: {model, id, role, content, usage, ...}, timestamp, version, ...}`
  - `usage` contains: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`
- `system` — system messages (commands, etc.)
- `attachment` — file/directory/deferred_tools attachments
- `bridge-session` — bridge session info
- `last-prompt` — last user prompt text

Global session registry: `~/.claude/sessions/<pid>.json` with `{pid, sessionId, cwd, version, status, ...}`.

Cost estimation uses per-model pricing (per million tokens):
- Sonnet 4.x: $3 input, $15 output
- Opus 4.x: $15 input, $75 output
- Haiku 4.5: $0.80 input, $4 output
- Cache read: 10% of input price
- Cache creation: 125% of input price

---

## Mock Data Generator — Spec Format

The `GenerationSpec` is the core data model:

```json
{
  "entities": [{
    "name": "OrderEvent",
    "fields": [{
      "name": "id",
      "type": "string",              // string|integer|number|boolean|array|object
      "source": "faker-provider",     // enum-from-samples|regex-template|range|faker-provider|constant|reference-to-other-field
      "fakerProvider": "uuid4",       // Faker method name
      "pattern": null,                // regex observed in samples
      "template": null,               // e.g. "ORD-{###}"
      "enumValues": null,             // ["active","inactive"] for enum source
      "enumWeights": null,            // [0.7, 0.3] frequency weights
      "rangeMin": null,               // for range source
      "rangeMax": null,
      "constant": null,               // for constant source
      "nullable": false,
      "nullRate": 0.0,                // 0.0–1.0, observed from samples
      "unique": true,
      "isKey": true,                  // primary key
      "conditionalOn": null,          // field name this depends on
      "conditionalValue": null,       // value the other field must have
      "correlatedWith": null,         // e.g. "createdAt"
      "correlationType": null,        // "greater_than"|"subset_of"|"same_entity"
      "referenceEntity": null,        // for FK: entity name
      "referenceField": null,         // for FK: field name in referenced entity
      "maxLength": null,
      "minLength": null,
      "children": null                // for object/array types: nested FieldSpec[]
    }]
  }],
  "mode": "kafka",                    // "kafka"|"api"
  "apiBaseUrl": null,                 // for API mode
  "apiEndpoints": null                // [{method, path, entityName, headers?}]
}
```

Generation profiles:
- `valid` — respects all constraints
- `invalid` — randomly violates one constraint per record (~15% chance per field): null a required field, wrong type, overflow maxLength
- `edge` — boundary values: 0, -1, empty string, max-length string, range min/max

Generated Python scripts import `auth_util` and call `auth_util.get_token()` for JWT auth in `call_api.py`. The `auth_util` module is assumed to exist in the execution environment — the Mock Generator does not create or manage it.

---

## Groq Integration

The `GroqProvider` calls `https://api.groq.com/openai/v1/chat/completions` with:
- Model: configurable (default `llama-3.3-70b-versatile`)
- Temperature: 0.1 (near-deterministic)
- `response_format: {type: "json_object"}` (forces valid JSON output)
- Max tokens: 8192
- System prompt instructs the LLM to output a `GenerationSpec` JSON
- User prompt contains the samples (truncated to 4000 chars each) + optional schema (6000 chars)

API key is stored in `mockgen_config` table, set via `POST /config`, masked in `GET /config`.

---

## Known Limitations & TODO

- Hub DB export/import uses JDBC-based SQL INSERT dumps, not `pg_dump`. Works for small datasets but doesn't handle sequences, constraints, or binary data perfectly.
- No hub-level aggregated backup (export all modules in one zip) — each module's backup is separate.
- `X-Frame-Options` / CSP headers on external services can block iframes. No strip-headers nginx proxy is set up.
- FolderService doesn't return `workdir`/`command` fields in its entry query (only `EntryService` does). This doesn't affect the UI because those fields are only needed for TUI entries, which go through EntryService.
- The ttyd-manager doesn't persist sessions across restarts. If the process dies, all TUI sessions are lost and ports are reclaimed.
- Mock Generator's Python subprocess has no timeout — a malformed spec could hang the generation.
- Kafbat+ consumer uses ephemeral consumer groups (random UUID per request), so it doesn't track offsets.
