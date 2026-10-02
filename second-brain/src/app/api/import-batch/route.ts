import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import importData from './import-data.json';

export const dynamic = 'force-dynamic';

interface ImportNote {
  title: string;
  content: string;
  category?: string;
  tags?: string[];
}

async function doImport(notes: ImportNote[]) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
  }

  const supabase = createClient(url, key);
  const results: { title: string; ok: boolean; error?: string }[] = [];

  for (const note of notes) {
    const { error } = await supabase.from('notes').insert({
      title: note.title,
      content: note.content,
      category: note.category || 'research',
      tags: note.tags || [],
      linked_note_ids: [],
      attachments: [],
    }).select('id').single();

    results.push({
      title: note.title,
      ok: !error,
      error: error?.message,
    });
  }

  return NextResponse.json({ results });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.ADMIN_ACCESS_CODE) {
    return NextResponse.json(
      { error: '접근 코드가 필요합니다. ?secret=코드 를 URL에 추가하세요' },
      { status: 401 }
    );
  }

  return doImport(importData as ImportNote[]);
}

export async function POST(req: Request) {
  try {
    const { notes, secret } = await req.json();

    if (secret !== process.env.ADMIN_ACCESS_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return doImport(notes as ImportNote[]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
