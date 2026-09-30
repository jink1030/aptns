'use client';

import { useEffect, useState } from 'react';
import {
  Plus, Check, Trash2, CalendarDays, Clock, MessageSquareText, Loader2, X,
  Circle, PlayCircle, CheckCircle2, Pencil, FileText, Search,
} from 'lucide-react';
import { fetchTodos, createTodo, editTodo, removeTodo, fetchNotes } from '@/lib/db';
import type { Note, Todo, TodoPriority, TodoStatus } from '@/types';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ExtractedAgenda {
  title: string;
  description: string;
  dueDate: string | null;
  priority: TodoPriority;
  checked: boolean;
}

const statusLabel: Record<TodoStatus, string> = {
  todo: '할 일',
  in_progress: '진행중',
  done: '완료',
};

const priorityLabel: Record<TodoPriority, string> = {
  high: '높음',
  medium: '보통',
  low: '낮음',
};

export default function SchedulePage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'done'>('all');
  const [showForm, setShowForm] = useState(false);
  const [showExtract, setShowExtract] = useState(false);

  const [allNotes, setAllNotes] = useState<Note[]>([]);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDue, setNewDue] = useState('');
  const [newPriority, setNewPriority] = useState<TodoPriority>('medium');
  const [newLinkedNotes, setNewLinkedNotes] = useState<string[]>([]);
  const [newNoteSearch, setNewNoteSearch] = useState('');

  const [conversation, setConversation] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [agendas, setAgendas] = useState<ExtractedAgenda[]>([]);
  const [extractError, setExtractError] = useState('');
  const [registering, setRegistering] = useState(false);

  // Detail modal state
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editDue, setEditDue] = useState('');
  const [editPriority, setEditPriority] = useState<TodoPriority>('medium');
  const [editStatus, setEditStatus] = useState<TodoStatus>('todo');
  const [editLinkedNotes, setEditLinkedNotes] = useState<string[]>([]);
  const [editNoteSearch, setEditNoteSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTodos().then(setTodos);
    fetchNotes().then(setAllNotes);
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
      linkedNoteIds: newLinkedNotes,
    });
    setNewTitle('');
    setNewDesc('');
    setNewDue('');
    setNewPriority('medium');
    setNewLinkedNotes([]);
    setNewNoteSearch('');
    setShowForm(false);
    await reload();
  }

  function openDetail(todo: Todo) {
    setDetailTodo(todo);
    setEditTitle(todo.title);
    setEditDesc(todo.description || '');
    setEditDue(todo.dueDate || '');
    setEditPriority(todo.priority);
    setEditStatus(todo.status);
    setEditLinkedNotes(todo.linkedNoteIds || []);
    setEditNoteSearch('');
  }

  function closeDetail() {
    setDetailTodo(null);
  }

  async function handleSaveDetail() {
    if (!detailTodo || !editTitle.trim()) return;
    setSaving(true);
    await editTodo(detailTodo.id, {
      title: editTitle,
      description: editDesc,
      dueDate: editDue || null,
      priority: editPriority,
      status: editStatus,
      linkedNoteIds: editLinkedNotes,
    });
    await reload();
    setSaving(false);
    closeDetail();
  }

  async function handleDeleteFromDetail() {
    if (!detailTodo) return;
    if (!confirm('이 할일을 삭제하시겠습니까?')) return;
    await removeTodo(detailTodo.id);
    await reload();
    closeDetail();
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
            {/* Linked Notes Picker */}
            <div>
              <label className="text-xs text-[var(--muted)] flex items-center gap-1 mb-1.5">
                <FileText size={12} /> 참고 노트 ({newLinkedNotes.length}/10)
              </label>
              {newLinkedNotes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {newLinkedNotes.map((nid) => {
                    const note = allNotes.find((n) => n.id === nid);
                    return note ? (
                      <span key={nid} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                        {note.title.slice(0, 20)}{note.title.length > 20 ? '...' : ''}
                        <button onClick={() => setNewLinkedNotes((prev) => prev.filter((id) => id !== nid))} className="hover:text-red-500">
                          <X size={12} />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              {newLinkedNotes.length < 10 && (
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                  <input
                    type="text"
                    placeholder="노트 검색..."
                    value={newNoteSearch}
                    onChange={(e) => setNewNoteSearch(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                  />
                  {newNoteSearch && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {allNotes
                        .filter((n) => !newLinkedNotes.includes(n.id) && n.title.toLowerCase().includes(newNoteSearch.toLowerCase()))
                        .slice(0, 8)
                        .map((n) => (
                          <button
                            key={n.id}
                            onClick={() => {
                              setNewLinkedNotes((prev) => [...prev, n.id]);
                              setNewNoteSearch('');
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition flex items-center gap-2"
                          >
                            <FileText size={12} className="text-[var(--muted)] flex-shrink-0" />
                            <span className="truncate">{n.title}</span>
                            <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{n.category}</span>
                          </button>
                        ))}
                      {allNotes.filter((n) => !newLinkedNotes.includes(n.id) && n.title.toLowerCase().includes(newNoteSearch.toLowerCase())).length === 0 && (
                        <div className="px-3 py-2 text-xs text-[var(--muted)]">검색 결과 없음</div>
                      )}
                    </div>
                  )}
                </div>
              )}
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
              onClick={() => openDetail(todo)}
              className={`card flex items-start gap-3 cursor-pointer hover:shadow-md transition-shadow ${todo.status === 'done' ? 'opacity-50' : ''}`}
            >
              <div
                className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  todo.status === 'done'
                    ? 'border-[var(--success)] bg-[var(--success)] text-white'
                    : todo.status === 'in_progress'
                    ? 'border-[var(--accent)] bg-blue-50'
                    : 'border-gray-300'
                }`}
              >
                {todo.status === 'done' && <Check size={12} />}
                {todo.status === 'in_progress' && <Clock size={10} className="text-[var(--accent)]" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-medium text-sm ${todo.status === 'done' ? 'line-through' : ''}`}>
                    {todo.title}
                  </span>
                  <span className={`badge badge-${todo.priority}`}>
                    {priorityLabel[todo.priority]}
                  </span>
                </div>
                {todo.description && (
                  <p className="text-xs text-[var(--muted)] mb-1 line-clamp-2">{todo.description}</p>
                )}
                {todo.dueDate && (
                  <div className={`text-xs flex items-center gap-1 ${dueLabel(todo.dueDate).color}`}>
                    <CalendarDays size={12} />
                    {dueLabel(todo.dueDate).text}
                  </div>
                )}
                {!todo.dueDate && (
                  <div className="text-xs text-[var(--muted)] flex items-center gap-1 opacity-50">
                    <CalendarDays size={12} />
                    날짜 미지정
                  </div>
                )}
                {todo.linkedNoteIds && todo.linkedNoteIds.length > 0 && (
                  <div className="text-xs text-blue-500 flex items-center gap-1 mt-0.5">
                    <FileText size={12} />
                    참고 노트 {todo.linkedNoteIds.length}개
                  </div>
                )}
              </div>

              <Pencil size={14} className="text-gray-300 mt-1 flex-shrink-0" />
            </div>
          ))
        )}
      </div>

      {/* Detail Modal */}
      {detailTodo && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeDetail}>
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-base">할일 상세</h3>
              <button onClick={closeDetail} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              {/* Status selector */}
              <div>
                <label className="text-xs text-[var(--muted)] block mb-2">상태</label>
                <div className="flex gap-2">
                  {(['todo', 'in_progress', 'done'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setEditStatus(s)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition border-2 ${
                        editStatus === s
                          ? s === 'done'
                            ? 'border-[var(--success)] bg-green-50 text-[var(--success)]'
                            : s === 'in_progress'
                            ? 'border-[var(--accent)] bg-blue-50 text-[var(--accent)]'
                            : 'border-gray-400 bg-gray-50 text-gray-700'
                          : 'border-[var(--border)] text-[var(--muted)] hover:border-gray-300'
                      }`}
                    >
                      {s === 'todo' && <Circle size={14} />}
                      {s === 'in_progress' && <PlayCircle size={14} />}
                      {s === 'done' && <CheckCircle2 size={14} />}
                      {statusLabel[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">제목</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs text-[var(--muted)] block mb-1">설명</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none"
                  placeholder="설명 입력..."
                />
              </div>

              {/* Date & Priority row */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[var(--muted)] block mb-1">마감일</label>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={editDue}
                      onChange={(e) => setEditDue(e.target.value)}
                      className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                    {editDue && (
                      <button
                        onClick={() => setEditDue('')}
                        className="px-2 text-[var(--muted)] hover:text-[var(--danger)] text-xs"
                        title="날짜 제거"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="w-28">
                  <label className="text-xs text-[var(--muted)] block mb-1">우선순위</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as TodoPriority)}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                  >
                    <option value="high">높음</option>
                    <option value="medium">보통</option>
                    <option value="low">낮음</option>
                  </select>
                </div>
              </div>

              {/* Linked Notes Picker */}
              <div>
                <label className="text-xs text-[var(--muted)] flex items-center gap-1 mb-1.5">
                  <FileText size={12} /> 참고 노트 ({editLinkedNotes.length}/10)
                </label>
                {editLinkedNotes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {editLinkedNotes.map((nid) => {
                      const note = allNotes.find((n) => n.id === nid);
                      return note ? (
                        <span key={nid} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs">
                          {note.title.slice(0, 20)}{note.title.length > 20 ? '...' : ''}
                          <button onClick={() => setEditLinkedNotes((prev) => prev.filter((id) => id !== nid))} className="hover:text-red-500">
                            <X size={12} />
                          </button>
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {editLinkedNotes.length < 10 && (
                  <div className="relative">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
                    <input
                      type="text"
                      placeholder="노트 검색..."
                      value={editNoteSearch}
                      onChange={(e) => setEditNoteSearch(e.target.value)}
                      className="w-full border border-[var(--border)] rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-[var(--accent)]"
                    />
                    {editNoteSearch && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-[var(--border)] rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {allNotes
                          .filter((n) => !editLinkedNotes.includes(n.id) && n.title.toLowerCase().includes(editNoteSearch.toLowerCase()))
                          .slice(0, 8)
                          .map((n) => (
                            <button
                              key={n.id}
                              onClick={() => {
                                setEditLinkedNotes((prev) => [...prev, n.id]);
                                setEditNoteSearch('');
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-blue-50 transition flex items-center gap-2"
                            >
                              <FileText size={12} className="text-[var(--muted)] flex-shrink-0" />
                              <span className="truncate">{n.title}</span>
                              <span className="text-[10px] text-[var(--muted)] flex-shrink-0">{n.category}</span>
                            </button>
                          ))}
                        {allNotes.filter((n) => !editLinkedNotes.includes(n.id) && n.title.toLowerCase().includes(editNoteSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-xs text-[var(--muted)]">검색 결과 없음</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Created date info */}
              <div className="text-[11px] text-[var(--muted)] pt-1">
                생성: {format(new Date(detailTodo.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSaveDetail}
                  disabled={saving || !editTitle.trim()}
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : '저장'}
                </button>
                <button
                  onClick={handleDeleteFromDetail}
                  className="px-4 py-2.5 bg-red-50 text-[var(--danger)] border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 flex items-center gap-1.5"
                >
                  <Trash2 size={14} /> 삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
