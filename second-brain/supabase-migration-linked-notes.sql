-- ===========================================
-- Migration: todos 테이블에 linked_note_ids 컬럼 추가
-- ===========================================
-- 할일에 참고 노트를 최대 10개까지 연결할 수 있습니다.
-- 기존 Supabase를 사용 중이라면 이 SQL을 실행하세요.

ALTER TABLE todos ADD COLUMN IF NOT EXISTS linked_note_ids text[] NOT NULL DEFAULT '{}';
