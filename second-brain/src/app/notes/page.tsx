'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Search, Trash2, Save, X, Tag, Link2,
} from 'lucide-react';
import {
  fetchNotes, createNote, editNote, removeNote,
} from '@/lib/db';
import type { Note, NoteCategory } from '@/types';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const CATEGORIES: { value: NoteCategory; label: string }[] = [
  { value: 'idea', label: '아이디어' },
  { value: 'work', label: '업무' },
  { value: 'research', label: '리서치' },
  { value: 'personal', label: '개인' },
];

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-[var(--muted)]">로딩 중...</div>}>
      <NotesContent />
    </Suspense>
  );
}

function NotesContent() {
  const searchParams = useSearchParams();
  const [notes, setNotes] = useState<Note[]>([]);
  const [selected, setSelected] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('idea');
  const [tags, setTags] = useState('');
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [showLinkPicker, setShowLinkPicker] = useState(false);

  const reload = useCallback(async () => {
    const all = await fetchNotes();
    setNotes(all);
    return all;
  }, []);

  useEffect(() => {
    reload().then((all) => {
      const idParam = searchParams.get('id');
      const newParam = searchParams.get('new');
      if (idParam) {
        const found = all.find((n) => n.id === idParam);
        if (found) openNote(found);
      } else if (newParam) {
        startNew();
      }
    });
  }, [searchParams, reload]);

  function openNote(note: Note) {
    setSelected(note);
    setIsNew(false);
    setTitle(note.title);
    setContent(note.content);
    setCategory(note.category);
    setTags(note.tags.join(', '));
    setLinkedIds(note.linkedNoteIds);
  }

  function startNew() {
    setSelected(null);
    setIsNew(true);
    setTitle('');
    setContent('');
    setCategory('idea');
    setTags('');
    setLinkedIds([]);
  }

  async function handleSave() {
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isNew) {
      const created = await createNote({
        title: title || '제목 없음',
        content,
        category,
        tags: tagList,
        linkedNoteIds: linkedIds,
      });
      setIsNew(false);
      setSelected(created);
      await reload();
    } else if (selected) {
      const updated = await editNote(selected.id, {
        title: title || '제목 없음',
        content,
        category,
        tags: tagList,
        linkedNoteIds: linkedIds,
      });
      if (updated) setSelected(updated);
      await reload();
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('이 노트를 삭제하시겠습니까?')) return;
    await removeNote(selected.id);
    setSelected(null);
    setIsNew(false);
    await reload();
  }

  function toggleLink(noteId: string) {
    setLinkedIds((prev) =>
      prev.includes(noteId) ? prev.filter((id) => id !== noteId) : [...prev, noteId]
    );
  }

  const filtered = notes.filter((n) => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const editing = isNew || selected;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">노트</h1>
        <button
          onClick={startNew}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={16} /> 새 노트
        </button>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-6">
        {/* Note List */}
        <div>
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="노트 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>

          <div className="flex gap-1 mb-3 flex-wrap">
            <button
              onClick={() => setFilterCategory('all')}
              className={`px-3 py-1 rounded-full text-xs ${
                filterCategory === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-[var(--muted)]'
              }`}
            >
              전체
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setFilterCategory(c.value)}
                className={`px-3 py-1 rounded-full text-xs ${
                  filterCategory === c.value
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-gray-100 text-[var(--muted)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[calc(100vh-240px)] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--muted)] p-4 text-center">노트가 없습니다</p>
            ) : (
              filtered
                .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                .map((note) => (
                  <button
                    key={note.id}
                    onClick={() => openNote(note)}
                    className={`w-full text-left p-3 rounded-lg border transition ${
                      selected?.id === note.id
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                        : 'border-[var(--border)] bg-white hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge badge-${note.category}`}>
                        {CATEGORIES.find((c) => c.value === note.category)?.label}
                      </span>
                      <span className="text-xs text-[var(--muted)]">
                        {format(new Date(note.updatedAt), 'M/d HH:mm', { locale: ko })}
                      </span>
                    </div>
                    <div className="font-medium text-sm truncate">{note.title}</div>
                    <p className="text-xs text-[var(--muted)] line-clamp-2 mt-1">
                      {note.content.slice(0, 120)}
                    </p>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-[var(--muted)]">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))
            )}
          </div>
        </div>

        {/* Note Editor */}
        <div className="card">
          {editing ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as NoteCategory)}
                    className="text-sm border border-[var(--border)] rounded-lg px-2 py-1.5 outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  {selected && (
                    <button onClick={handleDelete} className="p-2 text-[var(--danger)] hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => { setSelected(null); setIsNew(false); }}
                    className="p-2 text-[var(--muted)] hover:bg-gray-100 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
                  >
                    <Save size={14} /> 저장
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="제목을 입력하세요"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full text-xl font-bold border-none outline-none mb-4 placeholder:text-gray-300"
              />

              <textarea
                placeholder="내용을 입력하세요..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={16}
                className="w-full border border-[var(--border)] rounded-lg p-3 text-sm outline-none focus:border-[var(--accent)] resize-none"
              />

              <div className="mt-4 flex items-center gap-2">
                <Tag size={14} className="text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="태그 (쉼표로 구분: CRM, 아이디어, 리서치)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="flex-1 text-sm border border-[var(--border)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div className="mt-3">
                <button
                  onClick={() => setShowLinkPicker(!showLinkPicker)}
                  className="flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
                >
                  <Link2 size={14} />
                  연결된 노트 ({linkedIds.length})
                </button>
                {showLinkPicker && (
                  <div className="mt-2 border border-[var(--border)] rounded-lg p-3 max-h-40 overflow-y-auto">
                    {notes
                      .filter((n) => n.id !== selected?.id)
                      .map((n) => (
                        <label key={n.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={linkedIds.includes(n.id)}
                            onChange={() => toggleLink(n.id)}
                          />
                          <span className={`badge badge-${n.category}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                            {CATEGORIES.find((c) => c.value === n.category)?.label}
                          </span>
                          {n.title}
                        </label>
                      ))}
                  </div>
                )}
              </div>

              {selected && (
                <div className="mt-4 text-xs text-[var(--muted)]">
                  생성: {format(new Date(selected.createdAt), 'yyyy-MM-dd HH:mm', { locale: ko })} &middot;
                  수정: {format(new Date(selected.updatedAt), 'yyyy-MM-dd HH:mm', { locale: ko })}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-[var(--muted)] text-sm">
              왼쪽에서 노트를 선택하거나 새 노트를 만들어보세요
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
