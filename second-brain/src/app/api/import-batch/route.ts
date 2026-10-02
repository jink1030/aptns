import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { notes, secret } = await req.json();

    if (secret !== process.env.ADMIN_ACCESS_CODE) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const supabase = createClient(url, key);
    const results: { title: string; ok: boolean; error?: string }[] = [];

    for (const note of notes) {
      const { data, error } = await supabase.from('notes').insert({
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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
