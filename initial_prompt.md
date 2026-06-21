# Personal Dev Portal — Plano Completo

## Visão Geral

Plataforma local pessoal de desenvolvimento, correndo inteiramente em localhost via Docker Compose único. É um hub com sidebar persistente, iframes para cada ferramenta, e módulos próprios com backend + frontend + base de dados isolados por container.

Objetivo: ter tudo acessível num único tab do browser, sem perder estado ao navegar entre ferramentas.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontends | React + Vite (TypeScript) |
| Backends | Ktor (Kotlin) |
| Bases de dados | PostgreSQL |
| Infraestrutura | Docker Compose único |
| TUIs expostas como web | ttyd |

---

## Convenção de Portas

Cada módulo tem um sufixo `xx` consistente entre frontend / backend / db.

| Módulo | Frontend (103xx) | Backend (104xx) | DB (105xx) |
|---|---|---|---|
| Hub | 10300 | 10303 | 10403 |
| Kafbat+ | 10301 | 10401 | 10501 |
| AI Session Manager | 10302 | 10402 | 10502 |
| RTK Helper | 10305 | 10405 | 10505 |
| JSON Tools | 10306 | 10406 | — |
| GitLab MR Dashboard | 10307 | 10407 | — |
| ttyd Manager | 10604–10620 (dinâmico) | — | — |

Extras em `106xx`. O ttyd-manager ocupa o range `10604–10620` dinamicamente conforme as TUIs configuradas.

---

## Arquitetura Geral

```
personal-dev-portal/
├── docker-compose.yml
├── hub/
│   ├── frontend/          # React + Vite — 10300
│   └── backend/           # Ktor — 10303 (+ Postgres 10403)
├── kafbat-plus/
│   ├── frontend/          # React + Vite — 10301
│   └── backend/           # Ktor — 10401 (+ Postgres 10501)
├── ai-session-manager/
│   ├── frontend/          # React + Vite — 10302
│   └── backend/           # Ktor — 10402 (+ Postgres 10502)
├── rtk-helper/
│   ├── frontend/          # React + Vite — 10305
│   └── backend/           # Ktor — 10405 (+ Postgres 10505)
├── json-tools/
│   ├── frontend/          # React + Vite — 10306
│   └── backend/           # Ktor — 10406 (stateless, sem DB)
├── gitlab-mr/
│   ├── frontend/          # React + Vite — 10307
│   └── backend/           # Ktor — 10407 (stateless, sem DB)
└── ttyd-manager/          # Ktor — gere TUIs em 10604–10620
```

Cada módulo é independente. O hub sabe os URLs de cada um. Adicionar um módulo novo = novo serviço no compose + registo no hub.

---

## Tipos de Entries no Hub

O hub suporta três tipos de entries na sidebar:

1. **Tool própria** — container no compose, frontend dedicado, aparece como iframe no hub
2. **Redirect puro** — só um URL externo (ex: ArgoCD, Kafbat dev env, Keycloak Admin, Portainer), abre em iframe
3. **TUI via ttyd** — processo terminal exposto como webpage via ttyd, aparece em iframe

---

## Redirects e TUIs Default

O hub arranca com um conjunto de entries pré-configuradas (seed na BD do hub no primeiro arranque). Todas editáveis/removíveis no config card — são só um ponto de partida.

### Redirects (pasta "Infra")
| Nome | URL (exemplo) | Notas |
|---|---|---|
| Portainer | `https://localhost:9443` | Container management |
| ArgoCD (dev) | `https://argocd.dev.<empresa>` | GitOps / deploy status |
| Kafbat (dev) | `http://kafbat.dev.<empresa>` | Kafka UI do ambiente dev |
| Keycloak Admin | `https://keycloak.dev.<empresa>/admin` | Identity / realms / clients |

### Redirects (pasta "Dev")
| Nome | URL (exemplo) | Notas |
|---|---|---|
| GitLab (empresa) | `https://gitlab.<empresa>` | Repos, MRs, pipelines |
| Confluence | `https://<empresa>.atlassian.net/wiki` | Documentação |
| Jira | `https://<empresa>.atlassian.net` | Tasks / boards |
| SonarQube | `https://sonar.dev.<empresa>` | Code quality / security |

### Redirects úteis (pasta "Observabilidade") — opcionais
| Nome | URL (exemplo) | Notas |
|---|---|---|
| Grafana | `https://grafana.dev.<empresa>` | Dashboards / métricas |
| Kibana / OpenSearch | `https://kibana.dev.<empresa>` | Logs |
| Kubernetes Dashboard | `https://k8s-dash.dev.<empresa>` | Cluster overview |

### TUIs default (via ttyd-manager)
| Nome | Comando | Notas |
|---|---|---|
| k9s | `k9s` | Navegação do cluster k8s |
| lazydocker | `lazydocker` | Containers/logs no terminal |
| Tool do colega | `<comando>` | k9s + redis + kafka integrados |
| bash | `bash` | Shell genérico |

URLs e comandos são placeholders — preenchidos no config card com os endereços reais do ambiente. Os que não se aplicam removem-se com um clique.

---

## Convenções Globais

Regras transversais que todos os módulos seguem.

### Configuração e credenciais
- **Tudo o que for configuração ou autenticação vai para o config card do serviço.** PATs, URLs, paths de binários, credenciais — nada hardcoded no código ou no compose.
- Campos sensíveis (tokens, passwords) são apresentados masked no UI.
- Cada backend de módulo próprio expõe `GET /config` e `POST /config`.

### Endpoints obrigatórios por backend
Todo o backend de módulo próprio (presente e futuro) implementa:

| Endpoint | Obrigatório | Descrição |
|---|---|---|
| `GET /config` | sempre | Lê configuração atual |
| `POST /config` | sempre | Atualiza configuração |
| `GET /health` | sempre | Healthcheck (para o hub saber se está up) |
| `GET /config/export` | se tem config | Exporta config como JSON portável |
| `POST /config/import` | se tem config | Importa config a partir de JSON |
| `GET /db/export` | se tem DB | Dump da base de dados |
| `POST /db/import` | se tem DB | Restore da base de dados |

### CORS
Todos os backends permitem requests do hub frontend (`http://localhost:10300`). Como tudo corre em localhost, configurar CORS permissivo para a origem do hub.

### Convenção de portas
- Frontends: `103xx`
- Backends: `104xx`
- DBs: `105xx`
- Extras (ttyd-manager e as suas TUIs): `106xx`
- O sufixo `xx` é igual entre frontend/backend/db do mesmo módulo.

### Adicionar um módulo novo
1. Criar pasta `nome-modulo/` com `frontend/` e `backend/`
2. Atribuir o próximo `xx` livre
3. Implementar os endpoints obrigatórios
4. Adicionar os serviços ao `docker-compose.yml`
5. Registar a entry no hub (tipo "Tool própria")

---

## Módulo 1 — Hub

### Frontend (10300)

**Layout:**
- Sidebar persistente sempre visível, mesmo com iframe ativo
- Controlos de navegação (mudar de app, navegar pastas) ficam fora do iframe
- Iframe ocupa o espaço restante a 100%

**Home screen** (quando nenhum iframe está ativo):
- Barra de pesquisa de serviços
- Grid de ícones por entry (nome + ícone)
- Clique numa entry abre o iframe correspondente

**Sidebar:**
- Organizada em pastas (ex: "Kafka", "Auth", "AI", "Infra")
- Cada pasta é colapsável
- Entries dentro das pastas: ícone + label
- **Ícones automáticos** — para cada entry, o hub tenta buscar o favicon do serviço a partir do seu URL (ex: `<url>/favicon.ico`, ou parsing do `<link rel="icon">` do HTML). É feito pelo backend do hub para evitar problemas de CORS, e o resultado é cacheado na BD.
- **Override manual** — cada entry pode ter um ícone próprio definido pelo utilizador (upload de imagem ou URL de ícone), que tem prioridade sobre o favicon automático. Fallback para um ícone genérico se nenhum estiver disponível.
- Drag-and-drop de entries entre pastas
- Pasta "Config" fixa no fundo para abrir a página de configuração

**State preservation:**
- Ao navegar entre apps, os iframes **não são destruídos nem recriados**
- Todos os iframes ficam montados no DOM simultaneamente
- Navegação apenas faz `display: none` / `display: block` via CSS
- Preserva estado de tools próprias e de serviços externos (sessões, scroll, formulários)

### Backend (10303) + DB Postgres (10403)

Persiste e gere toda a configuração do hub.

**O que persiste em DB:**
- Lista de entries (id, label, url, tipo, pasta, ordem/posição)
- Lista de pastas (id, nome, ordem)
- Ícones: favicon cacheado por entry (bytes + content-type) e override do utilizador, se definido

**Endpoints:**
- `GET /entries` — lista todas as entries com pasta e tipo
- `POST /entries` — adicionar entry
- `PUT /entries/{id}` — editar entry (URL, label, pasta, ordem)
- `DELETE /entries/{id}` — remover entry
- `GET /entries/{id}/icon` — devolve o ícone da entry (override do utilizador se existir, senão favicon cacheado, senão fallback)
- `POST /entries/{id}/icon` — define ícone override (upload de imagem ou URL)
- `DELETE /entries/{id}/icon` — remove o override, volta a usar o favicon automático
- `POST /entries/{id}/icon/refresh` — força nova fetch do favicon a partir do URL
- `GET /folders` — lista pastas
- `POST /folders` — criar pasta
- `DELETE /folders/{id}` — remover pasta
- `GET /config` — retorna configuração atual (para o card na Config page)
- `POST /config` — atualizar configuração

**Resolução de ícones (backend):**
- Ao adicionar/editar uma entry com URL, o backend tenta buscar o favicon: primeiro `<url>/favicon.ico`, depois parsing do `<link rel="icon">` / `apple-touch-icon` do HTML da página.
- O favicon é cacheado na BD (bytes + content-type) para não refetch a cada render.
- Para TUIs (sem URL web próprio) e entries sem favicon, usa fallback genérico ou o override do utilizador.

**Config UI do Hub** (card na Config page):
- Select de tipo: `Redirect puro` | `TUI redirect` | *(futuros tipos)*
- Textfield de URL + botão `+` para adicionar mais URLs
- Gestão de pastas (criar, renomear, remover)
- Lista de entries com drag-and-drop entre pastas

---

## Módulo 2 — Kafbat+

Instância local de UI para Kafka, construída do zero.

### Features

- **Auto-descoberta de brokers** — tenta ligar a brokers configurados via `/config`, lista os que estão up
- **Listar topics** — sidebar com todos os topics do broker, com barra de pesquisa para filtrar por nome
- **Ver mensagens recentes** — consumer que lê as últimas N mensagens de um topic, apresentadas em painel com scroll
- **Pesquisa dentro de um topic** — filtrar mensagens por substring do valor, por key exata, ou por intervalo de timestamp
- **Produce mensagem** — editor JSON inline para escrever e enviar mensagem para um topic
- **Drag & drop / filepicker de JSON** — na página de um topic específico, arrastar um ficheiro `.json` ou usar filepicker abre um modal com:
  - Preview editável do conteúdo JSON
  - Tamanho do ficheiro indicado
  - Botões: Enviar / Editar / Cancelar
- **Deserialização:**
  - JSON puro por defeito — tenta parse e apresenta formatado
  - Fallback para raw bytes com opção de decode manual
  - **gRPC ready** — upload de ficheiro `.proto`, decode on-the-fly com `grpcio` / `protobuf` (Python sidecar ou integrado no backend Ktor via library)

### Frontend (10301)

- Sidebar com lista de topics + barra de pesquisa de topics
- Painel principal: mensagens recentes do topic selecionado
- Barra de filtro no painel de mensagens: pesquisa por substring, key, ou timestamp
- Zona de drag & drop visível na página do topic (ou botão filepicker alternativo)
- Modal de envio: preview JSON editável + tamanho do ficheiro + botões Enviar / Cancelar
- Botão "Produce": abre modal com editor JSON para escrever manualmente
- Botão "Upload .proto": para ativar decode gRPC

### Backend (10401) + DB Postgres (10501)

**Endpoints:**
- `GET /brokers` — lista brokers configurados e estado (up/down)
- `GET /topics` — lista topics do broker ativo
- `GET /topics?search=termo` — lista topics filtrados por nome
- `GET /topics/{topic}/messages?limit=50` — últimas N mensagens
- `GET /topics/{topic}/messages?search=substring` — filtra por substring do valor
- `GET /topics/{topic}/messages?key=valor` — filtra por key exata
- `GET /topics/{topic}/messages?from=timestamp&to=timestamp` — filtra por intervalo de timestamp
- `POST /topics/{topic}/produce` — envia mensagem JSON
- `POST /topics/{topic}/produce/file` — upload de JSON via filepicker/drag & drop e envia
- `POST /proto/upload` — faz upload de `.proto` para decode gRPC
- `GET /config` — retorna configuração atual
- `POST /config` — atualiza configuração (broker URLs, etc.)

**Config card:**
- Lista de broker URLs (textfield + botão `+` para adicionar mais)
- Limit de mensagens por defeito

---

## Módulo 3 — AI Session Manager

"Portainer para AI" — gestão visual de sessões Claude Code e OpenCode.

### Features

- **Scan de sessões** — lê os diretórios configurados para encontrar sessões de Claude Code e OpenCode. Path de pesquisa é configurável no card do próprio módulo na Config page.
- **Switch entre ferramentas** — toggle entre Claude Code e OpenCode. Ao trocar, a lista de conversas, spending e métricas mudam para refletir apenas a ferramenta selecionada.
- **Lista de conversas** — por ferramenta ativa, mostra todas as conversas encontradas com: nome/título, data da última mensagem, custo estimado total da conversa
- **Contagem de tokens e custo** — tokens consumidos por conversa e total acumulado, custo estimado em €/$
- **Contexto ativo** — mostra o contexto carregado na sessão atual
- **MCP tools em uso** — lista de MCP tools ativas na sessão

### Frontend (10302)

- Toggle Claude Code / OpenCode no topo — troca toda a vista
- Lista de conversas da ferramenta ativa (título, última interação, custo)
- Painel de detalhe ao clicar numa conversa: tokens, custo, MCPs, contexto ativo
- Spending total visível (por ferramenta e global)

### Backend (10402) + DB Postgres (10502)

- Volume mount read-only nos diretórios configurados para scan do filesystem
- Parsing de ficheiros de sessão do Claude Code e OpenCode
- Cálculo de tokens (via tiktoken ou equivalente JVM)
- Persiste histórico de consumo por conversa em DB

**Endpoints:**
- `GET /sessions?tool=claude-code|opencode` — lista conversas da ferramenta especificada
- `GET /sessions/{id}` — detalhe de uma conversa (tokens, custo, MCPs, contexto)
- `GET /spending?tool=claude-code|opencode` — spending total por ferramenta
- `GET /config` — configuração atual
- `POST /config` — atualiza (diretórios a monitorizar, preço por token, etc.)

**Config card:**
- Textfields para paths de diretórios a monitorizar (com botão `+` para adicionar mais)
- Preço por token configurável (para cálculo de custo em €/$)

---

## Módulo 4 — ttyd Manager (106xx dinâmico)

Em vez de um container ttyd por TUI hardcoded no compose, há um único serviço **ttyd-manager** que gere todas as TUIs dinamicamente.

### Como funciona

O ttyd-manager é um backend leve (Ktor) que:
1. Lê a sua config (lista de TUIs: nome + comando + porta atribuída)
2. Faz spawn de processos `ttyd` internamente, cada um numa porta diferente dentro do range `106xx`
3. Expõe uma API para criar, remover e listar TUIs em tempo real — sem reiniciar o compose
4. Cada TUI ativa é registada no hub como entry do tipo `TUI redirect` apontando para `http://localhost:106xx`

Adicionar uma TUI nova = ir ao config card do ttyd-manager, escrever nome + comando → manager sobe o processo e o hub recebe a nova entry automaticamente.

### Compose

```yaml
  ttyd-manager:
    build: ./ttyd-manager
    ports:
      - "10604-10620:10604-10620"  # range para as TUIs dinâmicas
    volumes:
      - /usr/local/bin:/usr/local/bin:ro  # acesso aos binários das TUIs
```

Um único serviço no compose. O range de portas cobre as TUIs que o manager vai lançar internamente.

### API do ttyd-manager

- `GET /tuis` — lista TUIs ativas (nome, comando, porta, estado)
- `POST /tuis` — lança nova TUI (nome + comando), atribui próxima porta livre em `106xx`
- `DELETE /tuis/{id}` — mata o processo ttyd correspondente
- `GET /config` — configuração atual (lista de TUIs persistida)
- `POST /config` — atualiza configuração

### Config card

- Lista de TUIs com nome + comando + porta atribuída
- Botão `+` para adicionar nova TUI (textfield de nome + textfield de comando)
- Botão de remover por entry
- Estado de cada TUI (running / stopped)

---

## Módulo 5 — RTK Helper (10305 / 10405 / 10505)

Ferramenta de gestão do ficheiro `filters.toml` do RTK (token filter), com histórico de versões e aplicação controlada.

### Features

- **Ver stats** — corre `rtk gain` e apresenta o output (tokens poupados, ratio, etc.) no UI
- **Ver e editar `filters.toml`** — editor de texto com syntax highlighting para TOML
- **Pesquisa** — filtrar entradas do ficheiro por substring ou regex de comandos/regras
- **Edição não-destrutiva** — todas as alterações feitas no UI são apenas locais até clicar em **Apply**
- **Apply com backup automático** — ao aplicar:
  1. O ficheiro atual em disco é lido e guardado na BD com timestamp e metadados (quando existia, quando foi substituído)
  2. O novo conteúdo é escrito no path configurado
- **Histórico de versões** — lista de versões anteriores do `filters.toml` com timestamp, possibilidade de ver o diff e fazer rollback

### Frontend (10305)

- Editor de texto principal com o conteúdo atual do `filters.toml`
- Barra de pesquisa por substring/regex para filtrar regras visíveis
- Painel lateral de stats (`rtk gain` output)
- Botão **Apply** — aplica o ficheiro editado (guarda backup, escreve no path)
- Botão **Discard** — descarta alterações locais
- Secção de histórico: lista de versões anteriores com timestamp, botão de ver diff e botão de rollback

### Backend (10405) + DB Postgres (10505)

- Lê o `filters.toml` do path configurado
- Executa `rtk gain` e devolve o output
- Ao aplicar: guarda versão anterior na BD, escreve novo ficheiro no path
- Persiste histórico de versões em DB (conteúdo + timestamp criação + timestamp substituição)

**Endpoints:**
- `GET /filters` — devolve conteúdo atual do `filters.toml`
- `POST /filters/apply` — recebe novo conteúdo, faz backup do atual na BD, escreve no path
- `GET /filters/history` — lista versões anteriores (id, timestamp, tamanho)
- `GET /filters/history/{id}` — conteúdo de uma versão específica
- `POST /filters/rollback/{id}` — restaura uma versão anterior (faz backup do atual primeiro)
- `GET /stats` — corre `rtk gain` e devolve output
- `GET /config` — configuração atual
- `POST /config` — atualiza configuração

**Config card:**
- Path para o `filters.toml` (textfield)
- Path para o binário `rtk` (textfield)

---

## Módulo 6 — JSON Tools (10306 / 10406)

Ferramenta self-hosted para trabalhar com JSON — diff, formatação e compactação. Sem BD (tudo stateless, processamento no backend).

### Features

- **Formatter** — recebe JSON e devolve formatado com indentação configurável
- **Compacter** — colapsa JSON para uma única linha (minify)
- **Diff viewer** — compara dois JSONs lado a lado, highlighting de diferenças (campos adicionados, removidos, alterados)

### Frontend (10306)

- Três tabs: **Format**, **Compact**, **Diff**
- **Format / Compact:** textarea de input + botão + output com copy-to-clipboard
- **Diff:** dois painéis de input lado a lado + painel de resultado com diff colorido (verde = adicionado, vermelho = removido, amarelo = alterado)
- Drag & drop ou paste direto de JSON em qualquer textarea

### Backend (10406)

Stateless — sem DB.

**Endpoints:**
- `POST /format` — recebe JSON, devolve formatado (`{ "json": "...", "indent": 2 }`)
- `POST /compact` — recebe JSON, devolve minificado
- `POST /diff` — recebe dois JSONs (`left` e `right`), devolve diff estruturado

---

## Módulo 7 — GitLab MR Dashboard (10307 / 10407)

Dashboard pessoal de Merge Requests, ligado ao GitLab self-hosted da empresa via Personal Access Token. Stateless — sem BD.

### Features

- **MRs assigned to me** — lista de MRs onde és assignee, com título, projeto, autor, estado, e número de threads abertos/totais
- **MRs to review** — lista de MRs onde és reviewer, com os mesmos dados
- **Threads abertos** — por MR, mostra quantos threads estão por resolver
- **Links diretos** — cada MR tem botão para abrir diretamente no GitLab (abre nova tab)
- **Refresh manual** — botão para re-fetch da API sem recarregar a página

### Frontend (10307)

- Duas tabs: **Assigned to me** / **To review**
- Lista de MRs com: título, projeto, autor, branch de origem → destino, data de atualização, threads abertos/totais, estado (open/draft)
- Badge de threads abertos em destaque (vermelho se > 0)
- Botão "Open in GitLab" por MR
- Botão de refresh no topo

### Backend (10407)

Stateless — sem DB. Faz proxy às chamadas GitLab API para não expor o token no frontend.

**Endpoints:**
- `GET /mrs/assigned` — MRs assigned ao utilizador configurado
- `GET /mrs/review` — MRs para review
- `GET /mrs/:id/threads` — threads de um MR específico (abertos vs resolvidos)
- `GET /config` — configuração atual
- `POST /config` — atualiza configuração

**Config card:**
- URL do GitLab self-hosted da empresa (textfield)
- Personal Access Token (textfield, masked)
- GitLab User ID ou username (textfield)

---

## Config Page

Página dedicada acessível via sidebar (ícone de engrenagem no fundo).

- Cada módulo/serviço aparece como um **card**
- Cada backend de tool própria expõe `GET /config` e `POST /config`
- O hub lê esses endpoints e renderiza um card por serviço
- Redirects e TUIs também têm card com o seu URL editável
- O card do Hub tem a UI de gestão de entries e pastas

---

## Export / Import — Portabilidade Total

### Filosofia

O dev portal deve ser completamente portável. Se fizeres `docker compose down -v` (apagar volumes) e voltares a fazer `up`, deves conseguir restaurar tudo — configurações e dados — a partir de ficheiros de backup. Não pode haver estado que só exista nos volumes Docker.

### Exportação de Configuração (JSON)

Cada backend expõe `GET /config/export` que devolve a sua configuração em JSON puro (broker URLs, diretórios monitorizados, preferências, etc. — tudo o que está na config page desse módulo).

O hub backend tem um endpoint `GET /config/export/all` que:
1. Chama `GET /config/export` em cada backend registado
2. Consolida tudo num único JSON com a estrutura:

```json
{
  "version": "1.0",
  "exported_at": "2026-06-20T10:00:00Z",
  "modules": {
    "hub": { ... },
    "kafbat-plus": { ... },
    "ai-session-manager": { ... },
    "rtk-helper": { ... },
    "gitlab-mr": { ... },
    "ttyd-manager": { ... }
  }
}
```

Nota: módulos stateless sem config persistente (ex: JSON Tools) não aparecem no export. Módulos com `/config` mas sem DB (ex: GitLab MR Dashboard, ttyd-manager) entram no export de config mas não no de BDs.

O hub também expõe `POST /config/import/all` que recebe este JSON e distribui cada secção para o backend correspondente via `POST /config/import`.

Na Config page há botões **"Export config"** (descarrega o JSON consolidado) e **"Import config"** (filepicker para carregar o JSON e aplicar tudo).

### Exportação de Base de Dados (Backup)

Cada backend expõe:
- `GET /db/export` — faz `pg_dump` da sua base de dados e devolve o ficheiro SQL (ou `.dump`)
- `POST /db/import` — recebe um ficheiro SQL/dump e faz restore via `psql` ou equivalente

O hub backend tem:
- `GET /db/export/all` — chama `GET /db/export` em cada módulo, empacota tudo num `.zip` com um dump por módulo
- `POST /db/import/all` — recebe o `.zip`, extrai e distribui cada dump para o módulo correspondente

Na Config page há uma secção **"Backup & Restore"** com:
- Botão **"Export all DBs"** — descarrega o `.zip` com todos os dumps
- Botão **"Import all DBs"** — filepicker para carregar o `.zip` e restaurar tudo
- Botões individuais por módulo para export/import granular

### Configuração de Ferramentas de BD (pg_dump / psql)

O hub backend tem no seu `/config` campos configuráveis para os paths dos binários PostgreSQL usados nos backups:

```json
{
  "pg_tools": {
    "pg_dump_path": "/usr/bin/pg_dump",
    "psql_path": "/usr/bin/psql",
    "pg_restore_path": "/usr/bin/pg_restore"
  }
}
```

Estes paths são usados por todos os módulos. O card do hub na Config page tem textfields editáveis para estes paths — útil para ajustar conforme o ambiente (WSL, Windows, path custom).

### Convenção por Módulo

Os endpoints de export/import (`/config/export`, `/config/import`, `/db/export`, `/db/import`) fazem parte dos endpoints obrigatórios definidos em **Convenções Globais**. Qualquer módulo que os implemente é automaticamente suportado pelo sistema de backup do hub, sem alterações ao hub.

### Cenário de Recuperação

```
# Perdi tudo (docker compose down -v)
docker compose up -d

# No browser, abrir http://localhost:10300/config
# Clicar "Import config" → selecionar config-backup.json
# Clicar "Import all DBs" → selecionar db-backup.zip
# Tudo restaurado
```

---

## SSO / Headers de Iframes Externos

Para serviços externos com SSO (ex: ArgoCD via Keycloak):
- Se o SSO usa cookies de sessão → funciona automaticamente no iframe
- Se o serviço tiver `X-Frame-Options: DENY` ou `CSP: frame-ancestors 'none'` → adicionar nginx container no compose que faz strip desses headers antes de servir ao hub

---

## Plataforma — WSL e Windows

**Prioridade: WSL (Ubuntu no Windows)**

O projeto corre em WSL2 com Docker Desktop integrado. Não há ajustes necessários à arquitetura — Docker Compose funciona nativamente em WSL2 e os containers acedem ao filesystem WSL sem problemas.

Pontos a ter em atenção:

- **Volume do AI Session Manager** — o mount de `/home/vicente` refere-se ao path WSL (`/home/vicente` dentro do WSL), não ao `C:\Users\`. Configurável via `/config`.
- **Paths de pg_dump/psql** — dentro dos containers são sempre paths Linux (`/usr/bin/pg_dump`). Os textfields de config existem exatamente para ajustar se o ambiente mudar.
- **Acesso pelo browser** — em WSL2 com Docker Desktop, `localhost` no Windows aponta diretamente para os containers. O hub em `http://localhost:10300` funciona tanto no browser do Windows como no WSL.

**Suporte a Windows nativo (secundário)**

Para correr em Windows puro (sem WSL), os ajustes são mínimos:
- Volume do AI Session Manager muda para `C:\Users\vicente` ou equivalente — configurável via `/config`
- Docker Desktop para Windows suporta o mesmo `docker-compose.yml` sem alterações
- Paths de pg_dump podem precisar de apontar para binários Windows (ex: `C:\Program Files\PostgreSQL\16\bin\pg_dump.exe`) — daí os textfields configuráveis no hub

O mesmo ficheiro `docker-compose.yml` deve funcionar nos dois ambientes com apenas mudanças de configuração, sem tocar no código.

---

## docker-compose.yml (estrutura base)

```yaml
services:

  hub-frontend:
    build: ./hub/frontend
    ports: ["10300:80"]

  hub-backend:
    build: ./hub/backend
    ports: ["10303:10303"]
    depends_on: [hub-db]

  hub-db:
    image: postgres:16
    ports: ["10403:5432"]
    environment:
      POSTGRES_DB: hub
      POSTGRES_USER: hub
      POSTGRES_PASSWORD: hub

  kafbat-plus-frontend:
    build: ./kafbat-plus/frontend
    ports: ["10301:80"]

  kafbat-plus-backend:
    build: ./kafbat-plus/backend
    ports: ["10401:10401"]
    depends_on: [kafbat-plus-db]

  kafbat-plus-db:
    image: postgres:16
    ports: ["10501:5432"]
    environment:
      POSTGRES_DB: kafbat
      POSTGRES_USER: kafbat
      POSTGRES_PASSWORD: kafbat

  ai-session-manager-frontend:
    build: ./ai-session-manager/frontend
    ports: ["10302:80"]

  ai-session-manager-backend:
    build: ./ai-session-manager/backend
    ports: ["10402:10402"]
    volumes:
      - /home/vicente:/home/user:ro   # path configurável via /config
    depends_on: [ai-session-manager-db]

  ai-session-manager-db:
    image: postgres:16
    ports: ["10502:5432"]
    environment:
      POSTGRES_DB: aisessions
      POSTGRES_USER: aisessions
      POSTGRES_PASSWORD: aisessions

  gitlab-mr-frontend:
    build: ./gitlab-mr/frontend
    ports: ["10307:80"]

  gitlab-mr-backend:
    build: ./gitlab-mr/backend
    ports: ["10407:10407"]

  json-tools-frontend:
    build: ./json-tools/frontend
    ports: ["10306:80"]

  json-tools-backend:
    build: ./json-tools/backend
    ports: ["10406:10406"]

  rtk-helper-frontend:
    build: ./rtk-helper/frontend
    ports: ["10305:80"]

  rtk-helper-backend:
    build: ./rtk-helper/backend
    ports: ["10405:10405"]
    volumes:
      - /home/vicente:/home/user:ro  # acesso ao filters.toml, path configurável
    depends_on: [rtk-helper-db]

  rtk-helper-db:
    image: postgres:16
    ports: ["10505:5432"]
    environment:
      POSTGRES_DB: rtk
      POSTGRES_USER: rtk
      POSTGRES_PASSWORD: rtk

  ttyd-manager:
    build: ./ttyd-manager
    ports:
      - "10604-10620:10604-10620"  # range dinâmico para as TUIs
    volumes:
      - /usr/local/bin:/usr/local/bin:ro
```

---

## Notas Técnicas e Decisões em Aberto

Pontos a ter em conta na implementação — alguns são avisos, outros decisões a tomar durante o build.

### ttyd-manager — spawn de processos dentro do container
O manager faz spawn de processos `ttyd` filhos, cada um a fazer bind a uma porta `106xx`. Para isto funcionar:
- O container precisa de ter o binário `ttyd` instalado (não usar a imagem oficial `tsl0922/ttyd` que só corre um ttyd; construir uma imagem própria com ttyd + runtime Ktor).
- As TUIs que o manager corre (k9s, etc.) precisam dos respetivos binários e configs acessíveis dentro do container (montar via volume ou instalar na imagem).
- k9s dentro do container precisa de acesso ao kubeconfig — montar `~/.kube/config` como volume read-only.
- Alternativa mais robusta: em vez de spawn de processos, o manager fala com o Docker socket e sobe um container ttyd por TUI. Mais isolado mas precisa de montar `/var/run/docker.sock`. **Decidir no MVP.**

### State preservation — iframes cross-origin
A técnica de manter iframes montados e alternar `display` preserva estado. Mas iframes cross-origin (serviços externos noutras portas/hosts) não permitem ler/manipular o conteúdo por JS — o que é fine, porque só precisamos de show/hide, não de tocar no conteúdo. Confirmar que nenhum redirect externo tem `X-Frame-Options`/CSP a bloquear (ver secção SSO).

### gRPC no Kafbat+ (backend Ktor)
Decode de gRPC/protobuf on-the-fly a partir de um `.proto` carregado em runtime é mais simples em Python (`grpcio-tools`, `protobuf`) do que em Kotlin/JVM. Opções:
- Sidecar Python pequeno só para o decode, chamado pelo backend Ktor.
- Library JVM (`protobuf-java` com `DynamicMessage` + `FileDescriptor` compilado em runtime via `protoc`).
- **Para o MVP do Kafbat+, JSON puro chega.** gRPC fica para uma segunda iteração — não bloquear o resto por causa disto.

### Tokenização no AI Session Manager
`tiktoken` é Python. Em JVM há ports (`jtokkit`) que cobrem os encoders da OpenAI, mas Claude/Anthropic usa um tokenizer diferente. Para custo estimado, o mais fiável é ler os próprios metadados de uso que o Claude Code / OpenCode já gravam nos ficheiros de sessão (se existirem), em vez de recontar tokens. **Investigar o formato dos ficheiros de sessão antes de assumir que é preciso tokenizar.**

### Ordem de arranque (depends_on)
`depends_on` garante ordem de arranque mas não que a DB está pronta a aceitar ligações. Os backends devem ter retry na ligação à DB no startup, ou usar healthchecks no compose com `condition: service_healthy`.

---

## Roadmap de Implementação

### Fase 1 — MVP (prioridade máxima)

Antes de construir qualquer módulo próprio, o hub deve ser funcional com o essencial:

1. **Hub frontend** — sidebar com pastas, navegação, state preservation (iframes montados no DOM, show/hide via CSS), home screen com pesquisa e ícones
2. **Hub backend + DB** — persistência de entries e pastas, drag-and-drop entre pastas, endpoints de config
3. **Redirects dinâmicos** — adicionar/remover redirects puros via config card (ArgoCD, Kafbat dev env, Keycloak Admin, Portainer, etc.)
4. **ttyd Manager** — lançar e gerir TUIs dinamicamente via config card, cada uma exposta como iframe no hub

O MVP está completo quando conseguires abrir o hub, adicionar um redirect para o ArgoCD, adicionar uma TUI com k9s, organizá-los em pastas, navegar entre eles sem perder estado, e exportar/importar toda a configuração (entries, pastas, redirects, TUIs) para um ficheiro JSON — repondo o estado numa instância limpa sem tocar nas BDs (que ainda não existem nesta fase).

### Fase 2 — Módulos próprios

Só depois do MVP funcional:

5. **Kafbat+** — o módulo com mais utilidade imediata
6. **AI Session Manager** — requer análise do formato de sessões Claude Code/OpenCode
7. **Futuros módulos** — seguem a mesma convenção de portas e `/config` endpoint
