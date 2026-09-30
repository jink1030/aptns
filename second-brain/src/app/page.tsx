'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, CalendarCheck, Sparkles, Plus, AlertTriangle } from 'lucide-react';
import { getNotes, getTodos } from '@/lib/storage';
import type { Note, Todo } from '@/types';
import { format, isPast, isToday, isTomorrow, addDays, isBefore } from 'date-fns';
import { ko } from 'date-fns/locale';

export default function Dashboard() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    setNotes(getNotes());
    setTodos(getTodos());
  }, []);

  const recentNotes = [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 5);

  const upcomingTodos = todos
    .filter((t) => t.status !== 'done' && t.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
    .slice(0, 5);

  const overdueTodos = todos.filter(
    (t) => t.status !== 'done' && t.dueDate && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  );

  const todayTodos = todos.filter(
    (t) => t.status !== 'done' && t.dueDate && isToday(new Date(t.dueDate))
  );

  const soonTodos = todos.filter(
    (t) => t.status !== 'done' && t.dueDate && isBefore(new Date(t.dueDate), addDays(new Date(), 3)) && !isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))
  );

  const categoryCount = {
    idea: notes.filter((n) => n.category === 'idea').length,
    work: notes.filter((n) => n.category === 'work').length,
    research: notes.filter((n) => n.category === 'research').length,
    personal: notes.filter((n) => n.category === 'personal').length,
  };

  function formatDueLabel(dateStr: string): string {
    const d = new Date(dateStr);
    if (isToday(d)) return '오늘';
    if (isTomorrow(d)) return '내일';
    if (isPast(d)) return '지남';
    return format(d, 'M/d (EEE)', { locale: ko });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-sm text-[var(--muted)]">
            {format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })}
          </p>
        </div>
        <Link
          href="/notes?new=1"
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition"
        >
          <Plus size={16} /> 새 노트
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-1">전체 노트</div>
          <div className="text-2xl font-bold">{notes.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-1">진행중 할일</div>
          <div className="text-2xl font-bold">
            {todos.filter((t) => t.status !== 'done').length}
          </div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-1">오늘 마감</div>
          <div className="text-2xl font-bold text-[var(--warning)]">{todayTodos.length}</div>
        </div>
        <div className="card">
          <div className="text-sm text-[var(--muted)] mb-1">지난 마감</div>
          <div className="text-2xl font-bold text-[var(--danger)]">{overdueTodos.length}</div>
        </div>
      </div>

      {/* Alerts */}
      {(overdueTodos.length > 0 || soonTodos.length > 0) && (
        <div className="card mb-6 border-l-4 border-l-[var(--warning)]">
          <div className="flex items-center gap-2 font-semibold text-sm mb-2">
            <AlertTriangle size={16} className="text-[var(--warning)]" />
            마감 알림
          </div>
          <div className="space-y-1">
            {overdueTodos.map((t) => (
              <div key={t.id} className="text-sm flex items-center gap-2">
                <span className="badge badge-high">지남</span>
                <span>{t.title}</span>
                <span className="text-[var(--muted)]">
                  {format(new Date(t.dueDate!), 'M/d', { locale: ko })}
                </span>
              </div>
            ))}
            {todayTodos.map((t) => (
              <div key={t.id} className="text-sm flex items-center gap-2">
                <span className="badge badge-medium">오늘</span>
                <span>{t.title}</span>
              </div>
            ))}
            {soonTodos.map((t) => (
              <div key={t.id} className="text-sm flex items-center gap-2">
                <span className="badge badge-low">{formatDueLabel(t.dueDate!)}</span>
                <span>{t.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Notes */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <FileText size={18} /> 최근 노트
            </h2>
            <Link href="/notes" className="text-xs text-[var(--accent)]">
              전체보기
            </Link>
          </div>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              아직 노트가 없습니다. 첫 번째 노트를 만들어보세요!
            </p>
          ) : (
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <Link
                  key={note.id}
                  href={`/notes?id=${note.id}`}
                  className="block p-3 rounded-lg hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge badge-${note.category}`}>
                      {note.category === 'idea' && '아이디어'}
                      {note.category === 'work' && '업무'}
                      {note.category === 'research' && '리서치'}
                      {note.category === 'personal' && '개인'}
                    </span>
                    <span className="font-medium text-sm">{note.title}</span>
                  </div>
                  <p className="text-xs text-[var(--muted)] line-clamp-1">
                    {note.content.slice(0, 100)}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Todos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarCheck size={18} /> 다가오는 일정
            </h2>
            <Link href="/schedule" className="text-xs text-[var(--accent)]">
              전체보기
            </Link>
          </div>
          {upcomingTodos.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">예정된 할일이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {upcomingTodos.map((todo) => (
                <div key={todo.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      todo.priority === 'high'
                        ? 'bg-[var(--danger)]'
                        : todo.priority === 'medium'
                        ? 'bg-[var(--warning)]'
                        : 'bg-[var(--success)]'
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{todo.title}</div>
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      todo.dueDate && isPast(new Date(todo.dueDate)) && !isToday(new Date(todo.dueDate))
                        ? 'text-[var(--danger)]'
                        : isToday(new Date(todo.dueDate!))
                        ? 'text-[var(--warning)]'
                        : 'text-[var(--muted)]'
                    }`}
                  >
                    {formatDueLabel(todo.dueDate!)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Category Overview */}
      <div className="card mt-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2">
          <Sparkles size={18} /> 카테고리 현황
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'idea', label: '아이디어', color: '#f59e0b' },
            { key: 'work', label: '업무', color: '#3b82f6' },
            { key: 'research', label: '리서치', color: '#6366f1' },
            { key: 'personal', label: '개인', color: '#ec4899' },
          ].map((cat) => (
            <div key={cat.key} className="text-center p-4 rounded-lg bg-gray-50">
              <div
                className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold"
                style={{ background: cat.color }}
              >
                {categoryCount[cat.key as keyof typeof categoryCount]}
              </div>
              <div className="text-sm font-medium">{cat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
