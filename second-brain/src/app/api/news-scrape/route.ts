import { NextRequest, NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

interface RawArticle {
  title: string;
  url: string;
  date: string;
  summary: string;
  source: string;
}

interface FilteredArticle extends RawArticle {
  relevance: string;
}

const NEWS_SOURCES = [
  {
    name: '한국아파트신문',
    baseUrl: 'https://www.hapt.co.kr',
    listUrl: 'https://www.hapt.co.kr/news/articleList.html?view_type=sm',
    rssUrl: 'https://www.hapt.co.kr/rss/allArticle.xml',
  },
  {
    name: '아파트관리신문',
    baseUrl: 'https://www.aptn.co.kr',
    listUrl: 'https://www.aptn.co.kr/news/articleList.html?view_type=sm',
    rssUrl: 'https://www.aptn.co.kr/rss/allArticle.xml',
  },
  {
    name: '한국아파트뉴스',
    baseUrl: 'https://koreaaptnews.com',
    listUrl: 'https://koreaaptnews.com/news/articleList.html?view_type=sm',
    rssUrl: 'https://koreaaptnews.com/rss/allArticle.xml',
  },
];

async function tryFetchRss(source: typeof NEWS_SOURCES[0]): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.rssUrl, {
      headers: { 'User-Agent': 'SecondBrain/1.0 RSS Reader' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    if (!xml.includes('<item>') && !xml.includes('<entry>')) return [];

    const $ = cheerio.load(xml, { xmlMode: true });
    const articles: RawArticle[] = [];

    $('item').each((_, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const desc = $(el).find('description').text().trim();
      if (title) {
        articles.push({
          title,
          url: link || '',
          date: pubDate || '',
          summary: cheerio.load(desc).text().slice(0, 300),
          source: source.name,
        });
      }
    });

    return articles.slice(0, 20);
  } catch {
    return [];
  }
}

async function tryFetchHtml(source: typeof NEWS_SOURCES[0]): Promise<RawArticle[]> {
  try {
    const res = await fetch(source.listUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const articles: RawArticle[] = [];

    // Pattern 1: Standard Korean news CMS (NR Media / DGN Media)
    $('section.article-list-content .list-block, .article-list .list-block, #section-list .list-block').each((_, el) => {
      const titleEl = $(el).find('.list-titles a, .titles a, h4.titles a, h3 a');
      const title = titleEl.text().trim();
      let href = titleEl.attr('href') || '';
      if (href && !href.startsWith('http')) {
        href = source.baseUrl + href;
      }
      const date = $(el).find('.list-dated, .byline em, .list-dated em').first().text().trim();
      const summary = $(el).find('.list-summary, .lead, p.summary').text().trim().slice(0, 300);

      if (title) {
        articles.push({ title, url: href, date, summary, source: source.name });
      }
    });

    // Pattern 2: Alternative list structure
    if (articles.length === 0) {
      $('li.list-block, .article-list li, .news-list li, .board-list tr, .list-item').each((_, el) => {
        const titleEl = $(el).find('a');
        const title = titleEl.first().text().trim();
        let href = titleEl.first().attr('href') || '';
        if (href && !href.startsWith('http')) {
          href = source.baseUrl + href;
        }
        const date = $(el).find('.date, .time, em, span.date').text().trim();

        if (title && title.length > 5) {
          articles.push({ title, url: href, date, summary: '', source: source.name });
        }
      });
    }

    // Pattern 3: Generic article links
    if (articles.length === 0) {
      $('a[href*="articleView"], a[href*="article"], a[href*="view"]').each((_, el) => {
        const title = $(el).text().trim();
        let href = $(el).attr('href') || '';
        if (href && !href.startsWith('http')) {
          href = source.baseUrl + href;
        }
        if (title && title.length > 8 && title.length < 200) {
          articles.push({ title, url: href, date: '', summary: '', source: source.name });
        }
      });
    }

    return articles.slice(0, 20);
  } catch {
    return [];
  }
}

async function fetchFromSource(source: typeof NEWS_SOURCES[0]): Promise<RawArticle[]> {
  // Try RSS first, fall back to HTML scraping
  let articles = await tryFetchRss(source);
  if (articles.length > 0) return articles;
  articles = await tryFetchHtml(source);
  return articles;
}

async function filterWithAI(articles: RawArticle[], apiKey: string): Promise<FilteredArticle[]> {
  if (articles.length === 0) return [];

  const articleList = articles.map((a, i) =>
    `[${i}] ${a.source} | ${a.title}${a.summary ? ' | ' + a.summary.slice(0, 100) : ''}`
  ).join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `당신은 공동주택 관리 전문 뉴스 큐레이터입니다. 아래 기사 목록에서 아파트케어 프로덕트 기획에 중요한 기사만 골라주세요.

관심 주제: 관리규약, 사업자 선정, 공동주택관리법/시행령 개정, 과태료, 장기수선계획, 하자보수, 관리비, 입주자대표회의, 위탁관리, 전자입찰, 에너지/탄소, 소방/안전, AI/디지털 관리

기사 목록:
${articleList}

아래 JSON 배열로만 응답하세요. 관련 없는 기사(단순 지역뉴스, 분양, 부동산 시세, 인사)는 제외합니다.

[{"index": 0, "relevance": "관련 주제를 2-3단어로"}]`,
        }],
      }),
    });

    if (!res.ok) {
      return articles.slice(0, 15).map(a => ({ ...a, relevance: '' }));
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return articles.slice(0, 15).map(a => ({ ...a, relevance: '' }));

    const filtered: { index: number; relevance: string }[] = JSON.parse(match[0]);
    return filtered
      .filter(f => f.index >= 0 && f.index < articles.length)
      .map(f => ({ ...articles[f.index], relevance: f.relevance }));
  } catch {
    return articles.slice(0, 15).map(a => ({ ...a, relevance: '' }));
  }
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey } = await req.json();

    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      NEWS_SOURCES.map(s => fetchFromSource(s))
    );

    const allArticles: RawArticle[] = [];
    const sourceStatus: { name: string; count: number; error?: string }[] = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled') {
        allArticles.push(...result.value);
        sourceStatus.push({ name: NEWS_SOURCES[i].name, count: result.value.length });
      } else {
        sourceStatus.push({ name: NEWS_SOURCES[i].name, count: 0, error: '접속 실패' });
      }
    });

    // AI filtering if API key provided
    let filtered: FilteredArticle[];
    if (apiKey && allArticles.length > 0) {
      filtered = await filterWithAI(allArticles, apiKey);
    } else {
      filtered = allArticles.map(a => ({ ...a, relevance: '' }));
    }

    return NextResponse.json({
      articles: filtered,
      sources: sourceStatus,
      totalFetched: allArticles.length,
      totalFiltered: filtered.length,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '뉴스 수집 실패' },
      { status: 500 }
    );
  }
}
