'use client';

import { useEffect, useState } from 'react';
import {
  Lock, FileText, CalendarCheck, Rss, Eye, LogOut,
  ChevronRight, Clock, CalendarDays, Check, Plus, X, Loader2,
} from 'lucide-react';
import { fetchNotes, fetchTodos, createNote } from '@/lib/db';
import type { Note, Todo, NoteCategory, TodoStatus } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

type Tab = 'notes' | 'todos' | 'research';

const CATEGORY_LABEL: Record<NoteCategory, string> = {
  idea: '아이디어', work: '업무', research: '리서치', personal: '개인',
};

const STATUS_LABEL: Record<TodoStatus, string> = {
  todo: '할 일', in_progress: '진행중', done: '완료',
};

export default function ViewerPage() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<Tab>('notes');

  const [notes, setNotes] = useState<Note[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [todoFilter, setTodoFilter] = useState<'all' | TodoStatus>('all');

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState<NoteCategory>('idea');
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
        /* Login Gate */
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
        /* Viewer Dashboard */
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
            ]).map(t => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSelectedNote(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition ${
                  tab === t.key
                    ? 'bg-[var(--accent)] text-white'
                    : 'text-[var(--muted)] hover:bg-gray-50'
                }`}
              >
                <t.icon size={16} /> {t.label}
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
                    {selectedNote.content}
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
                        <button
                          onClick={async () => {
                            if (!noteTitle.trim()) return;
                            setNoteSaving(true);
                            await createNote({
                              title: noteTitle,
                              content: noteContent,
                              category: noteCategory,
                              tags: noteCategory === 'idea' ? ['아이디어'] : [],
                              linkedNoteIds: [],
                            });
                            setNoteTitle('');
                            setNoteContent('');
                            setNoteCategory('idea');
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
                  <div
                    key={todo.id}
                    className={`bg-white rounded-xl border border-[var(--border)] p-4 ${todo.status === 'done' ? 'opacity-50' : ''}`}
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
                          <p className="text-xs text-[var(--muted)] mb-1">{todo.description}</p>
                        )}
                        {todo.dueDate && (
                          <div className="text-xs flex items-center gap-1 text-[var(--muted)]">
                            <CalendarDays size={12} /> {todo.dueDate}
                          </div>
                        )}
                        {todo.linkedNoteIds && todo.linkedNoteIds.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {todo.linkedNoteIds.map(nid => {
                              const note = notes.find(n => n.id === nid);
                              return note ? (
                                <button
                                  key={nid}
                                  onClick={() => { setTab('notes'); setSelectedNote(note); }}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] hover:bg-blue-100 transition"
                                >
                                  <FileText size={10} /> {note.title.slice(0, 15)}{note.title.length > 15 ? '...' : ''}
                                </button>
                              ) : null;
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
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
        </div>
      )}
    </div>
  );
}

function ResearchTab() {
  const [articles, setArticles] = useState<{title: string; url: string; date: string; summary: string; source: string; relevance: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

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
      setArticles(data.articles || []);
      setFetched(true);
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
      )}
    </div>
  );
}
