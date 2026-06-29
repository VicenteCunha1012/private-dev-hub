#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const API_BASE = process.env.AI_MEMORY_URL || 'http://localhost:10417'

async function apiReq(path, method = 'GET', body = undefined) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${API_BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

const server = new Server(
  { name: 'ai-memory', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'write_handoff',
      description: 'Write a handoff note for session continuity. Use when ending a session or switching context to preserve state for the next session.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name (e.g. "dev-hub", "my-app")' },
          context: { type: 'string', description: 'Context label (default: "default")', default: 'default' },
          content: { type: 'string', description: 'What was being done, what is left, pending decisions, context' },
          tool: { type: 'string', description: 'Tool writing this (e.g. "claude-code", "opencode")' },
        },
        required: ['project', 'content'],
      },
    },
    {
      name: 'read_handoff',
      description: 'Read the latest handoff note for a project. Use at the start of a session to get context from previous work.',
      inputSchema: {
        type: 'object',
        properties: {
          project: { type: 'string', description: 'Project name' },
          context: { type: 'string', description: 'Context label', default: 'default' },
        },
        required: ['project'],
      },
    },
    {
      name: 'log_decision',
      description: 'Log a technical decision. Use when making a significant architectural, library, or approach choice.',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short decision title (e.g. "Chose PostgreSQL over MongoDB")' },
          description: { type: 'string', description: 'What was decided and the context' },
          reasoning: { type: 'string', description: 'Why this option was chosen' },
          alternatives: { type: 'string', description: 'Other options considered' },
          tags: { type: 'string', description: 'Comma-separated tags (e.g. "database,architecture")' },
          project: { type: 'string', description: 'Project name' },
          tool: { type: 'string', description: 'Tool writing this' },
        },
        required: ['title', 'description'],
      },
    },
    {
      name: 'search_decisions',
      description: 'Search the decision log by text, tag, or project.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search text' },
          tag: { type: 'string', description: 'Filter by tag' },
          project: { type: 'string', description: 'Filter by project' },
        },
      },
    },
  ],
}))

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params

  switch (name) {
    case 'write_handoff': {
      const result = await apiReq('/handoffs', 'POST', {
        project: args.project,
        context: args.context || 'default',
        content: args.content,
        tool: args.tool,
      })
      return { content: [{ type: 'text', text: `Handoff written for ${result.project}/${result.context} (id: ${result.id})` }] }
    }

    case 'read_handoff': {
      try {
        const result = await apiReq(`/handoffs/latest?project=${encodeURIComponent(args.project)}&context=${encodeURIComponent(args.context || 'default')}`)
        return { content: [{ type: 'text', text: `# Handoff: ${result.project}/${result.context}\nUpdated: ${result.updatedAt}\nTool: ${result.tool || 'unknown'}\n\n${result.content}` }] }
      } catch {
        return { content: [{ type: 'text', text: `No handoff found for project "${args.project}"` }] }
      }
    }

    case 'log_decision': {
      const result = await apiReq('/decisions', 'POST', {
        title: args.title,
        description: args.description,
        reasoning: args.reasoning,
        alternatives: args.alternatives,
        tags: args.tags,
        project: args.project,
        tool: args.tool,
      })
      return { content: [{ type: 'text', text: `Decision logged: "${result.title}" (id: ${result.id})` }] }
    }

    case 'search_decisions': {
      const params = new URLSearchParams()
      if (args.query) params.set('search', args.query)
      if (args.tag) params.set('tag', args.tag)
      if (args.project) params.set('project', args.project)
      const results = await apiReq(`/decisions?${params.toString()}`)
      if (results.length === 0) return { content: [{ type: 'text', text: 'No decisions found.' }] }
      const text = results.map(d =>
        `## ${d.title}\n${d.tags ? `Tags: ${d.tags}` : ''}${d.project ? ` | Project: ${d.project}` : ''}\n${d.description}\n${d.reasoning ? `Reasoning: ${d.reasoning}` : ''}`
      ).join('\n\n---\n\n')
      return { content: [{ type: 'text', text: `Found ${results.length} decision(s):\n\n${text}` }] }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
