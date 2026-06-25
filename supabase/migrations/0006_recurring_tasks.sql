-- recurring-tasks: 반복 태스크 지원
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_type     TEXT    CHECK (recurrence_type IN ('daily','weekly','monthly','yearly')),
  ADD COLUMN IF NOT EXISTS recurrence_interval INT     DEFAULT 1,
  ADD COLUMN IF NOT EXISTS recurrence_end      DATE    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parent_task_id      UUID    REFERENCES tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_recurring_root   BOOL    DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON public.tasks(parent_task_id);
