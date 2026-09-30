export type NoteCategory = 'idea' | 'work' | 'research' | 'personal';
export type TodoPriority = 'high' | 'medium' | 'low';
export type TodoStatus = 'todo' | 'in_progress' | 'done';

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: NoteCategory;
  tags: string[];
  linkedNoteIds: string[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Todo {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  priority: TodoPriority;
  status: TodoStatus;
  noteId: string | null;
  linkedNoteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GraphNode {
  id: string;
  label: string;
  category: NoteCategory;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}
