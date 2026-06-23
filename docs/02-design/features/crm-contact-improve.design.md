# Design: crm-contact-improve — 연락처 등록 개선

> Plan 참조: `docs/01-plan/features/crm-contact-improve.plan.md`

---

## 1. 구현 범위 확정

| # | 항목 | 구현 여부 |
|---|------|-----------|
| 1 | 회사 패널 → 연락처 추가 버튼 | ✅ |
| 2 | ContactForm `defaultCompanyId` prop | ✅ |
| 3 | 카드/리스트 뷰 토글 (localStorage 유지) | ✅ |
| 4 | 이름·최신·회사순 정렬 드롭다운 | ✅ |
| 5 | 리스트 뷰 행 UI | ✅ |

> DB 변경 없음

---

## 2. 아키텍처

```
src/app/(main)/crm/page.tsx
  ├── 상태 추가: viewMode, sortBy, companyForNewContact
  ├── sortedContacts (useMemo) — filteredContacts + 정렬
  ├── 검색바 우측: 정렬 select + 뷰 토글 버튼
  ├── contacts 탭: viewMode에 따라 카드/리스트 분기
  ├── 회사 패널 소속연락처 헤더: "+" 버튼 추가
  └── ContactForm에 defaultCompanyId 전달

src/components/crm/ContactForm.tsx
  └── defaultCompanyId?: string prop 추가
      companyId 초기값: contact?.company_id ?? defaultCompanyId ?? ''
```

---

## 3. 상세 설계

### 3-1. 상태 추가 (`crm/page.tsx`)

```typescript
// 뷰 모드 — localStorage에서 초기값 읽기
const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
  (typeof window !== 'undefined'
    ? (localStorage.getItem('crm-view-mode') as 'card' | 'list')
    : null) ?? 'card'
)

// 정렬 기준
const [sortBy, setSortBy] = useState<'name' | 'latest' | 'company'>('name')

// 회사 패널에서 연락처 추가 시 pre-fill용
const [companyForNewContact, setCompanyForNewContact] = useState('')
```

뷰 모드 변경 시 localStorage 저장:
```typescript
function toggleViewMode(mode: 'card' | 'list') {
  setViewMode(mode)
  localStorage.setItem('crm-view-mode', mode)
}
```

---

### 3-2. `sortedContacts` (useMemo)

`filteredContacts` 이후 정렬 적용:

```typescript
const sortedContacts = useMemo(() => {
  const arr = [...filteredContacts]
  if (sortBy === 'name')
    return arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  if (sortBy === 'latest')
    return arr.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
  if (sortBy === 'company') {
    return arr.sort((a, b) => {
      const ca = a.company?.name ?? '￿'  // 회사 없으면 맨 뒤
      const cb = b.company?.name ?? '￿'
      return ca.localeCompare(cb, 'ko')
    })
  }
  return arr
}, [filteredContacts, sortBy])
```

---

### 3-3. 검색바 우측 UI (정렬 + 뷰 토글)

현재 검색바 (line 203-211):
```tsx
<div className="relative flex-1 max-w-xs">
  <Search ... />
  <input ... />
</div>
```

변경 후 — 검색바 오른쪽에 추가:
```tsx
{/* 정렬 */}
{tab === 'contacts' && (
  <select
    value={sortBy}
    onChange={e => setSortBy(e.target.value as typeof sortBy)}
    className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none"
  >
    <option value="name">이름순</option>
    <option value="latest">최신순</option>
    <option value="company">회사순</option>
  </select>
)}

{/* 뷰 토글 */}
{tab === 'contacts' && (
  <div className="flex border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
    <button
      onClick={() => toggleViewMode('card')}
      className={cn('p-2 transition-colors',
        viewMode === 'card'
          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600'
      )}
    >
      <LayoutGrid size={14} />
    </button>
    <button
      onClick={() => toggleViewMode('list')}
      className={cn('p-2 transition-colors',
        viewMode === 'list'
          ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
          : 'bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-600'
      )}
    >
      <List size={14} />
    </button>
  </div>
)}
```

---

### 3-4. contacts 탭 렌더링 분기

현재 (line 229-231):
```tsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {filteredContacts.map(c => <ContactCard key={c.id} contact={c} ... />)}
</div>
```

변경 후:
```tsx
{viewMode === 'card' ? (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {sortedContacts.map(c => <ContactCard key={c.id} contact={c} taskCount={taskCountMap[c.id] ?? 0} />)}
  </div>
) : (
  <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
    {sortedContacts.map((c, i) => (
      <Link
        key={c.id}
        href={`/crm/contacts/${c.id}`}
        className={cn(
          'flex items-center gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
          i !== 0 && 'border-t border-gray-100 dark:border-gray-800'
        )}
      >
        {/* 이름 + 회사·직함 */}
        <div className="w-40 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {[c.company?.name, c.role].filter(Boolean).join(' · ') || '개인'}
          </p>
        </div>
        {/* 이메일 */}
        <div className="flex-1 min-w-0">
          {c.email && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {maskEmail(c.email)}
            </span>
          )}
        </div>
        {/* 전화번호 */}
        <div className="w-32 min-w-0">
          {c.phones?.[0] && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {maskPhone(c.phones[0])}
            </span>
          )}
        </div>
        {/* 태그 */}
        <div className="flex gap-1 flex-wrap w-28">
          {c.tags.slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full">
              {tag}
            </span>
          ))}
        </div>
        {/* 다음 액션 */}
        <div className="w-24 text-right shrink-0">
          {c.next_action_date && (
            <span className="text-[10px] text-orange-500 font-medium">
              {new Date(c.next_action_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <ChevronRight size={13} className="text-gray-300 shrink-0" />
      </Link>
    ))}
  </div>
)}
```

---

### 3-5. 회사 패널 "연락처 추가" 버튼

현재 (line 325-326):
```tsx
<h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
  소속 연락처 ({contacts.filter(c => c.company_id === selectedCompany.id).length}명)
</h3>
```

변경 후:
```tsx
<div className="flex items-center justify-between mb-3">
  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
    소속 연락처 ({contacts.filter(c => c.company_id === selectedCompany.id).length}명)
  </h3>
  <button
    onClick={() => {
      setCompanyForNewContact(selectedCompany.id)
      setSelectedCompany(null)
      setShowContactForm(true)
    }}
    className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
  >
    <Plus size={12} /> 추가
  </button>
</div>
```

---

### 3-6. ContactForm 호출부 변경 + onClose 초기화

```tsx
{showContactForm && (
  <ContactForm
    companies={companies}
    defaultCompanyId={companyForNewContact}
    onClose={() => {
      setShowContactForm(false)
      setCompanyForNewContact('')
    }}
  />
)}
```

---

### 3-7. `src/components/crm/ContactForm.tsx`

Props 변경:
```typescript
// 변경 전
interface Props {
  companies: Company[]
  contact?: Contact
  onClose: () => void
}

// 변경 후
interface Props {
  companies: Company[]
  contact?: Contact
  defaultCompanyId?: string
  onClose: () => void
}
```

초기값 변경:
```typescript
// 변경 전
const [companyId, setCompanyId] = useState(contact?.company_id ?? '')

// 변경 후
const [companyId, setCompanyId] = useState(contact?.company_id ?? defaultCompanyId ?? '')
```

---

## 4. import 추가 (`crm/page.tsx`)

```typescript
import { LayoutGrid, List } from 'lucide-react'  // 뷰 토글 아이콘
import { maskEmail, maskPhone } from '@/lib/mask'  // 리스트 뷰 마스킹
```

---

## 5. 파일별 변경 요약

| 파일 | 변경 규모 | 핵심 내용 |
|------|-----------|-----------|
| `src/app/(main)/crm/page.tsx` | ~60줄 추가/수정 | 상태 3개, sortedContacts, 정렬 select, 뷰 토글, 리스트 뷰 JSX, 회사 패널 추가 버튼 |
| `src/components/crm/ContactForm.tsx` | 3줄 수정 | `defaultCompanyId` prop + 초기값 |

---

## 6. 구현 순서

```
1. ContactForm — defaultCompanyId prop 추가 (3줄)
2. crm/page.tsx
   a. import 추가 (LayoutGrid, List, maskEmail, maskPhone)
   b. 상태 3개 추가 (viewMode, sortBy, companyForNewContact)
   c. sortedContacts useMemo 추가
   d. 검색바 우측 정렬 select + 뷰 토글 버튼 삽입
   e. contacts 탭 렌더링 viewMode 분기
   f. filteredContacts → sortedContacts 교체
   g. 회사 패널 "추가" 버튼 삽입
   h. ContactForm defaultCompanyId/onClose 업데이트
```

---

## 7. 테스트 시나리오

| 시나리오 | 기대 결과 |
|----------|-----------|
| 회사 패널 → "추가" 클릭 | ContactForm 오픈, 해당 회사 자동 선택 |
| 정렬: 이름순 | 가나다 오름차순 |
| 정렬: 최신순 | 최근 등록 연락처 상단 |
| 정렬: 회사순 | 회사명 가나다순, 개인은 맨 아래 |
| 리스트 뷰 클릭 | 한 줄 테이블 형태 표시 |
| 새로고침 후 뷰 모드 | localStorage에서 복원 |
| 리스트 뷰 마스킹 | 이메일·전화번호 마스킹 적용 |
