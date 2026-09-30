import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { conversation, apiKey } = await req.json();

    if (!apiKey) {
      return NextResponse.json({ error: 'API 키가 필요합니다. 설정에서 Claude API 키를 입력해주세요.' }, { status: 400 });
    }

    if (!conversation?.trim()) {
      return NextResponse.json({ error: '대화 내용을 입력해주세요.' }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: `당신은 업무 대화에서 액션 아이템과 아젠다를 추출하는 AI 비서입니다.
오늘 날짜: ${today}

아래 대화를 분석하여 액션 아이템(해야 할 일, 검토 사항, 보고 사항, 후속 조치 등)을 추출해주세요.

대화 내용:
${conversation}

---

아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 포함하지 마세요.

[
  {
    "title": "할일 제목 (간결하게)",
    "description": "상세 설명 (대화 맥락 포함, 누가 누구에게 요청했는지, 배경 포함)",
    "dueDate": "YYYY-MM-DD 또는 null",
    "priority": "high | medium | low"
  }
]

규칙:
- 구체적인 액션이 필요한 항목만 추출 (단순 확인/수신 제외)
- 날짜가 "수요일 전까지", "10월말", "금일 중" 등 상대적으로 언급된 경우 오늘(${today}) 기준으로 구체적 날짜(YYYY-MM-DD)로 변환
- "~월 내 런칭" → 해당 월 말일, "~주 내" → 해당 주 금요일
- 날짜 언급이 없으면 dueDate는 null
- priority: 대표/상사 직접 요청 → high, 일반 업무 → medium, 참고/후속 → low
- description에 대화 맥락을 충분히 포함하여 나중에 봐도 이해 가능하게 작성`,
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
    const text = data.content?.[0]?.text || '[]';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: '응답에서 아젠다를 추출하지 못했습니다.' }, { status: 500 });
    }

    const agendas = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ agendas });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '서버 오류' },
      { status: 500 }
    );
  }
}
