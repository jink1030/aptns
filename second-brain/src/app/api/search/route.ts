import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { query, context, apiKey } = await req.json();

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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `당신은 사용자의 세컨드 브레인(지식 관리 시스템)에 저장된 노트를 분석하는 AI 비서입니다.

아래는 사용자가 저장한 노트들입니다:

${context}

---

사용자 질문: ${query}

위 노트들을 바탕으로 한국어로 답변해주세요. 관련 노트를 참조하여 구체적으로 답변하고, 노트에 없는 내용은 없다고 말해주세요.`,
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
