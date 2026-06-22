const API = import.meta.env.VITE_API_URL || 'http://localhost:10412';

export interface TodoList {
  id: number;
  name: string;
  color: string;
  icon: string;
  position: number;
  parentId: number | null;
  createdAt: string;
  taskCount?: number;
  children?: TodoList[];
}

export interface Task {
  id: number;
  listId: number | null;
  title: string;
  notes: string | null;
  completed: boolean;
  priority: number;
  dueDate: string | null;
  tags: string | null;
  position: number;
  parentId: number | null;
  createdAt: string;
  completedAt: string | null;
  subtasks?: Task[];
}

export interface CreateListRequest {
  name: string;
  color?: string;
  icon?: string;
  parentId?: number;
}

export interface UpdateListRequest {
  name?: string;
  color?: string;
  icon?: string;
  position?: number;
  parentId?: number;
}

export interface CreateTaskRequest {
  title: string;
  listId?: number;
  notes?: string;
  priority?: number;
  dueDate?: string;
  tags?: string;
  parentId?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  notes?: string;
  completed?: boolean;
  priority?: number;
  dueDate?: string;
  tags?: string;
  position?: number;
  listId?: number;
  parentId?: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  // Config
  getConfig: () => request<Record<string, string>>('/config'),
  updateConfig: (config: Record<string, string>) => request<Record<string, string>>('/config', { method: 'POST', body: JSON.stringify(config) }),
  exportConfig: () => request<Record<string, string>>('/config/export'),
  importConfig: (config: Record<string, string>) => request<{ status: string }>('/config/import', { method: 'POST', body: JSON.stringify(config) }),

  // DB
  exportDb: () => fetch(`${API}/db/export`).then(r => r.text()),
  importDb: (sql: string) => request<{ status: string }>('/db/import', { method: 'POST', body: sql, headers: { 'Content-Type': 'text/plain' } }),

  // Lists
  getLists: () => request<TodoList[]>('/lists'),
  createList: (data: CreateListRequest) => request<TodoList>('/lists', { method: 'POST', body: JSON.stringify(data) }),
  updateList: (id: number, data: UpdateListRequest) => request<TodoList>(`/lists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteList: (id: number) => request<void>(`/lists/${id}`, { method: 'DELETE' }),

  // Tasks
  getTasks: (params?: { listId?: number; completed?: boolean; search?: string; tag?: string; priority?: number }) => {
    const sp = new URLSearchParams();
    if (params?.listId != null) sp.set('listId', String(params.listId));
    if (params?.completed != null) sp.set('completed', String(params.completed));
    if (params?.search) sp.set('search', params.search);
    if (params?.tag) sp.set('tag', params.tag);
    if (params?.priority != null) sp.set('priority', String(params.priority));
    const qs = sp.toString();
    return request<Task[]>(`/tasks${qs ? '?' + qs : ''}`);
  },
  createTask: (data: CreateTaskRequest) => request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
  updateTask: (id: number, data: UpdateTaskRequest) => request<Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTask: (id: number) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  getTags: () => request<string[]>('/tasks/tags'),
};
