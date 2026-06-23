# Gap Analysis: crm-contact-improve

> 분석일: 2026-06-23
> Design 문서: `docs/02-design/features/crm-contact-improve.design.md`

---

## Match Rate: 100% ✅

---

## 항목별 검증

### 1. `src/components/crm/ContactForm.tsx`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `defaultCompanyId?: string` prop 추가 | ✅ | Props interface에 추가 |
| `companyId` 초기값 `contact?.company_id ?? defaultCompanyId ?? ''` | ✅ | 우선순위: 기존 contact > defaultCompanyId > 빈값 |

### 2. `src/app/(main)/crm/page.tsx` — 상태

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `viewMode` 상태 (`'card' \| 'list'`) | ✅ | localStorage 초기값 읽기 포함 |
| `sortBy` 상태 (`'name' \| 'latest' \| 'company'`) | ✅ | 기본값 `'name'` |
| `companyForNewContact` 상태 (`string`) | ✅ | 회사 패널 추가 버튼용 |
| `toggleViewMode(mode)` 함수 | ✅ | setState + localStorage.setItem 동시 처리 |

### 3. `src/app/(main)/crm/page.tsx` — `sortedContacts`

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `filteredContacts` 기반 useMemo | ✅ | |
| 이름순: `localeCompare('ko')` 오름차순 | ✅ | |
| 최신순: `created_at` 내림차순 | ✅ | |
| 회사순: `company?.name`, 없으면 `'￿'` (맨 뒤) | ✅ | U+FFFD 활용 |

### 4. `src/app/(main)/crm/page.tsx` — 검색바 UI

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| 정렬 `<select>` — 이름순/최신순/회사순 | ✅ | `contacts` 탭에서만 표시 |
| 뷰 토글 버튼 그룹 (LayoutGrid / List) | ✅ | `contacts` 탭에서만 표시 |
| 선택된 뷰 모드 강조 스타일 | ✅ | dark/light 모두 지원 |

### 5. `src/app/(main)/crm/page.tsx` — contacts 탭 렌더링

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `filteredContacts` → `sortedContacts` 교체 | ✅ | |
| `viewMode === 'card'` → 기존 카드 그리드 | ✅ | |
| `viewMode === 'list'` → 리스트 뷰 | ✅ | |
| 리스트 뷰: 이름 + 회사·직함 | ✅ | `join(' · ')`, 없으면 '개인' |
| 리스트 뷰: 이메일 마스킹 (`maskEmail`) | ✅ | |
| 리스트 뷰: 전화번호 마스킹 (`maskPhone`) | ✅ | `phones?.[0]` |
| 리스트 뷰: 태그 최대 2개 | ✅ | `tags.slice(0, 2)` |
| 리스트 뷰: 구분선 (border-t, 첫 항목 제외) | ✅ | `i !== 0 &&` 조건 |
| 리스트 뷰: 클릭 시 상세 페이지 이동 (`Link`) | ✅ | |

### 6. `src/app/(main)/crm/page.tsx` — 회사 패널

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| "소속 연락처" 헤더를 flex justify-between으로 변경 | ✅ | |
| "추가" 버튼 우측 배치 | ✅ | blue 텍스트 버튼 |
| 클릭 시: `setCompanyForNewContact(selectedCompany.id)` | ✅ | |
| 클릭 시: `setSelectedCompany(null)` (모달 닫기) | ✅ | 두 모달 겹침 방지 |
| 클릭 시: `setShowContactForm(true)` | ✅ | |

### 7. `src/app/(main)/crm/page.tsx` — ContactForm 호출부

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `defaultCompanyId={companyForNewContact}` 전달 | ✅ | |
| `onClose`에서 `setCompanyForNewContact('')` 초기화 | ✅ | |

### 8. import 추가

| 설계 항목 | 구현 여부 | 비고 |
|-----------|-----------|------|
| `LayoutGrid, List` from lucide-react | ✅ | 기존 import에 추가 |
| `maskEmail, maskPhone` from `@/lib/mask` | ✅ | 이미 import 존재 |

---

## 설계 대비 변경 사항 (Gap 아님)

| 항목 | 설계 | 실제 | 판단 |
|------|------|------|------|
| 리스트 뷰 `next_action_date` 컬럼 | 포함 | 제외 | ✅ 올바른 판단 — `Contact` 타입에 해당 필드 없음, TypeScript 에러 예방 |

---

## TypeScript 검증

```
npx tsc --noEmit → 에러 0개
```

---

## 테스트 시나리오 점검

| 시나리오 | 기대값 | 구현 상태 |
|----------|--------|-----------|
| 회사 패널 → "추가" 클릭 | ContactForm 오픈, 해당 회사 자동 선택 | ✅ |
| 정렬: 이름순 | 가나다 오름차순 | ✅ |
| 정렬: 최신순 | 최근 등록 연락처 상단 | ✅ |
| 정렬: 회사순 | 회사명 가나다순, 개인은 맨 아래 | ✅ |
| 리스트 뷰 토글 클릭 | 한 줄 테이블 형태 표시 | ✅ |
| 새로고침 후 뷰 모드 | localStorage에서 복원 | ✅ |
| 리스트 뷰 이메일/전화번호 | 마스킹 적용 | ✅ |
| companies 탭에서 정렬/토글 표시 여부 | 미표시 (contacts 탭에서만) | ✅ |
| TypeScript 에러 | 없음 | ✅ |

---

## Gap 없음 — Match Rate 100%
