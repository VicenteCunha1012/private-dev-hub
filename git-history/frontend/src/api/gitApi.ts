const BASE = 'http://localhost:10415'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, opts)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface RepoInfo { name: string; path: string }
export interface BranchInfo { name: string; current: boolean }
export interface CommitInfo {
  hash: string; shortHash: string; message: string
  author: string; authorEmail: string; date: string; relativeDate: string
}
export interface DiffLine {
  type: 'add' | 'remove' | 'context'
  content: string; oldLineNum?: number; newLineNum?: number
}
export interface DiffHunk { header: string; lines: DiffLine[] }
export interface DiffFile { path: string; status: string; hunks: DiffHunk[] }
export interface CommitDetail {
  hash: string; shortHash: string; message: string
  author: string; authorEmail: string; date: string; files: DiffFile[]
}
export interface TreeEntry { name: string; path: string; type: 'blob' | 'tree'; size?: number }
export interface FileContent { path: string; content: string; lines: number }
export interface BlameEntry {
  lineStart: number; lineEnd: number; hash: string; shortHash: string
  author: string; authorEmail: string; date: string; relativeDate: string; line: string
}
export interface LineHistoryEntry {
  hash: string; shortHash: string; author: string; date: string; message: string; diff: string
}

export const api = {
  getRepos: () => req<RepoInfo[]>('/repos'),
  getBranches: (repo: string) => req<BranchInfo[]>(`/repos/${enc(repo)}/branches`),
  getCommits: (repo: string, branch: string, limit = 50, offset = 0) =>
    req<CommitInfo[]>(`/repos/${enc(repo)}/commits?branch=${enc(branch)}&limit=${limit}&offset=${offset}`),
  getCommitDetail: (repo: string, hash: string) =>
    req<CommitDetail>(`/repos/${enc(repo)}/commits/${hash}`),
  getTree: (repo: string, ref: string, path = '') =>
    req<TreeEntry[]>(`/repos/${enc(repo)}/tree?ref=${enc(ref)}&path=${enc(path)}`),
  getFile: (repo: string, path: string, ref: string) =>
    req<FileContent>(`/repos/${enc(repo)}/file?path=${enc(path)}&ref=${enc(ref)}`),
  getFileHistory: (repo: string, path: string, branch = 'HEAD', limit = 50) =>
    req<CommitInfo[]>(`/repos/${enc(repo)}/file/history?path=${enc(path)}&branch=${enc(branch)}&limit=${limit}`),
  getBlame: (repo: string, path: string, start: number, end: number, ref = 'HEAD') =>
    req<BlameEntry[]>(`/repos/${enc(repo)}/blame?path=${enc(path)}&start=${start}&end=${end}&ref=${enc(ref)}`),
  getLineHistory: (repo: string, path: string, start: number, end: number, limit?: number) =>
    req<LineHistoryEntry[]>(`/repos/${enc(repo)}/line-history?path=${enc(path)}&start=${start}&end=${end}${limit ? `&limit=${limit}` : ''}`),
  getConfig: () => req<Record<string, string>>('/config'),
  setConfig: (cfg: { directories?: string[] }) =>
    req<Record<string, string>>('/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    }),
}

function enc(s: string) { return encodeURIComponent(s) }
