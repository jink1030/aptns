'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Download, Upload, Trash2, Key, Bell, AlertTriangle, Database, CheckCircle, XCircle,
} from 'lucide-react';
import { exportData, importData } from '@/lib/storage';
import { fetchNotes, fetchTodos, checkSupabaseConnected, migrateLocalToSupabase } from '@/lib/db';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [slackWebhook, setSlackWebhook] = useState('');
  const [saved, setSaved] = useState(false);
  const [importStatus, setImportStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [todoCount, setTodoCount] = useState(0);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [migrateResult, setMigrateResult] = useState('');

  useEffect(() => {
    try {
      const key = localStorage.getItem('secondbrain_claude_key');
      const webhook = localStorage.getItem('secondbrain_slack_webhook');
      if (key) setApiKey(key);
      if (webhook) setSlackWebhook(webhook);
    } catch {}
    setSupabaseConnected(checkSupabaseConnected());
    fetchNotes().then((n) => setNoteCount(n.length));
    fetchTodos().then((t) => setTodoCount(t.length));
  }, []);

  function handleSaveSettings() {
    try {
      localStorage.setItem('secondbrain_claude_key', apiKey);
      localStorage.setItem('secondbrain_slack_webhook', slackWebhook);
    } catch {}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleExport() {
    const json = exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `second-brain-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport() {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(reader.result as string);
      setImportStatus(ok ? '데이터를 성공적으로 불러왔습니다!' : '파일 형식이 올바르지 않습니다.');
      if (ok) {
        fetchNotes().then((n) => setNoteCount(n.length));
        fetchTodos().then((t) => setTodoCount(t.length));
      }
      setTimeout(() => setImportStatus(''), 3000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleClearAll() {
    if (!confirm('모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.\n\n삭제 전 백업을 권장합니다.')) return;
    try {
      localStorage.removeItem('secondbrain_notes');
      localStorage.removeItem('secondbrain_todos');
    } catch {}
    setNoteCount(0);
    setTodoCount(0);
  }

  async function testSlackWebhook() {
    if (!slackWebhook) return alert('Slack Webhook URL을 입력해주세요.');
    try {
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: slackWebhook,
          text: '🧠 Second Brain 연결 테스트 - 알림이 정상적으로 작동합니다!',
        }),
      });
      if (res.ok) {
        alert('슬랙에 테스트 메시지를 보냈습니다! 확인해보세요.');
      } else {
        alert('전송 실패. Webhook URL을 확인해주세요.');
      }
    } catch {
      alert('전송 실패. Webhook URL을 확인해주세요.');
    }
  }

  async function handleMigrate() {
    if (!supabaseConnected) return;
    if (!confirm('브라우저에 저장된 데이터를 Supabase로 복사합니다. 진행하시겠습니까?')) return;
    setMigrating(true);
    try {
      const result = await migrateLocalToSupabase();
      setMigrateResult(`완료! 노트 ${result.notes}개, 할일 ${result.todos}개를 Supabase로 이전했습니다.`);
      fetchNotes().then((n) => setNoteCount(n.length));
      fetchTodos().then((t) => setTodoCount(t.length));
    } catch {
      setMigrateResult('마이그레이션 실패. 콘솔을 확인해주세요.');
    }
    setMigrating(false);
    setTimeout(() => setMigrateResult(''), 5000);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">설정</h1>

      {/* Supabase Status */}
      <div className="card mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Database size={16} /> 데이터베이스 연결
        </h2>
        <div className="flex items-center gap-2 mb-3">
          {supabaseConnected ? (
            <>
              <CheckCircle size={16} className="text-[var(--success)]" />
              <span className="text-sm text-[var(--success)] font-medium">Supabase 연결됨</span>
              <span className="text-xs text-[var(--muted)]">- 어디서든 같은 데이터에 접근 가능</span>
            </>
          ) : (
            <>
              <XCircle size={16} className="text-[var(--warning)]" />
              <span className="text-sm text-[var(--warning)] font-medium">로컬 저장소 사용 중</span>
              <span className="text-xs text-[var(--muted)]">- 이 브라우저에서만 접근 가능</span>
            </>
          )}
        </div>
        {!supabaseConnected && (
          <div className="text-xs text-[var(--muted)] p-3 bg-gray-50 rounded-lg">
            <p className="font-medium mb-1">Supabase 연결 방법:</p>
            <ol className="space-y-1 ml-3">
              <li>1. supabase.com 가입 후 프로젝트 생성</li>
              <li>2. SQL Editor에서 제공된 스키마 실행</li>
              <li>3. .env.local 파일에 키 설정:</li>
            </ol>
            <code className="block mt-2 p-2 bg-gray-100 rounded text-[10px]">
              NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co<br />
              NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
            </code>
          </div>
        )}
        {supabaseConnected && (
          <div>
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {migrating ? '이전 중...' : '브라우저 데이터 → Supabase 이전'}
            </button>
            {migrateResult && (
              <p className="text-sm mt-2 text-[var(--success)]">{migrateResult}</p>
            )}
          </div>
        )}
      </div>

      {/* Data Stats */}
      <div className="card mb-6">
        <h2 className="font-semibold text-sm mb-3">데이터 현황</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[var(--muted)]">저장된 노트</div>
            <div className="text-xl font-bold">{noteCount}개</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-[var(--muted)]">저장된 할일</div>
            <div className="text-xl font-bold">{todoCount}개</div>
          </div>
        </div>
      </div>

      {/* API Settings */}
      <div className="card mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Key size={16} /> API 설정
        </h2>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-[var(--muted)] block mb-1">Claude API 키</label>
            <input
              type="password"
              placeholder="sk-ant-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <p className="text-xs text-[var(--muted)] mt-1">
              AI 검색 기능에 사용됩니다. console.anthropic.com에서 발급받으세요.
            </p>
          </div>

          <div>
            <label className="text-sm text-[var(--muted)] block mb-1">Slack Webhook URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={slackWebhook}
                onChange={(e) => setSlackWebhook(e.target.value)}
                className="flex-1 border border-[var(--border)] rounded-lg px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
              <button
                onClick={testSlackWebhook}
                className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-gray-50"
              >
                테스트
              </button>
            </div>
            <p className="text-xs text-[var(--muted)] mt-1">
              듀데이트 알림에 사용됩니다. Slack App에서 Incoming Webhook을 생성하세요.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveSettings}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90"
            >
              설정 저장
            </button>
            {saved && <span className="text-sm text-[var(--success)]">저장됨!</span>}
          </div>
        </div>
      </div>

      {/* Slack Setup Guide */}
      <div className="card mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Bell size={16} /> 슬랙 알림 설정 가이드
        </h2>
        <ol className="text-sm space-y-2 text-[var(--muted)]">
          <li>1. Slack 워크스페이스에서 앱 관리 페이지로 이동</li>
          <li>2. &quot;Incoming Webhooks&quot; 앱 추가</li>
          <li>3. 알림을 받을 채널 선택</li>
          <li>4. 생성된 Webhook URL을 위 필드에 붙여넣기</li>
          <li>5. &quot;테스트&quot; 버튼으로 작동 확인</li>
        </ol>
      </div>

      {/* Backup/Restore */}
      <div className="card mb-6">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <Download size={16} /> 백업 / 복원
        </h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          데이터를 JSON 파일로 내보내거나 불러올 수 있습니다.
          다른 기기에서 사용하려면 백업 후 복원하세요.
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-gray-50"
          >
            <Download size={14} /> 백업 내보내기
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2 border border-[var(--border)] rounded-lg text-sm hover:bg-gray-50"
          >
            <Upload size={14} /> 백업 불러오기
          </button>
          <input ref={fileRef} type="file" accept=".json" onChange={onFileChange} className="hidden" />
        </div>
        {importStatus && (
          <p className="text-sm mt-2 text-[var(--success)]">{importStatus}</p>
        )}
      </div>

      {/* Danger Zone */}
      <div className="card border-[var(--danger)]">
        <h2 className="font-semibold text-sm mb-3 flex items-center gap-2 text-[var(--danger)]">
          <AlertTriangle size={16} /> 위험 영역
        </h2>
        <p className="text-xs text-[var(--muted)] mb-3">
          모든 노트와 할일 데이터가 영구적으로 삭제됩니다. 삭제 전 백업을 권장합니다.
        </p>
        <button
          onClick={handleClearAll}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-[var(--danger)] border border-red-200 rounded-lg text-sm hover:bg-red-100"
        >
          <Trash2 size={14} /> 모든 데이터 삭제
        </button>
      </div>
    </div>
  );
}
