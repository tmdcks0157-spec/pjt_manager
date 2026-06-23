# Report: crm-contact-improve — 연락처 등록 개선

> 완료일: 2026-06-23
> Commit: `1ee7179`

---

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | crm-contact-improve |
| 완료일 | 2026-06-23 |
| Match Rate | **100%** |
| 변경 파일 | 2개 (`crm/page.tsx`, `ContactForm.tsx`) |
| 추가 코드 | +128줄 |

### Value Delivered

| 관점 | 내용 |
|------|------|
| **Problem** | 회사 패널에서 연락처 직접 추가 불가, 카드 뷰만 존재, 이름순 외 정렬 없음 |
| **Solution** | `defaultCompanyId` prop으로 회사 자동 선택, 카드/리스트 뷰 토글 + localStorage 유지, 이름·최신·회사순 정렬 |
| **Function UX Effect** | 회사 패널 → "추가" 클릭 → 해당 회사 자동 선택된 ContactForm 오픈, 리스트 뷰로 다수 연락처 한눈에 스캔, 정렬로 원하는 기준 즉시 전환 |
| **Core Value** | 연락처가 늘어도 2클릭 이내로 추가·탐색 가능한 CRM 효율 향상 |

---

## 1. 구현 내역

### 1.1 파일별 변경

| 파일 | 변경 유형 | 핵심 내용 |
|------|-----------|-----------|
| `src/app/(main)/crm/page.tsx` | 수정 (+125줄) | 상태 3개, sortedContacts, 정렬 select, 뷰 토글, 리스트 뷰 JSX, 회사 패널 추가 버튼 |
| `src/components/crm/ContactForm.tsx` | 수정 (+3줄) | `defaultCompanyId?: string` prop, 초기값 연결 |

### 1.2 기능별 구현 세부

#### ① 회사 패널 → 연락처 추가

```tsx
// 회사 패널 소속 연락처 헤더에 추가 버튼
<button onClick={() => {
  setCompanyForNewContact(selectedCompany.id)
  setSelectedCompany(null)   // 모달 겹침 방지
  setShowContactForm(true)
}}>
  <Plus size={12} /> 추가
</button>

// ContactForm 호출
<ContactForm
  defaultCompanyId={companyForNewContact}
  onClose={() => { setShowContactForm(false); setCompanyForNewContact('') }}
/>

// ContactForm 내부: 회사 자동 선택
const [companyId] = useState(contact?.company_id ?? defaultCompanyId ?? '')
```

#### ② 카드/리스트 뷰 토글

```tsx
const [viewMode, setViewMode] = useState<'card' | 'list'>(() =>
  localStorage.getItem('crm-view-mode') as 'card' | 'list' ?? 'card'
)
function toggleViewMode(mode: 'card' | 'list') {
  setViewMode(mode)
  localStorage.setItem('crm-view-mode', mode)
}
```

#### ③ 정렬 (sortedContacts)

```typescript
const sortedContacts = useMemo(() => {
  const arr = [...filteredContacts]
  if (sortBy === 'name')    return arr.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  if (sortBy === 'latest')  return arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (sortBy === 'company') return arr.sort((a, b) =>
    (a.company?.name ?? '￿').localeCompare(b.company?.name ?? '￿', 'ko')
  )
  return arr
}, [filteredContacts, sortBy])
```

---

## 2. Gap 분석 결과

| 구분 | 항목 수 | 결과 |
|------|---------|------|
| 설계 항목 총계 | 22개 | |
| 구현 완료 | 22개 | ✅ 100% |
| 미구현 | 0개 | |
| 설계 대비 조정 | 1개 | `next_action_date` 컬럼 제외 (Contact 타입 미존재 → 올바른 판단) |

---

## 3. 기술 품질

| 항목 | 결과 |
|------|------|
| TypeScript 에러 | 0개 |
| DB 마이그레이션 | 없음 (프론트엔드만) |
| 보안 영향 | 없음 |
| 기존 기능 영향 | 없음 (카드 뷰 기본값 유지) |

---

## 4. 학습 및 노트

- **모달 겹침 방지 패턴**: 회사 패널 닫기(`setSelectedCompany(null)`) → ContactForm 열기 순서가 중요. 동시에 두 모달이 열리면 UX 혼란.
- **localStorage 초기화 패턴**: `typeof window !== 'undefined'` 가드로 SSR 안전하게 처리.
- **한국어 정렬**: `localeCompare(b, 'ko')` 로케일 지정 필수 — 미지정 시 한글 정렬 불안정.
- **유니코드 정렬 트릭**: 회사 없는 연락처를 맨 뒤로 보낼 때 `'￿'` 사용 (모든 일반 문자보다 큰 코드포인트).

---

## 5. 다음 단계

| 우선순위 | 기능 | 문서 |
|----------|------|------|
| 계획됨 | 이슈기록 강화 (마크다운 노트) | `docs/01-plan/features/markdown-notes.plan.md` |
| 계획됨 | 완료 통계 시각화 | `docs/01-plan/features/completion-stats.plan.md` |
