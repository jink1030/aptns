'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Lock, FileText, CalendarCheck, Rss, Eye, LogOut,
  ChevronRight, Clock, CalendarDays, Check, Plus, X, Loader2,
  Share2, RefreshCw,
} from 'lucide-react';
import { fetchNotes, fetchTodos, createNote } from '@/lib/db';
import type { Note, Todo, NoteCategory, TodoStatus } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Tab = 'notes' | 'todos' | 'research' | 'graph';

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  idea: '아이디어', work: '업무', research: '리서치', personal: '개인',
};

const STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '할 일', in_progress: '진행중', done: '완료',
};

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  idea: '#f59e0b',
  work: '#3b82f6',
  research: '#6366f1',
  personal: '#ec4899',
};

const URL_REGEX = /(https?:\/\/[^\s<>]+)/g;

function Linkify({ text }: { text: string }) {
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

export default function ViewerPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('notes');

  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);
  const [todoFilter, setTodoFilter] = useState<'all' | TodoStatus>('all');

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('idea');
  const [noteTags, setNoteTags] = useState<string[]>([]);
  const [noteTagInput, setNoteTagInput] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('viewer_authed');
      if (saved === 'true') {
        setAuthed(true);
        loadData();
      }
    } catch {}
    setChecking(false);
  }, []);

  async function loadData() {
    const [n, t] = await Promise.all([fetchNotes(), fetchTodos()]);
    setNotes(n);
    setTodos(t);
  }

  async function handleLogin() {
    if (!code.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/viewer-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try { sessionStorage.setItem('viewer_authed', 'true'); } catch {}
        setAuthed(true);
        loadData();
      } else {
        setError(data.error || '접근 코드가 올바르지 않습니다.');
      }
    } catch {
      setError('인증에 실패했습니다.');
    }
  }

  function handleLogout() {
    try { sessionStorage.removeItem('viewer_authed'); } catch {}
    setAuthed(false);
    setCode('');
  }

  function handleAddTag() {
    const tag = noteTagInput.trim();
    if (tag && !noteTags.includes(tag)) {
      setNoteTags([...noteTags, tag]);
    }
    setNoteTagInput('');
  }

  if (checking) return null;

  const filteredTodos = todos
    .filter(t => todoFilter === 'all' || t.status === todoFilter)
    .sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const todoStats = {
    total: todos.length,
    todo: todos.filter(t => t.status === 'todo').length,
    in_progress: todos.filter(t => t.status === 'in_progress').length,
    done: todos.filter(t => t.status === 'done').length,
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-50 overflow-y-auto">
      {!authed ? (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center mx-auto mb-4">
              <Eye size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold mb-1">Second Brain</h1>
            <p className="text-sm text-[var(--muted)] mb-6">뷰어 모드</p>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="접근 코드 입력"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="w-full border border-[var(--border)] rounded-xl px-4 py-3 text-center text-lg tracking-widest outline-none focus:border-[var(--accent)]"
                autoFocus
              />
              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Lock size={16} /> 입장
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
                <Eye size={18} className="text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Second Brain</h1>
                <p className="text-xs text-[var(--muted)]">뷰어</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut size={14} /> 나가기
            </button>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--muted)]">노트</div>
              <div className="text-2xl font-bold">{notes.length}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--muted)]">진행중</div>
              <div className="text-2xl font-bold text-blue-600">{todoStats.in_progress}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-[var(--border)]">
              <div className="text-xs text-[var(--muted)]">완료</div>
              <div className="text-2xl font-bold text-green-600">{todoStats.done}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-[var(--border)]">
            {([
              { key: 'notes' as Tab, label: '노트', icon: FileText },
              { key: 'todos' as Tab, label: '일정 / 할일', icon: CalendarCheck },
              { key: 'research' as Tab, label: '리서치 피드', icon: Rss },
              { key: 'graph' as Tab, label: '지식 그래프', icon: Share2 },
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelectedNote(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:bg-gray-50'
                }`}
              >
                <t.icon size={14} /> <span className="hidden sm:inline">{t.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {tab === 'notes' && (
            <div>
              {selectedNote ? (
                <div className="bg-white rounded-xl border border-[var(--border)] p-6">
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="text-sm text-[var(--accent)] hover:underline mb-4 flex items-center gap-1"
                  >
                    ← 목록으로
                  </button>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`badge badge-${selectedNote.category}`}>
                      {CATEGORY_LABEL[selectedNote.category]}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {format(new Date(selectedNote.updatedAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold mb-4">{selectedNote.title}</h2>
                  <div className="text-sm text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
                    <Linkify text={selectedNote.content} />
                  </div>
                  {selectedNote.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-6 flex-wrap">
                      {selectedNote.tags.map(tag => (
                        <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-[var(--muted)]">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* New Note Button */}
                  <div className="mb-4">
                    <button
                      onClick={() => setShowNoteForm(!showNoteForm)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition ${
                        showNoteForm
                          ? 'bg-gray-100 text-[var(--muted)]'
                          : 'bg-[var(--accent)] text-white hover:opacity-90'
                      }`}
                    >
                      {showNoteForm ? <><X size={16} /> 취소</> : <><Plus size={16} /> 새 노트 작성</>}
                    </button>
                  </div>

                  {/* New Note Form */}
                  {showNoteForm && (
                    <div className="bg-white rounded-xl border border-[var(--border)] p-5 mb-4">
                      <h3 className="font-semibold text-sm mb-3">새 노트 작성</h3>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-[var(--muted)] block mb-1">카테고리</label>
                          <div className="flex gap-2">
                            {(['idea', 'work', 'research', 'personal'] as NoteCategory[]).map(c => (
                              <button
                                key={c}
                                onClick={() => setNoteCategory(c)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                  noteCategory === c
                                    ? 'bg-[var(--accent)] text-white'
                                    : 'bg-gray-100 text-[var(--muted)] hover:bg-gray-200'
                                }`}
                              >
                                {CATEGORY_LABEL[c]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input
                          type="text"
                          placeholder="제목"
                          value={noteTitle}
                          onChange={e => setNoteTitle(e.target.value)}
                          className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                        />
                        <textarea
                          placeholder="내용을 입력하세요..."
                          value={noteContent}
                          onChange={e => setNoteContent(e.target.value)}
                          rows={6}
                          className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-y"
                        />
                        {/* Tag Input */}
                        <div>
                          <label className="text-xs text-[var(--muted)] block mb-1">태그</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="태그 입력 후 Enter"
                              value={noteTagInput}
                              onChange={e => setNoteTagInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ',') {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                            />
                            <button
                              type="button"
                              onClick={handleAddTag}
                              className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-[var(--muted)] hover:bg-gray-200"
                            >
                              추가
                            </button>
                          </div>
                          {noteTags.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {noteTags.map(tag => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full"
                                >
                                  #{tag}
                                  <button
                                    onClick={() => setNoteTags(noteTags.filter(t => t !== tag))}
                                    className="hover:text-blue-800"
                                  >
                                    <X size={10} />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            if (!noteTitle.trim()) return;
                            setNoteSaving(true);
                            await createNote({
                              title: noteTitle,
                              content: noteContent,
                              category: noteCategory,
                              tags: noteTags.length > 0 ? noteTags : (noteCategory === 'idea' ? ['아이디어'] : []),
                              linkedNoteIds: [],
                            });
                            setNoteTitle('');
                            setNoteContent('');
                            setNoteCategory('idea');
                            setNoteTags([]);
                            setNoteTagInput('');
                            setShowNoteForm(false);
                            setNoteSaving(false);
                            await loadData();
                          }}
                          disabled={noteSaving || !noteTitle.trim()}
                          className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
                        >
                          {noteSaving ? <><Loader2 size={14} className="animate-spin" /> 저장 중...</> : '저장'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {notes
                      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                      .map(note => (
                        <button
                          key={note.id}
                          onClick={() => setSelectedNote(note)}
                          className="w-full text-left bg-white rounded-xl border border-[var(--border)] p-4 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`badge badge-${note.category}`}>
                              {CATEGORY_LABEL[note.category]}
                            </span>
                            <span className="text-xs text-[var(--muted)]">
                              {format(new Date(note.updatedAt), 'M/d HH:mm', { locale: ko })}
                            </span>
                          </div>
                          <div className="font-medium text-sm">{note.title}</div>
                          <p className="text-xs text-[var(--muted)] line-clamp-2 mt-1">
                            {note.content.slice(0, 150)}
                          </p>
                          {note.tags.length > 0 && (
                            <div className="flex gap-1 mt-2 flex-wrap">
                              {note.tags.slice(0, 4).map(tag => (
                                <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-[var(--muted)]">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                          <ChevronRight size={14} className="text-gray-300 mt-1 float-right" />
                        </button>
                      ))}
                    {notes.length === 0 && (
                      <div className="text-center py-16 text-[var(--muted)] text-sm">
                        등록된 노트가 없습니다
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'todos' && (
            <div>
              <div className="flex gap-1 mb-4 flex-wrap">
                {(['all', 'todo', 'in_progress', 'done'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTodoFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs ${
                      todoFilter === f ? 'bg-[var(--accent)] text-white' : 'bg-white text-[var(--muted)] border border-[var(--border)]'
                    }`}
                  >
                    {f === 'all' ? `전체 (${todoStats.total})` : `${STATUS_LABEL[f]} (${todoStats[f]})`}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {filteredTodos.map(todo => (
                  <button
                    key={todo.id}
                    onClick={() => setDetailTodo(todo)}
                    className={`w-full text-left bg-white rounded-xl border border-[var(--border)] p-4 hover:shadow-md transition-shadow ${todo.status === 'done' ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        todo.status === 'done'
                          ? 'border-green-500 bg-green-500 text-white'
                          : todo.status === 'in_progress'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-300'
                      }`}>
                        {todo.status === 'done' && <Check size={12} />}
                        {todo.status === 'in_progress' && <Clock size={10} className="text-blue-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-medium text-sm ${todo.status === 'done' ? 'line-through text-[var(--muted)]' : ''}`}>
                            {todo.title}
                          </span>
                          <span className={`badge badge-${todo.priority}`}>
                            {todo.priority === 'high' ? '높음' : todo.priority === 'medium' ? '보통' : '낮음'}
                          </span>
                        </div>
                        {todo.description && (
                          <p className="text-xs text-[var(--muted)] mb-1 line-clamp-1">{todo.description}</p>
                        )}
                        {todo.dueDate && (
                          <div className="text-xs flex items-center gap-1 text-[var(--muted)]">
                            <CalendarDays size={12} /> {todo.dueDate}
                          </div>
                        )}
                        {todo.linkedNoteIds && todo.linkedNoteIds.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-blue-600">
                            <FileText size={10} /> 참고 노트 {todo.linkedNoteIds.length}개
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-gray-300 mt-1 flex-shrink-0" />
                    </div>
                  </button>
                ))}
                {filteredTodos.length === 0 && (
                  <div className="text-center py-16 text-[var(--muted)] text-sm">
                    해당하는 할일이 없습니다
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'research' && (
            <ResearchTab />
          )}

          {tab === 'graph' && (
            <GraphTab notes={notes} />
          )}
        </div>
      )}

      {/* Todo Detail Modal */}
      {detailTodo && (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center p-4" onClick={() => setDetailTodo(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    detailTodo.status === 'done'
                      ? 'border-green-500 bg-green-500 text-white'
                      : detailTodo.status === 'in_progress'
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300'
                  }`}>
                    {detailTodo.status === 'done' && <Check size={14} />}
                    {detailTodo.status === 'in_progress' && <Clock size={12} className="text-blue-500" />}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    detailTodo.status === 'done' ? 'bg-green-50 text-green-700' :
                    detailTodo.status === 'in_progress' ? 'bg-blue-50 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {STATUS_LABEL[detailTodo.status]}
                  </span>
                </div>
                <button onClick={() => setDetailTodo(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                  <X size={18} className="text-gray-400" />
                </button>
              </div>

              <h2 className="text-lg font-bold mb-3">{detailTodo.title}</h2>

              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm">
                  <span className={`badge badge-${detailTodo.priority}`}>
                    우선순위: {detailTodo.priority === 'high' ? '높음' : detailTodo.priority === 'medium' ? '보통' : '낮음'}
                  </span>
                  {detailTodo.dueDate && (
                    <span className="flex items-center gap-1 text-[var(--muted)]">
                      <CalendarDays size={14} /> {detailTodo.dueDate}
                    </span>
                  )}
                </div>

                {detailTodo.description && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-[var(--muted)] mb-1">설명</div>
                    <div className="text-sm whitespace-pre-wrap leading-relaxed">
                      <Linkify text={detailTodo.description} />
                    </div>
                  </div>
                )}

                {detailTodo.linkedNoteIds && detailTodo.linkedNoteIds.length > 0 && (
                  <div>
                    <div className="text-xs text-[var(--muted)] mb-2">참고 노트</div>
                    <div className="space-y-1.5">
                      {detailTodo.linkedNoteIds.map(nid => {
                        const note = notes.find(n => n.id === nid);
                        return note ? (
                          <button
                            key={nid}
                            onClick={() => { setDetailTodo(null); setTab('notes'); setSelectedNote(note); }}
                            className="w-full text-left flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100 transition"
                          >
                            <FileText size={14} />
                            <span className="flex-1 truncate">{note.title}</span>
                            <ChevronRight size={14} className="text-blue-400" />
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                <div className="text-xs text-[var(--muted)] pt-2 border-t border-[var(--border)]">
                  생성: {format(new Date(detailTodo.createdAt), 'yyyy년 M월 d일 HH:mm', { locale: ko })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Research Tab with caching ─── */

const RESEARCH_CACHE_KEY = 'secondbrain_research_cache';

interface ResearchArticle {
  title: string;
  url: string;
  date: string;
  summary: string;
  source: string;
  relevance: string;
}

function ResearchTab() {
  const [articles, setArticles] = useState<ResearchArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(RESEARCH_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ResearchArticle[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setArticles(parsed);
          setFetched(true);
        }
      }
    } catch {}
  }, []);

  async function handleFetch() {
    setLoading(true);
    let apiKey = '';
    try { apiKey = localStorage.getItem('secondbrain_claude_key') || ''; } catch {}
    try {
      const res = await fetch('/api/news-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json();
      const newArticles = data.articles || [];
      setArticles(newArticles);
      setFetched(true);
      try { localStorage.setItem(RESEARCH_CACHE_KEY, JSON.stringify(newArticles)); } catch {}
    } catch {}
    setLoading(false);
  }

  return (
    <div>
      {!fetched ? (
        <div className="bg-white rounded-xl border border-[var(--border)] p-8 text-center">
          <Rss size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-[var(--muted)] mb-4">아파트 관리 관련 최신 뉴스를 수집합니다</p>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="px-6 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? '수집 중...' : '뉴스 수집'}
          </button>
        </div>
      ) : (
        <div>
          <div className="flex justify-end mb-3">
            <button
              onClick={handleFetch}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-white border border-[var(--border)] rounded-lg transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              {loading ? '수집 중...' : '새로고침'}
            </button>
          </div>
          <div className="space-y-2">
            {articles.map((a, i) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-white rounded-xl border border-[var(--border)] p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">{a.source}</span>
                  {a.relevance && <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{a.relevance}</span>}
                  {a.date && <span className="text-[10px] text-[var(--muted)]">{a.date}</span>}
                </div>
                <div className="font-medium text-sm">{a.title}</div>
                {a.summary && <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{a.summary}</p>}
              </a>
            ))}
            {articles.length === 0 && <p className="text-center py-8 text-sm text-[var(--muted)]">수집된 기사가 없습니다</p>}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Knowledge Graph Tab ─── */

interface SimNode {
  id: string;
  label: string;
  category: NoteCategory;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tags: string[];
}

interface SimLink {
  source: string;
  target: string;
}

function GraphTab({ notes }: { notes: Note[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const dragRef = useRef<{ node: SimNode | null }>({ node: null });
  const animRef = useRef<number>(0);
  const hoveredRef = useRef<SimNode | null>(null);

  const buildGraph = useCallback(() => {
    const nodes: SimNode[] = notes.map((n, i) => ({
      id: n.id,
      label: n.title,
      category: n.category,
      x: 300 + Math.cos((i / notes.length) * Math.PI * 2) * 180 + Math.random() * 40,
      y: 250 + Math.sin((i / notes.length) * Math.PI * 2) * 180 + Math.random() * 40,
      vx: 0,
      vy: 0,
      tags: n.tags,
    }));

    const links: SimLink[] = [];
    notes.forEach((note) => {
      note.linkedNoteIds.forEach((targetId) => {
        if (notes.some((n) => n.id === targetId)) {
          if (!links.some((l) => (l.source === note.id && l.target === targetId) || (l.source === targetId && l.target === note.id))) {
            links.push({ source: note.id, target: targetId });
          }
        }
      });
    });

    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const shared = notes[i].tags.filter((t) => notes[j].tags.includes(t));
        if (shared.length > 0 && !links.some((l) =>
          (l.source === notes[i].id && l.target === notes[j].id) ||
          (l.source === notes[j].id && l.target === notes[i].id)
        )) {
          links.push({ source: notes[i].id, target: notes[j].id });
        }
      }
    }

    nodesRef.current = nodes;
    linksRef.current = links;
  }, [notes]);

  useEffect(() => {
    buildGraph();
  }, [buildGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    function resize() {
      const rect = container!.getBoundingClientRect();
      canvas!.width = rect.width;
      canvas!.height = rect.height;
    }
    resize();
    window.addEventListener('resize', resize);

    function simulate() {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const w = canvas!.width;
      const h = canvas!.height;
      const cx = w / 2;
      const cy = h / 2;

      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.001;
        node.vy += (cy - node.y) * 0.001;
        for (const other of nodes) {
          if (other.id === node.id) continue;
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          if (dist < 200) {
            const force = 300 / (dist * dist);
            node.vx += (dx / dist) * force;
            node.vy += (dy / dist) * force;
          }
        }
      }

      for (const link of links) {
        const src = nodes.find((n) => n.id === link.source);
        const tgt = nodes.find((n) => n.id === link.target);
        if (!src || !tgt) continue;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 120) * 0.003;
        src.vx += (dx / dist) * force;
        src.vy += (dy / dist) * force;
        tgt.vx -= (dx / dist) * force;
        tgt.vy -= (dy / dist) * force;
      }

      for (const node of nodes) {
        if (dragRef.current.node?.id === node.id) continue;
        node.vx *= 0.9;
        node.vy *= 0.9;
        node.x += node.vx;
        node.y += node.vy;
        node.x = Math.max(30, Math.min(w - 30, node.x));
        node.y = Math.max(30, Math.min(h - 30, node.y));
      }

      ctx!.clearRect(0, 0, w, h);

      for (const link of links) {
        const src = nodes.find((n) => n.id === link.source);
        const tgt = nodes.find((n) => n.id === link.target);
        if (!src || !tgt) continue;
        ctx!.beginPath();
        ctx!.moveTo(src.x, src.y);
        ctx!.lineTo(tgt.x, tgt.y);
        ctx!.strokeStyle = '#e2e8f0';
        ctx!.lineWidth = 1.5;
        ctx!.stroke();
      }

      for (const node of nodes) {
        const color = CATEGORY_COLORS[node.category];
        const isHovered = hoveredRef.current?.id === node.id;
        const r = isHovered ? 22 : 16;

        ctx!.beginPath();
        ctx!.arc(node.x, node.y, r, 0, Math.PI * 2);
        ctx!.fillStyle = color;
        ctx!.fill();

        if (isHovered) {
          ctx!.strokeStyle = color;
          ctx!.lineWidth = 3;
          ctx!.stroke();
        }

        ctx!.fillStyle = '#1e293b';
        ctx!.font = '11px -apple-system, sans-serif';
        ctx!.textAlign = 'center';
        ctx!.fillText(node.label.slice(0, 12), node.x, node.y + r + 14);
      }

      animRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    function getNodeAt(x: number, y: number): SimNode | null {
      for (const node of nodesRef.current) {
        const dx = x - node.x;
        const dy = y - node.y;
        if (dx * dx + dy * dy < 20 * 20) return node;
      }
      return null;
    }

    function getPos(e: MouseEvent | Touch) {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function onMouseMove(e: MouseEvent) {
      const { x, y } = getPos(e);
      if (dragRef.current.node) {
        dragRef.current.node.x = x;
        dragRef.current.node.y = y;
        return;
      }
      const node = getNodeAt(x, y);
      hoveredRef.current = node;
      setHoveredNode(node);
      canvas!.style.cursor = node ? 'grab' : 'default';
    }

    function onMouseDown(e: MouseEvent) {
      const { x, y } = getPos(e);
      const node = getNodeAt(x, y);
      if (node) {
        dragRef.current = { node };
        canvas!.style.cursor = 'grabbing';
      }
    }

    function onMouseUp() {
      dragRef.current = { node: null };
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      const { x, y } = getPos(e.touches[0]);
      const node = getNodeAt(x, y);
      if (node) {
        e.preventDefault();
        dragRef.current = { node };
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragRef.current.node || e.touches.length !== 1) return;
      e.preventDefault();
      const { x, y } = getPos(e.touches[0]);
      dragRef.current.node.x = x;
      dragRef.current.node.y = y;
    }

    function onTouchEnd() {
      dragRef.current = { node: null };
    }

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mouseleave', onMouseUp);
    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mouseleave', onMouseUp);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, [notes]);

  return (
    <div>
      <div className="flex gap-3 mb-3 flex-wrap">
        {Object.entries(CATEGORY_COLORS).map(([key, color]) => (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            {CATEGORY_LABEL[key as NoteCategory]}
          </div>
        ))}
        <div className="text-xs text-[var(--muted)] ml-auto">
          노트 {notes.length}개 · 연결 {linksRef.current.length}개
        </div>
      </div>

      <div
        ref={containerRef}
        className="bg-white rounded-xl border border-[var(--border)] overflow-hidden"
        style={{ height: 420 }}
      >
        {notes.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--muted)] text-sm">
            노트를 추가하면 그래프가 나타납니다
          </div>
        ) : (
          <canvas ref={canvasRef} className="w-full h-full" />
        )}
      </div>

      {hoveredNode && (
        <div className="bg-white rounded-xl border border-[var(--border)] p-3 mt-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS[hoveredNode.category] }} />
            <span className="font-semibold text-sm">{hoveredNode.label}</span>
            <span className={`badge badge-${hoveredNode.category}`}>
              {CATEGORY_LABEL[hoveredNode.category]}
            </span>
          </div>
          {hoveredNode.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {hoveredNode.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 bg-gray-100 rounded">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
