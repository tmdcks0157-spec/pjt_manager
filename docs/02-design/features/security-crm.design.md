# Design: security-crm — CRM 개인정보 보안 강화

> Plan 참조: `docs/01-plan/features/security-crm.plan.md`

---

## 1. 구현 범위 확정

| # | 항목 | 구현 여부 | 비고 |
|---|------|-----------|------|
| 1 | CRM 테이블 RLS 마이그레이션 | ✅ 구현 | Critical — 최우선 |
| 2 | UI 전화번호·이메일 마스킹 | ✅ 구현 | CRM 목록 페이지만 적용 |
| 3 | 이메일 형식 입력 검증 | ✅ 구현 | ContactForm / CompanyForm |
| 4 | 감사 로그 (Audit Log) | ✅ 구현 | DB 트리거 — UI 없이 백엔드만 |
| 5 | 감사 로그 UI | ❌ 제외 | 추후 필요 시 추가 |

---

## 2. 아키텍처

```
[Supabase DB]
  contacts ──── RLS: auth.uid() = user_id  ← 0003_crm_rls.sql 추가
  companies ─── RLS: auth.uid() = user_id  ←
  activities ── RLS: auth.uid() = user_id  ←
  contact_audit_logs ── 트리거 자동 기록   ← INSERT/UPDATE/DELETE on contacts/companies

[Frontend]
  src/lib/mask.ts              ← 마스킹 유틸 (신규)
  src/app/(main)/crm/page.tsx  ← ContactCard에 마스킹 적용
  src/components/crm/ContactForm.tsx  ← 이메일 형식 검증 추가
  src/components/crm/CompanyForm.tsx  ← 이메일/URL 형식 검증 추가
```

---

## 3. 상세 설계

### 3-1. `supabase/migrations/0003_crm_rls.sql`

기존 `0001_enable_rls.sql`과 동일한 패턴 — idempotent 보장.

```sql
-- ============================================================
-- 0003_crm_rls.sql
-- CRM 테이블 RLS 적용 + 감사 로그
-- ============================================================

-- 1) CRM 3개 테이블 RLS
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
      raise notice 'SKIP (not found): %', t;
    end if;
  end loop;
end $$;

-- 2) 감사 로그 테이블
create table if not exists public.contact_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users not null,
  entity_type text not null,   -- 'contact' | 'company'
  entity_id   uuid not null,
  action      text not null,   -- 'insert' | 'update' | 'delete'
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
    case when tg_op in ('UPDATE','DELETE') then row_to_json(old)::jsonb else null end
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
-- 검증 쿼리 (실행 후 contacts/companies/activities 모두 true)
-- select tablename, rowsecurity from pg_tables
--  where schemaname = 'public'
--    and tablename in ('contacts','companies','activities','contact_audit_logs');
-- ============================================================
```

---

### 3-2. `src/lib/mask.ts` (신규)

```typescript
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return email
  const visible = local.length <= 2 ? local[0] : local.slice(0, 2)
  return `${visible}***@${domain}`
}

export function maskPhone(phone: string): string {
  // 숫자만 추출해서 뒤 4자리 앞을 마스킹
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) return phone
  const last4 = digits.slice(-4)
  const first = digits.slice(0, digits.length - 8)   // 010
  return first ? `${first}-****-${last4}` : `****-${last4}`
}
```

---

### 3-3. `src/app/(main)/crm/page.tsx` — ContactCard 마스킹

현재 코드 (`page.tsx:51-60`):
```tsx
{contact.email && (
  <a href={`mailto:${contact.email}`} ...>
    <Mail size={11} /> {contact.email}         {/* 전체 노출 */}
  </a>
)}
{contact.phones?.map((phone, i) => (
  <a key={i} href={`tel:${phone}`} ...>
    <Phone size={11} /> {phone}                {/* 전체 노출 */}
  </a>
))}
```

변경 후:
```tsx
import { maskEmail, maskPhone } from '@/lib/mask'

{contact.email && (
  <a href={`mailto:${contact.email}`} ...>
    <Mail size={11} /> {maskEmail(contact.email)}   {/* 마스킹 */}
  </a>
)}
{contact.phones?.map((phone, i) => (
  <a key={i} href={`tel:${phone}`} ...>
    <Phone size={11} /> {maskPhone(phone)}           {/* 마스킹 */}
  </a>
))}
```

> 상세 페이지(`/crm/contacts/[id]`)는 마스킹 없이 그대로 — 이미 인증된 상세 뷰.

---

### 3-4. `src/components/crm/ContactForm.tsx` — 이메일 검증

현재: `type="email"` HTML 속성만 있음 (브라우저 기본 검증, submit 전 피드백 없음)

변경: submit 시 이메일 형식 검증 추가 (`handleSubmit` 내부)

```typescript
// handleSubmit 상단에 추가
const emailTrimmed = email.trim()
if (emailTrimmed) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(emailTrimmed)) {
    setErrorMsg('올바른 이메일 형식을 입력해주세요')
    setSaving(false)
    return
  }
}
```

---

### 3-5. `src/components/crm/CompanyForm.tsx` — 이메일/URL 검증

CompanyForm에도 동일한 이메일 검증 패턴 적용.  
웹사이트(website) 필드에 URL 형식 검증 추가:

```typescript
const websiteTrimmed = website.trim()
if (websiteTrimmed) {
  try {
    new URL(websiteTrimmed.startsWith('http') ? websiteTrimmed : `https://${websiteTrimmed}`)
  } catch {
    setErrorMsg('올바른 웹사이트 주소를 입력해주세요 (예: https://example.com)')
    setSaving(false)
    return
  }
}
```

---

## 4. 파일별 변경 요약

| 파일 | 변경 유형 | 핵심 변경 내용 |
|------|-----------|---------------|
| `supabase/migrations/0003_crm_rls.sql` | 신규 | contacts/companies/activities RLS + 감사 로그 트리거 |
| `src/lib/mask.ts` | 신규 | `maskEmail()`, `maskPhone()` 유틸 |
| `src/app/(main)/crm/page.tsx` | 수정 | ContactCard에 maskEmail/maskPhone 적용 (2줄) |
| `src/components/crm/ContactForm.tsx` | 수정 | handleSubmit에 이메일 형식 검증 추가 (8줄) |
| `src/components/crm/CompanyForm.tsx` | 수정 | handleSubmit에 이메일/URL 검증 추가 (확인 필요) |

---

## 5. 구현 순서 (Do Phase)

```
1. SQL 먼저
   └─ 0003_crm_rls.sql 작성
   └─ Supabase SQL Editor에서 실행
   └─ pg_tables로 RLS 적용 확인

2. 프론트엔드
   └─ src/lib/mask.ts 생성
   └─ crm/page.tsx ContactCard 마스킹
   └─ ContactForm.tsx 이메일 검증
   └─ CompanyForm.tsx 이메일/URL 검증

3. 확인
   └─ 목록 화면에서 마스킹 확인
   └─ 잘못된 이메일 입력 시 에러 메시지 확인
   └─ Supabase audit_logs 테이블에 기록 확인
```

---

## 6. 테스트 시나리오

| 시나리오 | 예상 결과 |
|----------|-----------|
| CRM 목록 접속 | 전화번호 `010-****-1234`, 이메일 `ho***@gmail.com` 표시 |
| 연락처 상세 페이지 | 전화번호·이메일 전체 표시 |
| 잘못된 이메일 입력 후 저장 | "올바른 이메일 형식을 입력해주세요" 오류 표시 |
| 연락처 생성/수정/삭제 | `contact_audit_logs`에 행 생성 확인 (Supabase 대시보드) |
| `pg_tables` 조회 | contacts/companies/activities `rowsecurity = true` |
