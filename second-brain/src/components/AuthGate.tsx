'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Lock, Brain } from 'lucide-react';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  const isViewer = pathname.startsWith('/viewer');

  useEffect(() => {
    if (isViewer) {
      setChecking(false);
      setAuthed(true);
      return;
    }
    try {
      const saved = sessionStorage.getItem('admin_authed');
      if (saved === 'true') setAuthed(true);
    } catch {}
    setChecking(false);
  }, [isViewer]);

  async function handleLogin() {
    if (!code.trim()) return;
    setError('');
    try {
      const res = await fetch('/api/admin-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        try { sessionStorage.setItem('admin_authed', 'true'); } catch {}
        setAuthed(true);
      } else {
        setError(data.error || '접근 코드가 올바르지 않습니다.');
      }
    } catch {
      setError('인증에 실패했습니다.');
    }
  }

  if (checking) return null;
  if (isViewer || authed) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[90] bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
          <Brain size={28} className="text-white" />
        </div>
        <h1 className="text-xl font-bold mb-1">Second Brain</h1>
        <p className="text-sm text-[var(--muted)] mb-6">관리자 접근</p>

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
  );
}
