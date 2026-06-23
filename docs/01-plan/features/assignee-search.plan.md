# Plan: assignee-search — 담당자 검색 + 미등록 담당자 입력

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | TaskModal의 연락처 연결이 `<select>` 드롭다운이라 연락처가 많을 때 스크롤로 찾아야 하고, CRM에 등록되지 않은 외부인을 담당자로 지정할 수 없다 |
| **Solution** | `<select>` → 검색 가능한 Combobox로 교체, DB에 `assignee_name` 컬럼 추가해 미등록 담당자 자유 입력 지원 |
| **Function UX Effect** | 이름 2~3자 입력 시 즉시 필터링, 등록된 연락처 없으면 자유 입력값 그대로 저장 — 드롭다운 스크롤 제거 |
| **Core Value** | CRM 등록 여부와 무관하게 모든 협업 상황에서 담당자를 빠르게 지정 가능 |

---

## 1. 현황 분석

### 현재 구현 (TaskModal.tsx:225-238)

```tsx
// 문제: 드롭다운, 검색 없음, 등록된 연락처만 선택 가능
{contacts.length > 0 && (
  <select value={contactId} onChange={e => setContactId(e.target.value)}>
    <option value="">연결 안 함</option>
    {contacts.map(c => (
      <option key={c.id} value={c.id}>
        {c.name}{c.company ? ` · ${c.company.name}` : ''}
      </option>
    ))}
  </select>
)}
```

### DB 현재 상태

```sql
tasks 테이블:
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL  ← 등록된 연락처만
  -- assignee_name 컬럼 없음 ← 미등록 담당자 저장 불가
```

---

## 2. 기능 범위

### 2.1 Combobox 동작 방식

| 상황 | 동작 |
|------|------|
| 입력창 클릭 | 전체 연락처 드롭다운 표시 |
| 텍스트 입력 | 이름/회사/역할 실시간 필터링 |
| 등록 연락처 선택 | `contact_id` 저장, `assignee_name` null |
| 미등록 이름 입력 후 저장 | `assignee_name` 저장, `contact_id` null |
| 선택 취소 (X 버튼) | 둘 다 null |

### 2.2 DB 변경

```sql
ALTER TABLE tasks ADD COLUMN assignee_name TEXT;
-- 저장 로직: contact_id 있으면 assignee_name null, 없으면 assignee_name 저장
```

### 2.3 TaskCard 표시

| 항목 | 현재 | 변경 후 |
|------|------|---------|
| 담당자 뱃지 | contact_id 있을 때만 이름 표시 | contact_id 또는 assignee_name 있으면 표시 |

---

## 3. 파일 변경 목록

| 파일 | 유형 | 내용 |
|------|------|------|
| `supabase/migrations/0004_assignee_name.sql` | 신규 | `tasks.assignee_name` 컬럼 추가 |
| `src/components/ui/ContactCombobox.tsx` | 신규 | 검색 가능한 연락처 선택 컴포넌트 |
| `src/components/kanban/TaskModal.tsx` | 수정 | select → ContactCombobox 교체, assignee_name 상태 추가 |
| `src/components/kanban/TaskCard.tsx` | 수정 | assignee_name 표시 추가 |
| `src/types/index.ts` | 수정 | Task 타입에 `assignee_name?: string` 추가 |

---

## 4. 구현 순서

| 순서 | 작업 |
|------|------|
| 1 | `0004_assignee_name.sql` 작성 + Supabase 적용 |
| 2 | `Task` 타입에 `assignee_name` 추가 |
| 3 | `ContactCombobox.tsx` 컴포넌트 구현 |
| 4 | `TaskModal.tsx` — select 제거, Combobox 적용, assignee_name 상태/저장 추가 |
| 5 | `TaskCard.tsx` — 담당자 뱃지에 assignee_name 반영 |

---

## 5. 미포함 범위

- 여러 명 담당자 (다중 선택) — 현재 단일 담당자만
- 담당자 별 태스크 필터 (칸반 보기)
- 외부 라이브러리 미사용 (cmdk, headlessui) — 직접 구현으로 의존성 최소화
