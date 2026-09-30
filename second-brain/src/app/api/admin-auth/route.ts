import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const adminCode = process.env.ADMIN_ACCESS_CODE || '';

    if (!adminCode) {
      return NextResponse.json(
        { error: '관리자 접근 코드가 설정되지 않았습니다.' },
        { status: 403 }
      );
    }

    const { code } = await req.json();

    if (!code || code !== adminCode) {
      return NextResponse.json(
        { error: '접근 코드가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: '인증 실패' }, { status: 500 });
  }
}
