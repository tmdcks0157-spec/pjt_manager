# Plan: meeting-notes — 회의록 앱

> 상태: **Plan 확정** — 2026-06-25
> 위치: pjt-manager 내 `/meetings` 섹션 추가 (신규 레포 없음)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| **Problem** | 회의 노트가 산발적으로 흩어지고, 액션 아이템이 회의록에 묻혀 누락되며, 회의 전 준비와 회의 후 실행이 단절된다 |
| **Solution** | pjt-manager 내 `/meetings` 섹션으로 회의 전 안건 → 회의 중 마크다운 메모 → 회의 후 액션 아이템 → 태스크 내보내기까지 원스톱 처리 |
| **Function UX Effect** | 3열 레이아웃(캘린더+정보 \| 메모 \| 액션)으로 전체 페이지 활용, 타이머 상단 고정, 이전 회의 미완료 액션 이월 옵션 |
| **Core Value** | 회의에서 나온 결정과 액션이 즉시 pjt-manager 태스크로 연결 — CRM 연락처·프로젝트 인프라 재사용으로 별도 앱 없이 통합 관리 |

---

## 1. 기능 개요

### 1.1 핵심 플로우

```
회의 전     → 제목·날짜·참석자·안건 설정
회의 중     → 타이머 작동 + 마크다운 메모 + 안건 체크
회의 후     → 액션 아이템 정리 → pjt-manager 태스크 내보내기
다음 회의   → 이전 회의 미완료 액션 이월 옵션
```

### 1.2 Phase 범위

**Phase 1 (현재 구현):**
- `/meetings` 목록 페이지 (미니 캘린더 + 날짜별 리스트)
- `/meetings/[id]` 상세 페이지 (3열 레이아웃)
- 타이머 (시작/종료, duration 자동 기록)
- 마크다운 메모 (편집/미리보기 탭)
- 안건 체크리스트
- 액션 아이템 (수동 추가, 담당자/기한, 태스크 내보내기)
- 이전 회의 미완료 액션 이월
- CRM contacts 참석자 자동완성
- 사이드바 "회의록" 메뉴 추가

**Phase 2 (추후):**
- AI (Claude API 요약 + 액션 자동 추출)
- 정기 회의 (recurring 연동)
- 회의 유형 템플릿 (스탠드업, 1:1 등)
- 월간 회의 시간 통계

---

## 2. DB 스키마

### 2.1 meetings

```sql
CREATE TABLE public.meetings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL,
  date             TIMESTAMPTZ NOT NULL,
  duration_minutes INT         DEFAULT NULL,          -- 타이머 종료 시 기록
  status           TEXT        NOT NULL DEFAULT 'scheduled'
                               CHECK (status IN ('scheduled','in_progress','completed')),
  agenda           JSONB       DEFAULT '[]',           -- [{id, text, done}]
  notes            TEXT        DEFAULT '',             -- 마크다운 원문
  project_id       UUID        DEFAULT NULL,           -- pjt-manager 프로젝트 연결
  started_at       TIMESTAMPTZ DEFAULT NULL,           -- 타이머 시작 시각
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);
```

### 2.2 meeting_attendees

```sql
CREATE TABLE public.meeting_attendees (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id   UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  contact_id   UUID DEFAULT NULL,   -- CRM contacts 연결 (optional)
  name         TEXT NOT NULL,
  email        TEXT DEFAULT NULL,
  role         TEXT DEFAULT 'attendee' CHECK (role IN ('organizer','attendee')),
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

### 2.3 action_items

```sql
CREATE TABLE public.action_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id           UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL,
  text                 TEXT NOT NULL,
  assignee_name        TEXT DEFAULT NULL,
  assignee_contact_id  UUID DEFAULT NULL,
  due_date             DATE DEFAULT NULL,
  status               TEXT DEFAULT 'open' CHECK (status IN ('open','done')),
  exported_task_id     TEXT DEFAULT NULL,   -- pjt-manager task id
  created_at           TIMESTAMPTZ DEFAULT now(),
  updated_at           TIMESTAMPTZ DEFAULT now()
);
```

### 2.4 RLS

```sql
-- meetings: user_id 기준
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetings_owner" ON meetings USING (auth.uid() = user_id);

-- meeting_attendees: meetings 통해 owner 확인
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendees_owner" ON meeting_attendees
  USING (EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND m.user_id = auth.uid()));

-- action_items: user_id 기준
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "action_items_owner" ON action_items USING (auth.uid() = user_id);
```

---

## 3. UI/UX 스펙

### 3.1 목록 페이지 `/meetings`

```
┌──────────────────────────────────────────────────────────────┐
│ 회의록                                        [+ 새 회의]   │
├──────────────────────┬───────────────────────────────────────┤
│   미니 캘린더         │  날짜별 회의 리스트                  │
│                      │                                       │
│  < 2026년 6월 >      │  오늘 (06/25)                        │
│  일 월 화 수 목 금 토 │   ● Q1 전략 회의  14:00  🟡 진행중  │
│   1  2  3  4  5  6  7│   ○ 팀 스탠드업   09:00  ✅ 완료    │
│   8  9 10 11 12 13 14│                                       │
│  15 16 17 18 19 20 21│  이번 주                              │
│  22 23 24●[25]●26 27 │   ○ 클라이언트 미팅  화 10:00  📅예정 │
│  29  30              │                                       │
│                      │  지난 주                              │
│  ● = 회의 있는 날    │   ○ 팀 회고        목  완료          │
│                      │                                       │
│  이번 달 통계        │                                       │
│  총 7회 · 8.5시간    │                                       │
└──────────────────────┴───────────────────────────────────────┘
```

- 미니 캘린더: 날짜별 회의 점(dot) 표시, 날짜 클릭 시 해당일 필터
- 리스트: 날짜 그룹핑 (오늘 / 이번 주 / 지난 주 / 이번 달)
- 상태 뱃지: 📅 예정 / 🟡 진행중 / ✅ 완료

### 3.2 상세 페이지 `/meetings/[id]`

```
┌──────────────────────────────────────────────────────────────────┐
│ ◀ 목록   Q1 전략 회의                      ▶ 00:23:41  [■ 종료]│
├─────────────────────┬───────────────────────────┬────────────────┤
│ 왼쪽 (22%)         │ 중앙 (48%)                 │ 오른쪽 (30%)  │
│                     │                            │                │
│  < 2026년 6월 >     │ 📋 안건                    │ ✅ 액션 아이템 │
│  일 월 화 수 목 금 토│  ☑ 예산 논의               │                │
│   ...  [25]  ...   │  ☐ Q1 로드맵               │ ⚠️ 이전 미완료 │
│                     │  ☐ 팀 빌딩   [+ 안건]      │ 2건 이월하기?  │
│ ─────────────────── │ ──────────────────────── ─│                │
│ 📅 2026/06/25       │                            │ □ 예산안 작성  │
│    14:00            │ ## 결정사항                │   박지수  1/15 │
│ 👥 박지수           │                            │   [→ 태스크]   │
│    이민준           │ - Q1 예산 확정             │                │
│    [+ 추가]         │ - 마케팅 방향 결정         │ □ 로드맵 PPT   │
│                     │                            │   이민준  1/20 │
│ 📁 pjt-manager      │ ## 논의 내용               │   [→ 태스크]   │
│                     │                            │                │
│                     │ ...                        │ [+ 추가]       │
│                     │                            │                │
│                     │      [편집 │ 미리보기]      │                │
└─────────────────────┴───────────────────────────┴────────────────┘
```

**열 구성:**
| 열 | 너비 | 내용 |
|----|------|------|
| 왼쪽 | ~22% | 미니 캘린더 + 회의 기본 정보 (날짜/참석자/프로젝트) |
| 중앙 | ~48% | 안건 체크리스트 + 마크다운 메모 |
| 오른쪽 | ~30% | 액션 아이템 패널 |

### 3.3 타이머

- 상태 `scheduled` → [▶ 회의 시작] 버튼
- 시작 클릭: `started_at = now()`, `status = in_progress`, 타이머 카운트업
- [■ 종료]: `duration_minutes` 자동 계산, `status = completed`
- 타이머는 상단 헤더 바에 고정 표시

### 3.4 마크다운 메모

- `textarea` (편집 탭) ↔ `react-markdown` 렌더링 (미리보기 탭) 토글
- `notes` 컬럼에 마크다운 원문 저장
- 자동 저장: 1초 debounce

### 3.5 액션 아이템

- 인라인 추가 폼: 텍스트 + 담당자(자유 입력 또는 CRM) + 기한
- [→ 태스크] 버튼: `tasks` 테이블에 INSERT, `exported_task_id` 기록
- 완료 체크 시 `status = done`

### 3.6 이전 회의 미완료 액션 이월

- 같은 프로젝트의 직전 회의 중 `status = open` 인 action_items 조회
- 새 회의 생성 또는 첫 진입 시 이월 여부 토스트/배너로 제안
- 이월 선택 시 해당 action_items 복사 (원본 유지)

### 3.7 참석자

- CRM contacts 자동완성 (기존 `useContacts` 훅 재사용)
- contacts 없는 경우 이름 자유 입력
- 추가 후 칩(chip) 형태로 표시

---

## 4. 컴포넌트 구조

```
src/app/(main)/meetings/
  ├─ page.tsx                    # 목록 (미니 캘린더 + 리스트)
  └─ [id]/
      └─ page.tsx                # 상세 (3열 레이아웃)

src/components/meetings/
  ├─ MeetingMiniCalendar.tsx     # 미니 캘린더 (날짜 dot + 필터)
  ├─ MeetingListItem.tsx         # 목록 카드
  ├─ MeetingTimer.tsx            # 타이머 (카운트업)
  ├─ MeetingAgenda.tsx           # 안건 체크리스트
  ├─ MeetingNotes.tsx            # 마크다운 편집/미리보기
  ├─ MeetingAttendees.tsx        # 참석자 (CRM 자동완성)
  └─ ActionItemPanel.tsx         # 액션 아이템 패널
```

---

## 5. pjt-manager 연동

| 연동 대상 | 방법 |
|-----------|------|
| 참석자 | `contacts` 테이블 재사용 (`useContacts` 훅) |
| 프로젝트 연결 | `projects` 테이블 FK |
| 태스크 내보내기 | `tasks` 테이블 INSERT (project_id, title, due_date) |
| 사이드바 메뉴 | 기존 사이드바에 "회의록" 항목 추가 |

---

## 6. 마이그레이션

파일: `supabase/migrations/0007_meeting_notes.sql`

```sql
-- meetings, meeting_attendees, action_items 테이블 생성
-- RLS 정책 적용
-- updated_at 트리거 (기존 패턴 재사용)
```

---

## 7. 제약사항

- `react-markdown` 패키지 필요 (설치 여부 확인)
- 실시간 공동 편집 미지원 (Phase 2 이후 Supabase Realtime)
- 타이머는 로컬 state 기반 (페이지 새로고침 시 started_at으로 재계산)

---

## 8. Phase 2 백로그

| 기능 | 설명 |
|------|------|
| AI 요약 | Claude API: 메모 → 결정사항 3줄 + 액션 자동 추출 |
| 정기 회의 | recurring-tasks 테이블 연동, 매주/매월 자동 생성 |
| 회의 템플릿 | 스탠드업 / 1:1 / 클라이언트 / 브레인스토밍 |
| 월간 통계 | 회의 수·시간 차트, 액션 완료율 |
