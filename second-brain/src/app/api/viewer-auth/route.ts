import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const viewerCode = process.env.VIEWER_ACCESS_CODE || '';

    if (!viewerCode) {
      return NextResponse.json(
        { error: '뷰어 모드가 설정되지 않았습니다. 관리자에게 문의하세요.' },
        { status: 403 }
      );
    }

    const { code } = await req.json();

    if (!code || code !== viewerCode) {
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

export async function GET() {
  const viewerCode = process.env.VIEWER_ACCESS_CODE || '';
  return NextResponse.json({ enabled: !!viewerCode });
}
