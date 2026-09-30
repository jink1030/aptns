'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Search, FileText, Loader2, AlertCircle, Settings } from 'lucide-react';
import { getNotes } from '@/lib/storage';
import type { Note } from '@/types';

const CATEGORY_LABELS: Record<string, string> = {
  idea: '아이디어',
  work: '업무',
  research: '리서치',
  personal: '개인',
};

export default function AISearchPage() {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [results, setResults] = useState<{ note: Note; relevance: string }[]>([]);
  const [aiAnswer, setAiAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  useEffect(() => {
    setNotes(getNotes());
    try {
      const stored = localStorage.getItem('secondbrain_claude_key');
      if (stored) setApiKey(stored);
    } catch {}
  }, []);

  function saveApiKey() {
    try {
      localStorage.setItem('secondbrain_claude_key', apiKey);
    } catch {}
    setShowKeyInput(false);
  }

  async function handleSearch() {
    if (!query.trim()) return;

    // Local search first
    const q = query.toLowerCase();
    const localResults = notes
      .map((note) => {
        let score = 0;
        if (note.title.toLowerCase().includes(q)) score += 3;
        if (note.content.toLowerCase().includes(q)) score += 2;
        if (note.tags.some((t) => t.toLowerCase().includes(q))) score += 1;
        return { note, score };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score);

    setResults(localResults.map((r) => ({
      note: r.note,
      relevance: r.score >= 3 ? '높음' : r.score >= 2 ? '보통' : '낮음',
    })));

    // AI search with Claude
    if (!apiKey) {
      setAiAnswer('Claude API 키를 설정하면 AI가 노트를 분석하여 더 정확한 답변을 제공합니다.');
      return;
    }

    setLoading(true);
    setError('');
    setAiAnswer('');

    try {
      const context = notes
        .map((n) => `[${CATEGORY_LABELS[n.category] || n.category}] ${n.title}\n${n.content}\n태그: ${n.tags.join(', ')}`)
        .join('\n---\n');

      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, context, apiKey }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'AI 검색 실패');
      }

      const data = await res.json();
      setAiAnswer(data.answer);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'AI 검색 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI 검색</h1>
          <p className="text-sm text-[var(--muted)]">
            노트를 자연어로 검색하고 Claude AI가 분석해드립니다
          </p>
        </div>
        <button
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="p-2 text-[var(--muted)] hover:bg-gray-100 rounded-lg"
          title="API 키 설정"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* API Key Input */}
      {showKeyInput && (
        <div className="card mb-4">
          <h3 className="text-sm font-semibold mb-2">Claude API 키 설정</h3>
          <p className="text-xs text-[var(--muted)] mb-3">
            API 키는 브라우저에만 저장되며 서버로 전송 시 Claude API 호출에만 사용됩니다.
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={saveApiKey}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium"
            >
              저장
            </button>
          </div>
        </div>
      )}

      {/* Search Input */}
      <div className="card mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              placeholder="예: CRM 관련 아이디어 중 우선순위 높은 것은? / 이번 주 리서치 내용 요약해줘"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-9 pr-3 py-3 border border-[var(--border)] rounded-lg text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            검색
          </button>
        </div>
      </div>

      {error && (
        <div className="card mb-4 border-l-4 border-l-[var(--danger)] flex items-center gap-2">
          <AlertCircle size={16} className="text-[var(--danger)]" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* AI Answer */}
      {(aiAnswer || loading) && (
        <div className="card mb-6 border-l-4 border-l-purple-400">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={16} className="text-purple-500" />
            <span className="font-semibold text-sm">AI 분석</span>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
              <Loader2 size={14} className="animate-spin" />
              노트를 분석하고 있습니다...
            </div>
          ) : (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">{aiAnswer}</div>
          )}
        </div>
      )}

      {/* Search Results */}
      {results.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <FileText size={16} />
            관련 노트 ({results.length}건)
          </h3>
          <div className="space-y-2">
            {results.map(({ note, relevance }) => (
              <div key={note.id} className="card hover:bg-gray-50">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge badge-${note.category}`}>
                    {CATEGORY_LABELS[note.category]}
                  </span>
                  <span className="font-medium text-sm">{note.title}</span>
                  <span className={`text-xs ml-auto ${relevance === '높음' ? 'text-[var(--success)]' : relevance === '보통' ? 'text-[var(--warning)]' : 'text-[var(--muted)]'}`}>
                    관련도: {relevance}
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] line-clamp-2">{note.content.slice(0, 200)}</p>
                {note.tags.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {note.tags.map((tag) => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-[var(--muted)]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && !aiAnswer && results.length === 0 && (
        <div className="card text-center py-16">
          <Sparkles size={40} className="mx-auto mb-4 text-gray-300" />
          <p className="text-[var(--muted)] text-sm mb-2">
            자연어로 노트를 검색해보세요
          </p>
          <p className="text-xs text-gray-400">
            예: &quot;최근 리서치한 내용 중 CRM 관련된 것은?&quot;
          </p>
        </div>
      )}
    </div>
  );
}
