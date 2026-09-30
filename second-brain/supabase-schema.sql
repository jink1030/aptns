-- ===========================================
-- Second Brain - Supabase 데이터베이스 스키마
-- ===========================================
-- 이 SQL을 Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.

-- 1. Notes 테이블
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '제목 없음',
  content text not null default '',
  category text not null default 'idea' check (category in ('idea', 'work', 'research', 'personal')),
  tags text[] not null default '{}',
  linked_note_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Todos 테이블
create table if not exists todos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  due_date timestamptz,
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  note_id uuid references notes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. updated_at 자동 업데이트 트리거
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger notes_updated_at
  before update on notes
  for each row execute function update_updated_at();

create trigger todos_updated_at
  before update on todos
  for each row execute function update_updated_at();

-- 4. RLS(Row Level Security) 비활성화 (개인용이므로)
alter table notes enable row level security;
alter table todos enable row level security;

-- 누구나 읽기/쓰기 가능 (anon key로 접근)
create policy "Allow all access to notes" on notes for all using (true) with check (true);
create policy "Allow all access to todos" on todos for all using (true) with check (true);

-- 5. 인덱스
create index if not exists idx_notes_category on notes(category);
create index if not exists idx_notes_updated on notes(updated_at desc);
create index if not exists idx_todos_status on todos(status);
create index if not exists idx_todos_due_date on todos(due_date);
