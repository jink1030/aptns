'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Brain,
  FileText,
  CalendarCheck,
  GitFork,
  Sparkles,
  Rss,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/', label: '대시보드', icon: Brain },
  { href: '/notes', label: '노트', icon: FileText },
  { href: '/schedule', label: '일정 / 할일', icon: CalendarCheck },
  { href: '/research', label: '리서치 피드', icon: Rss },
  { href: '/graph', label: '지식 그래프', icon: GitFork },
  { href: '/search', label: 'AI 검색', icon: Sparkles },
  { href: '/settings', label: '설정', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="fixed top-4 left-4 z-[60] md:hidden bg-slate-800 text-white p-2 rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
            <Brain size={20} className="text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">Second Brain</div>
            <div className="text-xs text-slate-400">나만의 지식 허브</div>
          </div>
        </div>

        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 px-3">
          메뉴
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 px-2">
          <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-4">
            데이터는 브라우저에 저장됩니다.
            <br />
            설정에서 백업/복원 가능합니다.
          </div>
        </div>
      </aside>
    </>
  );
}
