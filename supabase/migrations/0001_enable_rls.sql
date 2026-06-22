-- ============================================================
-- 0001_enable_rls.sql
-- 모든 사용자 데이터 테이블에 Row Level Security(RLS) 적용
--
-- 이 앱은 서버 없이 브라우저에서 anon key로 직접 Supabase에 접근한다.
-- anon key는 클라이언트 번들에 노출되므로, 데이터 격리는 전적으로
-- RLS 정책에 의존한다. RLS가 꺼진 테이블이 하나라도 있으면
-- 로그인한 누구나 타인의 데이터를 읽고/쓰고/삭제할 수 있다.
--
-- idempotent: 여러 번 실행해도 안전하다. Supabase 대시보드의
-- SQL Editor에 통째로 붙여넣어 실행하면 된다.
-- ============================================================

-- 사용자 소유 테이블: user_id = auth.uid() 인 행만 접근 허용
do $$
declare
  t text;
  owned_tables text[] := array[
    'projects',
    'columns',
    'tasks',
    'checklist_items',
    'calendar_events',
    'posts'
  ];
begin
  foreach t in array owned_tables loop
    -- 테이블이 실제로 존재할 때만 처리
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      -- RLS 활성화
      execute format('alter table public.%I enable row level security;', t);

      -- 기존 정책 제거 후 재생성 (idempotent)
      execute format('drop policy if exists "Users manage own rows" on public.%I;', t);
      execute format($f$
        create policy "Users manage own rows" on public.%I
          for all
          to authenticated
          using (auth.uid() = user_id)
          with check (auth.uid() = user_id);
      $f$, t);

      raise notice 'RLS applied: %', t;
    else
      raise notice 'SKIP (table not found): %', t;
    end if;
  end loop;
end $$;

-- ============================================================
-- 검증 쿼리 — 실행 후 아래로 RLS 상태를 확인할 수 있다.
-- 모든 테이블의 rowsecurity 가 true 여야 한다.
-- ============================================================
-- select tablename, rowsecurity
--   from pg_tables
--  where schemaname = 'public'
--    and tablename in ('projects','columns','tasks','checklist_items','calendar_events','posts')
--  order by tablename;
--
-- select tablename, policyname, cmd
--   from pg_policies
--  where schemaname = 'public'
--  order by tablename;
