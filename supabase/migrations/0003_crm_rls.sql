-- ============================================================
-- 0003_crm_rls.sql
-- CRM 테이블(contacts, companies, activities) RLS 적용
-- + 감사 로그(contact_audit_logs) 스키마 및 트리거
--
-- idempotent: 여러 번 실행해도 안전하다.
-- Supabase 대시보드 SQL Editor에 통째로 붙여넣어 실행.
-- ============================================================

-- 1) CRM 3개 테이블 RLS 적용
do $$
declare
  t text;
  crm_tables text[] := array['contacts', 'companies', 'activities'];
begin
  foreach t in array crm_tables loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists "Users manage own rows" on public.%I;', t);
      execute format($f$
        create policy "Users manage own rows" on public.%I
          for all
          to authenticated
          using (auth.uid() = user_id)
          with check (auth.uid() = user_id);
      $f$, t);
      raise notice 'CRM RLS applied: %', t;
    else
      raise notice 'SKIP (table not found): %', t;
    end if;
  end loop;
end $$;

-- 2) 감사 로그 테이블
create table if not exists public.contact_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  entity_type text not null,
  entity_id   uuid not null,
  action      text not null check (action in ('insert', 'update', 'delete')),
  old_data    jsonb,
  created_at  timestamptz default now()
);

alter table public.contact_audit_logs enable row level security;

drop policy if exists "Users read own audit logs" on public.contact_audit_logs;
create policy "Users read own audit logs" on public.contact_audit_logs
  for select to authenticated
  using (auth.uid() = user_id);

-- 3) 감사 로그 트리거 함수
create or replace function public.log_crm_change()
returns trigger language plpgsql security definer as $$
begin
  insert into public.contact_audit_logs
    (user_id, entity_type, entity_id, action, old_data)
  values (
    coalesce(new.user_id, old.user_id),
    tg_table_name,
    coalesce(new.id, old.id),
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then row_to_json(old)::jsonb else null end
  );
  return coalesce(new, old);
end;
$$;

-- 4) contacts 트리거
drop trigger if exists contacts_audit on public.contacts;
create trigger contacts_audit
  after insert or update or delete on public.contacts
  for each row execute function public.log_crm_change();

-- 5) companies 트리거
drop trigger if exists companies_audit on public.companies;
create trigger companies_audit
  after insert or update or delete on public.companies
  for each row execute function public.log_crm_change();

-- ============================================================
-- 검증 쿼리 (실행 후 아래로 확인)
-- contacts / companies / activities / contact_audit_logs 모두 rowsecurity = true
--
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public'
--    and tablename in ('contacts','companies','activities','contact_audit_logs')
--  order by tablename;
--
-- select tablename, policyname from pg_policies
--  where schemaname = 'public'
--    and tablename in ('contacts','companies','activities','contact_audit_logs')
--  order by tablename;
-- ============================================================
