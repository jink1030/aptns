import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { webhookUrl, text } = await req.json();

    if (!webhookUrl || !text) {
      return NextResponse.json({ error: 'webhookUrl과 text가 필요합니다.' }, { status: 400 });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (res.ok) {
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: '전송 실패' }, { status: res.status });
  } catch {
    return NextResponse.json({ error: '전송 실패' }, { status: 500 });
  }
}
