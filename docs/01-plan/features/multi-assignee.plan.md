# Plan: multi-assignee — 태스크 담당자 복수 지정

> 상태: **백로그 (미구현)** — 2026-06-23 기록
> 선행 기능: assignee-search (완료 2026-06-23)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 현재 태스크에 담당자를 1명만 지정할 수 있어, 공동 담당·협업 태스크를 표현할 수 없다 |
| **Solution** | `contact_ids UUID[]` + `assignee_names TEXT[]` 배열 컬럼으로 확장, ContactCombobox를 멀티셀렉트 칩 패턴으로 변경 |
| **Function UX Effect** | 담당자 입력창에서 여러 명을 선택하면 칩 형태로 쌓이고, 태스크 카드에 "김철수 외 N명" 뱃지로 표시 |
| **Core Value** | 협업 태스크를 정확히 표현하고 담당자별 태스크 조회 가능 |

---

## 1. 현재 구조 (선행 기능 assignee-search 기준)

```
tasks
  contact_id    UUID    FK → contacts.id (단일)
  assignee_name TEXT            (단일 자유 입력)
```

---

## 2. 변경 방향

### 방안 A: 배열 컬럼 (추천 — 현 규모에 적합)

```sql
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS contact_ids    UUID[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assignee_names TEXT[]  DEFAULT '{}';
```

- 기존 `contact_id`, `assignee_name` 데이터 마이그레이션 후 컬럼 제거
- 장점: 구현 단순, Supabase 조회 쉬움
- 단점: 배열 FK는 Supabase join이 복잡 (수동 join 필요)

### 방안 B: Junction 테이블 (연락처 수가 많아질 때)

```sql
CREATE TABLE public.task_assignees (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assignee_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

- 장점: 정규화, 담당자별 태스크 조회 쿼리 깔끔
- 단점: 코드 변경 범위 넓음, 별도 hook 필요

> **결정**: 방안 A로 구현 시작. 담당자별 조회 기능이 필요해지면 방안 B로 전환.

---

## 3. 구현 범위

| 파일 | 변경 내용 |
|------|-----------|
| `supabase/migrations/XXXX_multi_assignee.sql` | 배열 컬럼 추가, 기존 데이터 마이그레이션 |
| `src/types/index.ts` | `Task.contact_ids?: string[]`, `Task.assignee_names?: string[]` 추가 |
| `src/components/ui/ContactCombobox.tsx` | 멀티셀렉트 칩 패턴으로 변경 |
| `src/components/kanban/TaskModal.tsx` | 상태를 배열로 변경, handleSave 업데이트 |
| `src/components/kanban/TaskCard.tsx` | 뱃지 표시: "이름" / "이름 외 N명" |
| `src/app/(main)/crm/contacts/[id]/page.tsx` | contact 상세 → 연결 태스크 조회 쿼리 수정 |

---

## 4. UI 설계 (ContactCombobox 멀티셀렉트)

```
┌─────────────────────────────────────────┐
│ [김철수 ×] [이영희 ×]  담당자 검색...   │  ← 칩 + 입력창
└─────────────────────────────────────────┘
  ↓ 드롭다운
  ┌───────────────────────┐
  │ ✓ 김철수 (개발팀)     │  ← 이미 선택된 항목 체크 표시
  │   이영희 (디자인팀)   │
  │   박민준 (기획팀)     │
  └───────────────────────┘
```

- 선택된 항목은 칩(`<span>`)으로 표시, X 버튼으로 제거
- 이미 선택된 항목은 드롭다운에서 체크 표시
- 자유 입력은 Enter 키로 확정 (assignee_names에 추가)

---

## 5. TaskCard 뱃지

```tsx
// 담당자 1명
<span>김철수</span>

// 담당자 2명 이상
<span>김철수 외 {count - 1}명</span>
```

---

## 6. 데이터 마이그레이션 SQL

```sql
-- 기존 단일 값 → 배열로 이전
UPDATE public.tasks
SET contact_ids    = ARRAY[contact_id]
WHERE contact_id IS NOT NULL;

UPDATE public.tasks
SET assignee_names = ARRAY[assignee_name]
WHERE assignee_name IS NOT NULL AND assignee_name != '';

-- 기존 컬럼 제거 (마이그레이션 확인 후)
-- ALTER TABLE public.tasks DROP COLUMN contact_id;
-- ALTER TABLE public.tasks DROP COLUMN assignee_name;
```

> ⚠️ 기존 컬럼 제거 전 CRM 연결 쿼리(`contact_id` 참조 코드) 전체 교체 확인 필요

---

## 7. 구현 시 주의사항

- `useContacts()` hook의 contactsMap 조회가 배열 기반으로 바뀌므로 `contact_ids.map(id => contactsMap[id])` 패턴으로 교체
- RLS 정책에서 `contact_id` → `contact_ids` 참조 부분 확인
- crm/contacts/[id] 페이지의 "연결된 태스크" 쿼리: `.eq('contact_id', id)` → `.contains('contact_ids', [id])`
