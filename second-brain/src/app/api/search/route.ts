import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { query, context, apiKey: clientKey } = await req.json();
    const apiKey = clientKey || process.env.CLAUDE_API_KEY || '';

    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 필요합니다.' }, { status: 400 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: `아래는 사용자의 세컨드 브레인 노트다.

${context}

---

질문: ${query}

노트 기반으로 답변해. 규칙:
- 반말/간결체 사용 (예: ~이다, ~한다, ~임)
- 서두 인사·안내 문구 없이 바로 본론
- 긴 문장은 압축 (예: "테스트할 때 다음을 확인해야 합니다:" → "테스트 시 확인사항:")
- 불릿/번호로 구조화
- 노트에 없는 내용은 "노트에 없음"으로 표기`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      return NextResponse.json(
        { error: err.error?.message || 'Claude API 호출 실패' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || '응답을 생성할 수 없습니다.';

    return NextResponse.json({ answer });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    );
  }
}
