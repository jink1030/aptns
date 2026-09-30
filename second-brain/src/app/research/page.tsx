'use client';

import { useState } from 'react';
import {
  Rss, RefreshCw, Loader2, ExternalLink, BookmarkPlus, Check,
  AlertCircle, Filter, Newspaper,
} from 'lucide-react';
import { createNote } from '@/lib/db';

interface Article {
  title: string;
  url: string;
  date: string;
  summary: string;
  source: string;
  relevance: string;
}

interface SourceStatus {
  name: string;
  count: number;
  error?: string;
}

export default function ResearchPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fetchedAt, setFetchedAt] = useState('');
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [filterSource, setFilterSource] = useState<string>('all');

  async function handleFetch() {
    setLoading(true);
    setError('');

    let apiKey = '';
    try { apiKey = localStorage.getItem('secondbrain_claude_key') || ''; } catch {}

    try {
      const res = await fetch('/api/news-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '뉴스 수집 실패');
        return;
      }

      setArticles(data.articles || []);
      setSources(data.sources || []);
      setFetchedAt(data.fetchedAt || '');
      setSavedIds(new Set());

      if (data.articles?.length === 0 && data.totalFetched === 0) {
        setError('뉴스 사이트에서 기사를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } catch {
      setError('네트워크 오류. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveAsNote(article: Article, index: number) {
    setSavingId(index);
    try {
      await createNote({
        title: article.title,
        content: `${article.summary || article.title}\n\n출처: ${article.source}\n날짜: ${article.date || '미상'}\n링크: ${article.url}\n관련: ${article.relevance || '-'}`,
        category: 'research',
        tags: ['뉴스', article.source, ...(article.relevance ? [article.relevance] : [])],
        linkedNoteIds: [],
      });
      setSavedIds((prev) => new Set(prev).add(index));
    } catch { /* ignore */ }
    setSavingId(null);
  }

  const sourceNames = Array.from(new Set(articles.map((a) => a.source)));
  const displayed = filterSource === 'all'
    ? articles
    : articles.filter((a) => a.source === filterSource);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rss size={24} className="text-orange-500" /> 리서치 피드
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            아파트 관리 뉴스를 수집하고 AI가 관련 기사를 필터링합니다
          </p>
        </div>
        <button
          onClick={handleFetch}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> 수집 중...</>
          ) : (
            <><RefreshCw size={16} /> 뉴스 수집</>
          )}
        </button>
      </div>

      {/* Source Status */}
      {sources.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {sources.map((s) => (
            <div
              key={s.name}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${
                s.error
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : s.count > 0
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-gray-50 text-[var(--muted)] border border-[var(--border)]'
              }`}
            >
              <Newspaper size={12} />
              {s.name}: {s.error || `${s.count}건`}
            </div>
          ))}
          {fetchedAt && (
            <div className="px-3 py-1.5 text-xs text-[var(--muted)]">
              {new Date(fetchedAt).toLocaleString('ko-KR')}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 mb-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Source Filter */}
      {articles.length > 0 && sourceNames.length > 1 && (
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-[var(--muted)]" />
          <button
            onClick={() => setFilterSource('all')}
            className={`px-3 py-1 rounded-full text-xs ${
              filterSource === 'all' ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-[var(--muted)]'
            }`}
          >
            전체 ({articles.length})
          </button>
          {sourceNames.map((name) => {
            const count = articles.filter((a) => a.source === name).length;
            return (
              <button
                key={name}
                onClick={() => setFilterSource(name)}
                className={`px-3 py-1 rounded-full text-xs ${
                  filterSource === name ? 'bg-[var(--accent)] text-white' : 'bg-gray-100 text-[var(--muted)]'
                }`}
              >
                {name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Articles */}
      {articles.length === 0 && !loading && !error && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Rss size={48} className="text-gray-200 mb-4" />
          <p className="text-[var(--muted)] text-sm mb-1">
            아직 수집된 기사가 없습니다
          </p>
          <p className="text-xs text-[var(--muted)]">
            &quot;뉴스 수집&quot; 버튼을 눌러 아파트 관리 관련 최신 뉴스를 가져오세요
          </p>
          <p className="text-xs text-[var(--muted)] mt-3">
            설정에서 Claude API 키를 등록하면 AI가 관련 기사만 자동 필터링합니다
          </p>
        </div>
      )}

      {loading && (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <Loader2 size={32} className="animate-spin text-[var(--accent)] mb-4" />
          <p className="text-sm text-[var(--muted)]">뉴스 사이트에서 기사를 수집하고 있습니다...</p>
          <p className="text-xs text-[var(--muted)] mt-1">AI 필터링 포함 약 10~20초 소요</p>
        </div>
      )}

      <div className="space-y-3">
        {displayed.map((article, i) => {
          const globalIndex = articles.indexOf(article);
          const saved = savedIds.has(globalIndex);
          const saving = savingId === globalIndex;

          return (
            <div key={`${article.source}-${i}`} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] px-2 py-0.5 bg-orange-50 text-orange-600 rounded-full font-medium">
                      {article.source}
                    </span>
                    {article.relevance && (
                      <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
                        {article.relevance}
                      </span>
                    )}
                    {article.date && (
                      <span className="text-[10px] text-[var(--muted)]">{article.date}</span>
                    )}
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm hover:text-[var(--accent)] transition-colors flex items-center gap-1"
                  >
                    {article.title}
                    <ExternalLink size={12} className="flex-shrink-0 opacity-40" />
                  </a>

                  {article.summary && (
                    <p className="text-xs text-[var(--muted)] mt-1 line-clamp-2">{article.summary}</p>
                  )}
                </div>

                <button
                  onClick={() => handleSaveAsNote(article, globalIndex)}
                  disabled={saved || saving}
                  className={`flex-shrink-0 p-2 rounded-lg transition ${
                    saved
                      ? 'bg-green-50 text-green-600'
                      : 'text-[var(--muted)] hover:bg-blue-50 hover:text-[var(--accent)]'
                  }`}
                  title={saved ? '저장됨' : '리서치 노트로 저장'}
                >
                  {saving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : saved ? (
                    <Check size={16} />
                  ) : (
                    <BookmarkPlus size={16} />
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
