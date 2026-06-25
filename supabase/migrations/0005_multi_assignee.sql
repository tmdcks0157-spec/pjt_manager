-- multi-assignee: 담당자 복수 지정 (최대 5명)
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contact_ids    UUID[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_names TEXT[]  DEFAULT '{}';

-- 기존 단일 값 → 배열로 마이그레이션
UPDATE public.tasks
SET contact_ids = ARRAY[contact_id]
WHERE contact_id IS NOT NULL AND (contact_ids IS NULL OR contact_ids = '{}');

UPDATE public.tasks
SET assignee_names = ARRAY[assignee_name]
WHERE assignee_name IS NOT NULL AND assignee_name != ''
  AND (assignee_names IS NULL OR assignee_names = '{}');
