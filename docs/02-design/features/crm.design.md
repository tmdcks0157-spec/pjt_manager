# Design: CRM — 연락처 & 활동 관리

> Plan: `docs/01-plan/features/crm.plan.md`

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 연락한 사람들의 정보와 대화 이력이 여러 앱에 흩어져 "이 사람이랑 언제 뭘 얘기했더라"를 매번 뒤져야 한다 |
| **Solution** | 기존 앱에 `/crm` 섹션 추가 — contacts/companies/activities 테이블 + 기존 posts·tasks 재활용 |
| **Function UX Effect** | 연락처 상세 한 곳에서 기본 정보·활동 타임라인·메모 게시판·칸반 태스크 조회, Today 페이지 "연락할 것" 알림 |
| **Core Value** | 사람 중심으로 업무를 기억하는 도구 — 관계와 기록에만 집중 |

---

## 1. 파일 구조

### 신규 생성

```
src/
  app/
    (main)/
      crm/
        page.tsx                      ← 연락처 목록 ([사람] / [회사] 탭)
        contacts/
          [id]/
            page.tsx                  ← 연락처 상세 (탭 3개)
  hooks/
    useCRM.ts                         ← companies, contacts CRUD 훅
    useActivities.ts                  ← activities CRUD 훅
  components/
    crm/
      ContactCard.tsx                 ← 연락처 카드 (목록용)
      CompanyCard.tsx                 ← 회사 카드 (목록용)
      ContactForm.tsx                 ← 연락처 등록/수정 폼 (모달)
      CompanyForm.tsx                 ← 회사 등록/수정 폼 (모달)
      ActivityForm.tsx                ← 활동 기록 추가 폼 (인라인)
      ActivityTimeline.tsx            ← 활동 타임라인 컴포넌트
      NextActionBanner.tsx            ← 다음 액션 배너 (연락처 상세 헤더)
      TagBadge.tsx                    ← 태그 뱃지 컴포넌트
```

### 수정 대상

```
src/
  app/
    (main)/
      layout.tsx                      ← NAV_ITEMS에 /crm 추가
      today/page.tsx                  ← "연락할 것" 섹션 추가
  types/
    index.ts                          ← Company, Contact, Activity 타입 추가
```

---

## 2. DB 스키마 (Supabase SQL)

### 2.1 새 테이블 생성

```sql
-- 회사
CREATE TABLE companies (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  name        text NOT NULL,
  industry    text,
  website     text,
  phone       text,
  notes       text,
  tags        text[] DEFAULT '{}',
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_companies" ON companies
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 연락처 (사람)
CREATE TABLE contacts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users NOT NULL,
  company_id        uuid REFERENCES companies(id) ON DELETE SET NULL,
  name              text NOT NULL,
  email             text,
  phone             text,
  role              text,
  notes             text,
  tags              text[] DEFAULT '{}',
  next_action_date  date,
  next_action_note  text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_contacts" ON contacts
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 활동 기록
CREATE TABLE activities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  contact_id    uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  type          text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note')),
  title         text NOT NULL,
  body          text,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_activities" ON activities
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 2.2 기존 테이블 컬럼 추가

```sql
-- posts에 contact_id 추가 (이슈&기록 → 연락처 연결)
ALTER TABLE posts ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- tasks에 contact_id 추가 (칸반 태스크 → 연락처 연결)
ALTER TABLE tasks ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
```

---

## 3. TypeScript 타입 (`src/types/index.ts` 추가)

```typescript
export interface Company {
  id: string
  user_id: string
  name: string
  industry: string | null
  website: string | null
  phone: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  user_id: string
  company_id: string | null
  company?: Company            // join용
  name: string
  email: string | null
  phone: string | null
  role: string | null
  notes: string | null
  tags: string[]
  next_action_date: string | null
  next_action_note: string | null
  created_at: string
  updated_at: string
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'note'

export interface Activity {
  id: string
  user_id: string
  contact_id: string
  type: ActivityType
  title: string
  body: string | null
  activity_date: string
  created_at: string
}
```

---

## 4. React Query 훅

### 4.1 `src/hooks/useCRM.ts`

```typescript
// 연락처 목록 (사람 탭)
useContacts()
  queryKey: ['contacts']
  select: contacts + companies join

// 회사 목록 (회사 탭, 하위 contacts 포함)
useCompanies()
  queryKey: ['companies']

// 연락처 상세
useContact(id: string)
  queryKey: ['contacts', id]

// 연락처 CRUD
useCreateContact()
useUpdateContact()
useDeleteContact()

// 회사 CRUD
useCreateCompany()
useUpdateCompany()
useDeleteCompany()

// Today 페이지용 — 다음 액션 기한 지난 연락처
useOverdueNextActions()
  queryKey: ['contacts', 'overdue-actions']
  filter: next_action_date <= today
```

### 4.2 `src/hooks/useActivities.ts`

```typescript
// 연락처별 활동 목록
useActivities(contactId: string)
  queryKey: ['activities', contactId]
  order: activity_date DESC

// 활동 CRUD
useCreateActivity()
useUpdateActivity()
useDeleteActivity()
```

---

## 5. 페이지 설계

### 5.1 `/crm` — 연락처 목록 페이지

```
┌──────────────────────────────────────────────────────┐
│ 연락처                              [+ 새 연락처]      │
│                                                      │
│ [사람]  [회사]          🔍 검색...                    │
│ ─────────────────────────────────────────────────── │
│                                                      │
│  [사람 탭]                                           │
│  ┌────────────────────────────┐                      │
│  │ 김철수                      │                      │
│  │ 삼성전자 · 개발팀장           │                      │
│  │ [VIP] [기술]               │                      │
│  │ 마지막 활동: 3일 전 · 통화   │                      │
│  │ 다음 액션: D+1 견적 재검토  │  ← 기한 초과 시 빨간색 │
│  └────────────────────────────┘                      │
│  ┌────────────────────────────┐                      │
│  │ 이영희                      │                      │
│  │ 개인 · 프리랜서 디자이너     │                      │
│  │ [디자인]                   │                      │
│  │ 마지막 활동: 1주 전 · 미팅  │                      │
│  └────────────────────────────┘                      │
└──────────────────────────────────────────────────────┘
```

**컴포넌트 구조:**
```tsx
<CRMPage>
  <PageHeader title="연락처" action={<NewContactButton />} />
  <TabBar tabs={['사람', '회사']} />
  <SearchInput />
  {tab === '사람' && <ContactList contacts={filteredContacts} />}
  {tab === '회사' && <CompanyList companies={filteredCompanies} />}
  <ContactFormModal />
  <CompanyFormModal />
</CRMPage>
```

---

### 5.2 `/crm/contacts/[id]` — 연락처 상세

```
┌──────────────────────────────────────────────────────┐
│ ← 뒤로                                    [편집] [삭제]│
│                                                      │
│  김철수                                               │
│  삼성전자 · 개발팀장                                   │
│  📧 kim@samsung.com  📞 010-1234-5678                │
│  [VIP] [기술] [재계약]                                │
│                                                      │
│  ⏰ 다음 액션 — 2026-06-25                            │
│  "견적 재검토 미팅 잡기"        [완료] [편집]           │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ [활동 타임라인]  [이슈 & 기록]  [연결된 태스크]          │
│ ─────────────────────────────────────────────────── │
│                                                      │
│  [활동 타임라인 탭]                                    │
│  [+ 활동 추가]  📞통화 · 📧이메일 · 🤝미팅 · 📝메모    │
│                                                      │
│  2026-03-28  📞 통화                                  │
│  "예산 확인, 4월 초 재미팅 예정"                       │
│  ─────────────────────────────                      │
│  2026-03-20  📧 이메일                               │
│  "제안서 발송 완료"                                   │
└──────────────────────────────────────────────────────┘
```

**컴포넌트 구조:**
```tsx
<ContactDetailPage>
  <ContactHeader contact={contact} />        {/* 이름, 회사, 연락처, 태그 */}
  <NextActionBanner contact={contact} />     {/* 다음 액션 표시/편집 */}
  <TabBar tabs={['활동 타임라인', '이슈 & 기록', '연결된 태스크']} />

  {tab === '활동' && (
    <ActivityTab>
      <ActivityQuickAdd contactId={id} />    {/* 인라인 빠른 추가 */}
      <ActivityTimeline activities={activities} />
    </ActivityTab>
  )}
  {tab === '이슈' && (
    <PostsTab contactId={id} />             {/* 기존 posts 필터링 */}
  )}
  {tab === '태스크' && (
    <TasksTab contactId={id} />             {/* 기존 tasks 필터링 */}
  )}
</ContactDetailPage>
```

---

### 5.3 활동 빠른 추가 UI

```
[📞 통화]  [📧 이메일]  [🤝 미팅]  [📝 메모]
         ↓ 클릭 시 인라인 폼 펼침
┌─────────────────────────────────────────┐
│ 제목: [통화 - _____________________]    │
│ 날짜: [2026-06-20]  ← 오늘 기본값       │
│ 내용:                                   │
│ [___________________________________]  │
│ [___________________________________]  │
│                         [취소] [저장]   │
└─────────────────────────────────────────┘
```

---

## 6. 사이드바 메뉴 수정 (`layout.tsx`)

```typescript
// NAV_ITEMS에 추가
import { Users } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/today',     label: '오늘',       icon: Sun },
  { href: '/dashboard', label: '프로젝트',   icon: LayoutDashboard },
  { href: '/crm',       label: '연락처',     icon: Users },          // ← 추가
  { href: '/overview',  label: '전체 현황',  icon: LayoutGrid },
  { href: '/calendar',  label: '캘린더',     icon: Calendar },
  { href: '/report',    label: '주간 리포트', icon: BarChart2 },
]

// isActive 조건 (crm 하위 경로 포함)
const isCRM = href === '/crm' && (pathname === '/crm' || pathname.startsWith('/crm/'))
```

---

## 7. Today 페이지 "연락할 것" 섹션

```typescript
// today/page.tsx 추가 데이터
const { data: overdueActions = [] } = useOverdueNextActions()
// next_action_date <= 오늘인 contacts 목록

// 렌더링
{overdueActions.length > 0 && (
  <Section title="연락할 것">
    {overdueActions.map(contact => (
      <ContactActionRow
        key={contact.id}
        contact={contact}
        // 다음 액션 날짜, 메모, D-day 표시
      />
    ))}
  </Section>
)}
```

**ContactActionRow UI:**
```
👤 김철수 · 삼성전자
   "견적 재검토 미팅 잡기"
   D+1 초과                    [연락처 이동 →]
```

---

## 8. 중복 감지 로직

연락처 등록 시 클라이언트 측 체크:
```typescript
// ContactForm.tsx
const isDuplicate = contacts.some(c =>
  c.name === name && c.email === email && email !== ''
)
if (isDuplicate) {
  // "동일한 이름+이메일의 연락처가 있습니다" 경고 표시
  // 취소 또는 그래도 저장 선택
}
```

---

## 9. 구현 순서

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | Supabase SQL | companies, contacts, activities 테이블 생성 + RLS |
| 2 | Supabase SQL | posts, tasks에 contact_id 컬럼 추가 |
| 3 | `src/types/index.ts` | Company, Contact, Activity, ActivityType 타입 추가 |
| 4 | `src/hooks/useCRM.ts` | contacts, companies CRUD 훅 |
| 5 | `src/hooks/useActivities.ts` | activities CRUD 훅 |
| 6 | `src/app/(main)/layout.tsx` | NAV_ITEMS에 /crm 추가 |
| 7 | `src/app/(main)/crm/page.tsx` | 연락처 목록 페이지 ([사람]/[회사] 탭) |
| 8 | `src/components/crm/ContactForm.tsx` | 연락처 등록/수정 모달 |
| 9 | `src/components/crm/CompanyForm.tsx` | 회사 등록/수정 모달 |
| 10 | `src/app/(main)/crm/contacts/[id]/page.tsx` | 연락처 상세 페이지 |
| 11 | `src/components/crm/ActivityTimeline.tsx` | 활동 타임라인 |
| 12 | `src/components/crm/ActivityForm.tsx` | 활동 추가 폼 (인라인) |
| 13 | `src/app/(main)/today/page.tsx` | "연락할 것" 섹션 추가 |

---

## 10. 다크모드 처리

기존 앱의 `dark:` 클래스 패턴 그대로 적용:

```tsx
// 예시 — ContactCard
<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{name}</h3>
  <p className="text-xs text-gray-500 dark:text-gray-400">{role}</p>
</div>
```
