-- meetings 테이블에 archived / deleted_at 추가
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS archived    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_meetings_archived    ON public.meetings(archived);
CREATE INDEX IF NOT EXISTS idx_meetings_deleted_at  ON public.meetings(deleted_at);
