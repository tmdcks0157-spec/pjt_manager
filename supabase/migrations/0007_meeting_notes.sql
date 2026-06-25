-- updated_at 자동 갱신 함수 (없으면 생성)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- meetings
CREATE TABLE public.meetings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL DEFAULT '제목 없는 회의',
  date             TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_minutes INT         DEFAULT NULL,
  status           TEXT        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','in_progress','completed')),
  agenda           JSONB       NOT NULL DEFAULT '[]',
  notes            TEXT        NOT NULL DEFAULT '',
  project_id       UUID        DEFAULT NULL,
  started_at       TIMESTAMPTZ DEFAULT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- meeting_attendees
CREATE TABLE public.meeting_attendees (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  contact_id   UUID        DEFAULT NULL,
  name         TEXT        NOT NULL,
  email        TEXT        DEFAULT NULL,
  role         TEXT        NOT NULL DEFAULT 'attendee'
                           CHECK (role IN ('organizer','attendee')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- action_items
CREATE TABLE public.action_items (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id           UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL,
  text                 TEXT        NOT NULL,
  assignee_name        TEXT        DEFAULT NULL,
  assignee_contact_id  UUID        DEFAULT NULL,
  due_date             DATE        DEFAULT NULL,
  status               TEXT        NOT NULL DEFAULT 'open'
                                   CHECK (status IN ('open','done')),
  exported_task_id     TEXT        DEFAULT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_meetings_user_id     ON public.meetings(user_id);
CREATE INDEX idx_meetings_date        ON public.meetings(date);
CREATE INDEX idx_action_items_meeting ON public.action_items(meeting_id);

-- RLS
ALTER TABLE public.meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meetings_owner" ON public.meetings
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attendees_owner" ON public.meeting_attendees
  USING (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.meetings m WHERE m.id = meeting_id AND m.user_id = auth.uid()));

CREATE POLICY "action_items_owner" ON public.action_items
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at 트리거 (기존 패턴)
CREATE TRIGGER meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
