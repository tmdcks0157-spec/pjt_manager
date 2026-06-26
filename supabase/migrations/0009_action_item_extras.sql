-- action_items 테이블에 우선순위/태그/체크리스트 추가
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]';
