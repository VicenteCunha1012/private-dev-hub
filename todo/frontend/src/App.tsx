import { useState, useEffect, useCallback, useRef } from 'react';
import type { TodoList, Task, CreateTaskRequest } from './api/todoApi.ts';
import { api } from './api/todoApi.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<number, string> = { 1: '#3b82f6', 2: '#f59e0b', 3: '#ef4444' };
const PRIORITY_LABELS: Record<number, string> = { 0: 'None', 1: 'Low', 2: 'Medium', 3: 'High' };

function parseQuickAdd(raw: string): CreateTaskRequest {
  let title = raw;
  let priority: number | undefined;
  let tags: string[] = [];
  let dueDate: string | undefined;

  // Priority
  const priMap: Record<string, number> = { '!high': 3, '!h': 3, '!3': 3, '!medium': 2, '!m': 2, '!2': 2, '!low': 1, '!l': 1, '!1': 1 };
  for (const [token, val] of Object.entries(priMap)) {
    if (title.includes(token)) { priority = val; title = title.replace(token, '').trim(); break; }
  }

  // Tags
  const tagRe = /#(\w+)/g;
  let m;
  while ((m = tagRe.exec(title)) !== null) tags.push(m[1]);
  title = title.replace(tagRe, '').trim();

  // Due date
  const today = new Date();
  const dateMap: Record<string, () => string> = {
    '@today': () => fmt(today),
    '@tomorrow': () => { const d = new Date(today); d.setDate(d.getDate() + 1); return fmt(d); },
    '@monday': () => nextDay(1), '@tuesday': () => nextDay(2), '@wednesday': () => nextDay(3),
    '@thursday': () => nextDay(4), '@friday': () => nextDay(5), '@saturday': () => nextDay(6), '@sunday': () => nextDay(0),
  };
  for (const [token, fn] of Object.entries(dateMap)) {
    if (title.toLowerCase().includes(token)) { dueDate = fn(); title = title.replace(new RegExp(token, 'i'), '').trim(); break; }
  }

  return { title, priority, tags: tags.length ? tags.join(',') : undefined, dueDate };
}

function fmt(d: Date): string { return d.toISOString().slice(0, 10); }
function nextDay(day: number): string {
  const d = new Date(); const diff = (day - d.getDay() + 7) % 7 || 7; d.setDate(d.getDate() + diff); return fmt(d);
}

function formatDate(s: string | null): string {
  if (!s) return '';
  const d = new Date(s);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const target = new Date(s + 'T00:00:00'); target.setHours(0, 0, 0, 0);
  if (target.getTime() === today.getTime()) return 'Today';
  if (target.getTime() === tomorrow.getTime()) return 'Tomorrow';
  if (target < today) return 'Overdue';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── App ──────────────────────────────────────────────────────────────

export default function App() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [quickAdd, setQuickAdd] = useState('');
  const [showAddList, setShowAddList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [dragTaskId, setDragTaskId] = useState<number | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    try { setLists(await api.getLists()); } catch (e) { console.error('Failed to load lists', e); }
  }, []);

  const loadTasks = useCallback(async () => {
    try {
      const params: { listId?: number; search?: string } = {};
      if (selectedListId) params.listId = selectedListId;
      if (searchQuery) params.search = searchQuery;
      setTasks(await api.getTasks(params));
    } catch (e) { console.error('Failed to load tasks', e); }
  }, [selectedListId, searchQuery]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') { (e.target as HTMLElement).blur(); setSelectedTask(null); }
        return;
      }
      switch (e.key) {
        case 'n': e.preventDefault(); quickAddRef.current?.focus(); break;
        case 'f': e.preventDefault(); searchRef.current?.focus(); break;
        case 'Escape': setSelectedTask(null); break;
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleQuickAdd = async () => {
    if (!quickAdd.trim()) return;
    const parsed = parseQuickAdd(quickAdd);
    if (selectedListId) parsed.listId = selectedListId;
    await api.createTask(parsed);
    setQuickAdd('');
    loadTasks(); loadLists();
  };

  const toggleTask = async (task: Task) => {
    await api.updateTask(task.id, { completed: !task.completed });
    loadTasks(); loadLists();
    if (selectedTask?.id === task.id) setSelectedTask({ ...task, completed: !task.completed });
  };

  const deleteTask = async (id: number) => {
    await api.deleteTask(id);
    if (selectedTask?.id === id) setSelectedTask(null);
    loadTasks(); loadLists();
  };

  const updateTaskDetail = async (id: number, data: Record<string, unknown>) => {
    const updated = await api.updateTask(id, data);
    setSelectedTask(updated);
    loadTasks(); loadLists();
  };

  const createList = async () => {
    if (!newListName.trim()) return;
    await api.createList({ name: newListName });
    setNewListName(''); setShowAddList(false);
    loadLists();
  };

  const deleteList = async (id: number) => {
    await api.deleteList(id);
    if (selectedListId === id) setSelectedListId(null);
    loadLists(); loadTasks();
  };

  const handleDrop = async (targetIdx: number) => {
    if (dragTaskId == null) return;
    await api.updateTask(dragTaskId, { position: targetIdx });
    setDragTaskId(null);
    loadTasks();
  };

  const selectedListName = selectedListId
    ? lists.flatMap(l => [l, ...(l.children ?? [])]).find(l => l.id === selectedListId)?.name ?? 'All Tasks'
    : 'All Tasks';

  const selectedListIcon = selectedListId
    ? lists.flatMap(l => [l, ...(l.children ?? [])]).find(l => l.id === selectedListId)?.icon ?? ''
    : '';

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 'var(--sidebar-width)', minWidth: 'var(--sidebar-width)', background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', padding: '16px 0',
      }}>
        <div style={{ padding: '0 16px 16px', fontSize: '18px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.5px' }}>
          Todo
        </div>

        {/* Search */}
        <div style={{ padding: '0 12px 12px' }}>
          <input
            ref={searchRef}
            placeholder="Search tasks... (f)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ fontSize: '13px', padding: '6px 10px', background: 'var(--bg-secondary)' }}
          />
        </div>

        {/* All Tasks */}
        <div
          onClick={() => setSelectedListId(null)}
          style={{
            padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
            background: selectedListId === null ? 'rgba(139,92,246,0.1)' : 'transparent',
            borderLeft: selectedListId === null ? '3px solid var(--accent)' : '3px solid transparent',
            color: selectedListId === null ? 'var(--accent)' : 'var(--text)',
            fontSize: '14px',
          }}
        >
          <span>📑</span>
          <span style={{ flex: 1 }}>All Tasks</span>
        </div>

        {/* Lists */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: '8px' }}>
          {lists.map(list => (
            <ListItem key={list.id} list={list} selectedListId={selectedListId} onSelect={setSelectedListId} onDelete={deleteList} depth={0} />
          ))}
        </div>

        {/* Add list */}
        {showAddList ? (
          <div style={{ padding: '8px 12px' }}>
            <input
              autoFocus
              placeholder="List name"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createList(); if (e.key === 'Escape') setShowAddList(false); }}
              style={{ fontSize: '13px', padding: '6px 10px' }}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowAddList(true)}
            style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', width: '100%' }}
          >
            <span style={{ fontSize: '16px' }}>+</span> Add list
          </button>
        )}
      </aside>

      {/* ── Main Content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{ padding: '20px 24px 12px', borderBottom: '1px solid var(--border)' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            {selectedListIcon && <span>{selectedListIcon}</span>}
            {selectedListName}
          </h1>
        </header>

        {/* Quick Add */}
        <div style={{ padding: '12px 24px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              ref={quickAddRef}
              placeholder="Add a task... (n)  |  !high #tag @today"
              value={quickAdd}
              onChange={e => setQuickAdd(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleQuickAdd(); }}
              style={{ flex: 1, fontSize: '14px', padding: '10px 14px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
            />
            <button
              onClick={handleQuickAdd}
              style={{
                padding: '10px 20px', background: 'var(--accent)', borderRadius: 'var(--radius)',
                fontWeight: 600, fontSize: '13px', color: '#fff',
              }}
            >
              Add
            </button>
          </div>
        </div>

        {/* Task List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-dim)' }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎯</div>
              <div style={{ fontSize: '15px' }}>No tasks yet. Add one above!</div>
            </div>
          ) : (
            [...tasks]
              .sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              })
              .map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                isSelected={selectedTask?.id === task.id}
                onToggle={() => toggleTask(task)}
                onClick={() => setSelectedTask(task)}
                onDelete={() => deleteTask(task.id)}
                onDragStart={() => setDragTaskId(task.id)}
                onDrop={() => handleDrop(idx)}
              />
            ))
          )}
        </div>
      </main>

      {/* ── Detail Panel ── */}
      {selectedTask && (
        <DetailPanel
          task={selectedTask}
          lists={lists}
          onUpdate={(data) => updateTaskDetail(selectedTask.id, data)}
          onClose={() => setSelectedTask(null)}
          onToggle={() => toggleTask(selectedTask)}
          onDelete={() => deleteTask(selectedTask.id)}
          onAddSubtask={async (title: string) => {
            await api.createTask({ title, parentId: selectedTask.id, listId: selectedTask.listId ?? undefined });
            loadTasks();
            const updated = await api.getTasks(selectedListId ? { listId: selectedListId } : undefined);
            const refreshed = updated.flatMap(t => [t, ...(t.subtasks ?? [])]).find(t => t.id === selectedTask.id);
            if (refreshed) setSelectedTask(refreshed);
          }}
          onToggleSubtask={async (sub: Task) => {
            await api.updateTask(sub.id, { completed: !sub.completed });
            loadTasks();
            const updated = await api.getTasks(selectedListId ? { listId: selectedListId } : undefined);
            const refreshed = updated.flatMap(t => [t, ...(t.subtasks ?? [])]).find(t => t.id === selectedTask.id);
            if (refreshed) setSelectedTask(refreshed);
          }}
        />
      )}
    </div>
  );
}

// ── Sidebar List Item ────────────────────────────────────────────────

function ListItem({ list, selectedListId, onSelect, onDelete, depth }: {
  list: TodoList; selectedListId: number | null;
  onSelect: (id: number) => void; onDelete: (id: number) => void; depth: number;
}) {
  const isSelected = selectedListId === list.id;
  const [hovering, setHovering] = useState(false);

  return (
    <>
      <div
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={() => onSelect(list.id)}
        style={{
          padding: '8px 16px', paddingLeft: `${16 + depth * 20}px`, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: '10px',
          background: isSelected ? 'rgba(139,92,246,0.1)' : 'transparent',
          borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
          color: isSelected ? 'var(--accent)' : 'var(--text)',
          fontSize: '14px', position: 'relative',
        }}
      >
        <span>{list.icon}</span>
        <span style={{ flex: 1 }}>{list.name}</span>
        {(list.taskCount ?? 0) > 0 && (
          <span style={{ fontSize: '11px', color: 'var(--text-dim)', background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: '10px' }}>
            {list.taskCount}
          </span>
        )}
        {hovering && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(list.id); }}
            style={{ fontSize: '14px', color: 'var(--text-dim)', padding: '0 4px' }}
            title="Delete list"
          >
            x
          </button>
        )}
      </div>
      {(list.children ?? []).map(child => (
        <ListItem key={child.id} list={child} selectedListId={selectedListId} onSelect={onSelect} onDelete={onDelete} depth={depth + 1} />
      ))}
    </>
  );
}

// ── Task Row ─────────────────────────────────────────────────────────

function TaskRow({ task, isSelected, onToggle, onClick, onDelete, onDragStart, onDrop }: {
  task: Task; isSelected: boolean;
  onToggle: () => void; onClick: () => void; onDelete: () => void;
  onDragStart: () => void; onDrop: () => void;
}) {
  const [hovering, setHovering] = useState(false);
  const dateStr = formatDate(task.dueDate);
  const isOverdue = dateStr === 'Overdue';
  const tags = task.tags?.split(',').map(t => t.trim()).filter(Boolean) ?? [];

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={e => e.preventDefault()}
      onDrop={onDrop}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px',
        background: isSelected ? 'var(--card-hover)' : hovering ? 'rgba(255,255,255,0.02)' : 'transparent',
        borderRadius: 'var(--radius)', cursor: 'pointer', marginBottom: '2px',
        opacity: task.completed ? 0.5 : 1, transition: 'opacity 0.2s, background 0.15s',
        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
      }}
    >
      {/* Checkbox */}
      <div
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          border: task.completed ? 'none' : '2px solid var(--text-dim)',
          background: task.completed ? 'var(--success)' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        {task.completed && <span style={{ color: '#fff', fontSize: '12px' }}>✓</span>}
      </div>

      {/* Priority dot */}
      {task.priority > 0 && (
        <div style={{
          width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
          background: PRIORITY_COLORS[task.priority] || 'transparent',
        }} />
      )}

      {/* Title + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px', textDecoration: task.completed ? 'line-through' : 'none',
          color: task.completed ? 'var(--text-dim)' : 'var(--text)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        {(dateStr || tags.length > 0 || (task.subtasks && task.subtasks.length > 0)) && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '3px', alignItems: 'center', flexWrap: 'wrap' }}>
            {dateStr && (
              <span style={{ fontSize: '11px', color: isOverdue ? 'var(--danger)' : 'var(--text-muted)' }}>
                {dateStr}
              </span>
            )}
            {tags.map(tag => (
              <span key={tag} style={{
                fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                background: 'rgba(139,92,246,0.15)', color: 'var(--accent)',
              }}>
                {tag}
              </span>
            ))}
            {task.subtasks && task.subtasks.length > 0 && (
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length} subtasks
              </span>
            )}
          </div>
        )}
      </div>

      {/* Delete */}
      {hovering && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          style={{ fontSize: '16px', color: 'var(--text-dim)', padding: '0 4px', flexShrink: 0 }}
          title="Delete task"
        >
          x
        </button>
      )}
    </div>
  );
}

// ── Detail Panel ─────────────────────────────────────────────────────

function DetailPanel({ task, lists, onUpdate, onClose, onToggle, onDelete, onAddSubtask, onToggleSubtask }: {
  task: Task; lists: TodoList[];
  onUpdate: (data: Record<string, unknown>) => void; onClose: () => void;
  onToggle: () => void; onDelete: () => void;
  onAddSubtask: (title: string) => void; onToggleSubtask: (sub: Task) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [subtaskInput, setSubtaskInput] = useState('');

  useEffect(() => { setTitle(task.title); setNotes(task.notes ?? ''); }, [task.id, task.title, task.notes]);

  const allLists = lists.flatMap(l => [l, ...(l.children ?? [])]);

  return (
    <aside style={{
      width: '360px', minWidth: '360px', background: 'var(--sidebar-bg)',
      borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      overflowY: 'auto', padding: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <button onClick={onClose} style={{ color: 'var(--text-muted)', fontSize: '20px' }}>x</button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onToggle} style={{
            padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: '12px',
            background: task.completed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
            color: task.completed ? 'var(--success)' : 'var(--text-muted)',
          }}>
            {task.completed ? 'Completed' : 'Mark done'}
          </button>
          <button onClick={onDelete} style={{ padding: '4px 12px', borderRadius: 'var(--radius)', fontSize: '12px', color: 'var(--danger)', background: 'rgba(239,68,68,0.1)' }}>
            Delete
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        onBlur={() => { if (title !== task.title) onUpdate({ title }); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        style={{ fontSize: '18px', fontWeight: 700, background: 'transparent', border: 'none', padding: '0 0 12px', marginBottom: '16px', borderBottom: '1px solid var(--border)' }}
      />

      {/* Priority */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Priority</label>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
        {[0, 1, 2, 3].map(p => (
          <button
            key={p}
            onClick={() => onUpdate({ priority: p })}
            style={{
              flex: 1, padding: '6px 0', borderRadius: 'var(--radius)', fontSize: '12px',
              background: task.priority === p ? (p === 0 ? 'rgba(255,255,255,0.08)' : `${PRIORITY_COLORS[p]}22`) : 'rgba(255,255,255,0.03)',
              color: task.priority === p ? (p === 0 ? 'var(--text)' : PRIORITY_COLORS[p]) : 'var(--text-dim)',
              border: task.priority === p ? `1px solid ${p === 0 ? 'var(--border)' : PRIORITY_COLORS[p]}44` : '1px solid transparent',
            }}
          >
            {PRIORITY_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Due date */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Due date</label>
      <input
        type="date"
        value={task.dueDate ?? ''}
        onChange={e => onUpdate({ dueDate: e.target.value || null })}
        style={{ marginBottom: '16px', fontSize: '13px', colorScheme: 'dark' }}
      />

      {/* List */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>List</label>
      <select
        value={task.listId ?? ''}
        onChange={e => { const v = e.target.value; onUpdate({ listId: v ? Number(v) : null }); }}
        style={{ marginBottom: '16px', fontSize: '13px', padding: '8px 12px' }}
      >
        <option value="">No list</option>
        {allLists.map(l => <option key={l.id} value={l.id}>{l.icon} {l.name}</option>)}
      </select>

      {/* Tags */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Tags (comma separated)</label>
      <input
        value={task.tags ?? ''}
        onChange={e => onUpdate({ tags: e.target.value })}
        placeholder="work, urgent, ideas"
        style={{ marginBottom: '16px', fontSize: '13px' }}
      />

      {/* Notes */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>Notes</label>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        onBlur={() => { if (notes !== (task.notes ?? '')) onUpdate({ notes }); }}
        placeholder="Add notes..."
        rows={5}
        style={{ marginBottom: '16px', fontSize: '13px', resize: 'vertical' }}
      />

      {/* Subtasks */}
      <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Subtasks</label>
      {task.subtasks && task.subtasks.map(sub => (
        <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', paddingLeft: '4px' }}>
          <div
            onClick={() => onToggleSubtask(sub)}
            style={{
              width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              border: sub.completed ? 'none' : '2px solid var(--text-dim)',
              background: sub.completed ? 'var(--success)' : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {sub.completed && <span style={{ color: '#fff', fontSize: '10px' }}>✓</span>}
          </div>
          <span style={{
            fontSize: '13px', textDecoration: sub.completed ? 'line-through' : 'none',
            color: sub.completed ? 'var(--text-dim)' : 'var(--text)',
          }}>
            {sub.title}
          </span>
        </div>
      ))}
      <input
        placeholder="Add subtask..."
        value={subtaskInput}
        onChange={e => setSubtaskInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && subtaskInput.trim()) { onAddSubtask(subtaskInput.trim()); setSubtaskInput(''); } }}
        style={{ fontSize: '13px', padding: '6px 10px', marginTop: '4px' }}
      />

      {/* Meta info */}
      <div style={{ marginTop: 'auto', paddingTop: '20px', fontSize: '11px', color: 'var(--text-dim)' }}>
        Created: {new Date(task.createdAt).toLocaleString()}
        {task.completedAt && <><br />Completed: {new Date(task.completedAt).toLocaleString()}</>}
      </div>
    </aside>
  );
}
