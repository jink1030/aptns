import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import AuthGate from '@/components/AuthGate';

export const metadata: Metadata = {
  title: 'Second Brain',
  description: '나만의 지식 허브 - 아이디어, 일정, 학습노트를 한 곳에서',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthGate>
          <div className="layout">
            <Sidebar />
            <main className="main-content">{children}</main>
          </div>
        </AuthGate>
      </body>
    </html>
  );
}
