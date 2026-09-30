-- ===========================================
-- Second Brain - 첨부파일 기능 추가 마이그레이션
-- ===========================================
-- 이 SQL을 Supabase 대시보드 > SQL Editor에 붙여넣고 실행하세요.

-- 1. notes 테이블에 attachments 컬럼 추가
alter table notes add column if not exists attachments jsonb not null default '[]';

-- 2. 첨부파일 저장용 스토리지 버킷 생성
insert into storage.buckets (id, name, public) values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 3. 스토리지 접근 정책 (누구나 읽기/쓰기 - 개인용)
create policy "Allow public read" on storage.objects for select using (bucket_id = 'attachments');
create policy "Allow public upload" on storage.objects for insert with check (bucket_id = 'attachments');
create policy "Allow public delete" on storage.objects for delete using (bucket_id = 'attachments');
