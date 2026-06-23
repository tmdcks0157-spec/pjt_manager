# Design: assignee-search — 담당자 검색 + 미등록 담당자 입력

> Plan 참조: `docs/01-plan/features/assignee-search.plan.md`

---

## 1. 구현 범위 확정

| # | 항목 | 구현 여부 |
|---|------|-----------|
| 1 | `tasks.assignee_name` 컬럼 추가 (SQL) | ✅ |
| 2 | `Task` 타입 업데이트 | ✅ |
| 3 | `ContactCombobox.tsx` 신규 컴포넌트 | ✅ |
| 4 | `TaskModal.tsx` — select → Combobox 교체 | ✅ |
| 5 | `TaskCard.tsx` — assignee_name 뱃지 반영 | ✅ |

---

## 2. 아키텍처

```
[DB]
  tasks.assignee_name TEXT   ← 미등록 담당자 저장 (0004_assignee_name.sql)
  tasks.contact_id UUID      ← 기존 유지 (등록 연락처)

[Component]
  ContactCombobox.tsx        ← 신규 공용 컴포넌트
    props: contacts, contactId, assigneeName, onChange
    내부 상태: inputValue, isOpen, filtered

  TaskModal.tsx              ← select 제거, ContactCombobox 삽입
  TaskCard.tsx               ← assignee_name 뱃지 조건 추가
  src/types/index.ts         ← Task.assignee_name 추가
```

---

## 3. 상세 설계

### 3-1. `supabase/migrations/0004_assignee_name.sql`

```sql
-- tasks 테이블에 자유 입력 담당자 컬럼 추가
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assignee_name TEXT;

-- 검증
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'tasks' AND column_name = 'assignee_name';
```

---

### 3-2. `src/types/index.ts`

`Task` 인터페이스에 한 줄 추가 (line 41 이후):

```typescript
// 변경 전
  contact_id?: string | null

// 변경 후
  contact_id?: string | null
  assignee_name?: string | null
```

---

### 3-3. `src/components/ui/ContactCombobox.tsx` (신규)

**Props:**
```typescript
interface Props {
  contacts: Contact[]
  contactId: string        // 선택된 등록 연락처 ID
  assigneeName: string     // 자유 입력 담당자 이름
  onChange: (contactId: string, assigneeName: string) => void
}
```

**동작 로직:**
```
초기값 표시:
  - contactId 있으면 → contacts에서 이름 찾아 input에 표시
  - assigneeName 있으면 → 그대로 input에 표시
  - 둘 다 없으면 → 빈 input

입력 중:
  - contacts를 name/company.name/role로 필터링
  - 드롭다운에 최대 8개 표시

등록 연락처 클릭:
  - inputValue = 선택된 연락처 이름
  - onChange(contact.id, '')  ← contact_id 저장, assignee_name 비움
  - 드롭다운 닫기

바깥 클릭 / blur:
  - 현재 inputValue가 contacts 중 하나와 일치 → contact_id 유지
  - 일치 안 하면 → onChange('', inputValue)  ← assignee_name으로 저장
  - 드롭다운 닫기

X 버튼 클릭:
  - inputValue = ''
  - onChange('', '')  ← 둘 다 초기화
```

**컴포넌트 구조:**
```tsx
<div className="relative">
  <div className="flex items-center border rounded-xl ...">
    <UserIcon />
    <input
      value={inputValue}
      onChange={handleInput}
      onFocus={() => setIsOpen(true)}
      onBlur={handleBlur}
      placeholder="담당자 검색 또는 직접 입력..."
    />
    {inputValue && <X onClick={handleClear} />}
  </div>

  {isOpen && filtered.length > 0 && (
    <ul className="absolute z-10 w-full bg-white border rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
      {filtered.map(contact => (
        <li key={contact.id} onMouseDown={() => handleSelect(contact)}>
          <span className="font-medium">{contact.name}</span>
          {contact.company && <span className="text-gray-400"> · {contact.company.name}</span>}
          {contact.role && <span className="text-gray-400"> ({contact.role})</span>}
        </li>
      ))}
    </ul>
  )}
</div>
```

> `onMouseDown` 사용 이유: `onBlur`보다 먼저 발생해야 선택이 정상 처리됨

---

### 3-4. `src/components/kanban/TaskModal.tsx`

**상태 변경:**
```typescript
// 추가
const [assigneeName, setAssigneeName] = useState(task.assignee_name ?? '')

// 기존 유지
const [contactId, setContactId] = useState<string>(task.contact_id ?? '')
```

**handleSave 변경:**
```typescript
// 변경 전
contact_id: contactId || null,

// 변경 후
contact_id:    contactId || null,
assignee_name: contactId ? null : (assigneeName.trim() || null),
```

**JSX 변경 (line 222-238):**
```tsx
// 변경 전
{contacts.length > 0 && (
  <div className="space-y-1.5">
    <p className="text-xs font-medium text-gray-400">연락처</p>
    <select value={contactId} onChange={e => setContactId(e.target.value)}>
      ...
    </select>
  </div>
)}

// 변경 후
<div className="space-y-1.5">
  <p className="text-xs font-medium text-gray-400 dark:text-gray-500">담당자</p>
  <ContactCombobox
    contacts={contacts}
    contactId={contactId}
    assigneeName={assigneeName}
    onChange={(cid, name) => { setContactId(cid); setAssigneeName(name) }}
  />
</div>
```

> 기존: `contacts.length > 0`일 때만 표시 → 변경 후: 항상 표시 (직접 입력 가능하므로)

---

### 3-5. `src/components/kanban/TaskCard.tsx`

**담당자 뱃지 변경 (line 166-171):**
```tsx
// 변경 전
{task.contact_id && contactsMap[task.contact_id] && (
  <span className="... teal badge">
    <Users size={9} />
    {contactsMap[task.contact_id].name}
  </span>
)}

// 변경 후
{(task.contact_id && contactsMap[task.contact_id] || task.assignee_name) && (
  <span className="... teal badge">
    <Users size={9} />
    {task.contact_id && contactsMap[task.contact_id]
      ? contactsMap[task.contact_id].name
      : task.assignee_name}
  </span>
)}
```

---

## 4. 파일별 변경 요약

| 파일 | 유형 | 변경 규모 |
|------|------|-----------|
| `supabase/migrations/0004_assignee_name.sql` | 신규 | 2줄 |
| `src/types/index.ts` | 수정 | +1줄 |
| `src/components/ui/ContactCombobox.tsx` | 신규 | ~80줄 |
| `src/components/kanban/TaskModal.tsx` | 수정 | ~15줄 변경 |
| `src/components/kanban/TaskCard.tsx` | 수정 | ~5줄 변경 |

---

## 5. 구현 순서 (Do Phase)

```
1. SQL
   └─ 0004_assignee_name.sql 작성
   └─ Supabase SQL Editor 실행

2. 타입
   └─ src/types/index.ts — assignee_name 추가

3. 컴포넌트
   └─ src/components/ui/ContactCombobox.tsx 신규 작성

4. TaskModal
   └─ assigneeName 상태 추가
   └─ select → ContactCombobox 교체
   └─ handleSave assignee_name 저장 로직

5. TaskCard
   └─ 담당자 뱃지 조건 수정

6. 확인
   └─ 등록 연락처 검색·선택 → contact_id 저장
   └─ 미등록 이름 입력 → assignee_name 저장
   └─ 카드 뱃지 양쪽 모두 표시 확인
```

---

## 6. 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| 입력창 클릭 | 전체 연락처 드롭다운 표시 |
| "김" 입력 | "김" 포함된 연락처만 필터링 |
| 등록 연락처 선택 | 카드에 teal 뱃지 + 이름 표시 |
| "외부담당자" 입력 후 저장 | 카드에 teal 뱃지 + "외부담당자" 표시 |
| X 버튼 클릭 | 뱃지 사라짐, 둘 다 null |
| 연락처 0개일 때 | 드롭다운 없이 자유 입력만 가능 |
