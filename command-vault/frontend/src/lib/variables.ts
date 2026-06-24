export interface VarDef {
  name: string
  type: 'text' | 'file'
}

export function parseVariables(command: string): VarDef[] {
  const matches = command.match(/\{(?:file:)?\w+\}/g)
  if (!matches) return []
  const seen = new Set<string>()
  const vars: VarDef[] = []
  for (const m of matches) {
    const inner = m.slice(1, -1)
    const isFile = inner.startsWith('file:')
    const name = isFile ? inner.slice(5) : inner
    if (!seen.has(name)) {
      seen.add(name)
      vars.push({ name, type: isFile ? 'file' : 'text' })
    }
  }
  return vars
}

export function substituteVariables(command: string, values: Record<string, string>): string {
  let result = command
  for (const [key, val] of Object.entries(values)) {
    result = result.replaceAll(`{file:${key}}`, val)
    result = result.replaceAll(`{${key}}`, val)
  }
  return result
}
