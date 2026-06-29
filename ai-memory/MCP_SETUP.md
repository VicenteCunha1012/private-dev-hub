# AI Memory MCP Server Setup

## Install

```bash
cd ai-memory/mcp-server
npm install
```

## Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "ai-memory": {
      "command": "node",
      "args": ["/path/to/dev-hub/ai-memory/mcp-server/index.js"],
      "env": {
        "AI_MEMORY_URL": "http://localhost:10417"
      }
    }
  }
}
```

## OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "mcp": {
    "ai-memory": {
      "command": "node",
      "args": ["/path/to/dev-hub/ai-memory/mcp-server/index.js"],
      "env": {
        "AI_MEMORY_URL": "http://localhost:10417"
      }
    }
  }
}
```

## Available Tools

- `write_handoff` — Save session state for continuity (project, context, content, tool)
- `read_handoff` — Read latest handoff for a project
- `log_decision` — Log a technical decision (title, description, reasoning, alternatives, tags, project)
- `search_decisions` — Search decisions by text, tag, or project
