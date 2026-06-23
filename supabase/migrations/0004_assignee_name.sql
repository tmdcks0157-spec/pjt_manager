-- ============================================================
-- 0004_assignee_name.sql
-- tasks 테이블에 미등록 담당자 자유 입력 컬럼 추가
-- idempotent: IF NOT EXISTS로 중복 실행 안전
-- ============================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;

-- 검증 쿼리
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'tasks' AND column_name = 'assignee_name';
