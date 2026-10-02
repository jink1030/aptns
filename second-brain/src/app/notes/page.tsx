'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Search, Trash2, Save, X, Tag, Link2, Paperclip, FileText, ExternalLink,
  Upload, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  fetchNotes, createNote, editNote, removeNote,
} from '@/lib/db';
import {
  uploadFile, deleteFile, validateFile, getFileIcon, formatFileSize, extractDriveLinks,
} from '@/lib/file-upload';
import type { Note, NoteCategory, Attachment } from '@/types';
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
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState<NoteCategory>('work');
  const [bulkTags, setBulkTags] = useState('Confluence, 아파트케어');
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ success: number; total: number } | null>(null);

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
    setAttachments(note.attachments || []);
    setUploadError('');
  }

  function startNew() {
    setSelected(null);
    setIsNew(true);
    setTitle('');
    setContent('');
    setCategory('idea');
    setTags('');
    setLinkedIds([]);
    setAttachments([]);
    setUploadError('');
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setUploadError('');

    for (const file of Array.from(files)) {
      const error = validateFile(file);
      if (error) {
        setUploadError(error);
        continue;
      }

      const noteId = selected?.id || 'temp';
      const attachment = await uploadFile(file, noteId);
      if (attachment) {
        setAttachments((prev) => [...prev, attachment]);
      } else {
        setUploadError('파일 업로드에 실패했습니다.');
      }
    }

    setUploading(false);
    e.target.value = '';
  }

  async function handleRemoveAttachment(att: Attachment) {
    if (!confirm(`"${att.name}" 파일을 삭제하시겠습니까?`)) return;
    const noteId = selected?.id || 'temp';
    await deleteFile(att, noteId);
    setAttachments((prev) => prev.filter((a) => a.id !== att.id));
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
        attachments,
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
        attachments,
      });
      if (updated) setSelected(updated);
      await reload();
    }
  }

  async function handleDelete() {
    if (!selected) return;
    if (!confirm('이 노트를 삭제하시겠습니까?')) return;
    for (const att of attachments) {
      await deleteFile(att, selected.id);
    }
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

  interface ParsedNote {
    title: string;
    content: string;
    category?: NoteCategory;
    tags?: string[];
  }

  function parseBulkNotes(text: string): ParsedNote[] {
    const trimmed = text.trim();
    if (!trimmed) return [];

    // Format 1: --- separator blocks with 카테고리/제목/태그/내용
    if (trimmed.includes('\n---\n') && /제목\s*:/.test(trimmed)) {
      return parseSeparatorFormat(trimmed);
    }
    // Format 2: ## header-based markdown sections
    if (/^#{1,2}\s+\d*\.?\s*/m.test(trimmed)) {
      return parseMarkdownFormat(trimmed);
    }
    // Format 3: simple 제목:/내용: pairs
    if (/^제목\s*:/m.test(trimmed)) {
      return parseTitleContentFormat(trimmed);
    }
    // Fallback: treat ## headers without numbers
    if (/^#{1,2}\s+/m.test(trimmed)) {
      return parseMarkdownFormat(trimmed);
    }
    return [];
  }

  function parseSeparatorFormat(text: string): ParsedNote[] {
    const categoryMap: Record<string, NoteCategory> = {
      '아이디어': 'idea', '업무': 'work', '리서치': 'research', '개인': 'personal',
    };
    const blocks = text.split(/\n---\n/).filter((b) => b.trim());
    return blocks.map((block) => {
      const lines = block.trim().split('\n');
      let title = '', content = '', category: NoteCategory | undefined, tags: string[] | undefined;
      let contentStart = false;

      for (const line of lines) {
        const catMatch = line.match(/^\[카테고리\s*:\s*(.+?)\]/);
        if (catMatch) { category = categoryMap[catMatch[1].trim()] || undefined; continue; }
        if (/^제목\s*:\s*/.test(line)) { title = line.replace(/^제목\s*:\s*/, '').trim(); continue; }
        if (/^태그\s*:\s*/.test(line)) { tags = line.replace(/^태그\s*:\s*/, '').split(',').map((t) => t.trim()).filter(Boolean); continue; }
        if (/^내용\s*:\s*/.test(line)) { content = line.replace(/^내용\s*:\s*/, ''); contentStart = true; continue; }
        if (contentStart || title) content += (content ? '\n' : '') + line;
      }
      return { title: title || '제목 없음', content: content.trim(), category, tags };
    }).filter((n) => n.title !== '제목 없음' || n.content);
  }

  function parseMarkdownFormat(text: string): ParsedNote[] {
    const sections: ParsedNote[] = [];
    const lines = text.split('\n');
    let currentTitle = '';
    let currentContent = '';
    let currentTags: string[] | undefined;
    let mainTitle = '';

    for (const line of lines) {
      const h1Match = line.match(/^#\s+(.+)/);
      const h2Match = line.match(/^##\s+(.+)/);

      if (h1Match && !mainTitle) {
        mainTitle = h1Match[1].trim();
        continue;
      }

      if (h2Match) {
        if (currentTitle) {
          sections.push({ title: currentTitle, content: currentContent.trim(), tags: currentTags });
        }
        currentTitle = h2Match[1].replace(/^\d+\.\s*/, '').trim();
        currentContent = '';
        currentTags = undefined;
        continue;
      }

      const tagLine = line.match(/^태그\s*:\s*(.+)/);
      if (tagLine) {
        currentTags = tagLine[1].split(',').map((t) => t.replace(/#/g, '').trim()).filter(Boolean);
        continue;
      }

      if (currentTitle) {
        currentContent += (currentContent ? '\n' : '') + line;
      }
    }
    if (currentTitle) {
      sections.push({ title: currentTitle, content: currentContent.trim(), tags: currentTags });
    }

    if (sections.length === 0 && mainTitle) {
      sections.push({ title: mainTitle, content: text.replace(/^#\s+.+\n/, '').trim() });
    }

    return sections.filter((s) => s.content.length > 0);
  }

  function parseTitleContentFormat(text: string): ParsedNote[] {
    const entries: ParsedNote[] = [];
    const lines = text.split('\n');
    let currentTitle = '';
    let currentContent = '';

    for (const line of lines) {
      if (/^제목\s*:\s*/.test(line)) {
        if (currentTitle) entries.push({ title: currentTitle.trim(), content: currentContent.trim() });
        currentTitle = line.replace(/^제목\s*:\s*/, '');
        currentContent = '';
      } else if (/^내용\s*:\s*/.test(line)) {
        currentContent = line.replace(/^내용\s*:\s*/, '');
      } else if (currentTitle && line.trim()) {
        currentContent += '\n' + line;
      }
    }
    if (currentTitle) entries.push({ title: currentTitle.trim(), content: currentContent.trim() });
    return entries;
  }

  const parsedBulkNotes = parseBulkNotes(bulkText);

  async function handleBulkImport() {
    if (parsedBulkNotes.length === 0) return;
    setBulkImporting(true);
    setBulkResult(null);
    const defaultTags = bulkTags.split(',').map((t) => t.trim()).filter(Boolean);
    let success = 0;
    for (const entry of parsedBulkNotes) {
      try {
        await createNote({
          title: entry.title,
          content: entry.content,
          category: entry.category || bulkCategory,
          tags: entry.tags || defaultTags,
          linkedNoteIds: [],
        });
        success++;
      } catch { /* skip failed */ }
    }
    setBulkImporting(false);
    setBulkResult({ success, total: parsedBulkNotes.length });
    await reload();
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

  const driveLinks = extractDriveLinks(content);
  const editing = isNew || selected;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">노트</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowBulkImport(true); setBulkResult(null); }}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-sm font-medium hover:bg-gray-50 text-[var(--muted)]"
          >
            <Upload size={16} /> 일괄 등록
          </button>
          <button
            onClick={startNew}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> 새 노트
          </button>
        </div>
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
                      {note.attachments && note.attachments.length > 0 && (
                        <Paperclip size={12} className="text-[var(--muted)]" />
                      )}
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
                placeholder="내용을 입력하세요...&#10;&#10;Google Drive 링크를 붙여넣으면 자동으로 인식됩니다."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={14}
                className="w-full border border-[var(--border)] rounded-lg p-3 text-sm outline-none focus:border-[var(--accent)] resize-none"
              />

              {/* Google Drive Links */}
              {driveLinks.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-[var(--muted)] mb-2 font-medium">Google Drive 링크 감지됨</div>
                  <div className="space-y-1.5">
                    {driveLinks.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2.5 bg-blue-50 border border-blue-100 rounded-lg text-sm hover:bg-blue-100 transition"
                      >
                        <span className="text-lg">{link.icon}</span>
                        <span className="font-medium text-blue-700 flex-1 truncate">{link.label}</span>
                        <ExternalLink size={14} className="text-blue-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* File Attachments */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Paperclip size={14} className="text-[var(--muted)]" />
                  <span className="text-sm text-[var(--muted)] font-medium">
                    첨부파일 ({attachments.length})
                  </span>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 border border-[var(--border)] rounded-lg text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    <Plus size={12} />
                    {uploading ? '업로드 중...' : '파일 추가'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.gif,.webp"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>

                {uploadError && (
                  <p className="text-xs text-[var(--danger)] mb-2">{uploadError}</p>
                )}

                {attachments.length > 0 && (
                  <div className="space-y-1.5">
                    {attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-2 p-2.5 bg-gray-50 border border-[var(--border)] rounded-lg"
                      >
                        <span className="text-lg">{getFileIcon(att.type)}</span>
                        <div className="flex-1 min-w-0">
                          {att.url.startsWith('data:') || att.type.startsWith('image/') ? (
                            <span className="text-sm font-medium truncate block">{att.name}</span>
                          ) : (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-[var(--accent)] hover:underline truncate block"
                            >
                              {att.name}
                            </a>
                          )}
                          <span className="text-[10px] text-[var(--muted)]">{formatFileSize(att.size)}</span>
                        </div>
                        {att.type.startsWith('image/') && (
                          <img
                            src={att.url}
                            alt={att.name}
                            className="w-10 h-10 object-cover rounded"
                          />
                        )}
                        <button
                          onClick={() => handleRemoveAttachment(att)}
                          className="p-1 text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[10px] text-[var(--muted)] mt-2">
                  PDF, Excel, CSV, 이미지 (최대 10MB)
                </p>
              </div>

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
            <div className="flex flex-col items-center justify-center h-64 text-[var(--muted)] text-sm">
              <FileText size={40} className="mb-3 text-gray-300" />
              왼쪽에서 노트를 선택하거나 새 노트를 만들어보세요
            </div>
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      {showBulkImport && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowBulkImport(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Upload size={18} /> 노트 일괄 등록
              </h3>
              <button onClick={() => setShowBulkImport(false)} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition">
                <X size={20} />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-4">
              <div className="text-xs text-[var(--muted)] bg-gray-50 rounded-lg p-3 leading-relaxed">
                Claude Projects에서 뽑은 텍스트를 그대로 붙여넣으세요.<br />
                지원 형식: <code className="bg-white px-1 py-0.5 rounded text-[11px] border">## 제목</code> (마크다운) · <code className="bg-white px-1 py-0.5 rounded text-[11px] border">제목: / 내용:</code> · <code className="bg-white px-1 py-0.5 rounded text-[11px] border">---</code> 구분
              </div>

              <textarea
                value={bulkText}
                onChange={(e) => { setBulkText(e.target.value); setBulkResult(null); }}
                rows={12}
                placeholder={`## 1. 현재 상태 요약\n- 홈 개인화 대시보드 PRD 초안 v0.3 작성 완료\n- 클릭형 목업 v2 완성\n\n## 2. 논의된 방안\n- 개인화 4축: 지역 · 단지 규모 · 장수계 연동 여부 · 시즌성\n...\n\n또는\n\n제목: 아파트케어 비전\n내용: 법적 근거 기반의 판단·문서·민원·시설관리를 자동화해...`}
                className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)] resize-none font-mono"
              />

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-[var(--muted)] block mb-1">카테고리</label>
                  <select
                    value={bulkCategory}
                    onChange={(e) => setBulkCategory(e.target.value as NoteCategory)}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="text-xs text-[var(--muted)] block mb-1">태그 (쉼표 구분)</label>
                  <input
                    type="text"
                    value={bulkTags}
                    onChange={(e) => setBulkTags(e.target.value)}
                    className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>

              {parsedBulkNotes.length > 0 && (
                <div className="border border-[var(--border)] rounded-lg p-3">
                  <div className="text-xs font-medium text-[var(--muted)] mb-2">
                    미리보기: {parsedBulkNotes.length}개 노트 감지
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {parsedBulkNotes.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs">
                        <span className="text-[var(--accent)] font-mono mt-0.5 flex-shrink-0">{i + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {entry.category && (
                              <span className={`badge badge-${entry.category} text-[10px] px-1 py-0`}>
                                {CATEGORIES.find((c) => c.value === entry.category)?.label}
                              </span>
                            )}
                            <span className="font-medium truncate">{entry.title}</span>
                          </div>
                          <div className="text-[var(--muted)] line-clamp-1">{entry.content.slice(0, 100)}</div>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {entry.tags.slice(0, 5).map((t) => (
                                <span key={t} className="text-[9px] px-1 bg-gray-100 rounded text-[var(--muted)]">#{t}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bulkResult && (
                <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                  bulkResult.success === bulkResult.total ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  <CheckCircle2 size={16} />
                  {bulkResult.total}개 중 {bulkResult.success}개 등록 완료!
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleBulkImport}
                  disabled={bulkImporting || parsedBulkNotes.length === 0}
                  className="flex-1 px-4 py-2.5 bg-[var(--accent)] text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {bulkImporting ? (
                    <><Loader2 size={14} className="animate-spin" /> 등록 중...</>
                  ) : (
                    <>{parsedBulkNotes.length}개 노트 등록</>
                  )}
                </button>
                <button
                  onClick={() => setShowBulkImport(false)}
                  className="px-4 py-2.5 border border-[var(--border)] rounded-xl text-sm text-[var(--muted)] hover:bg-gray-50"
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
