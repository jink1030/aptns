'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Check, Trash2, CalendarDays, Clock,
} from 'lucide-react';
import { getTodos, saveTodo, updateTodo, deleteTodo } from '@/lib/storage';
import type { Todo, TodoPriority, TodoStatus } from '@/types';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function SchedulePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [showForm, setShowForm] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');

  useEffect(() => {
    setTodos(getTodos());
  }, []);

  function reload() {
    setTodos(getTodos());
  }

  function handleAdd() {
    if (!newTitle.trim()) return;
    saveTodo({
      title: newTitle,
      description: newDesc,
      dueDate: newDue || null,
      priority: newPriority,
      status: 'todo',
      noteId: null,
    });
    setNewTitle('');
    setNewDesc('');
    setNewDue('');
    setNewPriority('medium');
    setShowForm(false);
    reload();
  }

  function toggleStatus(todo: Todo) {
    const next: TodoStatus =
      todo.status === 'todo' ? 'in_progress' : todo.status === 'in_progress' ? 'done' : 'todo';
    updateTodo(todo.id, { status: next });
    reload();
  }

  function handleDeleteTodo(id: string) {
    deleteTodo(id);
    reload();
  }

  function dueLabel(dateStr: string): { text: string; color: string } {
    const d = new Date(dateStr);
    if (isPast(d) && !isToday(d)) return { text: '기한 초과', color: 'text-[var(--danger)]' };
    if (isToday(d)) return { text: '오늘 마감', color: 'text-[var(--warning)]' };
    if (isTomorrow(d)) return { text: '내일 마감', color: 'text-orange-500' };
    return { text: format(d, 'M월 d일 (EEE)', { locale: ko }), color: 'text-[var(--muted)]' };
  }

  const filtered = todos
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const statusLabel: Record<TodoStatus, string> = {
    todo: '할 일',
    in_progress: '진행중',
    done: '완료',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">일정 / 할일</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 새 할일
        </button>
      </div>

      {/* New Todo Form */}
      {showForm && (
        <div className="card mb-6">
          <h3 className="font-semibold text-sm mb-3">새 할일 추가</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="할일 제목"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <textarea
              placeholder="설명 (선택)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              rows={2}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
            />
            <div className="flex gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CalendarDays size={14} className="text-[var(--muted)]" />
                <input
                  type="date"
                  value={newDue}
                  onChange={(e) => setNewDue(e.target.value)}
                  className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none"
                />
              </div>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TodoPriority)}
                className="border border-[var(--border)] rounded-lg px-3 py-1.5 text-sm outline-none"
              >
                <option value="high">높음</option>
                <option value="medium">보통</option>
                <option value="low">낮음</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
              >
                추가
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-100 text-[var(--muted)] rounded-lg text-sm"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        {(['all', 'todo', 'in_progress', 'done'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              filter === f ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-[var(--muted)] hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? '전체' : statusLabel[f]} ({f === 'all' ? todos.length : todos.filter((t) => t.status === f).length})
          </button>
        ))}
      </div>

      {/* Todo List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card text-center text-sm text-[var(--muted)] py-12">
            {filter === 'all' ? '할일을 추가해보세요!' : '해당 상태의 할일이 없습니다.'}
          </div>
        ) : (
          filtered.map((todo) => (
            <div
              key={todo.id}
              className={`card flex items-start gap-3 ${todo.status === 'done' ? 'opacity-50' : ''}`}
            >
              <button
                onClick={() => toggleStatus(todo)}
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                  todo.status === 'done'
                    ? 'border-[var(--success)] bg-[var(--success)] text-white'
                    : todo.status === 'in_progress'
                    ? 'border-[var(--accent)] bg-blue-50'
                    : 'border-gray-300 hover:border-[var(--accent)]'
                }`}
                title={`상태: ${statusLabel[todo.status]} → 클릭하여 변경`}
              >
                {todo.status === 'done' && <Check size={12} />}
                {todo.status === 'in_progress' && <Clock size={10} className="text-[var(--accent)]" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-medium text-sm ${todo.status === 'done' ? 'line-through' : ''}`}>
                    {todo.title}
                  </span>
                  <span className={`badge badge-${todo.priority}`}>
                    {todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '보통' : '낮음'}
                  </span>
                </div>
                {todo.description && (
                  <p className="text-xs text-[var(--muted)] mb-1">{todo.description}</p>
                )}
                {todo.dueDate && (
                  <div className={`text-xs flex items-center gap-1 ${dueLabel(todo.dueDate).color}`}>
                    <CalendarDays size={12} />
                    {dueLabel(todo.dueDate).text}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleDeleteTodo(todo.id)}
                className="p-1.5 text-gray-300 hover:text-[var(--danger)] transition"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
