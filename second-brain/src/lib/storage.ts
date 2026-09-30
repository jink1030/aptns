import { Note, Todo } from '@/types';

const NOTES_KEY = 'secondbrain_notes';
const TODOS_KEY = 'secondbrain_todos';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function now(): string {
  return new Date().toISOString();
}

// --- Notes ---

export function getNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(NOTES_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function getNote(id: string): Note | undefined {
  return getNotes().find((n) => n.id === id);
}

export function saveNote(data: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>): Note {
  const notes = getNotes();
  const note: Note = { ...data, attachments: data.attachments || [], id: generateId(), createdAt: now(), updatedAt: now() };
  notes.push(note);
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return note;
}

export function updateNote(id: string, data: Partial<Omit<Note, 'id' | 'createdAt'>>): Note | null {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...data, updatedAt: now() };
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  return notes[idx];
}

export function deleteNote(id: string): boolean {
  const notes = getNotes();
  const filtered = notes.filter((n) => n.id !== id);
  if (filtered.length === notes.length) return false;
  localStorage.setItem(NOTES_KEY, JSON.stringify(filtered));
  return true;
}

export function searchNotes(query: string): Note[] {
  const q = query.toLowerCase();
  return getNotes().filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// --- Todos ---

export function getTodos(): Todo[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(TODOS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export function saveTodo(data: Omit<Todo, 'id' | 'createdAt' | 'updatedAt'>): Todo {
  const todos = getTodos();
  const todo: Todo = { ...data, id: generateId(), createdAt: now(), updatedAt: now() };
  todos.push(todo);
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  return todo;
}

export function updateTodo(id: string, data: Partial<Omit<Todo, 'id' | 'createdAt'>>): Todo | null {
  const todos = getTodos();
  const idx = todos.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  todos[idx] = { ...todos[idx], ...data, updatedAt: now() };
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
  return todos[idx];
}

export function deleteTodo(id: string): boolean {
  const todos = getTodos();
  const filtered = todos.filter((t) => t.id !== id);
  if (filtered.length === todos.length) return false;
  localStorage.setItem(TODOS_KEY, JSON.stringify(filtered));
  return true;
}

// --- Export/Import ---

export function exportData(): string {
  return JSON.stringify({ notes: getNotes(), todos: getTodos() }, null, 2);
}

export function importData(json: string): boolean {
  try {
    const data = JSON.parse(json);
    if (data.notes) localStorage.setItem(NOTES_KEY, JSON.stringify(data.notes));
    if (data.todos) localStorage.setItem(TODOS_KEY, JSON.stringify(data.todos));
    return true;
  } catch {
    return false;
  }
}
