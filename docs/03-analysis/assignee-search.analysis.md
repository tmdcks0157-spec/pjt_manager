# Gap Analysis: assignee-search

> 분석일: 2026-06-23
> Design 문서: `docs/02-design/features/assignee-search.design.md`

---

## Match Rate: 100% ✅

---

## 항목별 검증

### 1. `supabase/migrations/0004_assignee_name.sql`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `tasks.assignee_name TEXT` 컬럼 추가 | ✅ | `IF NOT EXISTS`로 idempotent |
| Supabase DB 실제 적용 | ✅ | SQL Editor 성공 확인 |

### 2. `src/types/index.ts`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `Task.assignee_name?: string \| null` 추가 | ✅ | contact_id 바로 아래 추가 |

### 3. `src/components/ui/ContactCombobox.tsx` (신규)

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| contacts/contactId/assigneeName/onChange props | ✅ | |
| 입력창 클릭 시 전체 드롭다운 표시 | ✅ | `onFocus → setIsOpen(true)` |
| 텍스트 입력 시 name/company/role 필터링 | ✅ | `toLowerCase` 포함 검색 |
| 최대 8개 표시 | ✅ | `filtered.slice(0, 8)` |
| 등록 연락처 선택 → `onChange(contact.id, '')` | ✅ | `onMouseDown`으로 blur 전 처리 |
| blur 시 자유 입력값 → `onChange('', val)` | ✅ | 150ms delay + commitFreeText |
| X 버튼 → `onChange('', '')` 초기화 | ✅ | `onMouseDown` 처리 |
| contactId 로드 후 이름 동기화 (useEffect) | ✅ | contacts 변경 시 재동기화 |

### 4. `src/components/kanban/TaskModal.tsx`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `assigneeName` 상태 추가 | ✅ | `task.assignee_name ?? ''` 초기값 |
| ContactCombobox import | ✅ | |
| select → ContactCombobox 교체 | ✅ | |
| `contacts.length > 0` 조건 제거 (항상 표시) | ✅ | |
| 라벨 "연락처" → "담당자" 변경 | ✅ | |
| handleSave: `contact_id` 저장 | ✅ | `contactId \|\| null` |
| handleSave: `assignee_name` 저장 | ✅ | `contactId ? null : assigneeName.trim() \|\| null` |

### 5. `src/components/kanban/TaskCard.tsx`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `contact_id` 있을 때 이름 표시 | ✅ | `contactsMap[task.contact_id].name` |
| `assignee_name` 있을 때 이름 표시 | ✅ | `task.assignee_name` |
| 둘 다 없으면 뱃지 미표시 | ✅ | 조건부 렌더링 |

---

## 테스트 시나리오 점검

| 시나리오 | 기대값 | 구현 상태 |
|----------|--------|-----------|
| 입력창 클릭 | 전체 연락처 드롭다운 | ✅ |
| "김" 입력 | 김 포함 연락처 필터 | ✅ |
| 등록 연락처 선택 | contact_id 저장, 카드 뱃지 표시 | ✅ |
| "외부담당자" 자유 입력 저장 | assignee_name 저장, 카드 뱃지 표시 | ✅ |
| X 버튼 | 둘 다 null, 뱃지 사라짐 | ✅ |
| 연락처 0개일 때 | 자유 입력만 가능 | ✅ |
| TypeScript 타입 에러 | 없음 | ✅ |

---

## Gap 없음 — Match Rate 100%
