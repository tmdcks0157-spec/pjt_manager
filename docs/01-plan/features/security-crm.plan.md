# Plan: security-crm — CRM 개인정보 보안 강화

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | CRM에 이름·전화번호·이메일 등 개인정보가 저장되고 있으나, contacts/companies/activities 테이블이 RLS 마이그레이션에서 누락되어 있어 타 사용자 데이터 접근 가능성이 존재한다 |
| **Solution** | ① CRM 테이블 RLS 즉시 적용(critical) ② 데이터 접근 감사 로그 추가 ③ UI 레벨 민감정보 마스킹으로 3-layer 보안 체계 구축 |
| **Function UX Effect** | 보안 강화 후에도 UX 변화 최소화 — 목록에서는 전화번호 마스킹, 상세 페이지 진입 시 전체 노출로 자연스러운 접근 제어 |
| **Core Value** | "저장한 사람만 볼 수 있다"는 신뢰 보장 — 개인정보 보호 기반 위에 CRM 기능 안정적 확장 |

---

## 1. 현황 분석

### 발견된 보안 취약점

| 심각도 | 항목 | 현재 상태 | 위험 |
|--------|------|-----------|------|
| 🔴 Critical | CRM 테이블 RLS 미적용 | `0001_enable_rls.sql`에 contacts/companies/activities 없음 | 로그인한 모든 유저가 타인 연락처 조회 가능 |
| 🟠 High | 감사 로그 없음 | 누가 언제 어떤 연락처를 봤는지 추적 불가 | 데이터 유출 시 탐지 불가 |
| 🟡 Medium | UI 데이터 노출 | 목록에서 전화번호·이메일 전체 노출 | 화면 공유·스크린샷 시 불필요한 노출 |
| 🟢 Low | 입력 검증 부재 | 전화번호·이메일 형식 미검증 | 잘못된 데이터 저장 |

### 기존 보안 현황 (재활용 가능)

| 항목 | 상태 | 활용 방법 |
|------|------|-----------|
| RLS 패턴 (`0001_enable_rls.sql`) | ✅ 적용됨 (6개 테이블) | CRM 테이블 동일 패턴으로 추가 |
| 세션 가드 (보안 하드닝에서 적용) | ✅ 적용됨 | 그대로 활용 |
| 입력 길이 제한 | ✅ 적용됨 | 전화번호/이메일 형식 검증 추가 |

---

## 2. 기능 범위

### 2.1 CRM 테이블 RLS 적용 (Critical — 즉시 필요)

| 항목 | 상세 |
|------|------|
| 대상 테이블 | `contacts`, `companies`, `activities` |
| 정책 | `auth.uid() = user_id` (기존 패턴과 동일) |
| 구현 방법 | `0003_crm_rls.sql` 마이그레이션 추가 |
| 검증 방법 | `pg_policies` 뷰로 정책 확인 쿼리 포함 |

### 2.2 감사 로그 (Audit Log)

| 항목 | 상세 |
|------|------|
| 추적 대상 | contacts/companies 조회(SELECT), 생성(INSERT), 수정(UPDATE), 삭제(DELETE) |
| 저장 위치 | `contact_audit_logs` 테이블 (user_id, contact_id, action, ip_hint, created_at) |
| 구현 방법 | Supabase DB 트리거 (INSERT/UPDATE/DELETE 시 자동 기록) |
| 보존 정책 | 90일 (자동 삭제 cron 또는 수동) |
| UI | 연락처 상세 페이지 하단 "접근 기록" 아코디언 (선택 표시) |

### 2.3 UI 데이터 마스킹

| 필드 | 목록(list) | 상세(detail) |
|------|-----------|--------------|
| 전화번호 | `010-****-1234` | 전체 표시 |
| 이메일 | `t***@gmail.com` | 전체 표시 |
| 메모(notes) | 미표시 | 전체 표시 |

- 마스킹 함수를 `src/lib/mask.ts`에 유틸로 분리
- 상세 페이지에서는 마스킹 없이 전체 표시 (이미 인증된 자신의 데이터)

### 2.4 입력 검증 강화

| 필드 | 검증 규칙 |
|------|-----------|
| 이메일 | RFC5322 기본 형식 (`z.string().email()`) |
| 전화번호 | 숫자·하이픈·+만 허용, 7~20자 |
| 웹사이트 | URL 형식 (`z.string().url()`) |
| 이름 | 1~100자, 특수문자 제한 |

구현: `ContactForm.tsx`, `CompanyForm.tsx`에 Zod 스키마 추가

---

## 3. DB 스키마 변경

### 신규: `0003_crm_rls.sql`

```sql
-- contacts, companies, activities RLS 적용
-- 기존 0001_enable_rls.sql 패턴과 동일

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
      raise notice 'RLS applied: %', t;
    else
      raise notice 'SKIP (table not found): %', t;
    end if;
  end loop;
end $$;
```

### 신규: `contact_audit_logs` 테이블

```sql
CREATE TABLE contact_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  contact_id  uuid,           -- NULL이면 companies 또는 bulk 작업
  entity_type text NOT NULL CHECK (entity_type IN ('contact', 'company')),
  action      text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_data    jsonb,          -- UPDATE/DELETE 시 이전 값
  created_at  timestamptz DEFAULT now()
);

-- RLS: 본인 로그만 조회
ALTER TABLE contact_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own logs" ON contact_audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 트리거: contacts 변경 시 자동 기록
CREATE OR REPLACE FUNCTION log_contact_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contact_audit_logs (user_id, contact_id, entity_type, action, old_data)
  VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.id, OLD.id),
    TG_TABLE_NAME::text,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD)::jsonb ELSE NULL END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER contacts_audit
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_contact_change();

CREATE TRIGGER companies_audit
  AFTER INSERT OR UPDATE OR DELETE ON companies
  FOR EACH ROW EXECUTE FUNCTION log_contact_change();
```

---

## 4. 파일 변경 목록

### 신규 파일

| 파일 | 목적 |
|------|------|
| `supabase/migrations/0003_crm_rls.sql` | CRM 테이블 RLS + 감사 로그 스키마 |
| `src/lib/mask.ts` | 전화번호·이메일 마스킹 유틸 함수 |

### 수정 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/components/crm/ContactForm.tsx` | Zod 입력 검증 추가 |
| `src/components/crm/CompanyForm.tsx` | Zod 입력 검증 추가 |
| `src/app/(main)/crm/page.tsx` | 목록에서 전화번호·이메일 마스킹 적용 |
| `src/hooks/useCRM.ts` | 감사 로그 조회 훅 추가 (선택) |

---

## 5. 구현 순서

| 순서 | 작업 | 우선순위 | 예상 소요 |
|------|------|---------|-----------|
| 1 | `0003_crm_rls.sql` 작성 및 Supabase 적용 | 🔴 즉시 | 30분 |
| 2 | RLS 적용 검증 (pg_policies 확인) | 🔴 즉시 | 10분 |
| 3 | `src/lib/mask.ts` 마스킹 유틸 작성 | 🟠 | 20분 |
| 4 | CRM 목록 페이지 마스킹 적용 | 🟠 | 20분 |
| 5 | ContactForm/CompanyForm Zod 검증 추가 | 🟡 | 30분 |
| 6 | 감사 로그 트리거 적용 (선택적 UI 포함) | 🟢 | 1시간 |

---

## 6. 미포함 범위

- 필드 레벨 암호화 (pgcrypto) — 현재 규모에서 과도한 복잡도
- GDPR 동의 기록 — 서비스 공개 전 검토
- IP 기반 접근 제한 — 인프라 레벨 이슈
- 데이터 내보내기/삭제 권한 — 기존 계정 삭제 기능으로 대응 중
