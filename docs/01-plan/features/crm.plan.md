# Plan: CRM — 연락처 & 활동 관리

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 업무·개인 관계에서 연락한 사람들의 정보와 대화 이력이 카카오톡·메일·메모장에 흩어져 있어, "이 사람이랑 언제 뭘 얘기했더라"를 매번 뒤져야 한다 |
| **Solution** | 기존 앱 안에 CRM 섹션 추가 — 연락처(사람+회사) 관리 + 활동 타임라인 + 기존 이슈&기록(posts) 연결로 메모 게시판 역할까지 |
| **Function UX Effect** | 연락처 상세 페이지 한 곳에서 기본 정보·활동 이력·관련 메모·연결된 칸반 태스크를 모두 조회, 다음 액션 예약으로 follow-up 누락 방지 |
| **Core Value** | "사람 중심으로 업무를 기억하는 도구" — 복잡한 자동화 없이 관계와 기록에 집중 |

---

## 1. 현황 분석

### 기존 앱에서 재활용 가능한 것

| 항목 | 재활용 방법 |
|------|------------|
| `posts` 테이블 (이슈&기록) | `contact_id` 컬럼 추가 → 연락처별 메모 게시판으로 사용 |
| `tasks` 테이블 (칸반) | `contact_id` 컬럼 추가 → 태스크 ↔ 연락처 연결 |
| Supabase 백엔드 | 동일 프로젝트에 새 테이블 3개 추가 |
| 사이드바 내비게이션 | CRM 메뉴 항목 추가 |
| `cn()`, `lucide-react`, React Query | 그대로 활용 |

### 새로 만들어야 하는 것

| 항목 | 설명 |
|------|------|
| `companies` 테이블 | 회사/조직 정보 |
| `contacts` 테이블 | 사람 정보 + 회사 연결 |
| `activities` 테이블 | 활동 타임라인 (통화/이메일/미팅/메모) |
| `/crm` 페이지 | 연락처 목록 |
| `/crm/contacts/[id]` 페이지 | 연락처 상세 (탭 3개) |

---

## 2. 기능 범위

### 결정된 설계 방향

| 항목 | 결정 |
|------|------|
| 연락처 목록 보기 | 탭 전환 (사람 탭 / 회사 탭) |
| 다음 액션 알림 위치 | Today 페이지 + CRM 페이지 모두 |
| 활동 기록 날짜 | 오늘 날짜 기본값, 변경 가능 |
| 개인 연락처 (회사 없음) | 지원 — 회사 연결은 선택사항 |

### 2.1 연락처 관리

| 기능 | 상세 |
|------|------|
| 회사 등록/수정/삭제 | 이름, 업종, 홈페이지, 메모 |
| 사람 등록/수정/삭제 | 이름, 이메일, 전화번호, 직함, 소속 회사(선택), 메모 |
| 개인 연락처 지원 | 회사 없이 개인만 등록 가능 (자주 사용) |
| 목록 보기 탭 | [사람] 탭 / [회사] 탭 전환 |
| 태그 | 배열 형태 (예: `["VIP", "기술", "재계약"]`) |
| 전체 검색 | 이름·회사명·이메일로 빠른 검색 |
| 중복 감지 | 이름+이메일 조합이 동일하면 등록 시 경고 |

### 2.2 활동 타임라인

| 기능 | 상세 |
|------|------|
| 활동 유형 | 📞 통화 / 📧 이메일 / 🤝 미팅 / 📝 메모 |
| 활동 기록 | 날짜(오늘 기본값), 제목, 내용(긴 메모 가능) |
| 다음 액션 | 날짜 + 내용 예약 (연락처별 1개) |
| 다음 액션 Today 연동 | Today 페이지 "연락할 것" 섹션 + CRM 목록 상단 배너 모두 표시 |

### 2.3 메모 게시판 (기존 posts 재활용)

| 기능 | 상세 |
|------|------|
| 연락처별 이슈&기록 | `posts.contact_id`로 연결, 기존 UI 컴포넌트 재사용 |
| 게시판 탭 | 연락처 상세 페이지 내 [이슈&기록] 탭 |
| 기존 이슈&기록 페이지 연동 | 프로젝트 기록에 연락처 뱃지 표시 옵션 |

### 2.4 칸반 태스크 연결

| 기능 | 상세 |
|------|------|
| 태스크 → 연락처 연결 | 태스크 상세 모달에서 연락처 선택 |
| 연락처 상세 → 태스크 목록 | [연결된 태스크] 탭에서 확인 및 이동 |
| 칸반 카드 뱃지 | 연결된 연락처 이름 소형 뱃지 표시 |

---

## 3. DB 스키마

### 새 테이블

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

-- 연락처 (사람)
CREATE TABLE contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  company_id  uuid REFERENCES companies(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text,
  phone       text,
  role        text,         -- 직함/역할
  notes       text,
  tags        text[] DEFAULT '{}',
  next_action_date  date,
  next_action_note  text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 활동 기록
CREATE TABLE activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users NOT NULL,
  contact_id  uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  type        text NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note')),
  title       text NOT NULL,
  body        text,
  activity_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now()
);
```

### 기존 테이블 변경

```sql
-- posts에 contact_id 추가
ALTER TABLE posts ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;

-- tasks에 contact_id 추가
ALTER TABLE tasks ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
```

---

## 4. 페이지 구조

```
/crm
├── 전체 연락처 목록
│   ├── 검색바
│   ├── 회사별 그룹 보기 / 전체 보기 전환
│   └── 연락처 카드 (이름, 회사, 마지막 활동, 다음 액션 D-day)
│
└── /crm/contacts/[id]
    ├── 헤더 (이름, 회사, 직함, 연락처 정보, 태그, 다음 액션)
    └── 탭
        ├── [활동 타임라인] — 날짜순 활동 목록 + 추가 버튼
        ├── [이슈 & 기록]   — posts 재활용 (contact_id 필터)
        └── [연결된 태스크] — tasks 재활용 (contact_id 필터)
```

---

## 5. 사이드바 메뉴 추가

```
기존 NAV_ITEMS에 추가:
{ href: '/crm', label: '연락처', icon: Users }
```

---

## 6. Today 페이지 연동

`contacts.next_action_date`가 오늘 이하인 항목을 Today 페이지에 표시:

```
📋 처리할 것
├── 오늘 일정
├── 오늘 마감
├── 기한 초과
├── 긴급 태스크
└── 연락할 것 (CRM)  ← 새로 추가
    └── 김철수 · 삼성전자 — "견적 재검토 미팅" D+1 초과
```

---

## 7. 구현 순서

| 순서 | 작업 | 예상 복잡도 |
|------|------|------------|
| 1 | Supabase 테이블 생성 (SQL 실행) | 낮음 |
| 2 | TypeScript 타입 추가 (`types/index.ts`) | 낮음 |
| 3 | `/crm` 연락처 목록 페이지 | 중간 |
| 4 | `/crm/contacts/[id]` 상세 페이지 (탭 구조) | 높음 |
| 5 | 활동 타임라인 + 활동 추가 폼 | 중간 |
| 6 | 이슈&기록 탭 (posts 재활용) | 낮음 |
| 7 | 칸반 태스크 연결 (모달 + 뱃지) | 중간 |
| 8 | Today 페이지 "연락할 것" 섹션 | 낮음 |
| 9 | 사이드바 메뉴 추가 | 낮음 |

---

## 8. 미포함 범위 (v1)

- 이메일 자동 연동 (Gmail 등)
- 영업 파이프라인
- 자동화 워크플로우
- 파일 첨부
- 팀 공유·권한 관리
