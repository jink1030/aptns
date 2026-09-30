import { getSupabase, isSupabaseConfigured } from './supabase';
import * as local from './storage';
import type { Note, Todo, NoteCategory, TodoPriority, TodoStatus, Attachment } from '@/types';

export function checkSupabaseConnected(): boolean {
  return isSupabaseConfigured();
}

// --- Notes ---

export async function fetchNotes(): Promise<Note[]> {
  const sb = getSupabase();
  if (!sb) return local.getNotes();

  const { data, error } = await sb
    .from('notes')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error || !data) return local.getNotes();

  return data.map(mapNote);
}

export async function fetchNote(id: string): Promise<Note | null> {
  const sb = getSupabase();
  if (!sb) return local.getNote(id) ?? null;

  const { data, error } = await sb.from('notes').select('*').eq('id', id).single();
  if (error || !data) return null;
  return mapNote(data);
}

export async function createNote(input: {
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  linkedNoteIds: string[];
  attachments?: Attachment[];
}): Promise<Note> {
  const sb = getSupabase();
  if (!sb) return local.saveNote({ ...input, attachments: input.attachments || [] });

  const { data, error } = await sb
    .from('notes')
    .insert({
      title: input.title,
      content: input.content,
      category: input.category,
      tags: input.tags,
      linked_note_ids: input.linkedNoteIds,
      attachments: input.attachments || [],
    })
    .select()
    .single();

  if (error || !data) return local.saveNote({ ...input, attachments: input.attachments || [] });
  return mapNote(data);
}

export async function editNote(
  id: string,
  input: Partial<{
    title: string;
    content: string;
    category: NoteCategory;
    tags: string[];
    linkedNoteIds: string[];
    attachments: Attachment[];
  }>
): Promise<Note | null> {
  const sb = getSupabase();
  if (!sb) return local.updateNote(id, input);

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.content !== undefined) update.content = input.content;
  if (input.category !== undefined) update.category = input.category;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.linkedNoteIds !== undefined) update.linked_note_ids = input.linkedNoteIds;
  if (input.attachments !== undefined) update.attachments = input.attachments;

  const { data, error } = await sb.from('notes').update(update).eq('id', id).select().single();
  if (error || !data) return null;
  return mapNote(data);
}

export async function removeNote(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return local.deleteNote(id);

  const { error } = await sb.from('notes').delete().eq('id', id);
  return !error;
}

export async function queryNotes(query: string): Promise<Note[]> {
  const sb = getSupabase();
  if (!sb) return local.searchNotes(query);

  const { data, error } = await sb
    .from('notes')
    .select('*')
    .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
    .order('updated_at', { ascending: false });

  if (error || !data) return local.searchNotes(query);
  return data.map(mapNote);
}

// --- Todos ---

export async function fetchTodos(): Promise<Todo[]> {
  const sb = getSupabase();
  if (!sb) return local.getTodos();

  const { data, error } = await sb
    .from('todos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error || !data) return local.getTodos();
  return data.map(mapTodo);
}

export async function createTodo(input: {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  noteId: string | null;
  linkedNoteIds?: string[];
}): Promise<Todo> {
  const sb = getSupabase();
  if (!sb) return local.saveTodo({ ...input, linkedNoteIds: input.linkedNoteIds || [] });

  const { data, error } = await sb
    .from('todos')
    .insert({
      title: input.title,
      description: input.description,
      due_date: input.dueDate,
      priority: input.priority,
      status: input.status,
      note_id: input.noteId,
      linked_note_ids: input.linkedNoteIds || [],
    })
    .select()
    .single();

  if (error || !data) return local.saveTodo({ ...input, linkedNoteIds: input.linkedNoteIds || [] });
  return mapTodo(data);
}

export async function editTodo(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    dueDate: string | null;
    priority: TodoPriority;
    status: TodoStatus;
    noteId: string | null;
    linkedNoteIds: string[];
  }>
): Promise<Todo | null> {
  const sb = getSupabase();
  if (!sb) return local.updateTodo(id, input);

  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.dueDate !== undefined) update.due_date = input.dueDate;
  if (input.priority !== undefined) update.priority = input.priority;
  if (input.status !== undefined) update.status = input.status;
  if (input.noteId !== undefined) update.note_id = input.noteId;
  if (input.linkedNoteIds !== undefined) update.linked_note_ids = input.linkedNoteIds;

  const { data, error } = await sb.from('todos').update(update).eq('id', id).select().single();
  if (error || !data) return null;
  return mapTodo(data);
}

export async function removeTodo(id: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return local.deleteTodo(id);

  const { error } = await sb.from('todos').delete().eq('id', id);
  return !error;
}

// --- Export/Import (Supabase ↔ localStorage 마이그레이션) ---

export async function migrateLocalToSupabase(): Promise<{ notes: number; todos: number }> {
  const sb = getSupabase();
  if (!sb) return { notes: 0, todos: 0 };

  const localNotes = local.getNotes();
  const localTodos = local.getTodos();

  let noteCount = 0;
  let todoCount = 0;

  for (const note of localNotes) {
    const { error } = await sb.from('notes').insert({
      title: note.title,
      content: note.content,
      category: note.category,
      tags: note.tags,
      linked_note_ids: note.linkedNoteIds,
      created_at: note.createdAt,
      updated_at: note.updatedAt,
    });
    if (!error) noteCount++;
  }

  for (const todo of localTodos) {
    const { error } = await sb.from('todos').insert({
      title: todo.title,
      description: todo.description,
      due_date: todo.dueDate,
      priority: todo.priority,
      status: todo.status,
      note_id: todo.noteId,
      linked_note_ids: todo.linkedNoteIds || [],
      created_at: todo.createdAt,
      updated_at: todo.updatedAt,
    });
    if (!error) todoCount++;
  }

  return { notes: noteCount, todos: todoCount };
}

// --- Mappers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapNote(row: any): Note {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    tags: row.tags || [],
    linkedNoteIds: row.linked_note_ids || [],
    attachments: row.attachments || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTodo(row: any): Todo {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    dueDate: row.due_date,
    priority: row.priority,
    status: row.status,
    noteId: row.note_id,
    linkedNoteIds: row.linked_note_ids || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
