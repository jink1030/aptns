'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Check, Trash2, CalendarDays, Clock, MessageSquareText, Loader2, X,
} from 'lucide-react';
import { fetchTodos, createTodo, editTodo, removeTodo } from '@/lib/db';
import type { Todo, TodoPriority, TodoStatus } from '@/types';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ExtractedAgenda {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TodoPriority;
  checked: boolean;
}

export default function SchedulePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showExtract, setShowExtract] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');

  const [conversation, setConversation] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [agendas, setAgendas] = useState<ExtractedAgenda[]>([]);
  const [extractError, setExtractError] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetchTodos().then(setTodos);
  }, []);

  async function reload() {
    const all = await fetchTodos();
    setTodos(all);
  }

  async function handleAdd() {
    if (!newTitle.trim()) return;
    await createTodo({
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
    await reload();
  }

  async function toggleStatus(todo: Todo) {
    const next: TodoStatus =
      todo.status === 'todo' ? 'in_progress' : todo.status === 'in_progress' ? 'done' : 'todo';
    await editTodo(todo.id, { status: next });
    await reload();
  }

  async function handleDeleteTodo(id: string) {
    await removeTodo(id);
    await reload();
  }

  async function handleExtract() {
    if (!conversation.trim()) return;
    setExtracting(true);
    setExtractError('');
    setAgendas([]);

    let apiKey = '';
    try { apiKey = localStorage.getItem('secondbrain_claude_key') || ''; } catch {}

    if (!apiKey) {
      setExtractError('설정에서 Claude API 키를 먼저 입력해주세요.');
      setExtracting(false);
      return;
    }

    try {
      const res = await fetch('/api/extract-agendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setExtractError(data.error || '추출 실패');
      } else if (data.agendas?.length === 0) {
        setExtractError('추출된 아젠다가 없습니다. 대화 내용을 확인해주세요.');
      } else {
        setAgendas(data.agendas.map((a: Omit<ExtractedAgenda, 'checked'>) => ({ ...a, checked: true })));
      }
    } catch {
      setExtractError('요청 실패. 다시 시도해주세요.');
    }
    setExtracting(false);
  }

  async function handleRegisterAgendas() {
    const selected = agendas.filter((a) => a.checked);
    if (selected.length === 0) return;
    setRegistering(true);
    for (const a of selected) {
      await createTodo({
        title: a.title,
        description: a.description,
        dueDate: a.dueDate || null,
        priority: a.priority,
        status: 'todo',
        noteId: null,
      });
    }
    await reload();
    setAgendas([]);
    setConversation('');
    setShowExtract(false);
    setRegistering(false);
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
        <div className="flex gap-2">
          <button
            onClick={() => { setShowExtract(!showExtract); setShowForm(false); }}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition ${
              showExtract
                ? 'border-[var(--accent)] text-[var(--accent)] bg-blue-50'
                : 'border-[var(--border)] text-[var(--foreground)] hover:bg-gray-50'
            }`}
          >
            <MessageSquareText size={16} /> 대화에서 추출
          </button>
          <button
            onClick={() => { setShowForm(!showForm); setShowExtract(false); }}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> 새 할일
          </button>
        </div>
      </div>

      {/* Extract from conversation */}
      {showExtract && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <MessageSquareText size={16} /> 대화에서 아젠다 추출
            </h3>
            <button onClick={() => { setShowExtract(false); setAgendas([]); setExtractError(''); }} className="text-[var(--muted)] hover:text-[var(--foreground)]">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-[var(--muted)] mb-3">
            슬랙, 카톡 등 업무 대화를 붙여넣으면 AI가 액션 아이템을 자동 추출합니다.
          </p>

          <textarea
            placeholder="대화 내용을 붙여넣으세요...&#10;&#10;예:&#10;김슬빈 [오후 4:04]&#10;해당문서에서 제가 의사결정이 필요한 부분이 있는지요?&#10;이진경 [오후 5:05]&#10;위 3건인데 정리해서 공유드리면..."
            value={conversation}
            onChange={(e) => setConversation(e.target.value)}
            rows={6}
            className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-y mb-3"
          />

          <button
            onClick={handleExtract}
            disabled={extracting || !conversation.trim()}
            className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {extracting ? <><Loader2 size={14} className="animate-spin" /> 분석 중...</> : '아젠다 추출'}
          </button>

          {extractError && (
            <p className="text-sm mt-3 text-[var(--danger)]">{extractError}</p>
          )}

          {/* Extracted agendas */}
          {agendas.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">{agendas.length}개 아젠다 추출됨</h4>
                <label className="flex items-center gap-1.5 text-xs text-[var(--muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agendas.every((a) => a.checked)}
                    onChange={(e) => setAgendas(agendas.map((a) => ({ ...a, checked: e.target.checked })))}
                    className="rounded"
                  />
                  전체 선택
                </label>
              </div>

              {agendas.map((agenda, i) => (
                <div key={i} className={`p-3 border rounded-lg transition ${agenda.checked ? 'border-[var(--accent)] bg-blue-50/30' : 'border-[var(--border)] opacity-60'}`}>
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={agenda.checked}
                      onChange={(e) => {
                        const next = [...agendas];
                        next[i] = { ...next[i], checked: e.target.checked };
                        setAgendas(next);
                      }}
                      className="mt-1 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={agenda.title}
                        onChange={(e) => {
                          const next = [...agendas];
                          next[i] = { ...next[i], title: e.target.value };
                          setAgendas(next);
                        }}
                        className="w-full font-medium text-sm bg-transparent outline-none border-b border-transparent focus:border-[var(--accent)] pb-0.5"
                      />
                      <textarea
                        value={agenda.description}
                        onChange={(e) => {
                          const next = [...agendas];
                          next[i] = { ...next[i], description: e.target.value };
                          setAgendas(next);
                        }}
                        rows={2}
                        className="w-full text-xs text-[var(--muted)] bg-transparent outline-none resize-none mt-1 border-b border-transparent focus:border-[var(--accent)]"
                      />
                      <div className="flex gap-3 mt-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays size={12} className="text-[var(--muted)]" />
                          <input
                            type="date"
                            value={agenda.dueDate || ''}
                            onChange={(e) => {
                              const next = [...agendas];
                              next[i] = { ...next[i], dueDate: e.target.value || null };
                              setAgendas(next);
                            }}
                            className="border border-[var(--border)] rounded px-2 py-1 text-xs outline-none"
                          />
                          {!agenda.dueDate && <span className="text-[10px] text-[var(--warning)]">날짜 미지정</span>}
                        </div>
                        <select
                          value={agenda.priority}
                          onChange={(e) => {
                            const next = [...agendas];
                            next[i] = { ...next[i], priority: e.target.value as TodoPriority };
                            setAgendas(next);
                          }}
                          className="border border-[var(--border)] rounded px-2 py-1 text-xs outline-none"
                        >
                          <option value="high">높음</option>
                          <option value="medium">보통</option>
                          <option value="low">낮음</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={handleRegisterAgendas}
                disabled={registering || agendas.filter((a) => a.checked).length === 0}
                className="w-full px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {registering
                  ? <><Loader2 size={14} className="animate-spin" /> 등록 중...</>
                  : `선택한 ${agendas.filter((a) => a.checked).length}개 할일로 등록`
                }
              </button>
            </div>
          )}
        </div>
      )}

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
