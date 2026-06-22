-- ============================================================
-- 0002_dedupe_policies.sql
-- 0001 적용 결과, 각 테이블에 정책이 2개씩(기존 + 신규) 중복됨.
-- 둘 다 auth.uid() = user_id 조건의 permissive ALL 정책이라 동작은 동일하지만,
-- 혼동을 막기 위해 기존 정책을 제거하고 0001의 "Users manage own rows" 만 남긴다.
--
-- 이로써 supabase/migrations/ 가 RLS 정책의 단일 진실 소스가 된다.
-- idempotent: 여러 번 실행해도 안전하다 (drop policy if exists).
-- ============================================================

drop policy if exists "users can manage own projects"        on public.projects;
drop policy if exists "users can manage own tasks"           on public.tasks;
drop policy if exists "users can manage own columns"         on public.columns;
drop policy if exists "users can manage own checklist items" on public.checklist_items;
drop policy if exists "Users can manage own calendar events" on public.calendar_events;
drop policy if exists "Users can CRUD their own posts"       on public.posts;

-- ============================================================
-- 검증 — 실행 후 6개 테이블에 "Users manage own rows" 정책만 하나씩 남아야 한다.
-- ============================================================
-- select tablename, policyname, cmd
--   from pg_policies
--  where schemaname = 'public'
--    and tablename in ('projects','columns','tasks','checklist_items','calendar_events','posts')
--  order by tablename;

